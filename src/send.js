let assert  = require('assert');
let urljoin = require('url-join');
let got     = require('got');
let debug   = require('debug')('statsum');

let contentType = 'application/json';
let serialize   = (data) => JSON.stringify(data);
let deserialize = (data) => JSON.parse(data.toString('utf8'));

/** Send data-point to statsum */
let sendDataPoints = async (configurer, options, payload) => {

  if (!options.token || options.tokenExpires < new Date()) {
    let result = await configurer(options.project);
    assert(result.token, 'token is required from the configurer');
    assert(result.baseUrl, 'baseUrl is required from the configurer');
    assert(result.expires, 'expires is required from the configurer');
    options.token = result.token;
    options.tokenExpires = new Date(result.expires);
    options.baseUrl = result.baseUrl;
  }

  let url = urljoin(options.baseUrl, 'v1/project', options.project);
  try {
    debug('Submitting data-point to: %s', url);
    let res = await got(url, {
      method:   'post',
      headers: {
        'content-type':   contentType,
        'accept':         contentType,
        'authorization':  'Bearer ' + options.token,
      },
      encoding: null,
      body:     serialize(payload),
      timeout:  30 * 1000,
      retries:  5,
    });
  } catch (err) {
    if (err && err.response && err.response.body) {
      let info = deserialize(err.response.body);
      if (info.code && info.message) {
        err = new Error(info.message);
        err.code = info.code;
      }
    }
    throw err;
  }
};

// Export sendDataPoints
module.exports = sendDataPoints;
