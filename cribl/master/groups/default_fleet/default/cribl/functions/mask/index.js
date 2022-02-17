exports.name = 'Mask';
exports.version = '0.3';
exports.group = 'Standard';

const { Expression, NestedPropertyAccessor } = C.expr;
const { NamedGroupRegExp } = C.util;
const cLogger = C.util.getLogger('func:mask');

const CTRL_PREFIX = '_ctrl.';
function getAccessor(fieldName) {
  if (fieldName) {
    return new NestedPropertyAccessor(fieldName);
  }
  return fieldName;
}

let rules = []; // list of {regex, expression}
let justOnRaw = false;
let flags = [];
let nonInternalWCL = undefined;
let internalWcl = undefined;

exports.init = (opts) => {
  const conf = opts.conf || {};
  rules = [];
  flags = [];
  justOnRaw = false;

  rules = (conf.rules || []).map(rule => {
    const regex = new NamedGroupRegExp(rule.matchRegex);
    const expression = new Expression(`${rule.replaceExpr}`, { disallowAssign: true });
    return { regex, expression };
  });

  const nonEmptyFields = (conf.fields || []).map(f => f.trim()).filter(f => f.length > 0);

  nonInternalWCL = undefined;
  internalWcl = undefined;

  const nonInternalFields = [];
  const internalFields = [];
  nonEmptyFields.forEach(field => {
    if (field.startsWith("__")) {
      // Internal field
      if (field.indexOf("*") > -1) {
        // Wild card with internal field, tsk tsk tsk
        cLogger.warn("Internal fields with wildcards are not supported, ignoring field", { field });
      } else {
        // No wild card
        internalFields.push(field);
      }
    } else {
      // Not an internal field
      nonInternalFields.push(field);
    }
  });

  justOnRaw = nonEmptyFields.length === 1 && nonEmptyFields[0] === '_raw'; // common case

  if (nonInternalFields.length > 0) {
    nonInternalWCL = new C.util.WildcardList(nonInternalFields);
  }
  if (internalFields.length > 0) {
    internalWcl = new C.util.WildcardList(internalFields);
  }

  (conf.flags || []).forEach(field => {
    field.name = (field.name || '').trim();
    const isCtrlField = field.name.startsWith(CTRL_PREFIX);
    flags.push(isCtrlField);
    flags.push(isCtrlField ? field.name.substr(CTRL_PREFIX.length) : getAccessor(field.name));
    flags.push(new Expression(`${field.value}`, { disallowAssign: true }));
  });
};

function execRules(value, event, flagEvent) {
  if (value === undefined || value === null || typeof value === 'object') {
    return value;
  }
  value = value.toString();
  for (let i = 0; i < rules.length; i++) {
    const { regex, expression } = rules[i];
    value = value.replace(regex.getRegExp(), (...args) => {
      const ctx = { g0: args[0], event };
      for (let gi = 1, end = args.length - 2; gi < end; gi++) {
        ctx[`g${gi}`] = args[gi];
      }
      let res = expression.evalOn(ctx);
      res = res === undefined ? args[0] : res; // in case of error (ie undefiend returned) do not replace
      if (res) flagEvent[0] = true;
      return res;
    });
  }
  return value;
}

function doFlag(event) {
  for (let i = 2; i < flags.length; i += 3) {
    const key = flags[i - 1];
    const val = flags[i].evalOn(event);
    if (!flags[i - 2]) {
      // might need to throw away the result
      if (key) key.set(event, val);
    } else {
      event.__setCtrlField(key, val);
    }
  }
}

exports.process = (event) => {
  if (!event || (nonInternalWCL == null && internalWcl == null) || rules.length === 0) {
    return event;
  }

  const flagEvent = [false];
  if (justOnRaw) {
    event._raw = execRules(event._raw, event, flagEvent);
    if (flagEvent[0]) doFlag(event);
    return event;
  }

  event.__traverseAndUpdateWithInternalFields(5, false, (path, value) => {
    if (event.__isInternalField(path) && (internalWcl == null || !internalWcl?.test(path))) { return value; }
    if (!event.__isInternalField(path) && (nonInternalWCL == null || !nonInternalWCL.test(path))) { return value; }
    return execRules(value, event, flagEvent);
  });

  if (flagEvent[0]) doFlag(event);
  return event;
};
