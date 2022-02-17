exports.name = 'Grok';
exports.version = '0.1';
exports.group = 'Beta Functions';
exports.disabled = process.platform !== 'linux';

const { GrokRule } = C.util;
const { NestedPropertyAccessor } = C.expr;
const dLogger = C.util.getLogger('func:grok');

const DEFAULT_FIELD = '_raw';
let srcField;
let overwrite = false;
let rules = [];

exports.init = (opts) => {
  const conf = opts.conf || {};
  overwrite = conf.overwrite;
  srcField = new NestedPropertyAccessor(conf.source || DEFAULT_FIELD);
  let patterns = [conf.pattern];
  if (conf.patternList) {
    patterns = patterns.concat((conf.patternList || []).map(p => p.pattern));
  }
  return GrokRule.buildMany(patterns).then(compiled => {
    rules = compiled;
    dLogger.debug('init', {rules, srcField})
  });
};

exports.process = (event) => {
  const field = srcField.get(event);
  if (field == null) return event;

  const fieldStr = String(field);

  for (let i=0; i<rules.length; i++) {
    const execArray = rules[i].exec(fieldStr);
    if(!execArray || !execArray.groups) continue;

    dLogger.debug('process', {execArray, groups: execArray.groups});
    const keys = Object.keys(execArray.groups);
    for(let j=0; j<keys.length; j++) {
      const key = keys[j];
      event[key.replace(/\\W+/g, '_')] = execArray.groups[key];
    }
  }
  return event;
};
