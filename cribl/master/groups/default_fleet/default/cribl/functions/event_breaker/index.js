exports.name = 'Event Breaker';
exports.version = '0.1';
exports.group = 'Advanced';
exports.disabled = false;

const dLogger = C.util.getLogger('func:event_breaker');
const { except } = C.util;

const CHANNEL = "__channel";
const DEFAULT_CHANNEL = "__EVENT_BREAKER_FUNC";

let rule;
let existingRule;
let isExistingRule;
let getBreakerCache;
let shouldMarkCriblBreaker;

exports.init = (opts) => {
  const { EventBreakerRule, BreakerMgr } = C.internal.Breakers;
  const conf = opts.conf || {};
  getBreakerCache = {};

  dLogger.info("Initializing function with conf", conf);

  BreakerMgr.instance()?.on('update', (updatedId) => {
    if (updatedId in getBreakerCache) {
      dLogger.debug(`Reset cache for ${updatedId}`);
      delete getBreakerCache.updatedId;
    }
  });

  existingRule = conf.existingRule;
  isExistingRule = conf.existingOrNew === "existing";
  shouldMarkCriblBreaker = conf.shouldMarkCriblBreaker ?? true;

  if (!isExistingRule) {
    // Let's create a new breaker from the config
    let ruleConfig = {
      ...conf,
      type: conf.ruleType,
      name: "event_breaker_func",
      condition: true // If we made it to this function then user wants to run breaker here
    };
    ruleConfig = except(['ruleType', 'existingRule', 'existingOrNew', 'shouldMarkCriblBreaker'], ruleConfig);

    rule = EventBreakerRule.from(ruleConfig, shouldMarkCriblBreaker);
  }
};

exports.process = (event) => {
  const { getBreaker } = C.internal.Breakers;

  // If we're using an existing rule, check our cache first, otherwise let's fetch it
  if (isExistingRule) {
    if (existingRule in getBreakerCache && getBreakerCache[existingRule].appliesTo(event)) {
      dLogger.debug('Found rule in cache');
      rule = getBreakerCache[existingRule];
    } else {
      const ruleset = getBreaker(existingRule);
      rule = ruleset.getBreakerFor(event, true, shouldMarkCriblBreaker);
      getBreakerCache[existingRule] = rule;
    }
  }

  // Fallback case, passthru
  if (rule == null || event._raw == null) {
    return event;
  }

  // Get any events that may have already 'expired'
  const events = [];

  // Be sure we have a unique __channel attribute on our event
  if (!(CHANNEL in event)) {
    event[CHANNEL] = DEFAULT_CHANNEL;
  }

  const temp = rule.break(event, true);

  if (temp.length === 0) {
    return event;
  }

  for (let i = 0; i < temp.length; i++) {
    // Add each event to our output
    events.push(temp[i]);
  }

  return (events.length === 1) ? events[0] : events;
};

exports.unload = () => {
  rule = undefined;
  isExistingRule = false;
  getBreakerCache = {};
  shouldMarkCriblBreaker = undefined;
};

//// tests only ///
exports.UT_getRule = () => rule;
exports.UT_getLogger = () => dLogger;