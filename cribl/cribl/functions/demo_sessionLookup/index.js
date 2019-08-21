exports.disabled = 0;
exports.name = 'Redis Lookup';
exports.version = 0.1;
exports.group = 'Demo Functions';

let conf;
const sessions = {};

const fs = require('fs');
const path = require('path');

// const dLogger = C.util.getLogger('sessionLookup');

exports.init = (opt) => {
  conf = (opt || {}).conf || {};

  const sessionCsvPath = path.resolve(__dirname, 'session.csv');
  // dLogger.info(`opening ${sessionCsvPath}`);
  const sessionLines = fs.readFileSync(sessionCsvPath, 'utf8');
  sessionLines.split('\n').forEach(l => {
    const parts = l.split(',');
    sessions[parts[1]] = parts[0];
  });
  // dLogger.info(`sessions: ${JSON.stringify(sessions)}`);
  // dLogger.info(`conf: ${JSON.stringify(conf)}`);
};


exports.process = (event) => {
  if (event[conf.fromField]) {
    if (sessions[event[conf.fromField]]) {
      event[conf.toField] = sessions[event[conf.fromField]];
    }
  }
  return event;
};

