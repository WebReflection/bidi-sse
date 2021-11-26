/*! (c) Andrea Giammarchi - ISC */

import {EventEmitter} from 'events';
import {OPEN, CLOSED} from './constants.js';

const {random} = Math;

class Client extends EventEmitter {
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
      this._.end();
      this.emit('close');
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
    super();

    const {parse, stringify} = options.JSON || JSON;
    const headers = options.headers || {};
    if (options.mode === 'cors')
      headers['access-control-allow-origin'] = '*';

    this.handler = handler.bind(this);
    this._ = {
      path,
      headers,
      parse,
      stringify,
      id: 0,
      clients: new Map,
    };
  }


  /**
   * @type {Client[]} all connected clients
   */
  get clients() {
    return [...this._.clients.values()];
  }

  /**
   * Close all connected clients and emit the `close` event.
   */
  async close() {
    const closed = [];
    const {clients} = this._;
    const once = (emitter, type) => new Promise($ => emitter.once(type, $));
    for (const client of clients.values()) {
      if (client.readyState === OPEN) {
        closed.push(once(client._, 'close'));
        client.close();
      }
    }
    await Promise.all(closed);
    this.emit('close');
  }
}

/**
 * Handles both *express* and regular *http* server as callback.
 * `bidisse.handler(req, res)` returns `true` if the request was handled.
 * @param {import('http').IncomingMessage} req the request instace
 * @param {import('http').ServerResponse} res the response instance
 * @param {function=} next optional callback to keep working (express)
 * @returns {boolean} `true` if handling the request, `false` otherwise.
 */
function handler(req, res, next) {
  const {path, headers, parse, stringify, clients} = this._;
  const {method, url} = req;
  if (url.startsWith(path)) {
    if (method === 'POST') {
      const i = url.indexOf('?');
      if (-1 < i) {
        const searchParams = new URLSearchParams(url.slice(i));
        if (searchParams.has('id')) {
          const uid = searchParams.get('id');
          if (clients.has(uid)) {
            const chunks = [];
            req.on('data', data => {
              chunks.push(data);
            });
            req.on('end', () => {
              if (!clients.has(uid)) return;
              const client = clients.get(uid);
              try { client.emit('message', parse(chunks.join(''))); }
              catch ({message}) {
                const error = stringify(message);
                client._.write(`event: unexpected\ndata: ${error}\n\n`);
              }
            });
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
      do { uid = (++this._.id+random()).toString(36); }
      while (clients.has(uid));
      const client = new Client(res, data => {
        try { res.write(`data: ${stringify(data)}\n\n`); }
        catch (err) { client.emit('error', err); }
      });
      clients.set(uid, client);
      res.once(
        'close',
        () => {
          clients.delete(uid);
          client.close();
        }
      ).writeHead(200, {
        ...headers,
        'connection': 'keep-alive',
        'cache-control': 'no-cache',
        'content-type': 'text/event-stream'
      });
      res.write(`event: id\ndata: ${stringify(uid)}\n\n`);
      this.emit('connection', client);
      return true;
    }
  }

  try { return false } finally {
    if (typeof next === 'function')
      next();
  }
}
