suite('statsum', () => {
  let assert    = require('assert');
  let Statsum   = require('../');
  let jwt       = require('jsonwebtoken');
  let http      = require('http');
  let getStream = require('get-stream');
  let _         = require('lodash');
  let debug     = require('debug')('statsum');

  let deserialize = (data) => JSON.parse(data.toString('utf8'));
  let server = null;
  let baseUrl = null;
  let payload = null;
  let configurer = null;
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

    configurer = async (project) => { return {
      project,
      baseUrl,
      token: 'KEY',
      expires: new Date().toJSON()
    }};
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
    let statsum = new Statsum(configurer, {project: 'test'});

    statsum.count('my-counter', 10);
    await statsum.flush();
    assert(payload.counters, 'missing counters');
    assert(payload.counters.length === 1, 'wrong number of entries');
    assert(payload.counters[0], 'missing entry');
    assert(payload.counters[0].k === 'my-counter', 'missing my-counter');
    assert(payload.counters[0].v === 10, 'wrong count');

    statsum.count('my-counter2', 2);
    statsum.count('my-counter2', 5);
    await statsum.flush();
    assert(payload.counters, 'missing counters');
    assert(payload.counters.length === 1, 'wrong number of entries');
    assert(payload.counters[0], 'missing entry');
    assert(payload.counters[0].k === 'my-counter2', 'missing my-counter2');
    assert(payload.counters[0].v === 7, 'wrong count');
  });

  test('value()', async () => {
    let statsum = new Statsum(configurer, {project: 'test'});

    statsum.measure('my-timer', 10);
    await statsum.flush();
    assert(payload.measures, 'missing measures');
    assert(payload.measures.length === 1, 'wrong number of entries');
    assert(payload.measures[0], 'missing entry');
    assert(payload.measures[0].k === 'my-timer', 'missing my-timer');
    assert(payload.measures[0].v.length === 1, 'expected 1 value');
    assert(payload.measures[0].v[0] === 10, 'wrong value');

    statsum.measure('my-timer2', 2);
    statsum.measure('my-timer2', 5);
    await statsum.flush();
    assert(payload.measures, 'missing measures');
    assert(payload.measures.length === 1, 'wrong number of entries');
    assert(payload.measures[0], 'missing entry');
    assert(payload.measures[0].k === 'my-timer2', 'missing my-timer2');
    assert(payload.measures[0].v.length === 2, 'expected 2 values');
    assert(payload.measures[0].v[0] === 2, 'wrong value');
    assert(payload.measures[0].v[1] === 5, 'wrong value');
  });

  test('value() w. tags', async () => {
    let statsum = new Statsum(configurer, {project: 'test'});

    statsum.measure({tag1: 'v1', tag2: 'v2'}, 5);
    statsum.measure({tag1: 'v1', tag2: 'v1'}, 5);
    await statsum.flush();
    assert(payload.measures, 'missing measures');
    assert(payload.measures.length === 6, 'wrong number of entries');
    assert(_.every([
      'tag1:v1.tag2:v2',
      'all-tag1.tag2:v2',
      'tag1:v1.tag2:v1',
      'all-tag1.tag2:v1',
      'tag1:v1.all-tag2',
      'all-tag1.all-tag2',
    ], key => _.includes(payload.measures.map(e => e.k), key)));
    assert(_.find(payload.measures, {
      k: 'tag1:v1.tag2:v2',
    }).v.length === 1);
    assert(_.find(payload.measures, {
      k: 'all-tag1.all-tag2',
    }).v.length === 2);
  });

  test('prefix().count()', async () => {
    let statsum = new Statsum(configurer, {project: 'test'});
    statsum = statsum.prefix('my')

    statsum.count('counter', 10);
    await statsum.flush();
    assert(payload.counters, 'missing counters');
    assert(payload.counters.length === 1, 'wrong number of entries');
    assert(payload.counters[0], 'missing entry');
    assert(payload.counters[0].k === 'my.counter', 'missing my.counter');
    assert(payload.counters[0].v === 10, 'wrong count');

    statsum.count('counter2', 2);
    statsum.count('counter2', 5);
    await statsum.flush();
    assert(payload.counters, 'missing counters');
    assert(payload.counters.length === 1, 'wrong number of entries');
    assert(payload.counters[0], 'missing entry');
    assert(payload.counters[0].k === 'my.counter2', 'missing my.counter2');
    assert(payload.counters[0].v === 7, 'wrong count');
  });

  test('prefix().measure()', async () => {
    let statsum = new Statsum(configurer, {project: 'test'});
    statsum = statsum.prefix('my')

    statsum.measure('timer', 10);
    await statsum.flush();
    assert(payload.measures, 'missing measures');
    assert(payload.measures.length === 1, 'wrong number of entries');
    assert(payload.measures[0], 'missing entry');
    assert(payload.measures[0].k === 'my.timer', 'missing my.timer');
    assert(payload.measures[0].v.length === 1, 'expected 1 value');
    assert(payload.measures[0].v[0] === 10, 'wrong value');

    statsum.measure('timer2', 2);
    statsum.measure('timer2', 5);
    await statsum.flush();
    assert(payload.measures, 'missing measures');
    assert(payload.measures.length === 1, 'wrong number of entries');
    assert(payload.measures[0], 'missing entry');
    assert(payload.measures[0].k === 'my.timer2', 'missing my.timer2');
    assert(payload.measures[0].v.length === 2, 'expected 2 values');
    assert(payload.measures[0].v[0] === 2, 'wrong value');
    assert(payload.measures[0].v[1] === 5, 'wrong value');
  });

  test('prefix().prefix()', async () => {
    let statsum = new Statsum(configurer, {project: 'test'});
    statsum = statsum.prefix('my').prefix('count');

    statsum.count('2', 10);
    statsum.count('2', 2);
    await statsum.flush();
    assert(payload.counters, 'missing counters');
    assert(payload.counters.length === 1, 'wrong number of entries');
    assert(payload.counters[0], 'missing entry');
    assert(payload.counters[0].k === 'my.count.2', 'missing my.count.2');
    assert(payload.counters[0].v === 12, 'wrong count');
  });
});
