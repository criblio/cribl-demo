exports.name = 'Sampling';
exports.version = '0.1';
exports.group = 'Standard';

// implements systematic sampling (pick random starting point then pick every X)
// https://en.wikipedia.org/wiki/Systematic_sampling

const { Expression } = C.expr;
const cLogger = C.util.getLogger('func:sampling');

const expressions = [];
const sampleRates = [];
const sampleIdx = []; // use as cursor/counter for systematic sampling

exports.init = (opts) => {
  const { conf } = opts;

  // reset in case of reinit
  sampleRates.length = 0;
  expressions.length = 0;
  sampleIdx.length = 0;

  (conf.rules || []).forEach(rule => {
    expressions.push(new Expression(`${rule.filter}`, { disallowAssign: true }));
    sampleRates.push(rule.rate);
    sampleIdx.push((Math.random() * rule.rate) | 0); // initialize sampling ctrs
  });
  cLogger.info('initialized', { rules: conf.rules || [] });
};

exports.process = (event) => {
  for (let i = 0; i < expressions.length; i++) {
    if (expressions[i].evalOn(event)) {
      if (sampleIdx[i]++ >= sampleRates[i]) {
        sampleIdx[i] = 1; // init to 1 to ensure proper counting in 1-in-N
        event.sampled = sampleRates[i];
        return event; // sampled
      }
      return null; // filtered
    }
  }
  // no expression matched ==> do not sample, still mark them as having gone thru sampling
  event.sampled = 1;
  return event;
};
