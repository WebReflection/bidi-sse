const express = require('express');
const BidiSSE = require('../cjs/server');

const bidi = new BidiSSE('/bidi-sse');

// use the handler
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
