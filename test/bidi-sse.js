/*! (c) Andrea Giammarchi - ISC */

const _$1 = new WeakMap;

class SimpleEmitter {
  constructor() {
    _$1.set(this, new Map);
  }

  on(type, listener) {
    const map = _$1.get(this);
    if (!map.has(type))
      map.set(type, new Set);
    map.get(type).add(listener);
    return this;
  }

  // lame version (meh about removing)
  once(type, listener) {
    return this.on(type, function $() {
      _$1.get(this).get(type).delete($);
      listener.apply(this, arguments);
    });
  }

  // no return true/false implemented
  emit(type, ...data) {
    const map = _$1.get(this);
    if (map.has(type)) {
      for (const listener of map.get(type))
        listener.apply(this, data);
    }
  }

  /* unnecessary extras ...

  // non lame version, requies another wm:
  const once = new WeakMap;
  once(type, listener) {
    if (!once.has(listener)) {
      once.set(listener, function _() {
        this.removeListener(type, _);
        listener.apply(this, arguments);
      });
    }
    return this.on(type, once.get(listener));
  }

  removeListener(type, listener) {
    const map = _.get(this);
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

const CONNECTING = 0;
const OPEN = 1;
const CLOSING = 2;
const CLOSED = 3;

const Class = Emitter => (class extends Emitter {
  static get CONNECTING() { return CONNECTING; }
  static get OPEN() { return OPEN; }
  static get CLOSING() { return CLOSING; }
  static get CLOSED() { return CLOSED; }
});

/*! (c) Andrea Giammarchi - ISC */

const fetchText = body => body.text();
const _ = new WeakMap;

/**
 * @typedef {Object} ClientOptions - additional options for SSE
 * @property {object} fetch - extra fetch options to use on demand
 * @property {JSON} JSON - the JSON namespace to use to `parse` and `stringify`
 */

class client extends Class(SimpleEmitter) {
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

export { client as default };
