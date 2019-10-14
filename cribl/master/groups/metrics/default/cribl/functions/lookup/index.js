exports.name = 'Lookup';
exports.version = '0.2';
exports.group = 'Standard';

const { CSV, LookupSpec, LookupFactory } = C.Lookup;
const cLogger = C.util.getLogger('func:lookup');

let table;
let file;
let addToEventFunc;
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
  const inEventFields = [];
  const inLookupFields = [];
  const outEventFields = [];
  const outLookupFields = [];

  return Promise.resolve()
    .then(() => {
      conf.inFields.forEach(inF => {
        inEventFields.push(inF.eventField);
        inLookupFields.push(inF.lookupField);
      });

      (conf.outFields || []).forEach(outF => {
        outEventFields.push(outF.eventField);
        outLookupFields.push(outF.lookupField);
      });
      addToEventFunc = conf.addToEvent ? addToRaw : undefined;
      const ls = new LookupSpec(inEventFields, outLookupFields, inLookupFields, outEventFields);
      cLogger.info('Creating Lookup: ', { matchMode, matchType, file });
      table = CSV.getReference(file, ls, (+conf.reloadPeriodSec) || -1, matchMode, matchType);
      return table.ready();
    });
};

exports.unload = () => {
  if (table) table.release();
  table = undefined;
};

exports.process = (event) => {
  if (table) {
    table.lookup(event, addToEventFunc);
  }
  return event;
};
