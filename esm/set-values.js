/*! (c) Andrea Giammarchi - ISC */

const valueOf = ({_}) => _.values();

/**
 * This class purpose is to avoid keeping in sync both
 * the Map that relates UUIDs with response objects,
 * and calls to the `bidi.clients` read-only set of clients.
 * Because it's forbidden to add or delete arbitrary items,
 * it's also limited in features, however it fits all use cases.
 */
export default class {
  constructor(map) { this._ = map; }
  get size() { return this._.size; }

  forEach(callback, context) {
    for (const v of valueOf(this))
      callback.call(context, v);
  }

  has(value) {
    for (const v of valueOf(this)) {
      if (v === value)
        return true;
    }
    return false;
  }

  keys() { return valueOf(this); }
  values() { return valueOf(this); }
  [Symbol.iterator]() { return valueOf(this); }
}
