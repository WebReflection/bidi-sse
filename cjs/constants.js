'use strict';
const CONNECTING = 0;
exports.CONNECTING = CONNECTING;
const OPEN = 1;
exports.OPEN = OPEN;
const CLOSING = 2;
exports.CLOSING = CLOSING;
const CLOSED = 3;
exports.CLOSED = CLOSED;

const Class = Emitter => (class extends Emitter {
  static get CONNECTING() { return CONNECTING; }
  static get OPEN() { return OPEN; }
  static get CLOSING() { return CLOSING; }
  static get CLOSED() { return CLOSED; }
});
exports.Class = Class;
