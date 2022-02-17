/* eslint-disable no-await-in-loop */
exports.name = 'Filesystem';
exports.version = '0.1';
exports.disabled = false;
exports.destroyable = true;

const fs = require('fs');
const os = require('os');
const _path = require('path');

let dir;
let recurse;
let extractors;
let filter;
let provider;
let batchSize;

exports.init = (opts) => {
  const conf = opts.conf;
  const path = conf.path;
  dir = path && path.startsWith('~/') ? path.replace('~', os.homedir()) : path;
  if (dir == null) return Promise.reject(new Error('path is required'));
  dir = C.util.resolveEnvVars(dir);
  dir = _path.resolve(dir);
  recurse = conf.recurse || false;
  if (conf.extractors) {
    extractors = {};
    const { Expression } = C.expr;
    conf.extractors.forEach(pair => {
      extractors[pair.key] = new Expression(pair.expression);
    });
  }
  filter = conf.filter || 'true';
  batchSize = conf.maxBatchSize || 10;
  provider = C.internal.Path.fileSystemProvider(recurse, dir);
  return provider.init();
};

function reportErrorIfAny(job, err) {
  if (err == null) return;
  job.reportError(err).catch(() => {});
}

exports.discover = async (job) => {
  const pathFilter = C.internal.Path.pathFilter(dir, filter, provider, job.logger(), extractors);
  let curPath = await pathFilter.getNextPath();
  reportErrorIfAny(job, pathFilter.getLastError());
  const results = [];
  while (!curPath.done) {
    const result = {
      source: curPath.val,
      size: curPath.meta.size
    };
    if (curPath.meta.fields) result.fields = curPath.meta.fields;
    if (curPath.val.endsWith('.gz')) result.compression = 'gzip';
    results.push(result);
    if (results.length >= batchSize) {
      await job.addResults(results);
      results.length = 0;
    }
    curPath = await pathFilter.getNextPath();
    reportErrorIfAny(job, pathFilter.getLastError());
  }
  await job.addResults(results);
};

exports.collect = async (collectible) => {
  return Promise.resolve(provider.createReadStream(collectible.source));
};

exports.destroy = async (collectible) => {
  await new Promise((resolve, reject) => {
    fs.unlink(collectible.source, (err) => {
      if (err) return reject(err);
      return resolve();
    });
  });
};
