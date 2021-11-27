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

  // lame version (meh about removing)
  once(type, listener) {
    return this.on(type, function _() {
      listeners.get(this).get(type).delete(_);
      listener.apply(this, arguments);
    });
  }

  // no return true/false implemented
  emit(type, ...data) {
    const map = listeners.get(this);
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
