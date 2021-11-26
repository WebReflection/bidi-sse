# bidi-sse

<sup>**Social Media Photo by [Ian Taylor](https://unsplash.com/@carrier_lost) on [Unsplash](https://unsplash.com/)**</sup>
  

Bidirectional [Server-sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events).


### About

Heavily inspired by the awesome [ws module](https://github.com/websockets/ws#readme), *bidi-sse* provides a *Web Sockets* friendly API, although based on both [fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) and [EventSource](https://developer.mozilla.org/en-US/docs/Web/API/EventSource) primitives.

Thanks to its different approach, both client side and server side code are minimal (~0.7K on the client, few lines on the server), and there is no need to roundtrip *ping* / *pong* to know whenever a client is gone, as that happens pretty much instantly, or better, as soon as the alive connection gets closed.


### Example

Following a very simple setup to explain the basics behind this module, one for the *client side*, and one for the *server side*.


#### On the client

```js
import BidiSSE from 'bidi-sse/client';

const bidi = new BidiSSE('/bidi-path');

// use it like a socket
bidi.on('open', () => {
  console.log('open');
  // send data once connected at any time
  bidi.send({some: 'data'});
});

bidi.on('message', console.log);
bidi.on('error', console.error);
bidi.on('close', () => console.log('closed'));
```

#### On the server

```js
const express = require('express');
const BidiSSE = require('bidi-sse/server');

const bidi = new BidiSSE('/bidi-path');

// use the handler
const app = express();
app.use(bidi.handler);
app.use(express.static(__dirname));
app.listen(8080);

// and set it up like a socket
bidi.on('connection', client => {

  // all clients via .clients for broadcast
  console.log('clients', bidi.clients.length);

  // setup clients also like sockets
  client.on('message', data => {
    console.log('client', data);
    client.send(data);
  });

  client.on('close', () => {
    console.log('client is gone');
  });
});
```

### API

Both *client* and *server* constructors accept a `path` to enable as *bidi-sse*, and an optional `options` object.

**client**
```js
const bidi = new BidiSSE('/some-path', {
  // optional fetch options to merge per each send
  // using credentials 'omit' set credentials for EventSource on
  fetch: {credentials: 'omit'},

  // default JSON serializer to send/receive data
  JSON
});
```

**server**
```js
const bidi = new BidiSSE('/some-path', {
  // if its value is `"cors"` it enables CORS via headers
  mode: '',

  // optional headers to include per each SSE initialization
  // or further posted data via send(...)
  headers: {},

  // default JSON serializer to send/receive data
  JSON
});
```

Please note that the **JSON** library must be the same for both *client* and *server*. [flatted](https://www.npmjs.com/package/flatted) or [@ungap/structured-clone/json](https://github.com/ungap/structured-clone#tojson) are just two possible parsers able to deal with recursion and, in the structured clone case, more data kinds than JSON.
