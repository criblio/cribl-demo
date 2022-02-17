exports.name = 'Lookup';
exports.version = '0.2';
exports.group = 'Standard';

const { CSV, LookupSpec } = C.internal.Lookup;
const cLogger = C.util.getLogger('func:lookup');
const ENV_ROLE = 'CRIBL_ROLE';
const ENV_CONFIG_HELPER = 'CONFIG_HELPER';

let table;
let file;
let addToEventFunc;
let defaultValues;
const QUOTE_REGEX = /(\\")/g;

function quote(str) {
  const newStr = str.replace(QUOTE_REGEX, '\\$1');
  return newStr.length === str.length && !/\s/.test(str) ? str : `"${newStr}"`;
}

function addToRaw(event, fields, values) {
  if (!event._raw || !fields || !values || !fields.length || !values.length) {
    return;
  }
  let delim = event._raw.length > 0 ? ',' : '';
  for (let i = 0; i < fields.length && i < values.length; i++) {
    const v = values[i];
    if (v !== undefined) {
      event._raw += `${delim}${quote(fields[i])}=${quote(v || '')}`;
      delim = ',';
    }
  }
}

exports.init = (opts) => {
  const conf = opts.conf || {};
  file = conf.file;
  table = undefined;
  addToEventFunc = undefined;
  const matchMode = conf.matchMode || 'exact';
  const matchType = conf.matchType || 'first';
  const outFields = conf.outFields || [];
  const inEventFields = [];
  const inLookupFields = [];
  const outEventFields = [];
  const outLookupFields = [];
  defaultValues = [];
  return Promise.resolve()
    .then(() => {
      conf.inFields.forEach(inF => {
        inEventFields.push(inF.eventField);
        inLookupFields.push(inF.lookupField);
      });
      defaultValues.fill(undefined, 0, outFields.length);
      for (let i = 0; i < outFields.length; i++) {
        const outF = outFields[i];
        outEventFields.push(outF.eventField);
        outLookupFields.push(outF.lookupField);
        if (outF.defaultValue !== undefined) defaultValues[i] = outF.defaultValue;
      }
      defaultValues = defaultValues.find(x => x != null) != null ? defaultValues : undefined;
      addToEventFunc = conf.addToEvent ? addToRaw : undefined;
      const ignoreCase = conf.ignoreCase || false;
      const ls = new LookupSpec(inEventFields, outLookupFields, inLookupFields, outEventFields, false, ignoreCase);
      cLogger.info('Creating Lookup: ', { matchMode, matchType, file });
      table = CSV.getReference(file, ls, (+conf.reloadPeriodSec) || -1, matchMode, matchType);
      return table.ready()
        .catch(err => {
          if (err.code === 'ENOENT' && isConfigHelper()) {
            cLogger.debug(`missing lookup file ${file} in cfg. helper`, { err });
            return [{
              func: exports.name,
              severity: 'warn',
              message: `The specified lookup file ${file} couldn't be found in this instance. Make sure it's present in Worker nodes.`
            }];
          }
          throw err;
        });
    });
};

function isConfigHelper() {
    return process.env[ENV_ROLE] === ENV_CONFIG_HELPER;
}

exports.unload = () => {
  if (table) table.release();
  table = undefined;
};

exports.process = (event) => {
  if (table) {
    table.lookup(event, addToEventFunc, defaultValues);
  }
  return event;
};
