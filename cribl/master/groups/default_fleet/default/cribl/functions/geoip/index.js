const cLogger = C.util.getLogger('func:geoip');
const { NestedPropertyAccessor } = C.expr;
const { GeoIpDatabase } = C.internal.Lookup;

exports.name = 'GeoIP';
exports.version = '0.1';
exports.disabled = false;
exports.group = 'Standard';

let geoipDb;
let inFields = [];
let outFields = [];

exports.init = (opts) => {
  geoipDb = undefined;
  const { file } = opts.conf;
  return Promise.resolve().then(() => {
    inFields.push(new NestedPropertyAccessor(opts.conf.inField || 'ip'));
    outFields.push(new NestedPropertyAccessor(opts.conf.outField || 'geoip'));
    const extraFields = opts.conf.additionalFields || [];
    for (let i = 0; i < extraFields.length; i++) {
      const extraField = extraFields[i];
      const eInField = extraField.extraInField;
      const eOutField = extraField.extraOutField;
      if (eInField && eOutField) {
        inFields.push(new NestedPropertyAccessor(eInField));
        outFields.push(new NestedPropertyAccessor(eOutField));
      }
    }
    const gDb = GeoIpDatabase.open(file);
    return gDb.ready()
      .then(() => { geoipDb = gDb; });
  });
};

exports.process = (event) => {
  if (!geoipDb) return event;
  return geoipDb.ready().then(() => {
    for (let i = 0; i < inFields.length; i++) {
      const ip = inFields[i].evalOn(event);
      if (ip) outFields[i].set(event, geoipDb.get(ip));
    }
    return event;
  });
};

exports.unload = () => {
  geoipDb && geoipDb.close();
  geoipDb = undefined;
  inFields = [];
  outFields = [];
}
