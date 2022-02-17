/* eslint-disable no-await-in-loop */

const { httpSearch, isHttp200, RestVerb, HttpError, RestAuthType } = C.internal.HttpUtils;
const { PrometheusParser } = C.internal.Parsers;
const { DiscoveryAdapterFactory } = C.internal.Adapters;

exports.name = 'Prometheus';
exports.version = '0.1';
exports.disabled = false;
exports.destroyable = false;
exports.hidden = true; // This collector exposed as source PrometheusIn

let conf;
let batchSize;
let dimensions;

exports.getParser = (job) => {
  return new PrometheusParser(job.logger(), dimensions);
};

exports.init = async (opts) => {
  conf = opts.conf;
  batchSize = conf.maxBatchSize || 10;
  dimensions = conf.dimensionList;
  // validate adapter conf
  DiscoveryAdapterFactory.create(conf).validate();
};

exports.discover = async (job) => {
  try {
    const targets = (await DiscoveryAdapterFactory.create(conf, job.logger()).discoverTargets(job)) || [];
    const results = [];
    for (const record of targets) {
      results.push(record);
      if (results.length >= batchSize) {
        await job.addResults(results);
        results.length = 0;
      }
    }
    if (results.length) await job.addResults(results);
  } catch (error) {
    job.logger().error('Discover error', { error });
    throw error;
  }
};

exports.collect = async (collectible, job) => {
  const { username, password } = conf;
  const authType = username && password ? RestAuthType.BASIC : RestAuthType.NONE;
  const opts = { url: collectible.source, method: RestVerb.GET, authType, username, password };
  const result = await httpSearch(opts, job.logger());
  result.res.on('end', () => {
    if (!isHttp200(result.res.statusCode)) {
      const error = new HttpError('http error', result.res.statusCode, { host: result.host, port: result.port, path: result.path, method: result.method });
      job.reportError(error).catch(() => {});
    }
  });
  result.res.on('error', (error) => {
    job.reportError(error).catch(() => {});
  });
  return result.res;
};
