const { Expression, NestedPropertyAccessor } = C.expr;

exports.name = 'Unroll';
exports.version = '0.1';
exports.group = 'Advanced';

let srcFieldExpr;
let dstFieldNPA;
exports.init = (opts) => {
  const conf = opts.conf || {};
  srcFieldExpr = new Expression(conf.srcExpr || '_raw', {disallowAssign: true});
  dstFieldNPA = new NestedPropertyAccessor(conf.dstField || '_raw');
};

exports.process = (event) => {
  const val = srcFieldExpr.evalOn(event);
  if(!Array.isArray(val))  return event;
  if(val.length === 0)     return undefined;

  const result = new Array(val.length);
  for(let i=0; i<val.length; i++){
    result[i] = event.__clone();
    dstFieldNPA.set(result[i], val[i]);
  }
  return result;
};
