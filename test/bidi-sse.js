const CONNECTING = 0;
const OPEN = 1;
const CLOSING = 2;
const CLOSED = 3;

/*! (c) Andrea Giammarchi - ISC */

const listeners = new WeakMap;

class SimpleEmitter {
  constructor() {
    listeners.set(this, new Map);
  }

  on(type, listener) {
    const map = listeners.get(this);
    if (!map.has(type))
      map.set(type, new Set);
    map.get(type).add(listener);
    return this;
  }

  emit(type, ...data) {
    const map = listeners.get(this);
    if (map.has(type)) {
      for (const listener of map.get(type))
        listener.apply(this, data);
    }
    // unnecessary return true or false logic
  }

  /* unnecessary extras
  // const once = new WeakMap;
  once(type, listener) {
    if (!once.has(listener)) {
      once.set(listener, function _() {
        listeners.get(this).get(type).delete(_);
        listener.apply(this, arguments);
      });
    }
    this.on(type, once.get(listener));
  }

  removeListener(type, listener) {
    const map = listeners.get(this);
    if (map.has(type)) {
      const set = map.get(type);
      set.delete(listener);
      if (once.has(listener))
        set.delete(once.get(listener));
    }
    return this;
  }
  //*/
}

/*! (c) Andrea Giammarchi - ISC */

const privates = new WeakMap;
const fetchText = body => body.text();

/**
 * @typedef {Object} ClientOptions - additional options for SSE
 * @property {object} fetch - extra fetch options to use on demand
 * @property {JSON} JSON - the JSON namespace to use to `parse` and `stringify`
 */

class Client extends SimpleEmitter {
  static get CONNECTING() { return CONNECTING; }
  static get OPEN() { return OPEN; }
  static get CLOSING() { return CLOSING; }
  static get CLOSED() { return CLOSED; }

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
    const es = new EventSource(url);
    const fetch = options.fetch || {};
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

export { Client as default };
