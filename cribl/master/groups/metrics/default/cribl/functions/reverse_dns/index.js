const cLogger = C.util.getLogger('func:reverse_dns');
const { NestedPropertyAccessor } = C.expr;

let dns = require('dns');
const net = require('net');

exports.name = 'Reverse DNS';
exports.version = '0.1';
exports.group = 'Beta Functions';

// DNS Cache - Key: ipAddress, Value: Promise<hostname|null>
let _dnsCache = {};

// DNS Cache reload params.
let _cacheReloadMS = (60 * 60) * 1000; // 1 hour default.
let _cacheExpirationTime;

// Input to Output field mappings:
// [
//   [NestedPropertyAccessor(inputFieldName), NestedPropertyAccessor(outputFieldName)],
//   [NestedPropertyAccessor(inputFieldName), NestedPropertyAccessor(outputFieldName)]
//   ...
// ]
let _lookupFields = [];

// Used to throttle error logging.
let numErrors = 0;
const ERROR_THRESHOLD = 1000;

function dnsLookup(ip, outputField, event) {
  let p = _dnsCache[ip];
  if (!p) {
    p = new Promise((resolve) => {
      dns.reverse(ip, (error, hostnames) => {
        let result = null;
        if (!error && hostnames && hostnames.length) {
          result = hostnames[0];
        } else {
          // Add cache entry for failed lookup since it will likely continue to fail
          result = null;
          if ((numErrors++) % ERROR_THRESHOLD) {
            cLogger.error('Failed to resolve host', { ip, error });
          }
        }
        return resolve(result);
      });
    });
    _dnsCache[ip] = p;
  }

  return p.then(host => {
    if (host && host.length) {
      outputField.set(event, host);
    }
  });
}

function refreshCache() {
  cLogger.info('Clearing DNS cache', { size: Object.keys(_dnsCache).length });
  _dnsCache = {};
  _cacheExpirationTime = Date.now() + _cacheReloadMS;
}

exports.init = (opts) => {
  const conf = opts.conf || {};

  if (!conf.fields || conf.fields.length < 1) {
    throw new Error('Invalid argument - Must specify at least 1 field to lookup!', conf);
  }
  for (let i = 0; i < conf.fields.length; i++) {
    const field = conf.fields[i];
    const inputField = field.inFieldName;
    if (inputField && inputField.length) {
      const outputField = (field.outFieldName && field.outFieldName.length) ? field.outFieldName : inputField;
      _lookupFields.push([new NestedPropertyAccessor(inputField), new NestedPropertyAccessor(outputField)]);
    }
  }
  const timeoutMinutes = conf.cacheTTL || 60;
  if (timeoutMinutes > 0) {
    _cacheReloadMS = (timeoutMinutes * 60) * 1000;
    _cacheExpirationTime = Date.now() + _cacheReloadMS;
  }
  if (conf.mock) {
    dns = conf.mock;
  }
};

exports.unload = () => {
  _dnsCache = {};
  _lookupFields = [];
};

exports.process = (event) => {
  if (Date.now() > _cacheExpirationTime) {
    // Periodically clear cache and let it rebuild.
    refreshCache();
  }
  const promises = [];
  const handleErorr = error => {
    if ((numErrors++) % ERROR_THRESHOLD) {
      cLogger.error('DNS Lookup error', { error });
    }
  };

  for (let i = 0; i < _lookupFields.length; i++) {
    const inputField = _lookupFields[i][0];
    const outputField = _lookupFields[i][1];
    const value = inputField.get(event);
    if (value && net.isIP(value)) {
      promises.push(dnsLookup(value, outputField, event).catch(handleErorr));
    }
  }
  return Promise.all(promises).then(() => event);
};

// For unit test
exports.getDnsCacheSize = () => Object.keys(_dnsCache).length;
