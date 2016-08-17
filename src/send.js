let assert  = require('assert');
let urljoin = require('url-join');
let got     = require('got');
let debug   = require('debug')('statsum');
let uuid    = require('uuid');
let Promise = require('promise');

let contentType = 'application/json';
let serialize   = (data) => JSON.stringify(data);
let deserialize = (data) => JSON.parse(data.toString('utf8'));
let sleep       = (time) => new Promise(accept => setTimeout(accept, time));

/** Maximum number of retries */
const MAX_RETRIES = 7;

/** Send data-point to statsum */
let sendDataPoints = async (configurer, options, payload) => {
  // Ensure we have credentials and url
  if (!options.token || options.tokenExpires < new Date()) {
    let result = await configurer(options.project);
    assert(result.token, 'token is required from the configurer');
    assert(result.baseUrl, 'baseUrl is required from the configurer');
    assert(result.expires, 'expires is required from the configurer');
    options.token = result.token;
    options.tokenExpires = new Date(result.expires);
    options.baseUrl = result.baseUrl;
  }

  // Use the same request-id for all retries
  let requestId = uuid.v4();

  // Submit metrics with retries
  let url = urljoin(options.baseUrl, 'v1/project', options.project);
  debug('Submitting data-points to: %s', url);
  let i = 0;
  while (true) {
    try {
      let res = await got(url, {
        method:   'post',
        headers: {
          'content-type':         contentType,
          'accept':               contentType,
          'authorization':        'Bearer ' + options.token,
          'x-statsum-request-id': requestId,
        },
        encoding: null,
        body:     serialize(payload),
        timeout:  45 * 1000,
        retries:  0,
      });
    } catch (err) {
      // Don't retry 4xx errors
      err.retries = i;
      if (err.statusCode && 400 <= err.statusCode && err.statusCode < 500) {
        if (err.response && err.response.body) {
          let info = deserialize(err.response.body);
          if (info.code && info.message) {
            err = new Error(info.message);
            err.code = info.code;
          }
        }
        throw err;
      }
      // Limit retries
      if (i > MAX_RETRIES) {
        throw err;
      }
      // Sleep between retries
      const noise = Math.random() * 100;
      await sleep((1 << i++) * 500 + noise);
      continue;
    }
    // If there is no errors, then no retries
    break;
  }
};

// Export sendDataPoints
module.exports = sendDataPoints;
