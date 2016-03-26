suite('utils', () => {
  let utils = require('../lib/utils');
  let assert = require('assert');
  let _ = require('lodash');

  test('joinKeys', () => {
    assert(utils.joinKeys('', '') === '');
    assert(utils.joinKeys('a', '') === 'a');
    assert(utils.joinKeys('', 'a') === 'a');
    assert(utils.joinKeys('a', 'b') === 'a.b');
    assert(utils.joinKeys('aa', 'bb') === 'aa.bb');
  });

  test('formatKey', () => {
    assert(utils.formatKey('') === '');
    assert(utils.formatKey(88) === '88');
    assert(utils.formatKey('ddd') === 'ddd');
    assert(utils.formatKey('ddd.') === 'ddd');
    assert(utils.formatKey('ddd..') === 'ddd');
    assert(utils.formatKey('..ddd') === 'ddd');
    assert(utils.formatKey('.ddd') === 'ddd');
    assert(utils.formatKey('.ddd.') === 'ddd');
    assert(utils.formatKey('..ddd..') === 'ddd');
    assert(utils.formatKey([12, 'test', 3, 4, null,]) === '12.test.3.4');
    assert(utils.formatKey([undefined, 3, 4, null,]) === '3.4');
    assert(utils.formatKey(['a', 'b']) === 'a.b');
    assert(utils.formatKey(['a', '.b']) === 'a.b');
    assert(utils.formatKey(['..a.', '..b.']) === 'a.b');
    assert(utils.formatKey(['..a.', '..b.', ['c', 8]]) === 'a.b.c.8');
  });

  test('iterateKey', () => {
    let testKey = (key, expect) => {
      let results = [];
      utils.iterateKey(key, k => results.push(k));
      assert(_.uniq(results).length === results.length, 'expected unique keys');
      expect.forEach(expected => {
        assert(_.includes(results, expected), 'Expected: ' + expected);
      });
      results.forEach(result => {
        assert(_.includes(expect, result), 'Result: ' + result + ' not expected');
      });
    };


    testKey('', ['']);
    testKey(88, ['88']);
    testKey('ddd', ['ddd']);
    testKey('ddd.', ['ddd']);
    testKey('ddd..', ['ddd']);
    testKey('..ddd', ['ddd']);
    testKey('.ddd', ['ddd']);
    testKey('.ddd.', ['ddd']);
    testKey('..ddd..', ['ddd']);
    testKey([12, 'test', 3, 4, null,], ['12.test.3.4']);
    testKey([undefined, 3, 4, null,], ['3.4']);
    testKey(['a', 'b'], ['a.b']);
    testKey(['a', '.b'], ['a.b']);
    testKey(['..a.', '..b.'], ['a.b']);
    testKey(['..a.', '..b.', ['c', 8]], ['a.b.c.8']);

    testKey({tag1: 'v1', tag2: 'v2'}, [
      'tag1:v1.tag2:v2',
      'all-tag1.tag2:v2',
      'tag1:v1.all-tag2',
      'all-tag1.all-tag2',
    ]);
    testKey({tag1: 'v1', tag2: 'v1'}, [
      'tag1:v1.tag2:v1',
      'all-tag1.tag2:v1',
      'tag1:v1.all-tag2',
      'all-tag1.all-tag2',
    ]);
  });
});
