exports.name = 'Trim Timestamp';
exports.version = '0.2';
exports.group = 'Advanced';
const { NestedPropertyAccessor } = C.expr;

let fieldName;
exports.init = (opts) => {
  const conf = opts.conf || {};
  const field = (conf.field || '').trim();
  fieldName = undefined;
  if (field) {
    fieldName = new NestedPropertyAccessor(field);
  }
};

exports.process = (event) => {
  if (!event._raw) {
    return event;
  }
  const start = Number(event.timestartpos);
  const end = Number(event.timeendpos);
  if (start === 0 && !Number.isNaN(end)) {
    if (fieldName) {
      fieldName.set(event, event._raw.substr(0, end));
    }
    event._raw = event._raw.substr(end).trimLeft();
    event.timestartpos = undefined;
    event.timeendpos = undefined;
  }
  return event;
};
