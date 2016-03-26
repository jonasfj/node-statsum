Statsum Client for Node.js
==========================

A Javascript client library for [statsum](https://github.com/jonasfj/statsum).

**Usage:**
```js

let Statsum = require('statsum');

// Create a project token
let token = Statsum.createToken('my-project', 'SECRET', '24h');

// Create a client object
let statsum = new Statsum({
  project:  'my-project',
  token:    token,
  baseUrl:  'https://statsum.example.com',
});

// Send metrics
statsum.count('my-counter', 1);
statsum.value('my-timer', 500);

// Create a child client (enforcing a prefix)
let child = statsum.prefix('child');
child.count('my-counter', 1); // submitted as 'child.my-counter'
child.value('my-timer', 500); // submitted as 'child.my-timer'

// Send tagged metrics
statsum.value({region: 'us-west-1', method: 'get'}, 542);
// Will be reported 4  time, the equivalent of:
statsum.value('region:us-west-1.method:get',  542);
statsum.value('all-region.method:get',        542);
statsum.value('region:us-west-1.all-method',  542);
statsum.value('all-region.all-method',        542);
// Use this feature with care, too many tags and the number of metrics explodes.
```
