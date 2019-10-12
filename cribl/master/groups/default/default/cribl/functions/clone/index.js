exports.name = 'Clone';
exports.version = '0.2';
exports.group = 'Advanced';
const { NestedPropertyAccessor } = C.expr;

let clones = [];
let cloneKeys = [];
let cloneVals = [];

exports.init = (opts) => {
  const conf = opts.conf || {};
  clones = conf.clones || [];
  cloneKeys = clones.map(c => Object.keys(c).map(k => new NestedPropertyAccessor(k)));
  cloneVals = clones.map(c => Object.keys(c).map(k => c[k]));
};


exports.process = (event) => {
  if (clones.length === 0) {
    return event;
  }
  const result = new Array(clones.length + 1);
  result[0] = event;
  const eventKeys = Object.keys(event);
  for (let i = 0; i < clones.length; i++) {
    const keys = cloneKeys[i];
    const vals = cloneVals[i];
    const copy = event.clone(false, eventKeys);
    for (let k = 0; k < keys.length; k++) {
      keys[k].set(copy, vals[k]);
    }
    result[i + 1] = copy;
  }
  return result;
};
