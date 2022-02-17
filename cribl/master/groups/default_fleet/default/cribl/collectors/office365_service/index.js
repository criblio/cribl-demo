/* eslint-disable no-await-in-loop */
/* eslint-disable-next-line no-template-curly-in-string */
exports.name = 'Office 365 Service Communications';
exports.version = '0.1';
exports.disabled = false;
exports.hidden = true; // This collector exposed as source Office365ServicesIn
exports.destroyable = false;

const { httpSearch, isHttp200, RestVerb, HttpError, wrapExpr, DEFAULT_TIMEOUT_SECS } = C.internal.HttpUtils;

let contentType;
let tenantId;
let appId;
let clientSecret;
let contentUrl;
let exprArgs = {};
let earliest;
let timeout;

const CONTENT_CURRENT  = 'CurrentStatus';
const CONTENT_MESSAGES = 'Messages';

exports.init = (opts) => {
  const conf = opts.conf;
  tenantId = conf.tenant_id;
  appId = conf.app_id;
  clientSecret = conf.client_secret;
  contentType = conf.content_type;
  if (![CONTENT_CURRENT, CONTENT_MESSAGES].includes(contentType)) {
    throw new Error(`Invalid contentType: ${conf.content_type}`);
  }
  exprArgs = { tenantId, appId, clientSecret, contentType };
  const remaining = ['tenantId','appId','clientSecret'].filter(k => !exprArgs[k]);
  if (remaining.length) {
    throw new Error(`Invalid configuration missing: ${remaining}`);
  }
  if (contentType === CONTENT_CURRENT) {
    contentUrl = 'https://graph.microsoft.com/v1.0/admin/serviceAnnouncement/healthOverviews';
  } else if (contentType === CONTENT_MESSAGES) {
    contentUrl = 'https://graph.microsoft.com/v1.0/admin/serviceAnnouncement/messages';
  }
  earliest = conf.earliest ? new Date(conf.earliest * 1000) : undefined;
  timeout = (conf.timeout != null && +conf.timeout >= 0) ? +conf.timeout : DEFAULT_TIMEOUT_SECS*1000;
};

function getCollectParams() {
  const params = {};
  if (earliest && contentType === CONTENT_MESSAGES) {
    // Get messages updated since earliest.
    params['$filter'] = wrapExpr(`lastModifiedDateTime ge ${earliest.toISOString()}`);
  }
  return params;
}
exports.discover = async (job) => {
  await job.addResult({ source: contentUrl });
};

exports.collect = async (collectible, job) => {
  // Authenticate
  const authParams = { client_id: wrapExpr(exprArgs.appId), resource: "'https://graph.microsoft.com'", client_secret: wrapExpr(exprArgs.clientSecret), grant_type: "'client_credentials'" };
  const authOpts = { url: 'https://login.microsoftonline.com/${tenantId}/oauth2/token', method: RestVerb.POST, params: authParams, exprArgs, timeout };
  const authToken = await (await httpSearch(authOpts, job.logger())).extractResult('access_token');
  // Collect
  const params = getCollectParams();
  const searchOpts = { url: collectible.source, params, method: RestVerb.GET, headers: { Authorization: wrapExpr(`Bearer ${authToken}`) }, timeout };
  const result = await httpSearch(searchOpts, job.logger());
  result.res.on('end', () => {
    if (!isHttp200(result.res.statusCode)) {
      const error = new HttpError('Office365 collect error', result.res.statusCode, { host: result.host, port: result.port, path: result.path, method: result.method });
      job.reportError(error, 'JobFatal').catch(() => {});
    }
  }).on('error', (error) => {
    job.reportError(error, 'JobFatal').catch(() => {});
  });
  return result.stream();
};
