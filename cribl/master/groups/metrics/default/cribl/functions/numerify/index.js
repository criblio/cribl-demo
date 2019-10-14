exports.disabled = 0;
exports.name = 'Numerify';
exports.version = '0.2';
exports.group = 'Standard';
const { NestedPropertyAccessor } = C.expr;

let conf = {};
let WLIgnoreList = null;

exports.init = (opt) => {
  conf = (opt || {}).conf || {};
  WLIgnoreList = null;
  conf.ignoreFields = (conf.ignoreFields || []).map(k => k.trim()).filter(k => k.length);
  if (conf.ignoreFields.length > 0) {
    WLIgnoreList = new C.util.WildcardList(conf.ignoreFields);
  }
};

exports.process = (event) => {
  if (!event) return event;

  event.__traverseAndUpdate(5, (path, val) => {
    const asNum = Number(val);
    if (Number.isNaN(asNum) || (WLIgnoreList && WLIgnoreList.test(path))) {
      return val;
    }
    return asNum;
  });
  return event;
};

