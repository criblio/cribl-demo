exports.name = 'Rename';
exports.version = '0.1';
exports.disabled = false;
exports.group = 'Standard';

const { Expression, NestedPropertyAccessor } = C.expr;
const cLogger = C.util.getLogger('func:rename');

const DEFAULT_DEPTH = 5;

let fields2rename = []; //NestedPropertyAccessor[]: currentName1, newName1, currentName2, newName2 ... 
let renameExpr;
let baseFields = []; //Simple base fields
let baseWCFields = null; // Base fields with wildcards
let wildcardDepth;

function getAccessor(fieldName) {
    return new NestedPropertyAccessor(fieldName);
}

function rename(currentField, newField, context) {
  if (typeof currentField !== 'object' || typeof newField !== 'object') return;
  const val = currentField.get(context);
  // There's no reason to proceed if the source is already undefined
  if (val === undefined) return;
  // rename is just about creating a new field with the new name
  newField.set(context, currentField.get(context));
  // for performance consideration, we set the old field to undefined 
  // instead of deleting it
  currentField.set(context, undefined);
}

function parseExpr (expr) {
  if (!expr) return undefined;
  return new Expression(`${expr}`, { disallowAssign: true, args: ['name', 'value'] });
}

function renameFieldsOn(base, event) {
  if (base == null || typeof base !== 'object') return;

  // rename by key-value
  for (let i = 1; i < fields2rename.length; i += 2) {
    rename(fields2rename[i - 1], fields2rename[i], base);
  }

  // rename by expression
  if (renameExpr) {
    for (let [name, value] of Object.entries(base)) {
      const newName = renameExpr.evalOn(event, name, value);
      if (newName != null && name !== newName) {
        base[newName] = base[name];
        base[name] = undefined;
      }
    }  
  }
}


exports.init = (opts) => {
  const conf = opts.conf;
  fields2rename = [];
  baseFields = [];
  baseWCFields = null;
  const rename = [];
  (conf.rename || []).forEach(field => {
    rename.push(getAccessor((field.currentName || '').trim()));
    rename.push(getAccessor((field.newName || '').trim()));
  });
  fields2rename = rename;

  const simpleBaseFields = [];
  const baseFieldPatterns = [];
  const sourceBaseFields = conf.baseFields || [];
  for (let i = 0; i < sourceBaseFields.length; i++) {
    const field = sourceBaseFields[i].trim();
    if (field.length > 0) {
      if (field.includes('*')) {
        baseFieldPatterns.push(field);
      } else {
        simpleBaseFields.push(field);
      }
    }
  }
  
  if (baseFieldPatterns.length > 0) {
    baseWCFields = new C.util.WildcardList([...new Set(baseFieldPatterns)]);
    wildcardDepth = conf.wildcardDepth == null ? DEFAULT_DEPTH : Number(conf.wildcardDepth);
    if (isNaN(wildcardDepth) || wildcardDepth < 0) {
      throw new Error('wildcardDepth must be a positive integer value');
    }
  }
  baseFields = [...new Set(simpleBaseFields)].filter(x => !baseWCFields || !baseWCFields.test(x)).map(getAccessor);
  renameExpr = parseExpr(conf.renameExpr);

};

exports.process = (event) => {

  if (!event) return event;

  if (fields2rename.length === 0 && !renameExpr) return event;

  // rename fields
  if (baseFields.length === 0 && baseWCFields == null) {
    renameFieldsOn(event, event);
  } else {
    for (let y = 0; y < baseFields.length; y++) {
      renameFieldsOn(baseFields[y].get(event), event);
    }
    if (baseWCFields) {
      event.__traverseAndUpdate(wildcardDepth, (path, value) => {
        if (baseWCFields.test(path)) {
          renameFieldsOn(value, event);
        }
        return value;
      });
    }
  }
  return event;
};

