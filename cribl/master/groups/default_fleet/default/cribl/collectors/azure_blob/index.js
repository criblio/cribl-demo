/* eslint-disable no-await-in-loop */

exports.name = 'Azure Blob';
exports.version = '0.1';
exports.disabled = false;
exports.destroyable = false;

let conf;
let dir;
let filter;
let extractors;
let provider;
let batchSize;
let connectionString;
let containerName;
let mockClient;

exports.init = (opts) => {
  conf = opts.conf;
  dir = conf.path || '';
  filter = conf.filter || 'true';
  batchSize = conf.maxBatchSize || 10;
  mockClient = conf.mockClient;
  connectionString = conf.connectionString || process.env.AZURE_STORAGE_CONNECTION_STRING;
  containerName = C.expr.runExprSafe(conf.containerName);
  if (!connectionString) {
    throw new Error('Invalid Config - connectionString not defined and not found in AZURE_STORAGE_CONNECTION_STRING environment variable');
  }
  if (!containerName) {
    throw new Error('Invalid Config - missing container name');
  }
  provider = C.internal.Path.AzureBlobProvider({
    recurse: conf.recurse || false,
    containerName,
    connectionString,
    mockClient
  });
  if (conf.extractors) {
    extractors = {};
    const { Expression } = C.expr;
    conf.extractors.forEach(pair => {
      extractors[pair.key] = new Expression(pair.expression);
    });
  }
  exports.provider = provider;
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
      ...curPath.meta
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

exports.collect = async (collectible, job) => {
  job.logger().debug('Downloading blob', { name: collectible.name });
  return Promise.resolve(provider.createReadStream(collectible.source));
};
