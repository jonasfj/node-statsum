suite('statsum', () => {
  let assert    = require('assert');
  let Statsum   = require('../');
  let jwt       = require('jsonwebtoken');
  let http      = require('http');
  let getStream = require('get-stream');
  let _         = require('lodash');
  let debug     = require('debug')('statsum');
  let msgpack = null;
  try {
    msgpack = require('msgpack');
  } catch (err) {
    debug('Failed to load msgpack (optional dependency) falling back to json');
  }
  let deserialize = (data) => JSON.parse(data.toString('utf8'));
  if (msgpack) {
    deserialize = (data) => msgpack.unpack(data);
  }

  let server = null;
  let baseUrl = null;
  let payload = null;
  before(async () => {
    server = http.createServer();
    server.on('request', async (req, res) => {
      debug('Request for %s with method: %s', req.url, req.method);
      payload = null;
      if (req.method === 'POST' && req.headers.authorization === 'Bearer KEY') {
        payload = deserialize(await getStream.buffer(req));
      }
      res.writeHead(200);
      res.end();
    });
    await new Promise((accept, reject) => {
      server.once('listening', accept);
      server.once('error', reject);
      server.listen();
    });
    baseUrl = 'http://localhost:' + server.address().port;
  });
  after(async () => {
    server.close();
    await new Promise(accept => server.on('close', accept));
  });

  test('createToken()', () => {
    let token = Statsum.createToken('test', 'secret');
    let result = jwt.verify(token, 'secret', {algorithm: 'HS256'});
    assert(result.project == 'test');
    assert(result.exp > Date.now() / 1000 + 60);
  });

  test('count()', async () => {
    let statsum = new Statsum({project: 'test', token: 'KEY', baseUrl});

    statsum.count('my-counter', 10);
    await statsum.flush();
    assert(payload.countMetrics, 'missing countMetrics');
    assert(payload.countMetrics.length === 1, 'wrong number of entries');
    assert(payload.countMetrics[0], 'missing entry');
    assert(payload.countMetrics[0].k === 'my-counter', 'missing my-counter');
    assert(payload.countMetrics[0].v === 10, 'wrong count');

    statsum.count('my-counter2', 2);
    statsum.count('my-counter2', 5);
    await statsum.flush();
    assert(payload.countMetrics, 'missing countMetrics');
    assert(payload.countMetrics.length === 1, 'wrong number of entries');
    assert(payload.countMetrics[0], 'missing entry');
    assert(payload.countMetrics[0].k === 'my-counter2', 'missing my-counter2');
    assert(payload.countMetrics[0].v === 7, 'wrong count');
  });

  test('value()', async () => {
    let statsum = new Statsum({project: 'test', token: 'KEY', baseUrl});

    statsum.value('my-timer', 10);
    await statsum.flush();
    assert(payload.valueMetrics, 'missing valueMetrics');
    assert(payload.valueMetrics.length === 1, 'wrong number of entries');
    assert(payload.valueMetrics[0], 'missing entry');
    assert(payload.valueMetrics[0].k === 'my-timer', 'missing my-timer');
    assert(payload.valueMetrics[0].v.length === 1, 'expected 1 value');
    assert(payload.valueMetrics[0].v[0] === 10, 'wrong value');

    statsum.value('my-timer2', 2);
    statsum.value('my-timer2', 5);
    await statsum.flush();
    assert(payload.valueMetrics, 'missing valueMetrics');
    assert(payload.valueMetrics.length === 1, 'wrong number of entries');
    assert(payload.valueMetrics[0], 'missing entry');
    assert(payload.valueMetrics[0].k === 'my-timer2', 'missing my-timer2');
    assert(payload.valueMetrics[0].v.length === 2, 'expected 2 values');
    assert(payload.valueMetrics[0].v[0] === 2, 'wrong value');
    assert(payload.valueMetrics[0].v[1] === 5, 'wrong value');
  });

  test('value() w. tags', async () => {
    let statsum = new Statsum({project: 'test', token: 'KEY', baseUrl});

    statsum.value({tag1: 'v1', tag2: 'v2'}, 5);
    statsum.value({tag1: 'v1', tag2: 'v1'}, 5);
    await statsum.flush();
    assert(payload.valueMetrics, 'missing valueMetrics');
    assert(payload.valueMetrics.length === 6, 'wrong number of entries');
    assert(_.every([
      'tag1:v1.tag2:v2',
      'all-tag1.tag2:v2',
      'tag1:v1.tag2:v1',
      'all-tag1.tag2:v1',
      'tag1:v1.all-tag2',
      'all-tag1.all-tag2',
    ], key => _.includes(payload.valueMetrics.map(e => e.k), key)));
    assert(_.find(payload.valueMetrics, {
      k: 'tag1:v1.tag2:v2',
    }).v.length === 1);
    assert(_.find(payload.valueMetrics, {
      k: 'all-tag1.all-tag2',
    }).v.length === 2);
  });

  test('prefix().count()', async () => {
    let statsum = new Statsum({project: 'test', token: 'KEY', baseUrl});
    statsum = statsum.prefix('my')

    statsum.count('counter', 10);
    await statsum.flush();
    assert(payload.countMetrics, 'missing countMetrics');
    assert(payload.countMetrics.length === 1, 'wrong number of entries');
    assert(payload.countMetrics[0], 'missing entry');
    assert(payload.countMetrics[0].k === 'my.counter', 'missing my.counter');
    assert(payload.countMetrics[0].v === 10, 'wrong count');

    statsum.count('counter2', 2);
    statsum.count('counter2', 5);
    await statsum.flush();
    assert(payload.countMetrics, 'missing countMetrics');
    assert(payload.countMetrics.length === 1, 'wrong number of entries');
    assert(payload.countMetrics[0], 'missing entry');
    assert(payload.countMetrics[0].k === 'my.counter2', 'missing my.counter2');
    assert(payload.countMetrics[0].v === 7, 'wrong count');
  });

  test('prefix().value()', async () => {
    let statsum = new Statsum({project: 'test', token: 'KEY', baseUrl});
    statsum = statsum.prefix('my')

    statsum.value('timer', 10);
    await statsum.flush();
    assert(payload.valueMetrics, 'missing valueMetrics');
    assert(payload.valueMetrics.length === 1, 'wrong number of entries');
    assert(payload.valueMetrics[0], 'missing entry');
    assert(payload.valueMetrics[0].k === 'my.timer', 'missing my.timer');
    assert(payload.valueMetrics[0].v.length === 1, 'expected 1 value');
    assert(payload.valueMetrics[0].v[0] === 10, 'wrong value');

    statsum.value('timer2', 2);
    statsum.value('timer2', 5);
    await statsum.flush();
    assert(payload.valueMetrics, 'missing valueMetrics');
    assert(payload.valueMetrics.length === 1, 'wrong number of entries');
    assert(payload.valueMetrics[0], 'missing entry');
    assert(payload.valueMetrics[0].k === 'my.timer2', 'missing my.timer2');
    assert(payload.valueMetrics[0].v.length === 2, 'expected 2 values');
    assert(payload.valueMetrics[0].v[0] === 2, 'wrong value');
    assert(payload.valueMetrics[0].v[1] === 5, 'wrong value');
  });

  test('prefix().prefix()', async () => {
    let statsum = new Statsum({project: 'test', token: 'KEY', baseUrl});
    statsum = statsum.prefix('my').prefix('count');

    statsum.count('2', 10);
    statsum.count('2', 2);
    await statsum.flush();
    assert(payload.countMetrics, 'missing countMetrics');
    assert(payload.countMetrics.length === 1, 'wrong number of entries');
    assert(payload.countMetrics[0], 'missing entry');
    assert(payload.countMetrics[0].k === 'my.count.2', 'missing my.count.2');
    assert(payload.countMetrics[0].v === 12, 'wrong count');
  });
});