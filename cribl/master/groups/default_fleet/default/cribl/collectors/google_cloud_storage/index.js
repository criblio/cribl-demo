/* eslint-disable no-await-in-loop */
exports.name = 'Google Cloud Storage';
exports.version = '0.1';
exports.disabled = false;
exports.destroyable = false;

let conf;
let dir;
let filter;
let extractors;
let bucketName;
let provider;
let batchSize;
let endpoint;
let creds;
let mockClient;

exports.init = (opts) => {
  conf = opts.conf;
  dir = conf.path || '';
  filter = conf.filter || 'true';
  batchSize = conf.maxBatchSize || 10;
  mockClient = conf.mockClient;
  if (!conf.serviceAccountCredentials) {
    throw new Error('Invalid Config - missing serviceAccountCredentials!');
  }
  try {
    creds = JSON.parse(conf.serviceAccountCredentials);
  } catch (error) {
    throw new Error('Invalid config - serviceAccountCredentials expected to be in JSON format!');
  }
  validateCredentials(creds);
  bucketName = C.expr.runExprSafe(conf.bucket);
  endpoint = conf.endpoint || undefined;
  if (!bucketName) {
    throw new Error('Invalid Config - missing bucket!');
  }
  provider = C.internal.Path.GoogleCloudProvider({
    recurse: conf.recurse || false,
    bucket: conf.bucket,
    credentials: creds,
    mockClient: conf.mockClient,
    endpoint
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

function validateCredentials(creds) {
  // Sanity check attributes of interest
  if (!creds.type || creds.type !== 'service_account') {
    throw new Error(`Invalid Config - unexpected service credentials type '${creds.type}' type expected to be 'service_account'!`);
  }
  if (!creds.project_id) {
    throw new Error('Invalid Config - unexpected service credentials missing projectId');
  }
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
  const fileName = collectible.source;
  job.logger().debug('Downloading file', { collectible, bucketName, fileName });
  return Promise.resolve(provider.createReadStream(fileName));
};
