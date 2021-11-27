# bidi-sse

<sup>**Social Media Photo by [Ian Taylor](https://unsplash.com/@carrier_lost) on [Unsplash](https://unsplash.com/)**</sup>

Bidirectional [Server-sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events).


### About

Heavily inspired by the awesome [ws module](https://github.com/websockets/ws#readme), *bidi-sse* provides a *Web Sockets* friendly API, although based on both [fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) and [EventSource](https://developer.mozilla.org/en-US/docs/Web/API/EventSource) primitives.

Thanks to its different approach, both client side and server side code are minimal (~0.7K on the client, few lines on the server), and there is no need to roundtrip *ping* / *pong* to know whenever a client is gone, as that happens pretty much instantly, or better, as soon as the alive connection gets closed.


### Example

Following a very simple setup to explain the basics behind this module, one for the *client side*, and one for the *server side*.


<details open>
  <summary><strong>Client</strong></summary>
  <div>

```js
import BidiSSE from 'bidi-sse/client';
// or import BidiSSE from 'https://unpkg.com/bidi-sse';

const bidi = new BidiSSE('/bidi-path');

// use it like a socket
bidi.on('open', () => {
  console.log('open');
  // it can send data once connected
  bidi.send({some: 'data'});
});

bidi.on('message', console.log);
bidi.on('error', console.error);
bidi.on('close', () => console.log('closed'));
```
  </div>
</details>

<details open>
  <summary><strong>Server</strong></summary>
  <div>

```js
const express = require('express');
const BidiSSE = require('bidi-sse/server');
// or import BidiSSE from 'https://unpkg.com/bidi-sse/esm/server.js';

const bidi = new BidiSSE('/bidi-path');

// use it as handler or check bidi.handler(req, res) directly
const app = express();
app.use(bidi.handler);
app.use(express.static(__dirname));
app.listen(8080);

// and set it up like a socket
bidi.on('connection', client => {

  // all clients via .clients for broadcast
  console.log('clients', bidi.clients.size);

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
  </div>
</details>



## API

Both *client* and *server* constructors accept a `path` to enable as *bidi-sse*, and an optional `options` object.

<details>
  <summary><strong>Client</strong> - a simplified emitter</summary>
  <div>

```js
const bidi = new BidiSSE('/some-path', {
  // optional fetch options to merge per each send
  // using credentials 'omit' set withCredentials
  // for EventSource as `false`: it's `true` by default.
  fetch: {credentials: 'omit'},

  // default JSON serializer to send/receive data
  JSON
});

// readyState is one of the static BidiSSE values:
bidi.readyState;
// BidiSSE.CONNECTING ➡ open event not fired yet: cannot send
// BidiSSE.OPEN       ➡ open fired: can now send
// BidiSSE.CLOSING    ➡ connection error occurred
// BidiSSE.CLOSED     ➡ bidi.close(); or after connection error

// events + chainable .on(type, fn) method
bidi.once('open', () => console.info('open'));
bidi.on('message', console.log);
bidi.on('error', console.error);
bidi.once('close', () => console.info('close'));

// methods: send throws if readyState is not OPEN
bidi.send({any: 'data'});
bidi.close();

// extra
bidi.emit('type', ...[{any: 'data'}]);
```
  </div>
</details>

<details>
  <summary><strong>Server</strong> - an event emitter with <em>clients</em> notified via <code>connection</code></summary>
  <div>

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

// a read only *Set* of clients, where each client has
// the same properties and methods of the client side one
bidi.clients;

// an auto-bound method usable as express handler or within
// basic nodejs createServer logic. Returns true if the request
// was handled as Server-sent Event
bidi.handler;

// events + chainable .on(type, fn) method
bidi.on('connection', client => {
  // client is unique per visitor and it has all features
  // a client-side bidi instance has
});
bidi.on('close', () => { console.log('all gone'); });

// methods: close throw away all connected clients, then resolves
bidi.close();
```
  </div>
</details>


## Use cases

It is very important to understand *where* this module can easily *fail*, as opposite of being a solution ...

  * this module assumes *every request passes through the same stack*, meaning that *cluster*, *serverless*, *load balance*, or any stack that might diverge the request somewhere else, will easily fail if the browser client `EventSource` points at a different end of the spectrum, and further *UUIDs related* request are sent elsewhere

  * this module was mostly born to satisfy [proxied-node](https://github.com/WebReflection/proxied-node#readme) constrains and architecrture, among IoT caveats, so *don't use this in production unless you really [understand how this module works](https://github.com/WebReflection/bidi-sse#how-it-works) 👍*


### How it works

  * an *EventSource* client request is intercepted and handled on the server:
    * the response object is trapped until the client disconnects
    * a server side *client* is created and the long living response object is associated with it
    * the very first server-sent event is a unique identifier
    * the server side *client* is associated to this unique identifier and a *connection* event emitted, passing such *client* as ready to communicate
  * the client stores internally such unique identifier and emit it's *open* listener, enabling its communication ability
  * each time the client instance `.send(data)` is invoked, the same *EventSource's href* plus the unique identifier is used to *POST* the data as serialized format
  * the server intercepts *POST* requests and handle these internally if:
    * the url is *the same as the initial one defined to trap responses*
    * there is *a known UUID* associated with the url as `bidi-sse` query string
  * the sent data is built as string via all its chunks, and then deserialized through the same `stringify` and `parse` mechanism used on the client. This is *JSON* by default, but [it could be any different library](https://github.com/WebReflection/bidi-sse#using-different-serialization)
    * if the `parse(postedData)` operation fails, an *error* is triggered on the client side, but only if it's still connected
    * if the operation is successful, a *message* event with the parsed data is invoked on the server "*client's counterpart*"
  * when the server side *client* `.send(data)` is invoked, a *message* event is emitted in the browser's *client* side, and through the same `stringify` and `parse` procedure


#### Using different serialization

Please note that the **JSON** reference library to *stringify* and *parse* must be the same for both *client* and *server*.

[flatted](https://www.npmjs.com/package/flatted) and [@ungap/structured-clone/json](https://github.com/ungap/structured-clone#tojson) are just two of the many possible parser alternatives, able to deal with recursion and, in the structured clone case, with also more data types and primitives.
