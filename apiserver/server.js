let conf;
const customers = {};
let fields = [];

const fs = require('fs');
const path = require('path');

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

app.get('/users/:userName', (req, res) => {
  if (!req.params.userName) {
    res.status(500).send('userName param missing');
    return;
  }

  const cust = customers[req.params.userName];

  if (!cust) {
    res.status(404).send(`${req.params.userName} not found`);
    return;
  }

  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(cust));
  return;
});

app.listen(port, () => console.log(`api server listening on port ${port}!`));
