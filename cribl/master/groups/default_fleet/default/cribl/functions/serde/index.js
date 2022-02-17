const { Expression, NestedPropertyAccessor } = C.expr;

exports.disabled = 0;
exports.name = 'Parser';
exports.version = '0.2';
exports.group = 'Standard';

let conf = {};
let srcField = '_raw';
let dstField;
let serde;
let fieldFilter;

class FieldFilter {
  constructor(keep, remove, fieldFilterExpr) {
    this.keepFields = keep;
    this.removeFields = remove;
    this.fieldFilterExpr = fieldFilterExpr;
  }

  shouldKeep(value, name, index) {
    if (this.keepFields && this.keepFields.test(name)) {
      return true;
    }
    if (this.removeFields && this.removeFields.test(name)) {
      return false;
    }
    return !this.fieldFilterExpr || this.fieldFilterExpr.evalOn({ index, name, value });
  }
}

exports.init = (opt) => {
  conf = (opt || {}).conf || {};

  srcField = new NestedPropertyAccessor((conf.srcField || '_raw').trim());
  dstField = (conf.dstField || '').trim();
  if (dstField) {
    dstField = new NestedPropertyAccessor(dstField);
  }

  const keepPatterns = (conf.keep || []).map(k => k.trim()).filter(k => k.length);
  let removePatterns = (conf.remove || []).map(k => k.trim()).filter(k => k.length);

  let keepFields;
  if (keepPatterns.length > 0) {
    keepFields = new C.util.WildcardList(keepPatterns);
  }

  if (keepPatterns.length > 0 && removePatterns.length === 0 &&
     (conf.fieldFilterExpr === undefined || conf.fieldFilterExpr.length === 0)) {
    // For keepPatterns to work w/out specifying removePatterns.
    removePatterns = ['*'];
  }

  let removeFields;
  if (removePatterns.length > 0) {
    removeFields = new C.util.WildcardList(removePatterns);
  }
  const fieldFilterExpr = conf.fieldFilterExpr && new Expression(`${conf.fieldFilterExpr}`, { disallowAssign: true });
  fieldFilter = new FieldFilter(keepFields, removeFields, fieldFilterExpr);

  if (conf.type === 'elff') {
    serde = C.Text._elffSerDe({
      fields: conf.fields || [],
    }, fieldFilter);
  } else if (conf.type === 'clf') {
    serde = C.Text._clfSerDe({
      fields: conf.fields || [],
    }, fieldFilter);
  } else if (conf.type === 'csv') {
    serde = C.Text._delimSerDe({
      fields: conf.fields || [],
    }, fieldFilter);
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
  if (conf.mode === 'reserialize') {
    exports.process = reserialize;
  } else {
    exports.process = extract;
  }
};

function extract(event){
  const raw = srcField.get(event);
  let dst = event;
  if (dstField) {
    dst = {};
    dstField.set(event, dst);
  }
  serde.deserialize(raw, dst);
  return event;
}

function reserialize(event){
  const raw = srcField.get(event);
  (dstField || srcField).set(event, serde.reserialize(raw));
  return event;
}

/* eslint-disable func-names, prefer-arrow-callback */
exports.process = extract;

