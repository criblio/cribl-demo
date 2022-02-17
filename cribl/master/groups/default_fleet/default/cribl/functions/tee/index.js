const { spawn } = require('child_process');
const cLogger = C.util.getLogger('func:tee');


let proc;
let hasFatalError = false;
let lastEvent;
let hasWrittenHeader;
let restartProm;
let unloading;

exports.name = 'Tee';
exports.version = '0.2';
exports.group = 'Advanced';

// time to wait before restarting a process
const RESTART_DELAY = 5000;
const RESTART_CODES = ['EPIPE', 'ERR_STREAM_DESTROYED', 'ERR_STREAM_WRITE_AFTER_END'];
function handleWriteError(error, conf) {
  // handle errors mostly originated when trying to write to child process's stdin

  if (restartProm)
    // restart in progress
    return;

  if (!hasWrittenHeader) {
    // failed to spawn process, process does not support input via stdin, failed to kill process, etc.
    cLogger.error(`write error. failed to write header.`, { error, command: conf.command, args: conf.args });
    hasFatalError = true;
    // exit event handler to handle this
    return;
  }

  cLogger.error(`write error.`, { error, pid: conf.pid, command: conf.command, args: conf.args });
  const reason = `Error: code=${error.code}, message=${error.message}`;
  const event = lastEvent;

  if (!error.code || RESTART_CODES.includes(error.code) || error.message === 'write after end') {
    hasFatalError = true;
    if (conf.restartOnExit) {
      restartProcesss(conf, reason)
        .then(() => new Promise((resolve) => {
          if (event) {
            Promise.resolve(exports.process(event, true)).then(resolve);
          } else {
            // error was before any event was processed
            resolve();
          }
        }))
        .catch(err => {});
    } else {
      killProcess(reason);
    }
  }
}

function handleProcessError(error, conf) {
  // handle child process's errors here, such as failing to spawn the process
  // non restartable errors 
  cLogger.error('process error', { error, pid: conf.pid, command: conf.command, args: conf.args });
  const reason = `Error: code=${error.code}, message=${error.message}`;
  killProcess(reason);
}

function handleProcessExit(code, signal, conf) {
  if ((code > 0 && conf.restartOnExit) || (code === 0 && conf.restartOnExit && hasWrittenHeader)) {
    // case 1 - exited with error and needs restart
    // case 2 - exited successfully but needs restart
    cLogger.info('process exited, attempting to restart it.', { pid: conf.pid, conf, code, signal });
    restartProcesss(conf, 'restarting after error.').catch(() => {});
  } else {
    cLogger.info('process exited', { pid: conf.pid, conf, code, signal });
  }
}

function writeHeader() {
  if (proc && proc.pid && proc.stdin) {
    // if the child process fails to spawn, its PID is set to undefined

    // best effort to track down whether the header was written or not.
    // call to write will return false if the stream is not writable.
    // however, chances are that it returns true but the callback is then called with an error-
    hasWrittenHeader = proc.stdin.write(`${JSON.stringify({ format: 'json', conf: proc.conf })}\n`, 'utf8', (err) => {
      // failed to write header
      if (err) hasWrittenHeader = false;
    });
  }
}

function startProcess(conf, reason) {
  const env = Object.assign({}, process.env, (conf.env || {}));
  const procConf = Object.assign({}, conf);
  proc = spawn(conf.command, conf.args || [], { stdio: ['pipe', 'ignore', 'ignore'], env });
  proc.conf = procConf;
  procConf.pid = proc.pid;
  cLogger.info('starting tee process', { reason, pid: proc.pid, conf: proc.conf });
  proc.on('error', (err) => handleProcessError(err, procConf));
  proc.stdin.on('error', (err) => handleWriteError(err, procConf));
  proc.on('exit', (code, signal) => handleProcessExit(code, signal, procConf));
  hasFatalError = false;
  // attempt to write the header on init
  writeHeader();
}

function restartProcesss(conf, reason) {
  if (unloading) return Promise.reject();
  if (restartProm) return restartProm;
  cLogger.info(`restarting process in ${getRestartDelay()}ms`, { reason, pid: proc.pid, conf: proc.conf });
  restartProm = new Promise(resolve => setTimeout(() => {
    killProcess('restart');
    startProcess(conf, 'restart');
    restartProm = undefined;
    resolve();
  }, getRestartDelay()));
  return restartProm;
}

function killProcess(reason) {
  if (proc) {
    proc.removeListener('exit', handleProcessExit);
    proc.removeListener('error', handleProcessError);
    proc.stdin.removeListener('error', handleWriteError);

    cLogger.info('killing tee process', { reason, pid: proc.pid, conf: proc.conf });

    proc.stdin.end();
    proc.stdin.emit('drain'); // unblock a potential last writes that could be waiting for a drain event
    proc.kill();
    proc = null;
    hasWrittenHeader = false;
  }
}

function getRestartDelay() {
  return process.env.NODE_ENV === 'test' ? 1  : RESTART_DELAY;
}

exports.init = (opts) => {
  const conf = opts.conf || {};
  unloading = false;

  if (!conf.command) {
    cLogger.error('missing required conf field, "command"', { conf });
    return;
  }

  startProcess(conf, 'init');
};

exports.unload = () => {
  unloading = true;
  killProcess('unload');
  lastEvent = undefined;
  hasWrittenHeader = false;
};


exports.process = (event) => {
  if (!event) return event;
  lastEvent = event; // resend in case of error
  if (proc && !restartProm && !hasFatalError && hasWrittenHeader) {
    if(proc.killed) {
      handleWriteError(new Error('process has died'), {...proc.conf, pid: proc.pid});
    } else {
      const canWriteMore = proc.stdin.write(`${event.asJSON()}\n`);
      if (!canWriteMore) {
        return new Promise((resolve) => {
          proc.stdin.once('drain', () => resolve(event));
        })
        .catch((err) => {})
      }
    }
  }
  return event;
};

//// test only ///
exports.UT_getProc = () => proc;
