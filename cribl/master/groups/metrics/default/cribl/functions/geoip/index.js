const cLogger = C.util.getLogger('func:geoip');
const { NestedPropertyAccessor } = C.expr;
const { GeoIpDatabase } = C.Lookup;

exports.name = 'GeoIP';
exports.version = '0.1';
exports.disabled = false;
exports.group = 'Standard';

let geoipDb;
let inField;
let outField;

exports.init = (opts) => {
  geoipDb = undefined;
  const { file } = opts.conf;
  return Promise.resolve().then(() => {
    inField = new NestedPropertyAccessor(opts.conf.inField || 'ip');
    outField = new NestedPropertyAccessor(opts.conf.outField || 'geoip');
    const gDb = GeoIpDatabase.open(file);
    return gDb.ready()
      .then(() => {geoipDb = gDb;});
  });
};

exports.process = (event) => {
   if(!geoipDb) return event;
   return geoipDb.ready().then(() => { 
       const ip = inField.evalOn(event);
       if(ip) outField.set(event, geoipDb.get(ip));
       return event;
   });
};

exports.unload = () => {
  geoipDb && geoipDb.close();
  geoipDb = undefined;
  inField = undefined;
  outField = undefined;
}
