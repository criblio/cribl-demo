const { Expression } = C.expr;

exports.name = 'CEF Serializer';
exports.version = '0.2';
exports.disabled = false;
exports.group = 'Formatters';

const { NestedPropertyAccessor } = C.expr;

const DEFAULT_OUT_FIELD = '_raw';
const headerSet = new Set(['cef_version', 'device_vendor', 'device_product', 'device_version', 'device_event_class_id', 'name', 'severity']);
let headerKeys = [];
let headerExpr = [];

let extKeys = [];
let extExpr = [];

let outputField;

function difference(set1, set2) {
  return new Set([...set1].filter(key => !set2.has(key)));
}

function validateHeaders(keys) {
  if (keys.length !== [...headerSet].length) {
    const set = new Set(keys);
    const diff = difference(headerSet, set);
    throw new Error(`Missing headers=${JSON.stringify([...diff])}`);
  }
  const kvPairKeySet = new Set(keys);
  const diff = difference(kvPairKeySet, headerSet);
  if ([...diff].length > 0) {
    throw new Error(`Invalid headers=${[...diff]}`);
  }
}

exports.init = (opts) => {
  const conf = opts.conf || {};
  headerKeys = [];
  headerExpr = [];
  extKeys = [];
  extExpr = [];
  outputField = new NestedPropertyAccessor(conf.outputField || DEFAULT_OUT_FIELD);
  (conf.header || []).forEach(kvPair => {
    headerKeys.push(kvPair.name);
    headerExpr.push(new Expression(`${kvPair.value}`, { disallowAssign: true }));
  });
  validateHeaders(headerKeys);
  (conf.extension || []).forEach(kvPair => {
    if (kvPair.name.includes('\n')) throw new Error('Extension field names cannot contain new lines');
    extKeys.push(kvPair.name);
    extExpr.push(new Expression(`${kvPair.value}`, { disallowAssign: true }));
  });
};

function stringify(input) {
  if (input === undefined) return '';
  if (typeof input === 'string') return input;
  try {
    return JSON.stringify(input);
  } catch (e) {
    return `${input}`;
  }
}

const headerEscapeChars = /([\\|])/g;
const extensionEscapeChars = /([\\=])/g;
exports.process = (event) => {
  const res = {};
  for (let hIdx = 0; hIdx < headerKeys.length; hIdx++) {
    res[headerKeys[hIdx]] = stringify(headerExpr[hIdx].evalOn(event)).replace(headerEscapeChars, '\\$1');
  }
  const raw = `${res.cef_version || 'CEF:0'}|${res.device_vendor}|${res.device_product}|${res.device_version}|${res.device_event_class_id}|${res.name}|${res.severity}|`;
  const extensionsStrs = [];
  for (let eIdx = 0; eIdx < extKeys.length; eIdx++) {
    const result = stringify(extExpr[eIdx].evalOn(event)).replace(extensionEscapeChars, '\\$1');
    const fieldName = extKeys[eIdx].replace(extensionEscapeChars, '\\$1');
    extensionsStrs.push(`${fieldName}=${result}`);
  }
  outputField.set(event, raw + extensionsStrs.join(' '));
  return event;
};

