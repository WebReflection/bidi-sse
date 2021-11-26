const {createServer} = require('http');
const {basename, join} = require('path');
const {createReadStream, existsSync} = require('fs');
const mime = require('mime-types');

const {Server} = require('../cjs');

const bidi = new Server('/bidi-sse', {mode: 'cors'});
bidi.on('connection', client => {
  const {clients} = bidi;
  const message = `There are ${clients.size} clients connected`;
  console.log(message);

  client.on('message', data => {
    console.log('client data', data);
    client.send({message});
  });

  client.on('close', () => {
    console.log('client gone');
    for (const client of clients)
      client.send({message: 'a client just left'});
  });

  for (const other of clients) {
    if (other !== client)
      other.send({message});
  }
  // setTimeout(() => { bidi.close(); }, 3000);
});

bidi.on('close', function () {
  console.log('clients', this.clients.size);
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
