exports.name = 'Regex Filter';
exports.version = '0.2';
exports.group = 'Standard';

const { NamedGroupRegExp } = C.util; 
const { NestedPropertyAccessor } = C.expr;

let regex;
let field = '_raw';
exports.init = (opts) => {
  const conf = opts.conf || {};
  regex = null;
  
  if (conf.regex) {
    regex = new NamedGroupRegExp(conf.regex.trim());
  } else {
    throw new Error('missing required parameter: regex');
  }
  field = new NestedPropertyAccessor(conf.field || '_raw');
};

exports.process = (event) => {
  if (regex) {
    regex.lastIndex = 0; // common trap of setting "global" flag
    return regex.test(field.get(event)) ? undefined : event;
  }
  return event;
};
