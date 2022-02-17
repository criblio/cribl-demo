

let arrayPath;
let splunkPathPrefix;
let objName;

function extractArray(obj) {
  for (let i = 0; i < arrayPath.length; i++) {
    const key = arrayPath[i];
    const val = obj[key];
    if (!val) {
      return undefined;
    }
    if (i === arrayPath.length - 1) {
      if (!Array.isArray(val)) {
        return undefined;
      }
      delete obj[key];
      return val;
    }
    obj = val;
  }
  return undefined;
}

function prepareForCloning(event) {
  delete event.__json; // don't want to clone this
  // now remove any index time fields
  const keys = Object.keys(event);
  for (let i = 0; i < keys.length; i++) {
    if (keys[i].startsWith(splunkPathPrefix)) {
      delete event[keys[i]];
    }
  }
}

exports.name = 'JSON Unroll';
exports.version = '0.1';
exports.group = 'Advanced';

exports.init = (opts) => {
  const conf = opts.conf || {};
  arrayPath = (conf.path || '').split('.').map(k => k.trim());
  objName = (conf.name || '').trim();

  splunkPathPrefix = '';
  for (let i = 0; i < arrayPath.length; i++) {
    const k = arrayPath[i];
    if (Number.isNaN(+k)) {
      splunkPathPrefix += `.${k}`;
    } else {
      splunkPathPrefix += '{}';
    }
  }
  if (splunkPathPrefix.length > 0 && splunkPathPrefix.startsWith('.')) {
    splunkPathPrefix = splunkPathPrefix.substr(1);
  }
  splunkPathPrefix += '{}'; // since it is supposed to be an array
};

exports.process = (event) => {
  if (!event._raw) return event;
  try {
    if (!event.__json) {
      event.__json = typeof event._raw === 'string' ? JSON.parse(event._raw) : event._raw;
    }
    const arr = extractArray(event.__json);
    if (arr) {
      const master = event.__json;
      prepareForCloning(event);
      return arr.map(el => {
        if (typeof el !== 'object' || objName) {
          el = { [objName || 'value']: el };
        }
        const clone = event.__clone();
        clone.__json = Object.assign({}, master, el);
        clone._raw = JSON.stringify(clone.__json);
        return clone;
      });
    }
  } catch (ignore) {}

  return event;
};
