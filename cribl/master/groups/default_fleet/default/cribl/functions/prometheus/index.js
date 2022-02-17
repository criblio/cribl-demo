exports.name = 'Prometheus Publisher (deprecated)';
exports.version = '0.1';
exports.disabled = false;
exports.group = 'Deprecated Functions';

const cLogger = C.util.getLogger('func:prometheus_publish');


let publisher;
let passthrough;

exports.init = (opts) => {
  const conf = opts.conf || {};
  passthrough = conf.passthrough !== undefined ? conf.passthrough : false;
  if (!opts.pid) throw new Error('Failed to find a valid pipeline id');
  const publishOpts = {
    name: 'prometheus',
    pipeId: opts.pid,
    update: conf.update,
    format: 'prometheus',
    fields: conf.fields || [],
    batchWriteInterval: conf.batchWriteInterval
  };
  publisher = C.internal.Publish.RESTPublisher(publishOpts);
  cLogger.info('init complete', publishOpts);
};

exports.process = (event) => {
  publisher.publish(event);
  return passthrough ? event : null;
};

exports.unload = () => {
  publisher.close();
};
