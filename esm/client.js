/*! (c) Andrea Giammarchi - ISC */

import SimpleEmitter from './simple-emitter.js';
import {Class, CONNECTING, OPEN, CLOSING, CLOSED} from './constants.js';

const fetchText = body => body.text();
const _ = new WeakMap;

/**
 * @typedef {Object} ClientOptions - additional options for SSE
 * @property {object} fetch - extra fetch options to use on demand
 * @property {JSON} JSON - the JSON namespace to use to `parse` and `stringify`
 */

export default class extends Class(SimpleEmitter) {
  /**
   * Create an `EventSource` like transport with the ability to send data too.
   * @param {string} url the end point enabled as bidi-sse server
   * @param {ClientOptions=} options extra options to use
   */
  constructor(url, options = {}) {
    super();
    const once = {once: true};
    const fetch = options.fetch || {};
    const withCredentials = fetch.credentials !== 'omit';
    const es = new EventSource(url, {withCredentials});
    const {parse, stringify} = options.JSON || JSON;
    const $ = {es, stringify, href: '', options: fetch, state: CONNECTING};

    // regular flow
    es.addEventListener('bidi-sse', ({data}) => {
      const id = parse(data);
      const location = new URL(es.url);
      location.searchParams.append('bidi-sse', id);
      $.href = location.href;
      $.state = OPEN;
      this.emit('open');
    }, once);

    es.addEventListener(
      'message',
      ({data}) => this.emit('message', parse(data))
    );

    es.addEventListener('close', () => {
      $.state = CLOSED;
      es.close();
      this.emit('close');
    }, once);

    // error handling
    es.addEventListener(
      'unexpected',
      ({data}) => this.emit('error', new Error('Unexpected ➡ ' + parse(data)))
    );

    es.addEventListener('error', () => {
      $.state = CLOSING;
      this.emit('error', new Error('Connection lost ➡ ' + es.url));
      this.close();
    }, once);

    _.set(this, $);
  }

  /**
   * @type {CONNECTING | OPEN | CLOSING | CLOSED}
   */
  get readyState() { return _.get(this).state; }

  /**
   * Send data to the server side bidi-sse enabled end point.
   * @param {any} data serializable data to send
   */
  send(data) {
    const {stringify, href, options, state} = _.get(this);
    if (state !== OPEN)
      throw new Error('invalid state');

    const body = stringify(data);
    fetch(href, {...options, method: 'post', body}).then(fetchText);
  }

  /**
   * Disconnect the `EventSource` and emit `close` event.
   */
  close() {
    _.get(this).es.dispatchEvent(new Event('close'));
  }
}
