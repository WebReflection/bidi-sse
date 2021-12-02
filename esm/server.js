/*! (c) Andrea Giammarchi - ISC */

import {randomUUID} from 'crypto';
import {EventEmitter} from 'events';
import {Values} from 'shadowed-map';
import {Class, OPEN, CLOSED} from './constants.js';

class Client extends Class(EventEmitter) {
  /**
   * @private
   */
  constructor(_, send) {
    super();
    this._ = _;
    this.readyState = OPEN;

    /**
     * Send any data to the connected client through its `message` listener.
     * @type {(data: any) => void}
     */
    this.send = send;
  }

  close() {
    if (this.readyState !== CLOSED) {
      this.readyState = CLOSED;
      this.emit('close');
      this._.end();
    }
  }
}

/**
 * @typedef {Object} ServerOptions - additional options for SSE
 * @property {string=} mode - if its value is `cors` it simplifies CORS mode
 * @property {object=} headers - extra headers to inject on demand
 * @property {JSON=} JSON - the JSON namespace to use to `parse` and `stringify`
 */

export default class Server extends EventEmitter {
  /**
   * Create an instance with server-side sockets like events and one
   * `handler` method usable directly or via `express.use(bidisse.handler)`.
   * @param {string} path the path used by the client to connect as `EventSource`
   * @param {ServerOptions=} options extra options to use
   */
  constructor(path, options = {}) {
    const clients = new Map;
    const {parse, stringify} = options.JSON || JSON;
    const headers = options.headers || {};
    if (options.mode === 'cors')
      headers['Access-Control-Allow-Origin'] = '*';

    super()._ = new Values(clients);

    /**
     * Handles both *express* and regular *http* server as callback.
     * `bidisse.handler(req, res)` returns `true` if the request was handled.
     * @param {import('http').IncomingMessage} req the request instace
     * @param {import('http').ServerResponse} res the response instance
     * @param {function=} next optional callback to keep working (express)
     * @returns {boolean} `true` if handling the request, `false` otherwise.
     */
    this.handler = (req, res, next) => {
      const {method, url} = req;
      if (url.startsWith(path)) {
        if (method === 'POST') {
          const i = url.indexOf('?');
          if (-1 < i) {
            const searchParams = new URLSearchParams(url.slice(i));
            if (searchParams.has('bidi-sse')) {
              const uid = searchParams.get('bidi-sse');
              if (clients.has(uid)) {
                const chunks = [];
                req
                  .on('data', chunk => { chunks.push(chunk); })
                  .on('end', () => {
                    if (!clients.has(uid)) return;
                    const client = clients.get(uid);
                    let data;
                    try { data = parse(chunks.join('')); }
                    catch ({message}) {
                      const error = stringify(message);
                      client._.write(`event: unexpected\ndata: ${error}\n\n`);
                      return;
                    }
                    client.emit('message', data);
                  })
                ;
                res.writeHead(200, headers).end();
                return true;
              }
            }
          }
        }
        else if (
          method === 'GET' &&
          url === path &&
          req.headers.accept === 'text/event-stream'
        ) {
          let uid = ''; // what are the odds
          do { uid = randomUUID({disableEntropyCache: true}); }
          while (clients.has(uid));

          const client = new Client(res, data => {
            try { res.write(`data: ${stringify(data)}\n\n`); }
            catch (err) { client.emit('error', err); }
          });

          clients.set(uid, client);
          res
            .once(
              'close',
              () => {
                clients.delete(uid);
                client.close();
              }
            )
            .writeHead(200, {
              ...headers,
              'Connection': 'keep-alive',
              'Cache-Control': 'no-cache',
              'Content-Type': 'text/event-stream'
            })
            .write(`event: bidi-sse\ndata: ${stringify(uid)}\n\n`)
          ;
          this.emit('connection', client);
          return true;
        }
      }

      try { return false } finally {
        if (typeof next === 'function')
          next();
      }
    };
  }


  /**
   * @type {Set<Client>} all connected clients
   */
  get clients() { return this._; }

  /**
   * Close all connected clients and emit the `close` event.
   */
  async close() {
    const closed = [];
    const once = ({_}) => new Promise($ => _.once('close', $));
    for (const client of this._) {
      if (client.readyState === OPEN) {
        closed.push(once(client));
        client.close();
      }
    }
    await Promise.all(closed);
    this.emit('close');
  }
}
