const {createServer} = require('http');
const {basename, join} = require('path');
const {createReadStream, existsSync} = require('fs');
const mime = require('mime-types');

const {Server} = require('../cjs');

const bidi = new Server('/bidi-sse', {mode: 'cors'});
bidi.on('connection', client => {
  console.log('clients', bidi.clients.length);
  client.on('message', data => {
    console.log('client', data);
    client.send(data);
  });
  // setTimeout(() => { bidi.close(); }, 3000);
});
bidi.on('close', () => {
  const {clients} = bidi;
  console.log('clients', clients.length);
});

createServer((req, res) => {
  if (bidi.handler(req, res))
    return;

  const base = basename(req.url.replace(/^\/$/, '/index.html'));
  const file = join(__dirname, base);
  if (existsSync(file)) {
    res.writeHead(200, {
      'content-type': mime.contentType(base)
    });
    createReadStream(file).pipe(res);
  }
  else
    res.end();
}).listen(8080, () => {
  console.log('http://localhost:8080/');
});
