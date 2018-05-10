Statsum Client for Node.js
==========================

A Javascript client library for [statsum](https://github.com/jonasfj/statsum).

**Usage:**
```js

let Statsum = require('statsum');

// Create a client object
let configurer = async (project) => { return {
  project: 'example-project',
  rootUrl: 'https://example.com',
  token: 'KEY',
  expires: new Date().toJSON()
}};
let statsum = new Statsum(configurer, {project: 'test'});

// Send metrics
statsum.count('my-counter', 1);
statsum.measure('my-timer', 500);

// Create a child client (enforcing a prefix)
let child = statsum.prefix('child');
child.count('my-counter', 1); // submitted as 'child.my-counter'
child.measure('my-timer', 500); // submitted as 'child.my-timer'

// Send tagged metrics
statsum.measure({region: 'us-west-1', method: 'get'}, 542);
// Will be reported 4  time, the equivalent of:
statsum.measure('region:us-west-1.method:get',  542);
statsum.measure('all-region.method:get',        542);
statsum.measure('region:us-west-1.all-method',  542);
statsum.measure('all-region.all-method',        542);
// Use this feature with care, too many tags and the number of metrics explodes.
```
