const { spawn } = require('child_process');

const cLogger = C.util.getLogger('func:tee');


let proc;
let hasFatalError = false;
let lastEvent;

exports.name = 'Tee';
exports.version = '0.1';
exports.group = 'Advanced';


const RESTART_CODES = ['EPIPE', 'ERR_STREAM_DESTROYED', 'ERR_STREAM_WRITE_AFTER_END'];
function handleWriteError(error) {
  cLogger.error('write error', { error });
  const event = lastEvent;
  if (!error.code || RESTART_CODES.includes(error.code) || error.message === 'write after end') {
    hasFatalError = true;
    const conf = proc.conf;
    if (conf.restartOnExit) {
      const reason = `Error: code=${error.code}, message=${error.message}`;
      return new Promise(resolve => {
        killProcess(reason);
        startProcess(conf, reason);
        Promise.resolve(exports.process(event, true)).then(resolve);
      });
    }
  }
  return event;
}

function startProcess(conf, reason) {
  const env = Object.assign({}, process.env, (conf.env || {}));
  proc = spawn(conf.command, conf.args || [], { stdio: ['pipe', 'ignore', 'ignore'], env });
  proc.conf = conf;
  cLogger.info('starting tee process', { reason, pid: proc.pid, conf: proc.conf });
  proc.stdin.on('error', handleWriteError);
  proc.stdin.write(`${JSON.stringify({ format: 'json', conf })}\n`);
  hasFatalError = false;
}

function killProcess(reason) {
  if (proc) {
    cLogger.info('killing tee process', { reason, pid: proc.pid, conf: proc.conf });
    proc.stdin.end();
    proc.stdin.emit('drain'); // unblock a potential last writes that could be waiting for a drain event
    proc.kill();
    proc = null;
  }
}

exports.init = (opts) => {
  const conf = opts.conf || {};

  if (!conf.command) {
    cLogger.error('missing required conf field, "command"', { conf });
    return;
  }

  startProcess(conf, 'init');
};

exports.unload = () => {
  killProcess('unload');
};


exports.process = (event) => {
  lastEvent = event; // resend in case of error
  if (event && proc && !hasFatalError) {
    proc._lastEvent = event;
    const canWriteMore = proc.stdin.write(`${event.asJSON()}\n`);
    if (!canWriteMore) {
      return new Promise((resolve) => {
        proc.stdin.once('drain', () => resolve(event));
      });
    }
  }
  return event;
};

//// test only ///
exports.getProc = () => proc;
