exports.disabled = 0;
exports.name = 'REST Lookup';
exports.version = 0.1;
exports.group = 'Demo Functions';

let conf;
const customers = {};
let fields = [];

const fs = require('fs');
const path = require('path');

// Hard coding from field because we're pretending to be a REST lookup
const FROM_FIELD = 'userName';

const dLogger = C.util.getLogger('sessionLookup');

exports.init = (opt) => {
  conf = (opt || {}).conf || {};

  const customersCsvPath = path.resolve(__dirname, '../../../../gogen_assets/samples/customer_master_small.csv');
  // dLogger.info(`opening ${customersCsvPath}`);
  const customerLines = fs.readFileSync(customersCsvPath, 'utf8');
  customerLines.split('\n').forEach((l, idx) => {
    const parts = l.split(',');
    if (idx === 0) {
      fields = parts;
      // dLogger.info(`Fields: ${JSON.stringify(fields)}`);
    } else {
      // Last field is username and what we want to lookup against
      customers[parts[parts.length - 1]] = parts.reduce((prev, cur, ridx) => { prev[fields[ridx]] = cur; return prev; }, {});
    }
  });
  dLogger.info(`one cust: ${JSON.stringify(customers[Object.keys(customers)[0]])}`);
  // dLogger.info(`conf: ${JSON.stringify(conf)}`);
};


exports.process = (event) => {
  const cust = customers[event[FROM_FIELD]];
  if (cust) {
    Object.assign(event, cust);
  }
  return event;
};

