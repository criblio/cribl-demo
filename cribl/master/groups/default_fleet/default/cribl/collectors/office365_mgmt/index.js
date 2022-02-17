/* eslint-disable no-await-in-loop */
/* eslint-disable-next-line no-template-curly-in-string */

exports.name = 'Office 365 Management Activity';
exports.version = '0.1';
exports.disabled = false;
exports.hidden = true; // This collector exposed as source Office365MgmtIn
exports.destroyable = false;

const { httpSearch, isHttp200, RestVerb, HttpError, wrapExpr, DEFAULT_TIMEOUT_SECS } = C.internal.HttpUtils;
const { Expression, PartialEvalRewrite } = C.expr;

let rootUrl;
let planType;
let tenantId;
let publisherIdentifier;
let appId;
let clientSecret;
let contentType;
let exprArgs = {};
let batchSize;
let filter;
let earliest;
let latest;
let headers;
let timeout;

const ENTERPRISE_ROOT = 'https://manage.office.com';
const GCC_ROOT = 'https://manage-gcc.office.com';
const GCC_HIGH_ROOT = 'https://manage.office365.us';
const DOD_ROOT = 'https://manage.protection.apps.mil';

const AUTH_URL = 'https://login.microsoftonline.com/${tenantId}/oauth2/token';
const LIST_SUBSCRIPTIONS_URL = '${rootUrl}/api/v1.0/${tenantId}/activity/feed/subscriptions/list';
const LIST_CONTENT_URL = '${rootUrl}/api/v1.0/${tenantId}/activity/feed/subscriptions/content';

const MS_24H = (24 * 60 * 60 * 1000);

// Verify the content type subscription exists. Subscriptions are created externally in the
// office 365 UI as part of setting up the environment. If the Subscritpion does not exist,
// the collector will report an error.
async function subscriptionExists(authToken, logger) {
  // Setup headers for all subsequent discover calls to use.
  headers = { Authorization: wrapExpr(`Bearer ${authToken}`) };
  const params = { PublisherIdentifier: wrapExpr(publisherIdentifier) };
  const listOpts = { url: LIST_SUBSCRIPTIONS_URL, method: RestVerb.GET, params, headers, exprArgs, timeout };

  logger.debug('Listing Subscriptions', { listOpts });
  const subs = await (await httpSearch(listOpts, logger)).extractResult() || [];
  logger.debug('List Subscriptions result', { listOpts, result: subs });
  const theSub = subs.filter(v => v.contentType === contentType);
  if (theSub && theSub.length && theSub[0].status === 'enabled') {
    return;
  }
  // List current subscriptions for the error.
  const currentSubs = subs.filter(s => s.status === 'enabled').map(s => s.contentType);
  throw new Error(`Office365 management activity subscription for content type: ${contentType} does not exist, active subscriptions: ${currentSubs}`);
}

// List content available for the specified content type, note that is paginated and accepts a date range.
// Date range cannot be more than 24 hours or reach back more than 7 days in the past.
async function listContent(authToken, job) {
  const logger = job.logger();
  const results = [];
  const requiredFields = ['contentType', 'contentId', 'contentUri', 'contentCreated', 'contentExpiration', 'source', 'host'];
  const filterExpr = new Expression(filter, { disallowAssign: true,
    partialEval: new PartialEvalRewrite((field) => !requiredFields.includes(field))
  });
  const startTime = earliest.toISOString();
  const endTime = latest.toISOString();
  const params = { PublisherIdentifier: wrapExpr(publisherIdentifier), contentType: wrapExpr(contentType), startTime: wrapExpr(startTime), endTime: wrapExpr(endTime) };
  const opts = { url: LIST_CONTENT_URL, method: RestVerb.GET, params, headers, exprArgs, timeout };
  // Handle multiple pages of results, we know if there is another page once the results are received.
  let page = 0;
  let nextPageUri;
  do {
    logger.debug('Listing Content', { opts });
    const searchResult = await httpSearch(opts, job.logger());
    const data = await searchResult.extractResult() || [];
    nextPageUri = searchResult.res.headers.NextPageUri; // Present if more content available.
    logger.debug('List Content Results', { opts, page, result: data, nextPageUri });
    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      item.source = item.contentUri;
      if (!filterExpr.evalOn(data[i])) {
        logger.debug('Excluding content because it does not match filter', { content: data[i], filter });
        continue; // No filter match
      }
      logger.debug('Content', { item });
      // Add contentTime date to collectible for event filtering
      item.contentTime = new Date(item.contentCreated).getTime() / 1000;
      results.push(item);
      if (results.length >= batchSize) {
        await job.addResults(results);
        results.length = 0;
      }
    }
    opts.url = nextPageUri;
    page++;
  } while (nextPageUri != null)
  await job.addResults(results);
}

