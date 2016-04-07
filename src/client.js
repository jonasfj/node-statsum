let assert                = require('assert');
let events                = require('events');
let _                     = require('lodash');
let debug                 = require('debug')('statsum');
let utils                 = require('./utils');
let sendDataPoints        = require('./send');
let PrefixedStatsumClient = require('./prefixedclient');

/** StatsumClient object for collecting data-points and sending them */
class StatsumClient extends events.EventEmitter {
  /**
   * Create a statsum client.
   *
   * Configurer: A function that returns an object like
   * ```js
   * {
   *   project:       '...',                  // Project to submit for
   *   token:         '...',                  // JWT token
   *   baseUrl:       'https://example.com/', // baseUrl for the server
   *   expires:       'date-time',            // Time at which the token expires
   * }
   * ```
   *
   * Options:
   * ```js
   * {
   *   project:       '...',                  // Project to submit for
   *   maxDataPoints: 10000,                  // Max data-points before flushing
   *   maxDelay:      90,                     // Max delay before flush (s)
   *   minDelay:      30,                     // Min delay before flush (s)
   *   emitErrors:    false,                  // Emit 'error' events on errors
   * }
   * ```
   */
  constructor(configurer, options) {
    super();
    this._options = options = _.defaults({}, options || {}, {
      maxDataPoints:  10000,
      maxDelay:       90,
      minDelay:       30,
      emitErrors:     false,
    });
    assert(options.project, 'project is required');
    assert(typeof(options.minDelay) === 'number', 'minDelay must be a number');
    assert(typeof(options.maxDelay) === 'number', 'maxDelay must be a number');
    assert(options.maxDelay >= 30, 'maxDelay must be > 30 seconds');
    assert(typeof(options.maxDataPoints) === 'number',
           'maxDataPoints must be a number');
    options.minDelay = Math.min(options.minDelay, options.maxDelay);
    this._counters = {};
    this._measures = {};
    this._flushTimer = null;
    this._dataPoints = 0;
    this._configurer = configurer;
  }

  /** Increment counter for `key` with `count` */
  count(key, count = 1) {
    utils.iterateKey(key, k => {
      if (this._counters[k] === undefined) {
        // A counter is only one data-point when it's increment further
        this._dataPoints += 1;
        this._counters[k] = count;
      } else {
        this._counters[k] += count;
      }
    });
    this._scheduleFlush();
  }

  /** Add `value` to measure for `key` */
  measure(key, value) {
    utils.iterateKey(key, k => {
      this._dataPoints += 1;
      if (this._measures[k] === undefined) {
        this._measures[k] = [value];
      } else {
        this._measures[k].push(value);
      }
    });
    this._scheduleFlush();
  }

  /** Construct child StatsumClient where everything is prefixed `prefix` */
  prefix(key) {
    key = utils.formatKey(key);
    return new PrefixedStatsumClient(key, this);
  }

  /** Flush all data-points */
  async flush() {
    // Clear the timer if any
    if (this._flushTimer) {
      clearTimeout(this._flushTimer);
      this._flushTimer = null;
    }

    // Construct the payload
    let payload = {
      counters: _.map(this._counters, (v, k) => {return {k, v}}),
      measures: _.map(this._measures, (v, k) => {return {k, v}}),
    };
    // Nice to have stats for debugging (doesn't really cost anything)
    let dataPoints = this._dataPoints;

    // Reset state
    this._counters    = {};
    this._measures    = {};
    this._dataPoints  = 0;

    // Send payload
    try {
      debug(
        'Submitting %s data-points with dimensionality %s to project: %s',
        dataPoints, payload.counters.length + payload.measures.length,
        this._options.project,
      );
      await sendDataPoints(this._configurer, this._options, payload);
    } catch (err) {
      debug('Failed to send data-points with error: %s, stack: %j', err, err);
      if (this._options.emitErrors) {
        this.emit('error', err);
      }
    }
  }

  _scheduleFlush() {
    if (this._dataPoints > this._options.maxDataPoints) {
      this.flush();
    } else if (!this._flushTimer) {
      // Pick a random delay between minDelay and maxDelay
      let range = this._options.maxDelay - this._options.minDelay;
      let delay = this._options.minDelay + Math.random() * range;
      this._flushTimer = setTimeout(() => this.flush(), delay);
    }
  }

  /** Create token for a project */
  static createToken(project, secret, expiresIn = '96h') {
    let jwt = require('jsonwebtoken');
    return jwt.sign({project}, secret, {
      algorithm: 'HS256',
      expiresIn,
    });
  }
};

// Export StatsumClient
module.exports = StatsumClient;
