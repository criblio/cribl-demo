/* eslint-disable no-await-in-loop */

exports.name = 'REST';
exports.version = '0.1';
exports.disabled = false;
exports.destroyable = false;

const { RestCollector } = C.internal.Collectors;
const restC = new RestCollector();

exports.init = async (opts) => {
  return restC.init(opts);
};

exports.discover = async (job) => {
  return restC.discover(job);
};

exports.collect = async (collectible, job) => {
  return restC.collect(collectible, job);
};

exports.getParser = (job) => {
  return restC.getParser(job);
};
