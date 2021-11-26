/*! (c) Andrea Giammarchi - ISC */

import SimpleEmitter from './simple-emitter.js';
import {Class, CONNECTING, OPEN, CLOSING, CLOSED} from './constants.js';

const privates = new WeakMap;
const fetchText = body => body.text();

/**
 * @typedef {Object} ClientOptions - additional options for SSE
 * @property {object} fetch - extra fetch options to use on demand
 * @property {JSON} JSON - the JSON namespace to use to `parse` and `stringify`
 */

export default class extends Class(SimpleEmitter) {
  /**
   * @type {CONNECTING | OPEN | CLOSING | CLOSED}
   */
  get readyState() {
    return privates.get(this).readyState;
  }

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
    const _ = {
      es,
      parse,
      stringify,
      options: fetch,
      href: '',
      readyState: CONNECTING
    };

    es.addEventListener('id', ({data}) => {
      const id = parse(data);
      const location = new URL(es.url);
      location.searchParams.append('id', id);
      _.href = location.href;
      _.readyState = OPEN;
      this.emit('open');
    }, {once: true});

    es.addEventListener('unexpected', ({data}) => {
      this.emit('error', new Error('Unexpected ➡ ' + parse(data)));
    });

    es.addEventListener('message', ({data}) => {
      this.emit('message', parse(data));
    });

    es.addEventListener('error', () => {
      _.readyState = CLOSING;
      this.emit('error', new Error('Connection lost ➡ ' + url));
      this.close();
    }, {once: true});

    es.addEventListener('close', () => {
      _.readyState = CLOSED;
      es.close();
      this.emit('close');
    }, {once: true});

    privates.set(this, _);
  }

  /**
   * Send data to the server side bidi-sse enabled end point.
   * @param {any} data serializable data to send
   */
  send(data) {
    const {href, options, readyState, stringify} = privates.get(this);

    if (readyState !== OPEN)
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
