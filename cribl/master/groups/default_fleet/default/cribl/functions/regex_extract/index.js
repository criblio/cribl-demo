exports.name = 'Regex Extract';
exports.version = '0.2';
exports.group = 'Standard';

const { NamedGroupRegExp } = C.util;
const { NestedPropertyAccessor, Expression } = C.expr;
const cLogger = C.util.getLogger('func:regex_extract');

const DEFAULT_ITERATIONS = 100;
const KV_REGEX = /^_(KEY|NAME|VAL|VALUE)_(.+)$/;

const DEFAULT_FIELD = '_raw';
let _iterations = DEFAULT_ITERATIONS;
let regExList = [];
let srcField;
let fieldNameExp;
let overwrite = false;

// If fieldNameExpression not specified, this RegEx is used to remove leading underscores and digits
// then remove non alpha numeric and underscore chars from field names. i.e.: _0key_1_@!2_3 => key_1_2_3
const fieldNameFilter = new RegExp(/^[_0-9]+|[^a-zA-Z0-9_]+/g);

// This function derives configuration for the regEx string in conf as follows:
// 1. Validates conf.regex
// 2. Determines if conf.regex is a name value capture group, add global flag to conf.regex if necessary.
function getRegExConf(conf) {
  if (!conf || !conf.regex) {
    return undefined;
  }
  const result = NamedGroupRegExp.parseRegexLiteral(conf.regex);
  if (result.groups.length === 1) {
    // a regex with no capturing groups, wtf?
    return undefined;
  }
  // analyze the capture groups an pick out matching _NAME/KEY_<ID> and _VAL/VALUE_<ID>
  const keyGroups = {};
  const valGroups = {};
  for (let i = 0; i < result.groups.length; i++) {
    const groupName = result.groups[i];
    if (groupName) {
      const m = KV_REGEX.exec(groupName);
      if (m) {
        if (m[1] === 'KEY' || m[1] === 'NAME') {
          keyGroups[m[2]] = i;
        } else {
          valGroups[m[2]] = i;
        }
      }
    }
  }

  // if key2value[i] == number > 0 --> event[match[i]] = match[key2value[i]]
  // if key2value[i] == -1         --> event[regex.groups[i]] = match[i]
  // if key2value[i] == undefined  --> ignore capture group
  const key2value = new Array(result.groups.length);
  key2value.fill(-1, 0, key2value.length);
  let kvPairCount = 0;
  Object.keys(keyGroups).forEach(keyId => {
    const valId = valGroups[keyId];
    if (valId !== undefined) {
      key2value[keyGroups[keyId]] = valId;
      key2value[valId] = undefined;
      kvPairCount++;
    }
  });

  let regex = conf.regex;
  let iterations = _iterations; // Default to function level iterations.
  const flags = result.flags || '';
  if (kvPairCount === 0) {
    // Named capture group regex
    if (flags.includes('g')) {
      // Honor global flag
      iterations = _iterations;
    } else {
      // Only iterate once since global flag not set
      iterations = 1;
    }
  } else if (!flags.includes('g')) {
    // Name value capture group regex must have global flag set
    regex = `${regex}g`;
  }
  return { regex: new NamedGroupRegExp(regex), kvPairCount, iterations, key2value };
}

// Format or sanitize field name for _NAME_ and _VALUE_ extractions.
function formatFieldName(event, fieldName) {
  // Format
  if (fieldNameExp && fieldName) {
    // Use expression to format field name.
    return fieldNameExp.evalOn(event, fieldName);
  } else if (fieldNameFilter && fieldName) {
    // sanitize with regEx to remove non-alpha numeric values.
    fieldNameFilter.lastIndex = 0;
    return fieldName.replace(fieldNameFilter, '');
  }
  return fieldName;
}

function processRegex(conf, event, fieldStr) {
  conf.regex.lastIndex = 0; // common trap of setting "global" flag
  for (let i = 0; i < conf.iterations; i++) {
    const m = conf.regex.exec(fieldStr);
    if (!m) {
      break;
    }
    for (let k = 1; k < conf.key2value.length; k++) {
      const kv = conf.key2value[k];
      const gName = conf.regex.groups[k];
      let key;
      let value;
      if (kv === -1 && gName) { // simple capture group
        key = gName;
        value = m[k];
      } else if (kv > 0) { // _NAME = _VALUE pair
        key = formatFieldName(event, m[k]);
        value = m[kv];
      } else {
        // ignore - value of a kv pair
        continue;
      }
      const currentValue = event[key];
      if (!overwrite && currentValue !== undefined) {
        // Field exists on event which means we are dealing with an MV field extraction.
        if (Array.isArray(currentValue)) {
          // Field is already array, add the newly extracted value.
          currentValue.push(value);
        } else {
          // field is currently name=value, extract current value and convert to array.
          event[key] = [currentValue, value];
        }
      } else {
        event[key] = value;
      }
    }
  }
  return event;
}

exports.init = (opts) => {
  const conf = opts.conf || {};
  srcField = new NestedPropertyAccessor(conf.source || DEFAULT_FIELD);
  overwrite = conf.overwrite || false;
  regExList = [];
  _iterations = (conf.iterations) ? conf.iterations : DEFAULT_ITERATIONS;
  // Top level regex
  if (conf.regex) {
    const regExConf = getRegExConf(conf);
    if (regExConf) {
      regExList.push(regExConf);
    }
  }
  // Additional Regex
  if (conf.regexList) {
    for (let i = 0; i < conf.regexList.length; i++) {
      const item = conf.regexList[i];
      if (item) {
        const regExConf = getRegExConf(item);
        if (regExConf) {
          regExList.push(regExConf);
        }
      }
    }
  }
  // fieldNameExpression - for _NAME_ _VALUE_ extractions used to format extracted names.
  fieldNameExp = (conf.fieldNameExpression || '').trim().length ? fieldNameExp = new Expression(conf.fieldNameExpression.trim(), { disallowAssign: true, args: ['name'] }) : undefined;
};

exports.process = (event) => {
  if (regExList.length === 0) {
    return event;
  }
  const field = srcField.get(event);
  if (field == null) {
    return event;
  }
  const fieldStr = `${field}`;
  for (let i = 0; i < regExList.length; i++) {
    const conf = regExList[i];
    processRegex(conf, event, fieldStr);
  }
  return event;
};

// Unit test
exports.getIterations = () => { return _iterations; };
exports.getSrcField = () => { return srcField.path; };
exports.getOverwrite = () => { return overwrite; };
