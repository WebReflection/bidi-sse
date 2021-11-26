'use strict';
/*! (c) Andrea Giammarchi - ISC */

const SimpleEmitter = (m => /* c8 ignore start */ m.__esModule ? m.default : m /* c8 ignore stop */)(require('./simple-emitter.js'));
const {Class, CONNECTING, OPEN, CLOSING, CLOSED} = require('./constants.js');

const privates = new WeakMap;
const fetchText = body => body.text();

/**
 * @typedef {Object} ClientOptions - additional options for SSE
 * @property {object} fetch - extra fetch options to use on demand
 * @property {JSON} JSON - the JSON namespace to use to `parse` and `stringify`
 */

module.exports = class extends Class(SimpleEmitter) {
  /**
   * Create an `EventSource` like transport with the ability to send data too.
   * @param {string} url the end point enabled as bidi-sse server
   * @param {ClientOptions=} options extra options to use
   */
  constructor(url, options = {}) {
    super();
    const fetch = options.fetch || {};
    const es = new EventSource(url, {
      withCredentials: fetch.credentials !== 'omit'
    });
    const {parse, stringify} = options.JSON || JSON;
    const _ = {es, stringify, href: '', options: fetch, state: CONNECTING};

    es.addEventListener('bidi-sse', ({data}) => {
      const id = parse(data);
      const location = new URL(es.url);
      location.searchParams.append('bidi-sse', id);
      _.href = location.href;
      _.state = OPEN;
      this.emit('open');
    }, {once: true});

    es.addEventListener('unexpected', ({data}) => {
      this.emit('error', new Error('Unexpected ➡ ' + parse(data)));
    });

    es.addEventListener('message', ({data}) => {
      this.emit('message', parse(data));
    });

    es.addEventListener('error', () => {
      _.state = CLOSING;
      this.emit('error', new Error('Connection lost ➡ ' + url));
      this.close();
    }, {once: true});

    es.addEventListener('close', () => {
      _.state = CLOSED;
      es.close();
      this.emit('close');
    }, {once: true});

    privates.set(this, _);
  }

  /**
   * @type {CONNECTING | OPEN | CLOSING | CLOSED}
   */
  get readyState() {
    return privates.get(this).state;
  }

  /**
   * Send data to the server side bidi-sse enabled end point.
   * @param {any} data serializable data to send
   */
  send(data) {
    const {stringify, href, options, state} = privates.get(this);
    if (state !== OPEN)
      throw new Error('invalid state');

    const body = stringify(data);
    fetch(href, {...options, method: 'post', body}).then(fetchText);
  }

  /**
   * Disconnect the `EventSource` and emit `close` event.
   */
  close() {
    privates.get(this).es.dispatchEvent(new Event('close'));
  }
}
