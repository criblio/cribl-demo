exports.name = 'Regex Filter';
exports.version = '0.2';
exports.group = 'Standard';

const { NamedGroupRegExp } = C.util;
const { NestedPropertyAccessor } = C.expr;

let regexList = [];
let field = '_raw';

exports.init = (opts) => {
  const conf = opts.conf || {};
  regexList = [];

  // Top level regex
  if (conf.regex) {
    regexList.push(new NamedGroupRegExp(conf.regex));
  } else {
    throw new Error('missing required parameter: regex');
  }

  // Additional Regex
  if (conf.regexList && conf.regexList.length > 0) {
    for (let i = 0; i < conf.regexList.length; i++) {
      regexList.push(new NamedGroupRegExp(conf.regexList[i].regex));
    }
  }

  field = new NestedPropertyAccessor(conf.field || '_raw');
};

exports.process = (event) => {
  const fieldValue = field.get(event);
  for (let i = 0; i < regexList.length; i++) {
    regexList[i].lastIndex = 0; // common trap of setting "global" flag
    if (regexList[i].test(fieldValue)) {
      return undefined;
    }
  }
  return event;
};
