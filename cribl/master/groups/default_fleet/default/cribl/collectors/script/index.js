const { Expression, PartialEvalRewrite } = C.expr;

exports.name = 'Script';
exports.version = '0.1';
exports.disabled = false;
exports.destroyable = false;

const os = require('os');
const { spawn } = require('child_process');
const { constants, promises } = require('fs');
const {pipe, SpawnGenerator, } = C.internal.Generators;
const {scopedResource } = C.internal;


const accessAsync = promises.access;

const host = os.hostname();

let conf;
let batchSize;
let filter;
const requiredFields = ['host', 'source'];

exports.init = async (opts) => {
  conf = opts.conf;
  batchSize = conf.maxBatchSize || 10;
  filter = conf.filter || 'true';
  //TODO: do some arg validation here ...
  return Promise.resolve();
};


exports.discover = async (job) => {
  const filterExpr = new Expression(filter, {
    disallowAssign: true,
    partialEval: new PartialEvalRewrite((field) => !requiredFields.includes(field)),
  });

  const shellCmd = conf.shell || '/bin/bash';

  try {
    await accessAsync(shellCmd, constants.X_OK);
  } catch (err) {
    throw new Error(`Invalid shell, code: ${err.code}, errno: ${err.errno}, reason: ${err.message}`);
  }

  const spawnGen = new SpawnGenerator({ shell: shellCmd, cmd: conf.discoverScript });

  try {
    await scopedResource(
      pipe(spawnGen)
        .byLines()
        .map((line) => ({ host, source: line.trim() }))
        .filteredBy(filterExpr)
        .byChunksOf(batchSize)
        .execute(),
      async (gen) => {
        for await (const results of gen) {
          await job.addResults(results);
        }
      }
    );
  } catch (error) {
    if (error.code != null) {
      job.logger().error('discover script failed', { exitCode: error.code, stderr: error.message });
      const _error = C.internal.TaskError.createError({ code: getTypeFromCode(error.code), errorInfo: error });
      throw _error;
    }
    throw error;
  }
};

const errorCode2type = {
  1: 'TASK_FATAL',
  2: 'TASK_FATAL',
  3: 'TASK_RETRYABLE',
  4: 'JOB_FATAL',
};
function getTypeFromCode(code) {
  return code in errorCode2type ? errorCode2type[code] : 'TASK_FATAL';
}
const STDERR_SIZE = 1024;
exports.collect = async (collectible, job) => {
  const env = { ...process.env, CRIBL_COLLECT_ARG: collectible.source };
  job.logger().debug('starting collect script', { source: collectible.source });
  const proc = spawn(conf.shell || '/bin/bash', { env });
  proc.stdin.end(conf.collectScript);
  let errStr = '';
  let lastErr = '';
  proc.stderr.on('data', (errInfo) => {
    errStr += errInfo;
    errStr = errStr.slice(STDERR_SIZE);
    const str = lastErr + errInfo;
    lastErr = str.slice(-STDERR_SIZE);
  });
  proc.on('exit', code => {
    if (code) {
      const msg = 'collect task failed';
      job.reportError(C.internal.TaskError.createError({ type: getTypeFromCode(code), errorInfo: new Error(errStr + lastErr) }));
      job.logger().error(msg, { exitCode: code, source: collectible.source, error: errStr.toString() });
    } else job.logger().info('collect task completed', { exitCode: code, source: collectible.source });
  });
  return Promise.resolve(proc.stdout);
};
