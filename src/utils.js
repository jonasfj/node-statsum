let _ = require('lodash');

/** Separator used in metric paths */
const SEPARATOR = '.';

/** Join two keys with SEPARATOR if necessary */
let joinKeys = (k1, k2) => {
  if (k1 !== '' && k2 !== '') {
    return k1 + SEPARATOR + k2;
  } else {
    return k1 + k2;
  }
};

// Export joinKeys
exports.joinKeys = joinKeys;

/** Format a key for use as metric name */
let formatKey = (key) => {
  if (typeof(key) === 'number') {
    return '' + key;
  }
  if (typeof(key) === 'string') {
    return _.trim(key, SEPARATOR);
  }
  if (key instanceof Array) {
    return key.filter(k => k !== null && k !== undefined)
              .map(k => formatKey(k))
              .join(SEPARATOR);
  }
  let err = new Error('Key type: ' + typeof(key) + ' is not supported!');
  err.key = key;
  throw err;
};

// Export formatKey
exports.formatKey = formatKey;

/**
 * Iterate keys in the key construct, calling cb() for each key.
 *
 * This is mostly for the case where we have an object:
 *   {tag1: 'val1', tag2: 'val2'}
 * And we want keys:
 *   - tag1:val1.tag2:val2
 *   - all-tag1.tag2:val2
 *   - tag1:val1.all-tag2
 *   - all-tag1.all-tag2
 *
 */
let iterateKey = (key, cb) => {
  if (typeof(key) === 'number') {
    return cb('' + key);
  }
  if (typeof(key) === 'string') {
    return cb(_.trim(key, SEPARATOR));
  }
  if (key instanceof Array) {
    return cb(key.filter(k => k !== null && k !== undefined)
                 .map(k => formatKey(k))
                 .join(SEPARATOR));
  }
  if (typeof(key) === 'object') {
    if (key === null || key === undefined) {
      return cb('');
    }
    let entries = _.keys(key).filter(k => key[k] != null).sort();
    let N = entries.length;
    if (N > 5) {
      let err = new Error(
        'Key may not have more than 5 tags, as this would give more than 64 ' +
        'combination. This is a bad design and performance will degrade. ' +
        'You should identify combinations that you do not care about, ' +
        'and simplify the tags a accordingly'
      );
      err.key = key;
      err.tags = entries;
      throw err;
    }
    let f = (s, i) => {
      if (i >= N) {
        return cb(s);
      }
      let entry = entries[i];
      let tag   = _.trim(entry, SEPARATOR);
      let val   = formatKey(key[entry]);
      f(joinKeys(s, tag + ':' + val), i + 1);
      f(joinKeys(s, 'all-' + tag), i + 1);
    };
    return f('', 0);
  }
  let err = new Error('Key type: ' + typeof(key) + ' is not supported!');
  err.key = key;
  throw err;
};

// Export iterateKey
exports.iterateKey = iterateKey;
