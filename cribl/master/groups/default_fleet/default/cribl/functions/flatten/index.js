exports.name = 'Flatten';
exports.version = '0.1';
exports.disabled = false;
exports.group = 'Formatters';

const cLogger = C.util.getLogger('func:flatten');

const DEFAULT_DEPTH = 5;

let prefix = "";
let depth = DEFAULT_DEPTH;
let delimiter = "_";
let nonInternalWCL = undefined;
let internalWcl = undefined;

exports.init = (opts) => {
  const conf = opts.conf;
  const fields = [...conf.fields];

  nonInternalWCL = undefined;
  internalWcl = undefined;

  const nonInternalFields = [];
  const internalFields = [];
  fields.forEach(field => {
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

  if (internalFields.length > 0) {
    internalWcl = new C.util.WildcardList(internalFields);
  }
  if (nonInternalFields.length === 0 && internalFields.length === 0) {
    // No fields specified, use default *
    cLogger.info('No fields specified, defaulting to all');
    nonInternalWCL = new C.util.WildcardList(['*']);
  } else if (nonInternalFields.length) {
    // Only internal fields specified, no need to handle others
    nonInternalWCL = new C.util.WildcardList(nonInternalFields);
  }
  // else only internal fields specified, no need to process non-internal fields.

  prefix = conf.prefix;
  depth = conf.depth >= 1 ? conf.depth : DEFAULT_DEPTH;
  delimiter = conf.delimiter;
};

exports.process = (event) => {
  event.__traverseForFlatten(event, depth, (path, value, obj, key, level) => {
    if (level === depth && event.__isInternalField(key) && (!internalWcl?.test(key) || internalWcl == null)) { return true; }
    if (level === depth && !event.__isInternalField(key) && !nonInternalWCL?.test(key)) { return true; }
    // for now, we are dealing with matched objects
    if (level === 1 && (typeof value === "object")) {
      value = JSON.stringify(value);
    }
    if (level === depth) { // if its an higher level object delete it
      delete event[key];
    }
    if (typeof value !== "object") { // if its a literal update event
      event[path] = value;
    }
    return (typeof value !== "object");
  }, prefix, delimiter);
  return event;
};
