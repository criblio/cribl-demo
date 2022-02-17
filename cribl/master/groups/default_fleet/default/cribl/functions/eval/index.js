exports.name = 'Eval';
exports.version = '0.2';
exports.disabled = false;
exports.group = 'Standard';

const { Expression, NestedPropertyAccessor } = C.expr;
const cLogger = C.util.getLogger('func:eval');

let fields2add = []; // key1, expr1, key2, expr2 ...
let fields2remove = []; // list of fields to remove
let WL2remove = null; // wildcarded fields to remove
let WL2keep = null;

const CTRL_PREFIX = '_ctrl.';
function getAccessor(fieldName) {
  if (fieldName) {
    return new NestedPropertyAccessor(fieldName);
  }
  return fieldName;
}

exports.init = (opts) => {
  const conf = opts.conf;
  fields2add = [];
  fields2remove = [];
  WL2remove = null;
  WL2keep = null;

  const add = [];
  const remove = [];
  (conf.add || []).forEach(field => {
    field.name = (field.name || '').trim();
    const isCtrlField = field.name.startsWith(CTRL_PREFIX);
    add.push(isCtrlField);
    add.push(isCtrlField ? field.name.substr(CTRL_PREFIX.length) : getAccessor(field.name));
    add.push(new Expression(`${field.value}`, { disallowAssign: true }));
  });

  const removePatterns = [];
  (conf.remove || []).forEach(field => {
    field = (field || '').trim();
    if (field.indexOf('*') > -1) {
      removePatterns.push(field);
    } else {
      remove.push(field);
    }
  });

  const keepPatterns = (conf.keep || []).map(k => k.trim()).filter(k => k.length);
  if (keepPatterns.length > 0) {
    WL2keep = new C.util.WildcardList(keepPatterns);
  }

  if (removePatterns.length > 0) {
    WL2remove = new C.util.WildcardList(removePatterns, keepPatterns);
  }

  fields2add = add;
  fields2remove = remove.filter(field => (!WL2keep || !WL2keep.test(field))).map(getAccessor);
};

exports.process = (event) => {
  if(!event) return event;
  // add/replace some fields
  for (let i = 2; i < fields2add.length; i += 3) {
    const key = fields2add[i - 1];
    const val = fields2add[i].evalOn(event);
    if (!fields2add[i - 2]) {
      // might need to throw away the result
      if (key) key.set(event, val);
    } else {
      event.__setCtrlField(key, val);
    }
  }
  // remove some fields, here we simply set fields to undefined for performance reasons
  for (let i = 0; i < fields2remove.length; i++) {
    fields2remove[i].set(event, undefined);
  }

  // remove wildcard fields
  if (WL2remove) {
    event.__traverseAndUpdate(5, (path, value) => {
      return WL2remove.test(path) ? undefined : value;
    });
  }
  return event;
};
