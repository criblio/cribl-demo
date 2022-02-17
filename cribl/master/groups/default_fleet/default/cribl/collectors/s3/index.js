/* eslint-disable no-await-in-loop */
exports.name = 'S3';
exports.version = '0.1';
exports.disabled = false;
exports.destroyable = false;

let dir;
let filter;
let extractors;

let provider;
let batchSize;

exports.init = (opts) => {
  const conf = opts.conf;
  dir = conf.path || '';
  filter = conf.filter || 'true';
  batchSize = conf.maxBatchSize || 10;

  if (conf.extractors) {
    extractors = {};
    const { Expression } = C.expr;
    conf.extractors.forEach(pair => {
      extractors[pair.key] = new Expression(pair.expression);
    });
  }

  provider = C.internal.Path.s3Provider({
    recurse: conf.recurse || false,
    bucket: conf.bucket,
    authenticationMethod: conf.authenticationMethod,
    apiKey: conf.awsApiKey,
    secretKey: conf.awsSecretKey,
    region: conf.region,
    endpoint: conf.endpoint,
    signatureVersion: conf.signatureVersion,
    mockClient: opts.mockClient,
    enableAssumeRole: conf.enableAssumeRole || false,
    assumeRoleArn: conf.assumeRoleArn,
    assumeRoleExternalId: conf.assumeRoleExternalId,
    reuseConnections: conf.reuseConnections != null ? conf.reuseConnections : true,
    rejectUnauthorized: conf.rejectUnauthorized != null ? conf.rejectUnauthorized : true
  });
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
      size: curPath.meta.Size
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
