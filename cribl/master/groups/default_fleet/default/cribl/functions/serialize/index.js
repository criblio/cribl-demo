const { NestedPropertyAccessor } = C.expr;

exports.disabled = 0;
exports.name = 'Serialize';
exports.version = '0.1';
exports.group = 'Formatters';

let conf = {};
let srcField;
let dstField;
let serde;
let fieldFilter;

class FieldFilter {
  constructor(keep) {
    this.keepFields = keep;
  }

  shouldKeep(value, name, index) {
    return !this.keepFields || this.keepFields.test(name);
  }
}

exports.init = (opt) => {
  conf = (opt || {}).conf || {};

  dstField = (conf.dstField || '_raw').trim();
  srcField = (conf.srcField || '').trim();
  dstField = new NestedPropertyAccessor(dstField);
  srcField = (srcField.length === 0) ? undefined : new NestedPropertyAccessor(srcField);

  const fields = (conf.fields || []).map(k => k.trim()).filter(k => k.length);
  if (!fields.length && ['clf', 'elff', 'csv'].indexOf(conf.type) > -1) {
    throw new Error('\'Fields to serialize\' is required when an order dependent serialization type is specified.');
  }
  if (!fields.length) {
    fields.push('!__*', '*'); // Don't serialize internal fields.
  }

  // For the serde function to only include fields specified.
  const keep = new C.util.WildcardList([...fields, '!*']);
  fieldFilter = new FieldFilter(keep);

  if (conf.type === 'elff') {
    serde = C.Text._elffSerDe({ fields }, fieldFilter);
  } else if (conf.type === 'clf') {
    serde = C.Text._clfSerDe({ fields }, fieldFilter);
  } else if (conf.type === 'csv') {
    serde = C.Text._delimSerDe({ fields }, fieldFilter);
  } else if (conf.type === 'delim') {
    serde = C.Text._delimSerDe({
      delimiter: conf.delimChar,
      escapeChar: conf.escapeChar,
      quoteChar: conf.quoteChar,
      nullValue: conf.nullValue,
      fields: conf.fields || [],
    }, fieldFilter);
  } else if (conf.type === 'kvp') {
    serde = C.Text._kvpSerDe(fieldFilter, conf.cleanFields);
  } else if (conf.type === 'json') {
    serde = C.Text._jsonSerDe(fieldFilter);
  } else {
    throw new Error(`unknown type=${conf.type}`);
  }
};

function serialize(event) {
  const obj = srcField ? srcField.get(event) : event;
  if (obj) {
    dstField.set(event, serde.serialize(obj, true));
  }
  return event;
}

/* eslint-disable func-names, prefer-arrow-callback */
exports.process = serialize;
