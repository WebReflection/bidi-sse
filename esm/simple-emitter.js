/*! (c) Andrea Giammarchi - ISC */

const listeners = new WeakMap;

export default class SimpleEmitter {
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
