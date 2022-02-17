exports.name = 'License Expiration';
exports.type = 'message';
exports.category = 'license';

exports.init = (opts) => {}

exports.build = () => ({
  filter: `id === 'LICENSE_EXPIRING_SOON' || id === 'LICENSE_EXPIRED'`,
  pipeline: {
    conf: {
      functions: [] // passthru
    }
  }
})