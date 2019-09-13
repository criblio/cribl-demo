let conf;
const customers = {};
const cache = {};
let fields = [];

const fs = require('fs');
const path = require('path');
const os = require('os');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apiserver'));

const customersCsvPath = path.resolve(__dirname, '../data/customer_master_small.csv');
const customerLines = fs.readFileSync(customersCsvPath, 'utf8');
customerLines.split('\n').forEach((l, idx) => {
  const parts = l.split(',');
  if (idx === 0) {
    fields = parts;
  } else {
    // Last field is username and what we want to lookup against
    customers[parts[parts.length - 1]] = parts.reduce((prev, cur, ridx) => { prev[fields[ridx]] = cur; return prev; }, {});
  }
});


const express = require('express');
const morgan = require('morgan');
const app = express();
const port = 3000;

// app.use(morgan('short'));

function getAndIncrAccessCount(userName) {
  let accountCount;
  let file;
  const cacheFile = cache[userName];
  let ret = Promise.resolve();
  if (cacheFile) {
    ret = ret.then(() => cacheFile);
  } else {
    ret = ret.then(() => {
      const fileName = path.join(tmpDir, userName);
      return new Promise((resolve, reject) => {
        fs.open(fileName, 'w+', 0o600, (err, f) => {
          if (err) {
            return reject(new Error(`error opening file: ${err.message}`));
          }
          return resolve(f);
        });
      });
    });
  }
  return ret.then((f) => {
    if (f === undefined) {
      throw new Error('f is undefined');
    }
    file = f;
    cache[userName] = f;
    const b = Buffer.alloc(4);
    return new Promise((resolve, reject) => {
      fs.read(file, b, 0, 4, 0, (err, bytesRead, b) => {
        if (err) return reject(err);
        resolve({ bytesRead, buffer: b });
        return;
      });
    });
  })
  .then((readOut) => {
    accessCount = 0;
    if (readOut.buffer.length === 4) {
      accessCount = readOut.buffer.readUInt32LE(0);
    }
    accessCount++;
    const writeBuf = Buffer.from(readOut.buffer);
    const written = writeBuf.writeUInt32LE(accessCount, 0);
    if (written !== 4) {
      throw new Error('expected to write 4 bytes to buffer');
    }
    return new Promise((resolve, reject) => {
      fs.write(file, writeBuf, 0, 4, 0, (err, bytesWritten, b) => {
        if (err) return reject(err);
        resolve({ bytesWritten, buffer: b });
        return;
      });
    });
  })
  .then((writeOut) => {
    if (writeOut.bytesWritten !== 4) {
      throw new Error('expected to write 4 bytes');
    }
    return accessCount;
  })
}

app.get('/users/:userName', (req, res, next) => {
  const userName = req.params.userName;
  if (!userName) {
    res.status(400).send('userName param missing');
    return;
  }

  // Validate for invalid characters
  if (/[^-_.A-Za-z0-9]/.test(userName)) {
    res.status(400).send('invalid userName');
    return;
  }

  const cust = customers[userName];

  if (!cust) {
    res.status(404).send(`${userName} not found`);
    return;
  }

  res.setHeader('Content-Type', 'application/json');

  getAndIncrAccessCount(userName)
    .then((accessCount) => {
      cust.accessCount = accessCount;
      res.send(JSON.stringify(cust));
      next();
    })
    .catch((error) => {
      console.error(error);
      res.status(500).send(error.message);
      next();
    });
  return;
});

app.get('/', (req, res, next) => {
  res.send('Nothing here');
  next();
});

app.listen(port, () => console.log(`api server listening on port ${port}!`));
