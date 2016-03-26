let assert = require('assert');
let utils = require('./utils');

/** Prefix StatsumClient */
class PrefixedStatsumClient {
  constructor(prefix, parent) {
    assert(prefix && parent);
    this._parent = parent;
    this._prefix = prefix;
  }

  count(key, count = 1) {
    utils.iterateKey(key, k => {
      k = utils.joinKeys(this._prefix, k);
      if (this._parent._countMetrics[k] === undefined) {
        this._parent._dataPoints += 1;
        this._parent._countMetrics[k] = count;
      } else {
        this._parent._countMetrics[k] += count;
      }
    });
    this._parent._scheduleFlush();
  }

  value(key, value) {
    utils.iterateKey(key, k => {
      k = utils.joinKeys(this._prefix, k);
      this._parent._dataPoints += 1;
      if (this._parent._valueMetrics[k] === undefined) {
        this._parent._valueMetrics[k] = [value];
      } else {
        this._parent._valueMetrics[k].push(value);
      }
    });
    this._parent._scheduleFlush();
  }

  prefix(key) {
    key = utils.formatKey(key);
    key = utils.joinKeys(this._prefix, key);
    return new PrefixedStatsumClient(key, this._parent);
  }

  flush() {
    return this._parent.flush();
  }
};

// Export PrefixedStatsumClient
module.exports = PrefixedStatsumClient;