async function authenticate(logger) {
  const params = { client_id: wrapExpr(exprArgs.appId), resource: wrapExpr(rootUrl), client_secret: wrapExpr(exprArgs.clientSecret), grant_type: "'client_credentials'" };
  const authOpts = { url: AUTH_URL, method: RestVerb.POST, params, exprArgs, timeout };
  logger.debug('Authenticating');
  const authToken = await (await httpSearch(authOpts, logger)).extractResult('access_token');
  logger.debug('Authentication done', { haveToken: authToken != null });
  if (!authToken) {
    // Error should be thrown above, just in case...
    throw new Error('Authentication failed!');
  }
  return authToken;
}

// Date range cannot be more than 24 hours or reach back more than 7 days in the past.
function validateDateRange() {
  // Verify date range does not span more than 24 hours.
  if (latest.getTime() - earliest.getTime() > MS_24H) {
    throw new Error('Invalid Argument - Date range cannot exceed 24 hours!');
  }
  // Verify startDate does not go back more than 7 days.
  if (earliest.getTime() < Date.now() - (MS_24H * 7)) {
    throw new Error('Invalid Argument - Date range cannot go back more than 7 days in the past!');
  }
}

exports.init = (opts) => {
  const conf = opts.conf;
  filter = conf.filter || 'true';
  planType = conf.plan_type;
  tenantId = conf.tenant_id;
  publisherIdentifier = conf.publisher_identifier || tenantId;
  appId = conf.app_id;
  clientSecret = conf.client_secret;
  contentType = conf.content_type;
  batchSize = conf.maxBatchSize || 10;
  timeout = (conf.timeout != null && +conf.timeout >= 0) ? +conf.timeout : DEFAULT_TIMEOUT_SECS*1000;
  const now = Date.now();
  earliest = new Date(conf.earliest != null ? conf.earliest * 1000 : now - MS_24H);
  latest = new Date(conf.latest != null ? conf.latest * 1000 : now);
  validateDateRange();
  if (!['Audit.AzureActiveDirectory', 'Audit.Exchange', 'Audit.SharePoint', 'Audit.General', 'DLP.All'].includes(contentType)) {
    throw new Error(`Invalid content type: ${contentType}`);
  }
  if (!['enterprise_gcc', 'gcc', 'gcc_high', 'dod'].includes(planType)) {
    throw new Error(`Invalid Subscription Plan: ${planType}`);
  }
  if (planType === 'enterprise_gcc') {
    // 'enterprise_gcc' is really 'enterprise'. enterprise_gcc is a legacy value (pre 3.0) when it was thought, incorrectly,
    // both enterprise and gcc used the same endpoint. See CRIBL-5173 for more info.
    rootUrl = ENTERPRISE_ROOT;
  } else if (planType === 'gcc') {
    rootUrl = GCC_ROOT;
  } else if (planType === 'gcc_high') {
    rootUrl = GCC_HIGH_ROOT;
  } else {
    rootUrl = DOD_ROOT;
  }
  exprArgs = { rootUrl, planType, tenantId, appId, clientSecret, contentType, earliest, latest };
  const missing = ['tenantId', 'appId', 'clientSecret', 'contentType'].filter(v => exprArgs[v] == null);
  if (missing.length) throw new Error(`Missing required configuration=${missing}`);
};

exports.discover = async (job) => {
  const logger = job.logger();
  const authToken = await authenticate(logger);
  // Make sure the subscription exists, will throw if subscription does not exist.
  await subscriptionExists(authToken, logger);
  // Retrieve list of available content, which can be multiple pages / api calls.
  await listContent(authToken, job);
};

exports.collect = async (collectible, job) => {
  const logger = job.logger();
  const authToken = await authenticate(logger);
  const searchOpts = { url: collectible.contentUri, params: {}, method: RestVerb.GET, headers: { Authorization: wrapExpr(`Bearer ${authToken}`) }, timeout };
  const result = await httpSearch(searchOpts, logger);
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

