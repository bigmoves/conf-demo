// build/dev/javascript/prelude.mjs
class CustomType {
  withFields(fields) {
    let properties = Object.keys(this).map((label) => (label in fields) ? fields[label] : this[label]);
    return new this.constructor(...properties);
  }
}

class List {
  static fromArray(array, tail) {
    let t = tail || new Empty;
    for (let i = array.length - 1;i >= 0; --i) {
      t = new NonEmpty(array[i], t);
    }
    return t;
  }
  [Symbol.iterator]() {
    return new ListIterator(this);
  }
  toArray() {
    return [...this];
  }
  atLeastLength(desired) {
    let current = this;
    while (desired-- > 0 && current)
      current = current.tail;
    return current !== undefined;
  }
  hasLength(desired) {
    let current = this;
    while (desired-- > 0 && current)
      current = current.tail;
    return desired === -1 && current instanceof Empty;
  }
  countLength() {
    let current = this;
    let length = 0;
    while (current) {
      current = current.tail;
      length++;
    }
    return length - 1;
  }
}
function prepend(element, tail) {
  return new NonEmpty(element, tail);
}
function toList(elements, tail) {
  return List.fromArray(elements, tail);
}

class ListIterator {
  #current;
  constructor(current) {
    this.#current = current;
  }
  next() {
    if (this.#current instanceof Empty) {
      return { done: true };
    } else {
      let { head, tail } = this.#current;
      this.#current = tail;
      return { value: head, done: false };
    }
  }
}

class Empty extends List {
}
class NonEmpty extends List {
  constructor(head, tail) {
    super();
    this.head = head;
    this.tail = tail;
  }
}
class BitArray {
  bitSize;
  byteSize;
  bitOffset;
  rawBuffer;
  constructor(buffer, bitSize, bitOffset) {
    if (!(buffer instanceof Uint8Array)) {
      throw globalThis.Error("BitArray can only be constructed from a Uint8Array");
    }
    this.bitSize = bitSize ?? buffer.length * 8;
    this.byteSize = Math.trunc((this.bitSize + 7) / 8);
    this.bitOffset = bitOffset ?? 0;
    if (this.bitSize < 0) {
      throw globalThis.Error(`BitArray bit size is invalid: ${this.bitSize}`);
    }
    if (this.bitOffset < 0 || this.bitOffset > 7) {
      throw globalThis.Error(`BitArray bit offset is invalid: ${this.bitOffset}`);
    }
    if (buffer.length !== Math.trunc((this.bitOffset + this.bitSize + 7) / 8)) {
      throw globalThis.Error("BitArray buffer length is invalid");
    }
    this.rawBuffer = buffer;
  }
  byteAt(index) {
    if (index < 0 || index >= this.byteSize) {
      return;
    }
    return bitArrayByteAt(this.rawBuffer, this.bitOffset, index);
  }
  equals(other) {
    if (this.bitSize !== other.bitSize) {
      return false;
    }
    const wholeByteCount = Math.trunc(this.bitSize / 8);
    if (this.bitOffset === 0 && other.bitOffset === 0) {
      for (let i = 0;i < wholeByteCount; i++) {
        if (this.rawBuffer[i] !== other.rawBuffer[i]) {
          return false;
        }
      }
      const trailingBitsCount = this.bitSize % 8;
      if (trailingBitsCount) {
        const unusedLowBitCount = 8 - trailingBitsCount;
        if (this.rawBuffer[wholeByteCount] >> unusedLowBitCount !== other.rawBuffer[wholeByteCount] >> unusedLowBitCount) {
          return false;
        }
      }
    } else {
      for (let i = 0;i < wholeByteCount; i++) {
        const a = bitArrayByteAt(this.rawBuffer, this.bitOffset, i);
        const b = bitArrayByteAt(other.rawBuffer, other.bitOffset, i);
        if (a !== b) {
          return false;
        }
      }
      const trailingBitsCount = this.bitSize % 8;
      if (trailingBitsCount) {
        const a = bitArrayByteAt(this.rawBuffer, this.bitOffset, wholeByteCount);
        const b = bitArrayByteAt(other.rawBuffer, other.bitOffset, wholeByteCount);
        const unusedLowBitCount = 8 - trailingBitsCount;
        if (a >> unusedLowBitCount !== b >> unusedLowBitCount) {
          return false;
        }
      }
    }
    return true;
  }
  get buffer() {
    bitArrayPrintDeprecationWarning("buffer", "Use BitArray.byteAt() or BitArray.rawBuffer instead");
    if (this.bitOffset !== 0 || this.bitSize % 8 !== 0) {
      throw new globalThis.Error("BitArray.buffer does not support unaligned bit arrays");
    }
    return this.rawBuffer;
  }
  get length() {
    bitArrayPrintDeprecationWarning("length", "Use BitArray.bitSize or BitArray.byteSize instead");
    if (this.bitOffset !== 0 || this.bitSize % 8 !== 0) {
      throw new globalThis.Error("BitArray.length does not support unaligned bit arrays");
    }
    return this.rawBuffer.length;
  }
}
function bitArrayByteAt(buffer, bitOffset, index) {
  if (bitOffset === 0) {
    return buffer[index] ?? 0;
  } else {
    const a = buffer[index] << bitOffset & 255;
    const b = buffer[index + 1] >> 8 - bitOffset;
    return a | b;
  }
}

class UtfCodepoint {
  constructor(value) {
    this.value = value;
  }
}
var isBitArrayDeprecationMessagePrinted = {};
function bitArrayPrintDeprecationWarning(name, message) {
  if (isBitArrayDeprecationMessagePrinted[name]) {
    return;
  }
  console.warn(`Deprecated BitArray.${name} property used in JavaScript FFI code. ${message}.`);
  isBitArrayDeprecationMessagePrinted[name] = true;
}
class Result extends CustomType {
  static isResult(data) {
    return data instanceof Result;
  }
}

class Ok extends Result {
  constructor(value) {
    super();
    this[0] = value;
  }
  isOk() {
    return true;
  }
}
class Error2 extends Result {
  constructor(detail) {
    super();
    this[0] = detail;
  }
  isOk() {
    return false;
  }
}
function isEqual(x, y) {
  let values = [x, y];
  while (values.length) {
    let a = values.pop();
    let b = values.pop();
    if (a === b)
      continue;
    if (!isObject(a) || !isObject(b))
      return false;
    let unequal = !structurallyCompatibleObjects(a, b) || unequalDates(a, b) || unequalBuffers(a, b) || unequalArrays(a, b) || unequalMaps(a, b) || unequalSets(a, b) || unequalRegExps(a, b);
    if (unequal)
      return false;
    const proto = Object.getPrototypeOf(a);
    if (proto !== null && typeof proto.equals === "function") {
      try {
        if (a.equals(b))
          continue;
        else
          return false;
      } catch {}
    }
    let [keys, get] = getters(a);
    const ka = keys(a);
    const kb = keys(b);
    if (ka.length !== kb.length)
      return false;
    for (let k of ka) {
      values.push(get(a, k), get(b, k));
    }
  }
  return true;
}
function getters(object) {
  if (object instanceof Map) {
    return [(x) => x.keys(), (x, y) => x.get(y)];
  } else {
    let extra = object instanceof globalThis.Error ? ["message"] : [];
    return [(x) => [...extra, ...Object.keys(x)], (x, y) => x[y]];
  }
}
function unequalDates(a, b) {
  return a instanceof Date && (a > b || a < b);
}
function unequalBuffers(a, b) {
  return !(a instanceof BitArray) && a.buffer instanceof ArrayBuffer && a.BYTES_PER_ELEMENT && !(a.byteLength === b.byteLength && a.every((n, i) => n === b[i]));
}
function unequalArrays(a, b) {
  return Array.isArray(a) && a.length !== b.length;
}
function unequalMaps(a, b) {
  return a instanceof Map && a.size !== b.size;
}
function unequalSets(a, b) {
  return a instanceof Set && (a.size != b.size || [...a].some((e) => !b.has(e)));
}
function unequalRegExps(a, b) {
  return a instanceof RegExp && (a.source !== b.source || a.flags !== b.flags);
}
function isObject(a) {
  return typeof a === "object" && a !== null;
}
function structurallyCompatibleObjects(a, b) {
  if (typeof a !== "object" && typeof b !== "object" && (!a || !b))
    return false;
  let nonstructural = [Promise, WeakSet, WeakMap, Function];
  if (nonstructural.some((c) => a instanceof c))
    return false;
  return a.constructor === b.constructor;
}
function makeError(variant, file, module, line, fn, message, extra) {
  let error = new globalThis.Error(message);
  error.gleam_error = variant;
  error.file = file;
  error.module = module;
  error.line = line;
  error.function = fn;
  error.fn = fn;
  for (let k in extra)
    error[k] = extra[k];
  return error;
}
// build/dev/javascript/gleam_stdlib/gleam/option.mjs
class Some extends CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}
class None extends CustomType {
}
function from_result(result) {
  if (result instanceof Ok) {
    let a = result[0];
    return new Some(a);
  } else {
    return new None;
  }
}
function unwrap(option, default$) {
  if (option instanceof Some) {
    let x = option[0];
    return x;
  } else {
    return default$;
  }
}
function then$(option, fun) {
  if (option instanceof Some) {
    let x = option[0];
    return fun(x);
  } else {
    return option;
  }
}

// build/dev/javascript/gleam_stdlib/dict.mjs
var referenceMap = /* @__PURE__ */ new WeakMap;
var tempDataView = /* @__PURE__ */ new DataView(/* @__PURE__ */ new ArrayBuffer(8));
var referenceUID = 0;
function hashByReference(o) {
  const known = referenceMap.get(o);
  if (known !== undefined) {
    return known;
  }
  const hash = referenceUID++;
  if (referenceUID === 2147483647) {
    referenceUID = 0;
  }
  referenceMap.set(o, hash);
  return hash;
}
function hashMerge(a, b) {
  return a ^ b + 2654435769 + (a << 6) + (a >> 2) | 0;
}
function hashString(s) {
  let hash = 0;
  const len = s.length;
  for (let i = 0;i < len; i++) {
    hash = Math.imul(31, hash) + s.charCodeAt(i) | 0;
  }
  return hash;
}
function hashNumber(n) {
  tempDataView.setFloat64(0, n);
  const i = tempDataView.getInt32(0);
  const j = tempDataView.getInt32(4);
  return Math.imul(73244475, i >> 16 ^ i) ^ j;
}
function hashBigInt(n) {
  return hashString(n.toString());
}
function hashObject(o) {
  const proto = Object.getPrototypeOf(o);
  if (proto !== null && typeof proto.hashCode === "function") {
    try {
      const code = o.hashCode(o);
      if (typeof code === "number") {
        return code;
      }
    } catch {}
  }
  if (o instanceof Promise || o instanceof WeakSet || o instanceof WeakMap) {
    return hashByReference(o);
  }
  if (o instanceof Date) {
    return hashNumber(o.getTime());
  }
  let h = 0;
  if (o instanceof ArrayBuffer) {
    o = new Uint8Array(o);
  }
  if (Array.isArray(o) || o instanceof Uint8Array) {
    for (let i = 0;i < o.length; i++) {
      h = Math.imul(31, h) + getHash(o[i]) | 0;
    }
  } else if (o instanceof Set) {
    o.forEach((v) => {
      h = h + getHash(v) | 0;
    });
  } else if (o instanceof Map) {
    o.forEach((v, k) => {
      h = h + hashMerge(getHash(v), getHash(k)) | 0;
    });
  } else {
    const keys = Object.keys(o);
    for (let i = 0;i < keys.length; i++) {
      const k = keys[i];
      const v = o[k];
      h = h + hashMerge(getHash(v), hashString(k)) | 0;
    }
  }
  return h;
}
function getHash(u) {
  if (u === null)
    return 1108378658;
  if (u === undefined)
    return 1108378659;
  if (u === true)
    return 1108378657;
  if (u === false)
    return 1108378656;
  switch (typeof u) {
    case "number":
      return hashNumber(u);
    case "string":
      return hashString(u);
    case "bigint":
      return hashBigInt(u);
    case "object":
      return hashObject(u);
    case "symbol":
      return hashByReference(u);
    case "function":
      return hashByReference(u);
    default:
      return 0;
  }
}
var SHIFT = 5;
var BUCKET_SIZE = Math.pow(2, SHIFT);
var MASK = BUCKET_SIZE - 1;
var MAX_INDEX_NODE = BUCKET_SIZE / 2;
var MIN_ARRAY_NODE = BUCKET_SIZE / 4;
var ENTRY = 0;
var ARRAY_NODE = 1;
var INDEX_NODE = 2;
var COLLISION_NODE = 3;
var EMPTY = {
  type: INDEX_NODE,
  bitmap: 0,
  array: []
};
function mask(hash, shift) {
  return hash >>> shift & MASK;
}
function bitpos(hash, shift) {
  return 1 << mask(hash, shift);
}
function bitcount(x) {
  x -= x >> 1 & 1431655765;
  x = (x & 858993459) + (x >> 2 & 858993459);
  x = x + (x >> 4) & 252645135;
  x += x >> 8;
  x += x >> 16;
  return x & 127;
}
function index(bitmap, bit) {
  return bitcount(bitmap & bit - 1);
}
function cloneAndSet(arr, at, val) {
  const len = arr.length;
  const out = new Array(len);
  for (let i = 0;i < len; ++i) {
    out[i] = arr[i];
  }
  out[at] = val;
  return out;
}
function spliceIn(arr, at, val) {
  const len = arr.length;
  const out = new Array(len + 1);
  let i = 0;
  let g = 0;
  while (i < at) {
    out[g++] = arr[i++];
  }
  out[g++] = val;
  while (i < len) {
    out[g++] = arr[i++];
  }
  return out;
}
function spliceOut(arr, at) {
  const len = arr.length;
  const out = new Array(len - 1);
  let i = 0;
  let g = 0;
  while (i < at) {
    out[g++] = arr[i++];
  }
  ++i;
  while (i < len) {
    out[g++] = arr[i++];
  }
  return out;
}
function createNode(shift, key1, val1, key2hash, key2, val2) {
  const key1hash = getHash(key1);
  if (key1hash === key2hash) {
    return {
      type: COLLISION_NODE,
      hash: key1hash,
      array: [
        { type: ENTRY, k: key1, v: val1 },
        { type: ENTRY, k: key2, v: val2 }
      ]
    };
  }
  const addedLeaf = { val: false };
  return assoc(assocIndex(EMPTY, shift, key1hash, key1, val1, addedLeaf), shift, key2hash, key2, val2, addedLeaf);
}
function assoc(root2, shift, hash, key, val, addedLeaf) {
  switch (root2.type) {
    case ARRAY_NODE:
      return assocArray(root2, shift, hash, key, val, addedLeaf);
    case INDEX_NODE:
      return assocIndex(root2, shift, hash, key, val, addedLeaf);
    case COLLISION_NODE:
      return assocCollision(root2, shift, hash, key, val, addedLeaf);
  }
}
function assocArray(root2, shift, hash, key, val, addedLeaf) {
  const idx = mask(hash, shift);
  const node = root2.array[idx];
  if (node === undefined) {
    addedLeaf.val = true;
    return {
      type: ARRAY_NODE,
      size: root2.size + 1,
      array: cloneAndSet(root2.array, idx, { type: ENTRY, k: key, v: val })
    };
  }
  if (node.type === ENTRY) {
    if (isEqual(key, node.k)) {
      if (val === node.v) {
        return root2;
      }
      return {
        type: ARRAY_NODE,
        size: root2.size,
        array: cloneAndSet(root2.array, idx, {
          type: ENTRY,
          k: key,
          v: val
        })
      };
    }
    addedLeaf.val = true;
    return {
      type: ARRAY_NODE,
      size: root2.size,
      array: cloneAndSet(root2.array, idx, createNode(shift + SHIFT, node.k, node.v, hash, key, val))
    };
  }
  const n = assoc(node, shift + SHIFT, hash, key, val, addedLeaf);
  if (n === node) {
    return root2;
  }
  return {
    type: ARRAY_NODE,
    size: root2.size,
    array: cloneAndSet(root2.array, idx, n)
  };
}
function assocIndex(root2, shift, hash, key, val, addedLeaf) {
  const bit = bitpos(hash, shift);
  const idx = index(root2.bitmap, bit);
  if ((root2.bitmap & bit) !== 0) {
    const node = root2.array[idx];
    if (node.type !== ENTRY) {
      const n = assoc(node, shift + SHIFT, hash, key, val, addedLeaf);
      if (n === node) {
        return root2;
      }
      return {
        type: INDEX_NODE,
        bitmap: root2.bitmap,
        array: cloneAndSet(root2.array, idx, n)
      };
    }
    const nodeKey = node.k;
    if (isEqual(key, nodeKey)) {
      if (val === node.v) {
        return root2;
      }
      return {
        type: INDEX_NODE,
        bitmap: root2.bitmap,
        array: cloneAndSet(root2.array, idx, {
          type: ENTRY,
          k: key,
          v: val
        })
      };
    }
    addedLeaf.val = true;
    return {
      type: INDEX_NODE,
      bitmap: root2.bitmap,
      array: cloneAndSet(root2.array, idx, createNode(shift + SHIFT, nodeKey, node.v, hash, key, val))
    };
  } else {
    const n = root2.array.length;
    if (n >= MAX_INDEX_NODE) {
      const nodes = new Array(32);
      const jdx = mask(hash, shift);
      nodes[jdx] = assocIndex(EMPTY, shift + SHIFT, hash, key, val, addedLeaf);
      let j = 0;
      let bitmap = root2.bitmap;
      for (let i = 0;i < 32; i++) {
        if ((bitmap & 1) !== 0) {
          const node = root2.array[j++];
          nodes[i] = node;
        }
        bitmap = bitmap >>> 1;
      }
      return {
        type: ARRAY_NODE,
        size: n + 1,
        array: nodes
      };
    } else {
      const newArray = spliceIn(root2.array, idx, {
        type: ENTRY,
        k: key,
        v: val
      });
      addedLeaf.val = true;
      return {
        type: INDEX_NODE,
        bitmap: root2.bitmap | bit,
        array: newArray
      };
    }
  }
}
function assocCollision(root2, shift, hash, key, val, addedLeaf) {
  if (hash === root2.hash) {
    const idx = collisionIndexOf(root2, key);
    if (idx !== -1) {
      const entry = root2.array[idx];
      if (entry.v === val) {
        return root2;
      }
      return {
        type: COLLISION_NODE,
        hash,
        array: cloneAndSet(root2.array, idx, { type: ENTRY, k: key, v: val })
      };
    }
    const size = root2.array.length;
    addedLeaf.val = true;
    return {
      type: COLLISION_NODE,
      hash,
      array: cloneAndSet(root2.array, size, { type: ENTRY, k: key, v: val })
    };
  }
  return assoc({
    type: INDEX_NODE,
    bitmap: bitpos(root2.hash, shift),
    array: [root2]
  }, shift, hash, key, val, addedLeaf);
}
function collisionIndexOf(root2, key) {
  const size = root2.array.length;
  for (let i = 0;i < size; i++) {
    if (isEqual(key, root2.array[i].k)) {
      return i;
    }
  }
  return -1;
}
function find(root2, shift, hash, key) {
  switch (root2.type) {
    case ARRAY_NODE:
      return findArray(root2, shift, hash, key);
    case INDEX_NODE:
      return findIndex(root2, shift, hash, key);
    case COLLISION_NODE:
      return findCollision(root2, key);
  }
}
function findArray(root2, shift, hash, key) {
  const idx = mask(hash, shift);
  const node = root2.array[idx];
  if (node === undefined) {
    return;
  }
  if (node.type !== ENTRY) {
    return find(node, shift + SHIFT, hash, key);
  }
  if (isEqual(key, node.k)) {
    return node;
  }
  return;
}
function findIndex(root2, shift, hash, key) {
  const bit = bitpos(hash, shift);
  if ((root2.bitmap & bit) === 0) {
    return;
  }
  const idx = index(root2.bitmap, bit);
  const node = root2.array[idx];
  if (node.type !== ENTRY) {
    return find(node, shift + SHIFT, hash, key);
  }
  if (isEqual(key, node.k)) {
    return node;
  }
  return;
}
function findCollision(root2, key) {
  const idx = collisionIndexOf(root2, key);
  if (idx < 0) {
    return;
  }
  return root2.array[idx];
}
function without(root2, shift, hash, key) {
  switch (root2.type) {
    case ARRAY_NODE:
      return withoutArray(root2, shift, hash, key);
    case INDEX_NODE:
      return withoutIndex(root2, shift, hash, key);
    case COLLISION_NODE:
      return withoutCollision(root2, key);
  }
}
function withoutArray(root2, shift, hash, key) {
  const idx = mask(hash, shift);
  const node = root2.array[idx];
  if (node === undefined) {
    return root2;
  }
  let n = undefined;
  if (node.type === ENTRY) {
    if (!isEqual(node.k, key)) {
      return root2;
    }
  } else {
    n = without(node, shift + SHIFT, hash, key);
    if (n === node) {
      return root2;
    }
  }
  if (n === undefined) {
    if (root2.size <= MIN_ARRAY_NODE) {
      const arr = root2.array;
      const out = new Array(root2.size - 1);
      let i = 0;
      let j = 0;
      let bitmap = 0;
      while (i < idx) {
        const nv = arr[i];
        if (nv !== undefined) {
          out[j] = nv;
          bitmap |= 1 << i;
          ++j;
        }
        ++i;
      }
      ++i;
      while (i < arr.length) {
        const nv = arr[i];
        if (nv !== undefined) {
          out[j] = nv;
          bitmap |= 1 << i;
          ++j;
        }
        ++i;
      }
      return {
        type: INDEX_NODE,
        bitmap,
        array: out
      };
    }
    return {
      type: ARRAY_NODE,
      size: root2.size - 1,
      array: cloneAndSet(root2.array, idx, n)
    };
  }
  return {
    type: ARRAY_NODE,
    size: root2.size,
    array: cloneAndSet(root2.array, idx, n)
  };
}
function withoutIndex(root2, shift, hash, key) {
  const bit = bitpos(hash, shift);
  if ((root2.bitmap & bit) === 0) {
    return root2;
  }
  const idx = index(root2.bitmap, bit);
  const node = root2.array[idx];
  if (node.type !== ENTRY) {
    const n = without(node, shift + SHIFT, hash, key);
    if (n === node) {
      return root2;
    }
    if (n !== undefined) {
      return {
        type: INDEX_NODE,
        bitmap: root2.bitmap,
        array: cloneAndSet(root2.array, idx, n)
      };
    }
    if (root2.bitmap === bit) {
      return;
    }
    return {
      type: INDEX_NODE,
      bitmap: root2.bitmap ^ bit,
      array: spliceOut(root2.array, idx)
    };
  }
  if (isEqual(key, node.k)) {
    if (root2.bitmap === bit) {
      return;
    }
    return {
      type: INDEX_NODE,
      bitmap: root2.bitmap ^ bit,
      array: spliceOut(root2.array, idx)
    };
  }
  return root2;
}
function withoutCollision(root2, key) {
  const idx = collisionIndexOf(root2, key);
  if (idx < 0) {
    return root2;
  }
  if (root2.array.length === 1) {
    return;
  }
  return {
    type: COLLISION_NODE,
    hash: root2.hash,
    array: spliceOut(root2.array, idx)
  };
}
function forEach(root2, fn) {
  if (root2 === undefined) {
    return;
  }
  const items = root2.array;
  const size = items.length;
  for (let i = 0;i < size; i++) {
    const item = items[i];
    if (item === undefined) {
      continue;
    }
    if (item.type === ENTRY) {
      fn(item.v, item.k);
      continue;
    }
    forEach(item, fn);
  }
}

class Dict {
  static fromObject(o) {
    const keys = Object.keys(o);
    let m = Dict.new();
    for (let i = 0;i < keys.length; i++) {
      const k = keys[i];
      m = m.set(k, o[k]);
    }
    return m;
  }
  static fromMap(o) {
    let m = Dict.new();
    o.forEach((v, k) => {
      m = m.set(k, v);
    });
    return m;
  }
  static new() {
    return new Dict(undefined, 0);
  }
  constructor(root2, size) {
    this.root = root2;
    this.size = size;
  }
  get(key, notFound) {
    if (this.root === undefined) {
      return notFound;
    }
    const found = find(this.root, 0, getHash(key), key);
    if (found === undefined) {
      return notFound;
    }
    return found.v;
  }
  set(key, val) {
    const addedLeaf = { val: false };
    const root2 = this.root === undefined ? EMPTY : this.root;
    const newRoot = assoc(root2, 0, getHash(key), key, val, addedLeaf);
    if (newRoot === this.root) {
      return this;
    }
    return new Dict(newRoot, addedLeaf.val ? this.size + 1 : this.size);
  }
  delete(key) {
    if (this.root === undefined) {
      return this;
    }
    const newRoot = without(this.root, 0, getHash(key), key);
    if (newRoot === this.root) {
      return this;
    }
    if (newRoot === undefined) {
      return Dict.new();
    }
    return new Dict(newRoot, this.size - 1);
  }
  has(key) {
    if (this.root === undefined) {
      return false;
    }
    return find(this.root, 0, getHash(key), key) !== undefined;
  }
  entries() {
    if (this.root === undefined) {
      return [];
    }
    const result = [];
    this.forEach((v, k) => result.push([k, v]));
    return result;
  }
  forEach(fn) {
    forEach(this.root, fn);
  }
  hashCode() {
    let h = 0;
    this.forEach((v, k) => {
      h = h + hashMerge(getHash(v), getHash(k)) | 0;
    });
    return h;
  }
  equals(o) {
    if (!(o instanceof Dict) || this.size !== o.size) {
      return false;
    }
    try {
      this.forEach((v, k) => {
        if (!isEqual(o.get(k, !v), v)) {
          throw unequalDictSymbol;
        }
      });
      return true;
    } catch (e) {
      if (e === unequalDictSymbol) {
        return false;
      }
      throw e;
    }
  }
}
var unequalDictSymbol = /* @__PURE__ */ Symbol();

// build/dev/javascript/gleam_stdlib/gleam/order.mjs
class Lt extends CustomType {
}
class Eq extends CustomType {
}
class Gt extends CustomType {
}

// build/dev/javascript/gleam_stdlib/gleam/int.mjs
function max(a, b) {
  let $ = a > b;
  if ($) {
    return a;
  } else {
    return b;
  }
}

// build/dev/javascript/gleam_stdlib/gleam/list.mjs
class Ascending extends CustomType {
}

class Descending extends CustomType {
}
function reverse_and_prepend(loop$prefix, loop$suffix) {
  while (true) {
    let prefix = loop$prefix;
    let suffix = loop$suffix;
    if (prefix instanceof Empty) {
      return suffix;
    } else {
      let first$1 = prefix.head;
      let rest$1 = prefix.tail;
      loop$prefix = rest$1;
      loop$suffix = prepend(first$1, suffix);
    }
  }
}
function reverse(list) {
  return reverse_and_prepend(list, toList([]));
}
function filter_loop(loop$list, loop$fun, loop$acc) {
  while (true) {
    let list = loop$list;
    let fun = loop$fun;
    let acc = loop$acc;
    if (list instanceof Empty) {
      return reverse(acc);
    } else {
      let first$1 = list.head;
      let rest$1 = list.tail;
      let _block;
      let $ = fun(first$1);
      if ($) {
        _block = prepend(first$1, acc);
      } else {
        _block = acc;
      }
      let new_acc = _block;
      loop$list = rest$1;
      loop$fun = fun;
      loop$acc = new_acc;
    }
  }
}
function filter(list, predicate) {
  return filter_loop(list, predicate, toList([]));
}
function filter_map_loop(loop$list, loop$fun, loop$acc) {
  while (true) {
    let list = loop$list;
    let fun = loop$fun;
    let acc = loop$acc;
    if (list instanceof Empty) {
      return reverse(acc);
    } else {
      let first$1 = list.head;
      let rest$1 = list.tail;
      let _block;
      let $ = fun(first$1);
      if ($ instanceof Ok) {
        let first$2 = $[0];
        _block = prepend(first$2, acc);
      } else {
        _block = acc;
      }
      let new_acc = _block;
      loop$list = rest$1;
      loop$fun = fun;
      loop$acc = new_acc;
    }
  }
}
function filter_map(list, fun) {
  return filter_map_loop(list, fun, toList([]));
}
function map_loop(loop$list, loop$fun, loop$acc) {
  while (true) {
    let list = loop$list;
    let fun = loop$fun;
    let acc = loop$acc;
    if (list instanceof Empty) {
      return reverse(acc);
    } else {
      let first$1 = list.head;
      let rest$1 = list.tail;
      loop$list = rest$1;
      loop$fun = fun;
      loop$acc = prepend(fun(first$1), acc);
    }
  }
}
function map(list, fun) {
  return map_loop(list, fun, toList([]));
}
function take_loop(loop$list, loop$n, loop$acc) {
  while (true) {
    let list = loop$list;
    let n = loop$n;
    let acc = loop$acc;
    let $ = n <= 0;
    if ($) {
      return reverse(acc);
    } else {
      if (list instanceof Empty) {
        return reverse(acc);
      } else {
        let first$1 = list.head;
        let rest$1 = list.tail;
        loop$list = rest$1;
        loop$n = n - 1;
        loop$acc = prepend(first$1, acc);
      }
    }
  }
}
function take(list, n) {
  return take_loop(list, n, toList([]));
}
function append_loop(loop$first, loop$second) {
  while (true) {
    let first = loop$first;
    let second = loop$second;
    if (first instanceof Empty) {
      return second;
    } else {
      let first$1 = first.head;
      let rest$1 = first.tail;
      loop$first = rest$1;
      loop$second = prepend(first$1, second);
    }
  }
}
function append(first, second) {
  return append_loop(reverse(first), second);
}
function prepend2(list, item) {
  return prepend(item, list);
}
function fold(loop$list, loop$initial, loop$fun) {
  while (true) {
    let list = loop$list;
    let initial = loop$initial;
    let fun = loop$fun;
    if (list instanceof Empty) {
      return initial;
    } else {
      let first$1 = list.head;
      let rest$1 = list.tail;
      loop$list = rest$1;
      loop$initial = fun(initial, first$1);
      loop$fun = fun;
    }
  }
}
function sequences(loop$list, loop$compare, loop$growing, loop$direction, loop$prev, loop$acc) {
  while (true) {
    let list = loop$list;
    let compare3 = loop$compare;
    let growing = loop$growing;
    let direction = loop$direction;
    let prev = loop$prev;
    let acc = loop$acc;
    let growing$1 = prepend(prev, growing);
    if (list instanceof Empty) {
      if (direction instanceof Ascending) {
        return prepend(reverse(growing$1), acc);
      } else {
        return prepend(growing$1, acc);
      }
    } else {
      let new$1 = list.head;
      let rest$1 = list.tail;
      let $ = compare3(prev, new$1);
      if (direction instanceof Ascending) {
        if ($ instanceof Lt) {
          loop$list = rest$1;
          loop$compare = compare3;
          loop$growing = growing$1;
          loop$direction = direction;
          loop$prev = new$1;
          loop$acc = acc;
        } else if ($ instanceof Eq) {
          loop$list = rest$1;
          loop$compare = compare3;
          loop$growing = growing$1;
          loop$direction = direction;
          loop$prev = new$1;
          loop$acc = acc;
        } else {
          let _block;
          if (direction instanceof Ascending) {
            _block = prepend(reverse(growing$1), acc);
          } else {
            _block = prepend(growing$1, acc);
          }
          let acc$1 = _block;
          if (rest$1 instanceof Empty) {
            return prepend(toList([new$1]), acc$1);
          } else {
            let next = rest$1.head;
            let rest$2 = rest$1.tail;
            let _block$1;
            let $1 = compare3(new$1, next);
            if ($1 instanceof Lt) {
              _block$1 = new Ascending;
            } else if ($1 instanceof Eq) {
              _block$1 = new Ascending;
            } else {
              _block$1 = new Descending;
            }
            let direction$1 = _block$1;
            loop$list = rest$2;
            loop$compare = compare3;
            loop$growing = toList([new$1]);
            loop$direction = direction$1;
            loop$prev = next;
            loop$acc = acc$1;
          }
        }
      } else if ($ instanceof Lt) {
        let _block;
        if (direction instanceof Ascending) {
          _block = prepend(reverse(growing$1), acc);
        } else {
          _block = prepend(growing$1, acc);
        }
        let acc$1 = _block;
        if (rest$1 instanceof Empty) {
          return prepend(toList([new$1]), acc$1);
        } else {
          let next = rest$1.head;
          let rest$2 = rest$1.tail;
          let _block$1;
          let $1 = compare3(new$1, next);
          if ($1 instanceof Lt) {
            _block$1 = new Ascending;
          } else if ($1 instanceof Eq) {
            _block$1 = new Ascending;
          } else {
            _block$1 = new Descending;
          }
          let direction$1 = _block$1;
          loop$list = rest$2;
          loop$compare = compare3;
          loop$growing = toList([new$1]);
          loop$direction = direction$1;
          loop$prev = next;
          loop$acc = acc$1;
        }
      } else if ($ instanceof Eq) {
        let _block;
        if (direction instanceof Ascending) {
          _block = prepend(reverse(growing$1), acc);
        } else {
          _block = prepend(growing$1, acc);
        }
        let acc$1 = _block;
        if (rest$1 instanceof Empty) {
          return prepend(toList([new$1]), acc$1);
        } else {
          let next = rest$1.head;
          let rest$2 = rest$1.tail;
          let _block$1;
          let $1 = compare3(new$1, next);
          if ($1 instanceof Lt) {
            _block$1 = new Ascending;
          } else if ($1 instanceof Eq) {
            _block$1 = new Ascending;
          } else {
            _block$1 = new Descending;
          }
          let direction$1 = _block$1;
          loop$list = rest$2;
          loop$compare = compare3;
          loop$growing = toList([new$1]);
          loop$direction = direction$1;
          loop$prev = next;
          loop$acc = acc$1;
        }
      } else {
        loop$list = rest$1;
        loop$compare = compare3;
        loop$growing = growing$1;
        loop$direction = direction;
        loop$prev = new$1;
        loop$acc = acc;
      }
    }
  }
}
function merge_ascendings(loop$list1, loop$list2, loop$compare, loop$acc) {
  while (true) {
    let list1 = loop$list1;
    let list2 = loop$list2;
    let compare3 = loop$compare;
    let acc = loop$acc;
    if (list1 instanceof Empty) {
      let list = list2;
      return reverse_and_prepend(list, acc);
    } else if (list2 instanceof Empty) {
      let list = list1;
      return reverse_and_prepend(list, acc);
    } else {
      let first1 = list1.head;
      let rest1 = list1.tail;
      let first2 = list2.head;
      let rest2 = list2.tail;
      let $ = compare3(first1, first2);
      if ($ instanceof Lt) {
        loop$list1 = rest1;
        loop$list2 = list2;
        loop$compare = compare3;
        loop$acc = prepend(first1, acc);
      } else if ($ instanceof Eq) {
        loop$list1 = list1;
        loop$list2 = rest2;
        loop$compare = compare3;
        loop$acc = prepend(first2, acc);
      } else {
        loop$list1 = list1;
        loop$list2 = rest2;
        loop$compare = compare3;
        loop$acc = prepend(first2, acc);
      }
    }
  }
}
function merge_ascending_pairs(loop$sequences, loop$compare, loop$acc) {
  while (true) {
    let sequences2 = loop$sequences;
    let compare3 = loop$compare;
    let acc = loop$acc;
    if (sequences2 instanceof Empty) {
      return reverse(acc);
    } else {
      let $ = sequences2.tail;
      if ($ instanceof Empty) {
        let sequence = sequences2.head;
        return reverse(prepend(reverse(sequence), acc));
      } else {
        let ascending1 = sequences2.head;
        let ascending2 = $.head;
        let rest$1 = $.tail;
        let descending = merge_ascendings(ascending1, ascending2, compare3, toList([]));
        loop$sequences = rest$1;
        loop$compare = compare3;
        loop$acc = prepend(descending, acc);
      }
    }
  }
}
function merge_descendings(loop$list1, loop$list2, loop$compare, loop$acc) {
  while (true) {
    let list1 = loop$list1;
    let list2 = loop$list2;
    let compare3 = loop$compare;
    let acc = loop$acc;
    if (list1 instanceof Empty) {
      let list = list2;
      return reverse_and_prepend(list, acc);
    } else if (list2 instanceof Empty) {
      let list = list1;
      return reverse_and_prepend(list, acc);
    } else {
      let first1 = list1.head;
      let rest1 = list1.tail;
      let first2 = list2.head;
      let rest2 = list2.tail;
      let $ = compare3(first1, first2);
      if ($ instanceof Lt) {
        loop$list1 = list1;
        loop$list2 = rest2;
        loop$compare = compare3;
        loop$acc = prepend(first2, acc);
      } else if ($ instanceof Eq) {
        loop$list1 = rest1;
        loop$list2 = list2;
        loop$compare = compare3;
        loop$acc = prepend(first1, acc);
      } else {
        loop$list1 = rest1;
        loop$list2 = list2;
        loop$compare = compare3;
        loop$acc = prepend(first1, acc);
      }
    }
  }
}
function merge_descending_pairs(loop$sequences, loop$compare, loop$acc) {
  while (true) {
    let sequences2 = loop$sequences;
    let compare3 = loop$compare;
    let acc = loop$acc;
    if (sequences2 instanceof Empty) {
      return reverse(acc);
    } else {
      let $ = sequences2.tail;
      if ($ instanceof Empty) {
        let sequence = sequences2.head;
        return reverse(prepend(reverse(sequence), acc));
      } else {
        let descending1 = sequences2.head;
        let descending2 = $.head;
        let rest$1 = $.tail;
        let ascending = merge_descendings(descending1, descending2, compare3, toList([]));
        loop$sequences = rest$1;
        loop$compare = compare3;
        loop$acc = prepend(ascending, acc);
      }
    }
  }
}
function merge_all(loop$sequences, loop$direction, loop$compare) {
  while (true) {
    let sequences2 = loop$sequences;
    let direction = loop$direction;
    let compare3 = loop$compare;
    if (sequences2 instanceof Empty) {
      return sequences2;
    } else if (direction instanceof Ascending) {
      let $ = sequences2.tail;
      if ($ instanceof Empty) {
        let sequence = sequences2.head;
        return sequence;
      } else {
        let sequences$1 = merge_ascending_pairs(sequences2, compare3, toList([]));
        loop$sequences = sequences$1;
        loop$direction = new Descending;
        loop$compare = compare3;
      }
    } else {
      let $ = sequences2.tail;
      if ($ instanceof Empty) {
        let sequence = sequences2.head;
        return reverse(sequence);
      } else {
        let sequences$1 = merge_descending_pairs(sequences2, compare3, toList([]));
        loop$sequences = sequences$1;
        loop$direction = new Ascending;
        loop$compare = compare3;
      }
    }
  }
}
function sort(list, compare3) {
  if (list instanceof Empty) {
    return list;
  } else {
    let $ = list.tail;
    if ($ instanceof Empty) {
      return list;
    } else {
      let x = list.head;
      let y = $.head;
      let rest$1 = $.tail;
      let _block;
      let $1 = compare3(x, y);
      if ($1 instanceof Lt) {
        _block = new Ascending;
      } else if ($1 instanceof Eq) {
        _block = new Ascending;
      } else {
        _block = new Descending;
      }
      let direction = _block;
      let sequences$1 = sequences(rest$1, compare3, toList([x]), direction, y, toList([]));
      return merge_all(sequences$1, new Ascending, compare3);
    }
  }
}
function each(loop$list, loop$f) {
  while (true) {
    let list = loop$list;
    let f = loop$f;
    if (list instanceof Empty) {
      return;
    } else {
      let first$1 = list.head;
      let rest$1 = list.tail;
      f(first$1);
      loop$list = rest$1;
      loop$f = f;
    }
  }
}

// build/dev/javascript/gleam_stdlib/gleam/string.mjs
function concat_loop(loop$strings, loop$accumulator) {
  while (true) {
    let strings = loop$strings;
    let accumulator = loop$accumulator;
    if (strings instanceof Empty) {
      return accumulator;
    } else {
      let string = strings.head;
      let strings$1 = strings.tail;
      loop$strings = strings$1;
      loop$accumulator = accumulator + string;
    }
  }
}
function concat2(strings) {
  return concat_loop(strings, "");
}
function join_loop(loop$strings, loop$separator, loop$accumulator) {
  while (true) {
    let strings = loop$strings;
    let separator = loop$separator;
    let accumulator = loop$accumulator;
    if (strings instanceof Empty) {
      return accumulator;
    } else {
      let string = strings.head;
      let strings$1 = strings.tail;
      loop$strings = strings$1;
      loop$separator = separator;
      loop$accumulator = accumulator + separator + string;
    }
  }
}
function join(strings, separator) {
  if (strings instanceof Empty) {
    return "";
  } else {
    let first$1 = strings.head;
    let rest = strings.tail;
    return join_loop(rest, separator, first$1);
  }
}
function trim(string) {
  let _pipe = string;
  let _pipe$1 = trim_start(_pipe);
  return trim_end(_pipe$1);
}
function split2(x, substring) {
  if (substring === "") {
    return graphemes(x);
  } else {
    let _pipe = x;
    let _pipe$1 = identity(_pipe);
    let _pipe$2 = split(_pipe$1, substring);
    return map(_pipe$2, identity);
  }
}
function first(string) {
  let $ = pop_grapheme(string);
  if ($ instanceof Ok) {
    let first$1 = $[0][0];
    return new Ok(first$1);
  } else {
    return $;
  }
}
function inspect2(term) {
  let _pipe = term;
  let _pipe$1 = inspect(_pipe);
  return identity(_pipe$1);
}

// build/dev/javascript/gleam_stdlib/gleam/dynamic/decode.mjs
class DecodeError extends CustomType {
  constructor(expected, found, path) {
    super();
    this.expected = expected;
    this.found = found;
    this.path = path;
  }
}
class Decoder extends CustomType {
  constructor(function$) {
    super();
    this.function = function$;
  }
}
function run(data, decoder) {
  let $ = decoder.function(data);
  let maybe_invalid_data;
  let errors;
  maybe_invalid_data = $[0];
  errors = $[1];
  if (errors instanceof Empty) {
    return new Ok(maybe_invalid_data);
  } else {
    return new Error2(errors);
  }
}
function success(data) {
  return new Decoder((_) => {
    return [data, toList([])];
  });
}
function decode_dynamic(data) {
  return [data, toList([])];
}
function map2(decoder, transformer) {
  return new Decoder((d) => {
    let $ = decoder.function(d);
    let data;
    let errors;
    data = $[0];
    errors = $[1];
    return [transformer(data), errors];
  });
}
function run_decoders(loop$data, loop$failure, loop$decoders) {
  while (true) {
    let data = loop$data;
    let failure = loop$failure;
    let decoders = loop$decoders;
    if (decoders instanceof Empty) {
      return failure;
    } else {
      let decoder = decoders.head;
      let decoders$1 = decoders.tail;
      let $ = decoder.function(data);
      let layer;
      let errors;
      layer = $;
      errors = $[1];
      if (errors instanceof Empty) {
        return layer;
      } else {
        loop$data = data;
        loop$failure = failure;
        loop$decoders = decoders$1;
      }
    }
  }
}
function one_of(first2, alternatives) {
  return new Decoder((dynamic_data) => {
    let $ = first2.function(dynamic_data);
    let layer;
    let errors;
    layer = $;
    errors = $[1];
    if (errors instanceof Empty) {
      return layer;
    } else {
      return run_decoders(dynamic_data, layer, alternatives);
    }
  });
}
function optional(inner) {
  return new Decoder((data) => {
    let $ = is_null(data);
    if ($) {
      return [new None, toList([])];
    } else {
      let $1 = inner.function(data);
      let data$1;
      let errors;
      data$1 = $1[0];
      errors = $1[1];
      return [new Some(data$1), errors];
    }
  });
}
var dynamic = /* @__PURE__ */ new Decoder(decode_dynamic);
function run_dynamic_function(data, name, f) {
  let $ = f(data);
  if ($ instanceof Ok) {
    let data$1 = $[0];
    return [data$1, toList([])];
  } else {
    let zero = $[0];
    return [
      zero,
      toList([new DecodeError(name, classify_dynamic(data), toList([]))])
    ];
  }
}
function decode_int(data) {
  return run_dynamic_function(data, "Int", int);
}
var int2 = /* @__PURE__ */ new Decoder(decode_int);
function decode_string(data) {
  return run_dynamic_function(data, "String", string);
}
var string2 = /* @__PURE__ */ new Decoder(decode_string);
function list2(inner) {
  return new Decoder((data) => {
    return list(data, inner.function, (p, k) => {
      return push_path(p, toList([k]));
    }, 0, toList([]));
  });
}
function push_path(layer, path) {
  let decoder = one_of(string2, toList([
    (() => {
      let _pipe = int2;
      return map2(_pipe, to_string);
    })()
  ]));
  let path$1 = map(path, (key) => {
    let key$1 = identity(key);
    let $ = run(key$1, decoder);
    if ($ instanceof Ok) {
      let key$2 = $[0];
      return key$2;
    } else {
      return "<" + classify_dynamic(key$1) + ">";
    }
  });
  let errors = map(layer[1], (error) => {
    return new DecodeError(error.expected, error.found, append(path$1, error.path));
  });
  return [layer[0], errors];
}
function index3(loop$path, loop$position, loop$inner, loop$data, loop$handle_miss) {
  while (true) {
    let path = loop$path;
    let position = loop$position;
    let inner = loop$inner;
    let data = loop$data;
    let handle_miss = loop$handle_miss;
    if (path instanceof Empty) {
      let _pipe = data;
      let _pipe$1 = inner(_pipe);
      return push_path(_pipe$1, reverse(position));
    } else {
      let key = path.head;
      let path$1 = path.tail;
      let $ = index2(data, key);
      if ($ instanceof Ok) {
        let $1 = $[0];
        if ($1 instanceof Some) {
          let data$1 = $1[0];
          loop$path = path$1;
          loop$position = prepend(key, position);
          loop$inner = inner;
          loop$data = data$1;
          loop$handle_miss = handle_miss;
        } else {
          return handle_miss(data, prepend(key, position));
        }
      } else {
        let kind = $[0];
        let $1 = inner(data);
        let default$;
        default$ = $1[0];
        let _pipe = [
          default$,
          toList([new DecodeError(kind, classify_dynamic(data), toList([]))])
        ];
        return push_path(_pipe, reverse(position));
      }
    }
  }
}
function subfield(field_path, field_decoder, next) {
  return new Decoder((data) => {
    let $ = index3(field_path, toList([]), field_decoder.function, data, (data2, position) => {
      let $12 = field_decoder.function(data2);
      let default$;
      default$ = $12[0];
      let _pipe = [
        default$,
        toList([new DecodeError("Field", "Nothing", toList([]))])
      ];
      return push_path(_pipe, reverse(position));
    });
    let out;
    let errors1;
    out = $[0];
    errors1 = $[1];
    let $1 = next(out).function(data);
    let out$1;
    let errors2;
    out$1 = $1[0];
    errors2 = $1[1];
    return [out$1, append(errors1, errors2)];
  });
}
function at(path, inner) {
  return new Decoder((data) => {
    return index3(path, toList([]), inner.function, data, (data2, position) => {
      let $ = inner.function(data2);
      let default$;
      default$ = $[0];
      let _pipe = [
        default$,
        toList([new DecodeError("Field", "Nothing", toList([]))])
      ];
      return push_path(_pipe, reverse(position));
    });
  });
}
function field(field_name, field_decoder, next) {
  return subfield(toList([field_name]), field_decoder, next);
}

// build/dev/javascript/gleam_stdlib/gleam_stdlib.mjs
var Nil = undefined;
var NOT_FOUND = {};
function identity(x) {
  return x;
}
function parse_float(value) {
  if (/^[-+]?(\d+)\.(\d+)([eE][-+]?\d+)?$/.test(value)) {
    return new Ok(parseFloat(value));
  } else {
    return new Error2(Nil);
  }
}
function to_string(term) {
  return term.toString();
}
function string_length(string3) {
  if (string3 === "") {
    return 0;
  }
  const iterator = graphemes_iterator(string3);
  if (iterator) {
    let i = 0;
    for (const _ of iterator) {
      i++;
    }
    return i;
  } else {
    return string3.match(/./gsu).length;
  }
}
function graphemes(string3) {
  const iterator = graphemes_iterator(string3);
  if (iterator) {
    return List.fromArray(Array.from(iterator).map((item) => item.segment));
  } else {
    return List.fromArray(string3.match(/./gsu));
  }
}
var segmenter = undefined;
function graphemes_iterator(string3) {
  if (globalThis.Intl && Intl.Segmenter) {
    segmenter ||= new Intl.Segmenter;
    return segmenter.segment(string3)[Symbol.iterator]();
  }
}
function pop_grapheme(string3) {
  let first2;
  const iterator = graphemes_iterator(string3);
  if (iterator) {
    first2 = iterator.next().value?.segment;
  } else {
    first2 = string3.match(/./su)?.[0];
  }
  if (first2) {
    return new Ok([first2, string3.slice(first2.length)]);
  } else {
    return new Error2(Nil);
  }
}
function uppercase(string3) {
  return string3.toUpperCase();
}
function split(xs, pattern) {
  return List.fromArray(xs.split(pattern));
}
function starts_with(haystack, needle) {
  return haystack.startsWith(needle);
}
var unicode_whitespaces = [
  " ",
  "\t",
  `
`,
  "\v",
  "\f",
  "\r",
  "",
  "\u2028",
  "\u2029"
].join("");
var trim_start_regex = /* @__PURE__ */ new RegExp(`^[${unicode_whitespaces}]*`);
var trim_end_regex = /* @__PURE__ */ new RegExp(`[${unicode_whitespaces}]*$`);
function trim_start(string3) {
  return string3.replace(trim_start_regex, "");
}
function trim_end(string3) {
  return string3.replace(trim_end_regex, "");
}
function console_log(term) {
  console.log(term);
}
function new_map() {
  return Dict.new();
}
function map_to_list(map3) {
  return List.fromArray(map3.entries());
}
function map_get(map3, key) {
  const value = map3.get(key, NOT_FOUND);
  if (value === NOT_FOUND) {
    return new Error2(Nil);
  }
  return new Ok(value);
}
function map_insert(key, value, map3) {
  return map3.set(key, value);
}
function classify_dynamic(data) {
  if (typeof data === "string") {
    return "String";
  } else if (typeof data === "boolean") {
    return "Bool";
  } else if (data instanceof Result) {
    return "Result";
  } else if (data instanceof List) {
    return "List";
  } else if (data instanceof BitArray) {
    return "BitArray";
  } else if (data instanceof Dict) {
    return "Dict";
  } else if (Number.isInteger(data)) {
    return "Int";
  } else if (Array.isArray(data)) {
    return `Array`;
  } else if (typeof data === "number") {
    return "Float";
  } else if (data === null) {
    return "Nil";
  } else if (data === undefined) {
    return "Nil";
  } else {
    const type = typeof data;
    return type.charAt(0).toUpperCase() + type.slice(1);
  }
}
function inspect(v) {
  return new Inspector().inspect(v);
}
function float_to_string(float2) {
  const string3 = float2.toString().replace("+", "");
  if (string3.indexOf(".") >= 0) {
    return string3;
  } else {
    const index4 = string3.indexOf("e");
    if (index4 >= 0) {
      return string3.slice(0, index4) + ".0" + string3.slice(index4);
    } else {
      return string3 + ".0";
    }
  }
}

class Inspector {
  #references = new Set;
  inspect(v) {
    const t = typeof v;
    if (v === true)
      return "True";
    if (v === false)
      return "False";
    if (v === null)
      return "//js(null)";
    if (v === undefined)
      return "Nil";
    if (t === "string")
      return this.#string(v);
    if (t === "bigint" || Number.isInteger(v))
      return v.toString();
    if (t === "number")
      return float_to_string(v);
    if (v instanceof UtfCodepoint)
      return this.#utfCodepoint(v);
    if (v instanceof BitArray)
      return this.#bit_array(v);
    if (v instanceof RegExp)
      return `//js(${v})`;
    if (v instanceof Date)
      return `//js(Date("${v.toISOString()}"))`;
    if (v instanceof globalThis.Error)
      return `//js(${v.toString()})`;
    if (v instanceof Function) {
      const args = [];
      for (const i of Array(v.length).keys())
        args.push(String.fromCharCode(i + 97));
      return `//fn(${args.join(", ")}) { ... }`;
    }
    if (this.#references.size === this.#references.add(v).size) {
      return "//js(circular reference)";
    }
    let printed;
    if (Array.isArray(v)) {
      printed = `#(${v.map((v2) => this.inspect(v2)).join(", ")})`;
    } else if (v instanceof List) {
      printed = this.#list(v);
    } else if (v instanceof CustomType) {
      printed = this.#customType(v);
    } else if (v instanceof Dict) {
      printed = this.#dict(v);
    } else if (v instanceof Set) {
      return `//js(Set(${[...v].map((v2) => this.inspect(v2)).join(", ")}))`;
    } else {
      printed = this.#object(v);
    }
    this.#references.delete(v);
    return printed;
  }
  #object(v) {
    const name = Object.getPrototypeOf(v)?.constructor?.name || "Object";
    const props = [];
    for (const k of Object.keys(v)) {
      props.push(`${this.inspect(k)}: ${this.inspect(v[k])}`);
    }
    const body = props.length ? " " + props.join(", ") + " " : "";
    const head = name === "Object" ? "" : name + " ";
    return `//js(${head}{${body}})`;
  }
  #dict(map3) {
    let body = "dict.from_list([";
    let first2 = true;
    map3.forEach((value, key) => {
      if (!first2)
        body = body + ", ";
      body = body + "#(" + this.inspect(key) + ", " + this.inspect(value) + ")";
      first2 = false;
    });
    return body + "])";
  }
  #customType(record) {
    const props = Object.keys(record).map((label) => {
      const value = this.inspect(record[label]);
      return isNaN(parseInt(label)) ? `${label}: ${value}` : value;
    }).join(", ");
    return props ? `${record.constructor.name}(${props})` : record.constructor.name;
  }
  #list(list3) {
    if (list3 instanceof Empty) {
      return "[]";
    }
    let char_out = 'charlist.from_string("';
    let list_out = "[";
    let current = list3;
    while (current instanceof NonEmpty) {
      let element = current.head;
      current = current.tail;
      if (list_out !== "[") {
        list_out += ", ";
      }
      list_out += this.inspect(element);
      if (char_out) {
        if (Number.isInteger(element) && element >= 32 && element <= 126) {
          char_out += String.fromCharCode(element);
        } else {
          char_out = null;
        }
      }
    }
    if (char_out) {
      return char_out + '")';
    } else {
      return list_out + "]";
    }
  }
  #string(str) {
    let new_str = '"';
    for (let i = 0;i < str.length; i++) {
      const char = str[i];
      switch (char) {
        case `
`:
          new_str += "\\n";
          break;
        case "\r":
          new_str += "\\r";
          break;
        case "\t":
          new_str += "\\t";
          break;
        case "\f":
          new_str += "\\f";
          break;
        case "\\":
          new_str += "\\\\";
          break;
        case '"':
          new_str += "\\\"";
          break;
        default:
          if (char < " " || char > "~" && char < " ") {
            new_str += "\\u{" + char.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0") + "}";
          } else {
            new_str += char;
          }
      }
    }
    new_str += '"';
    return new_str;
  }
  #utfCodepoint(codepoint2) {
    return `//utfcodepoint(${String.fromCodePoint(codepoint2.value)})`;
  }
  #bit_array(bits) {
    if (bits.bitSize === 0) {
      return "<<>>";
    }
    let acc = "<<";
    for (let i = 0;i < bits.byteSize - 1; i++) {
      acc += bits.byteAt(i).toString();
      acc += ", ";
    }
    if (bits.byteSize * 8 === bits.bitSize) {
      acc += bits.byteAt(bits.byteSize - 1).toString();
    } else {
      const trailingBitsCount = bits.bitSize % 8;
      acc += bits.byteAt(bits.byteSize - 1) >> 8 - trailingBitsCount;
      acc += `:size(${trailingBitsCount})`;
    }
    acc += ">>";
    return acc;
  }
}
function index2(data, key) {
  if (data instanceof Dict || data instanceof WeakMap || data instanceof Map) {
    const token = {};
    const entry = data.get(key, token);
    if (entry === token)
      return new Ok(new None);
    return new Ok(new Some(entry));
  }
  const key_is_int = Number.isInteger(key);
  if (key_is_int && key >= 0 && key < 8 && data instanceof List) {
    let i = 0;
    for (const value of data) {
      if (i === key)
        return new Ok(new Some(value));
      i++;
    }
    return new Error2("Indexable");
  }
  if (key_is_int && Array.isArray(data) || data && typeof data === "object" || data && Object.getPrototypeOf(data) === Object.prototype) {
    if (key in data)
      return new Ok(new Some(data[key]));
    return new Ok(new None);
  }
  return new Error2(key_is_int ? "Indexable" : "Dict");
}
function list(data, decode, pushPath, index4, emptyList) {
  if (!(data instanceof List || Array.isArray(data))) {
    const error = new DecodeError("List", classify_dynamic(data), emptyList);
    return [emptyList, List.fromArray([error])];
  }
  const decoded = [];
  for (const element of data) {
    const layer = decode(element);
    const [out, errors] = layer;
    if (errors instanceof NonEmpty) {
      const [_, errors2] = pushPath(layer, index4.toString());
      return [emptyList, errors2];
    }
    decoded.push(out);
    index4++;
  }
  return [List.fromArray(decoded), emptyList];
}
function int(data) {
  if (Number.isInteger(data))
    return new Ok(data);
  return new Error2(0);
}
function string(data) {
  if (typeof data === "string")
    return new Ok(data);
  return new Error2("");
}
function is_null(data) {
  return data === null || data === undefined;
}

// build/dev/javascript/gleam_stdlib/gleam/dict.mjs
function insert(dict2, key, value) {
  return map_insert(key, value, dict2);
}
function reverse_and_concat(loop$remaining, loop$accumulator) {
  while (true) {
    let remaining = loop$remaining;
    let accumulator = loop$accumulator;
    if (remaining instanceof Empty) {
      return accumulator;
    } else {
      let first2 = remaining.head;
      let rest = remaining.tail;
      loop$remaining = rest;
      loop$accumulator = prepend(first2, accumulator);
    }
  }
}
function do_keys_loop(loop$list, loop$acc) {
  while (true) {
    let list3 = loop$list;
    let acc = loop$acc;
    if (list3 instanceof Empty) {
      return reverse_and_concat(acc, toList([]));
    } else {
      let rest = list3.tail;
      let key = list3.head[0];
      loop$list = rest;
      loop$acc = prepend(key, acc);
    }
  }
}
function keys(dict2) {
  return do_keys_loop(map_to_list(dict2), toList([]));
}
// build/dev/javascript/gleam_javascript/gleam_javascript_ffi.mjs
class PromiseLayer {
  constructor(promise) {
    this.promise = promise;
  }
  static wrap(value) {
    return value instanceof Promise ? new PromiseLayer(value) : value;
  }
  static unwrap(value) {
    return value instanceof PromiseLayer ? value.promise : value;
  }
}
function resolve(value) {
  return Promise.resolve(PromiseLayer.wrap(value));
}
function then_await(promise, fn) {
  return promise.then((value) => fn(PromiseLayer.unwrap(value)));
}
function map_promise(promise, fn) {
  return promise.then((value) => PromiseLayer.wrap(fn(PromiseLayer.unwrap(value))));
}

// build/dev/javascript/gleam_javascript/gleam/javascript/promise.mjs
function tap(promise, callback) {
  let _pipe = promise;
  return map_promise(_pipe, (a) => {
    callback(a);
    return a;
  });
}

// build/dev/javascript/gleam_stdlib/gleam/result.mjs
function map4(result, fun) {
  if (result instanceof Ok) {
    let x = result[0];
    return new Ok(fun(x));
  } else {
    return result;
  }
}
function map_error(result, fun) {
  if (result instanceof Ok) {
    return result;
  } else {
    let error = result[0];
    return new Error2(fun(error));
  }
}
function try$(result, fun) {
  if (result instanceof Ok) {
    let x = result[0];
    return fun(x);
  } else {
    return result;
  }
}
function replace_error(result, error) {
  if (result instanceof Ok) {
    return result;
  } else {
    return new Error2(error);
  }
}
function values2(results) {
  return filter_map(results, (result) => {
    return result;
  });
}
// build/dev/javascript/gleam_json/gleam_json_ffi.mjs
function json_to_string(json) {
  return JSON.stringify(json);
}
function object(entries) {
  return Object.fromEntries(entries);
}
function identity2(x) {
  return x;
}
function array(list3) {
  return list3.toArray();
}
function decode(string3) {
  try {
    const result = JSON.parse(string3);
    return new Ok(result);
  } catch (err) {
    return new Error2(getJsonDecodeError(err, string3));
  }
}
function getJsonDecodeError(stdErr, json) {
  if (isUnexpectedEndOfInput(stdErr))
    return new UnexpectedEndOfInput;
  return toUnexpectedByteError(stdErr, json);
}
function isUnexpectedEndOfInput(err) {
  const unexpectedEndOfInputRegex = /((unexpected (end|eof))|(end of data)|(unterminated string)|(json( parse error|\.parse)\: expected '(\:|\}|\])'))/i;
  return unexpectedEndOfInputRegex.test(err.message);
}
function toUnexpectedByteError(err, json) {
  let converters = [
    v8UnexpectedByteError,
    oldV8UnexpectedByteError,
    jsCoreUnexpectedByteError,
    spidermonkeyUnexpectedByteError
  ];
  for (let converter of converters) {
    let result = converter(err, json);
    if (result)
      return result;
  }
  return new UnexpectedByte("", 0);
}
function v8UnexpectedByteError(err) {
  const regex = /unexpected token '(.)', ".+" is not valid JSON/i;
  const match = regex.exec(err.message);
  if (!match)
    return null;
  const byte = toHex(match[1]);
  return new UnexpectedByte(byte, -1);
}
function oldV8UnexpectedByteError(err) {
  const regex = /unexpected token (.) in JSON at position (\d+)/i;
  const match = regex.exec(err.message);
  if (!match)
    return null;
  const byte = toHex(match[1]);
  const position = Number(match[2]);
  return new UnexpectedByte(byte, position);
}
function spidermonkeyUnexpectedByteError(err, json) {
  const regex = /(unexpected character|expected .*) at line (\d+) column (\d+)/i;
  const match = regex.exec(err.message);
  if (!match)
    return null;
  const line = Number(match[2]);
  const column = Number(match[3]);
  const position = getPositionFromMultiline(line, column, json);
  const byte = toHex(json[position]);
  return new UnexpectedByte(byte, position);
}
function jsCoreUnexpectedByteError(err) {
  const regex = /unexpected (identifier|token) "(.)"/i;
  const match = regex.exec(err.message);
  if (!match)
    return null;
  const byte = toHex(match[2]);
  return new UnexpectedByte(byte, 0);
}
function toHex(char) {
  return "0x" + char.charCodeAt(0).toString(16).toUpperCase();
}
function getPositionFromMultiline(line, column, string3) {
  if (line === 1)
    return column - 1;
  let currentLn = 1;
  let position = 0;
  string3.split("").find((char, idx) => {
    if (char === `
`)
      currentLn += 1;
    if (currentLn === line) {
      position = idx + column;
      return true;
    }
    return false;
  });
  return position;
}

// build/dev/javascript/gleam_json/gleam/json.mjs
class UnexpectedEndOfInput extends CustomType {
}
class UnexpectedByte extends CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}
class UnableToDecode extends CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}
function do_parse(json, decoder) {
  return try$(decode(json), (dynamic_value) => {
    let _pipe = run(dynamic_value, decoder);
    return map_error(_pipe, (var0) => {
      return new UnableToDecode(var0);
    });
  });
}
function parse(json, decoder) {
  return do_parse(json, decoder);
}
function to_string2(json) {
  return json_to_string(json);
}
function string3(input) {
  return identity2(input);
}
function bool(input) {
  return identity2(input);
}
function object2(entries) {
  return object(entries);
}
function preprocessed_array(from) {
  return array(from);
}
function array2(entries, inner_type) {
  let _pipe = entries;
  let _pipe$1 = map(_pipe, inner_type);
  return preprocessed_array(_pipe$1);
}

// build/dev/javascript/gleam_stdlib/gleam/uri.mjs
class Uri extends CustomType {
  constructor(scheme, userinfo, host, port, path, query, fragment) {
    super();
    this.scheme = scheme;
    this.userinfo = userinfo;
    this.host = host;
    this.port = port;
    this.path = path;
    this.query = query;
    this.fragment = fragment;
  }
}
function remove_dot_segments_loop(loop$input, loop$accumulator) {
  while (true) {
    let input = loop$input;
    let accumulator = loop$accumulator;
    if (input instanceof Empty) {
      return reverse(accumulator);
    } else {
      let segment = input.head;
      let rest = input.tail;
      let _block;
      if (segment === "") {
        _block = accumulator;
      } else if (segment === ".") {
        _block = accumulator;
      } else if (segment === "..") {
        if (accumulator instanceof Empty) {
          _block = accumulator;
        } else {
          let accumulator$12 = accumulator.tail;
          _block = accumulator$12;
        }
      } else {
        let segment$1 = segment;
        let accumulator$12 = accumulator;
        _block = prepend(segment$1, accumulator$12);
      }
      let accumulator$1 = _block;
      loop$input = rest;
      loop$accumulator = accumulator$1;
    }
  }
}
function remove_dot_segments(input) {
  return remove_dot_segments_loop(input, toList([]));
}
function path_segments(path) {
  return remove_dot_segments(split2(path, "/"));
}
function to_string3(uri) {
  let _block;
  let $ = uri.fragment;
  if ($ instanceof Some) {
    let fragment = $[0];
    _block = toList(["#", fragment]);
  } else {
    _block = toList([]);
  }
  let parts = _block;
  let _block$1;
  let $1 = uri.query;
  if ($1 instanceof Some) {
    let query = $1[0];
    _block$1 = prepend("?", prepend(query, parts));
  } else {
    _block$1 = parts;
  }
  let parts$1 = _block$1;
  let parts$2 = prepend(uri.path, parts$1);
  let _block$2;
  let $2 = uri.host;
  let $3 = starts_with(uri.path, "/");
  if ($2 instanceof Some && !$3) {
    let host = $2[0];
    if (host !== "") {
      _block$2 = prepend("/", parts$2);
    } else {
      _block$2 = parts$2;
    }
  } else {
    _block$2 = parts$2;
  }
  let parts$3 = _block$2;
  let _block$3;
  let $4 = uri.host;
  let $5 = uri.port;
  if ($4 instanceof Some && $5 instanceof Some) {
    let port = $5[0];
    _block$3 = prepend(":", prepend(to_string(port), parts$3));
  } else {
    _block$3 = parts$3;
  }
  let parts$4 = _block$3;
  let _block$4;
  let $6 = uri.scheme;
  let $7 = uri.userinfo;
  let $8 = uri.host;
  if ($6 instanceof Some) {
    if ($7 instanceof Some) {
      if ($8 instanceof Some) {
        let s = $6[0];
        let u = $7[0];
        let h = $8[0];
        _block$4 = prepend(s, prepend("://", prepend(u, prepend("@", prepend(h, parts$4)))));
      } else {
        let s = $6[0];
        _block$4 = prepend(s, prepend(":", parts$4));
      }
    } else if ($8 instanceof Some) {
      let s = $6[0];
      let h = $8[0];
      _block$4 = prepend(s, prepend("://", prepend(h, parts$4)));
    } else {
      let s = $6[0];
      _block$4 = prepend(s, prepend(":", parts$4));
    }
  } else if ($7 instanceof None && $8 instanceof Some) {
    let h = $8[0];
    _block$4 = prepend("//", prepend(h, parts$4));
  } else {
    _block$4 = parts$4;
  }
  let parts$5 = _block$4;
  return concat2(parts$5);
}
// build/dev/javascript/gleam_stdlib/gleam/bool.mjs
function guard(requirement, consequence, alternative) {
  if (requirement) {
    return consequence;
  } else {
    return alternative();
  }
}

// build/dev/javascript/gleam_stdlib/gleam/function.mjs
function identity3(x) {
  return x;
}
// build/dev/javascript/lustre/lustre/internals/constants.ffi.mjs
var document2 = () => globalThis?.document;
var NAMESPACE_HTML = "http://www.w3.org/1999/xhtml";
var ELEMENT_NODE = 1;
var TEXT_NODE = 3;
var SUPPORTS_MOVE_BEFORE = !!globalThis.HTMLElement?.prototype?.moveBefore;

// build/dev/javascript/lustre/lustre/internals/constants.mjs
var empty_list = /* @__PURE__ */ toList([]);
var option_none = /* @__PURE__ */ new None;

// build/dev/javascript/lustre/lustre/vdom/vattr.ffi.mjs
var GT = /* @__PURE__ */ new Gt;
var LT = /* @__PURE__ */ new Lt;
var EQ = /* @__PURE__ */ new Eq;
function compare3(a, b) {
  if (a.name === b.name) {
    return EQ;
  } else if (a.name < b.name) {
    return LT;
  } else {
    return GT;
  }
}

// build/dev/javascript/lustre/lustre/vdom/vattr.mjs
class Attribute extends CustomType {
  constructor(kind, name, value) {
    super();
    this.kind = kind;
    this.name = name;
    this.value = value;
  }
}
class Property extends CustomType {
  constructor(kind, name, value) {
    super();
    this.kind = kind;
    this.name = name;
    this.value = value;
  }
}
class Event2 extends CustomType {
  constructor(kind, name, handler, include, prevent_default, stop_propagation, immediate, debounce, throttle) {
    super();
    this.kind = kind;
    this.name = name;
    this.handler = handler;
    this.include = include;
    this.prevent_default = prevent_default;
    this.stop_propagation = stop_propagation;
    this.immediate = immediate;
    this.debounce = debounce;
    this.throttle = throttle;
  }
}
class Handler extends CustomType {
  constructor(prevent_default, stop_propagation, message) {
    super();
    this.prevent_default = prevent_default;
    this.stop_propagation = stop_propagation;
    this.message = message;
  }
}
class Never extends CustomType {
  constructor(kind) {
    super();
    this.kind = kind;
  }
}
class Always extends CustomType {
  constructor(kind) {
    super();
    this.kind = kind;
  }
}
function merge(loop$attributes, loop$merged) {
  while (true) {
    let attributes = loop$attributes;
    let merged = loop$merged;
    if (attributes instanceof Empty) {
      return merged;
    } else {
      let $ = attributes.head;
      if ($ instanceof Attribute) {
        let $1 = $.name;
        if ($1 === "") {
          let rest = attributes.tail;
          loop$attributes = rest;
          loop$merged = merged;
        } else if ($1 === "class") {
          let $2 = $.value;
          if ($2 === "") {
            let rest = attributes.tail;
            loop$attributes = rest;
            loop$merged = merged;
          } else {
            let $3 = attributes.tail;
            if ($3 instanceof Empty) {
              let attribute$1 = $;
              let rest = $3;
              loop$attributes = rest;
              loop$merged = prepend(attribute$1, merged);
            } else {
              let $4 = $3.head;
              if ($4 instanceof Attribute) {
                let $5 = $4.name;
                if ($5 === "class") {
                  let kind = $.kind;
                  let class1 = $2;
                  let rest = $3.tail;
                  let class2 = $4.value;
                  let value = class1 + " " + class2;
                  let attribute$1 = new Attribute(kind, "class", value);
                  loop$attributes = prepend(attribute$1, rest);
                  loop$merged = merged;
                } else {
                  let attribute$1 = $;
                  let rest = $3;
                  loop$attributes = rest;
                  loop$merged = prepend(attribute$1, merged);
                }
              } else {
                let attribute$1 = $;
                let rest = $3;
                loop$attributes = rest;
                loop$merged = prepend(attribute$1, merged);
              }
            }
          }
        } else if ($1 === "style") {
          let $2 = $.value;
          if ($2 === "") {
            let rest = attributes.tail;
            loop$attributes = rest;
            loop$merged = merged;
          } else {
            let $3 = attributes.tail;
            if ($3 instanceof Empty) {
              let attribute$1 = $;
              let rest = $3;
              loop$attributes = rest;
              loop$merged = prepend(attribute$1, merged);
            } else {
              let $4 = $3.head;
              if ($4 instanceof Attribute) {
                let $5 = $4.name;
                if ($5 === "style") {
                  let kind = $.kind;
                  let style1 = $2;
                  let rest = $3.tail;
                  let style2 = $4.value;
                  let value = style1 + ";" + style2;
                  let attribute$1 = new Attribute(kind, "style", value);
                  loop$attributes = prepend(attribute$1, rest);
                  loop$merged = merged;
                } else {
                  let attribute$1 = $;
                  let rest = $3;
                  loop$attributes = rest;
                  loop$merged = prepend(attribute$1, merged);
                }
              } else {
                let attribute$1 = $;
                let rest = $3;
                loop$attributes = rest;
                loop$merged = prepend(attribute$1, merged);
              }
            }
          }
        } else {
          let attribute$1 = $;
          let rest = attributes.tail;
          loop$attributes = rest;
          loop$merged = prepend(attribute$1, merged);
        }
      } else {
        let attribute$1 = $;
        let rest = attributes.tail;
        loop$attributes = rest;
        loop$merged = prepend(attribute$1, merged);
      }
    }
  }
}
function prepare(attributes) {
  if (attributes instanceof Empty) {
    return attributes;
  } else {
    let $ = attributes.tail;
    if ($ instanceof Empty) {
      return attributes;
    } else {
      let _pipe = attributes;
      let _pipe$1 = sort(_pipe, (a, b) => {
        return compare3(b, a);
      });
      return merge(_pipe$1, empty_list);
    }
  }
}
var attribute_kind = 0;
function attribute(name, value) {
  return new Attribute(attribute_kind, name, value);
}
var property_kind = 1;
function property(name, value) {
  return new Property(property_kind, name, value);
}
var event_kind = 2;
function event(name, handler, include, prevent_default, stop_propagation, immediate, debounce, throttle) {
  return new Event2(event_kind, name, handler, include, prevent_default, stop_propagation, immediate, debounce, throttle);
}
var never_kind = 0;
var never = /* @__PURE__ */ new Never(never_kind);
var always_kind = 2;
var always = /* @__PURE__ */ new Always(always_kind);

// build/dev/javascript/lustre/lustre/attribute.mjs
function attribute2(name, value) {
  return attribute(name, value);
}
function property2(name, value) {
  return property(name, value);
}
function boolean_attribute(name, value) {
  if (value) {
    return attribute2(name, "");
  } else {
    return property2(name, bool(false));
  }
}
function class$(name) {
  return attribute2("class", name);
}
function id(value) {
  return attribute2("id", value);
}
function href(url) {
  return attribute2("href", url);
}
function target(value) {
  return attribute2("target", value);
}
function alt(text) {
  return attribute2("alt", text);
}
function src(url) {
  return attribute2("src", url);
}
function action(url) {
  return attribute2("action", url);
}
function method(http_method) {
  return attribute2("method", http_method);
}
function accept(values3) {
  return attribute2("accept", join(values3, ","));
}
function disabled(is_disabled) {
  return boolean_attribute("disabled", is_disabled);
}
function for$(id2) {
  return attribute2("for", id2);
}
function name(element_name) {
  return attribute2("name", element_name);
}
function placeholder(text) {
  return attribute2("placeholder", text);
}
function type_(control_type) {
  return attribute2("type", control_type);
}
function value(control_value) {
  return attribute2("value", control_value);
}

// build/dev/javascript/lustre/lustre/effect.mjs
class Effect extends CustomType {
  constructor(synchronous, before_paint, after_paint) {
    super();
    this.synchronous = synchronous;
    this.before_paint = before_paint;
    this.after_paint = after_paint;
  }
}

class Actions extends CustomType {
  constructor(dispatch, emit, select, root2, provide) {
    super();
    this.dispatch = dispatch;
    this.emit = emit;
    this.select = select;
    this.root = root2;
    this.provide = provide;
  }
}
function do_comap_select(_, _1, _2) {
  return;
}
function do_comap_actions(actions, f) {
  return new Actions((msg) => {
    return actions.dispatch(f(msg));
  }, actions.emit, (selector) => {
    return do_comap_select(actions, selector, f);
  }, actions.root, actions.provide);
}
function do_map(effects, f) {
  return map(effects, (effect) => {
    return (actions) => {
      return effect(do_comap_actions(actions, f));
    };
  });
}
function map5(effect, f) {
  return new Effect(do_map(effect.synchronous, f), do_map(effect.before_paint, f), do_map(effect.after_paint, f));
}
function perform(effect, dispatch, emit, select, root2, provide) {
  let actions = new Actions(dispatch, emit, select, root2, provide);
  return each(effect.synchronous, (run2) => {
    return run2(actions);
  });
}
var empty = /* @__PURE__ */ new Effect(/* @__PURE__ */ toList([]), /* @__PURE__ */ toList([]), /* @__PURE__ */ toList([]));
function none() {
  return empty;
}
function from(effect) {
  let task = (actions) => {
    let dispatch = actions.dispatch;
    return effect(dispatch);
  };
  return new Effect(toList([task]), empty.before_paint, empty.after_paint);
}
function batch(effects) {
  return fold(effects, empty, (acc, eff) => {
    return new Effect(fold(eff.synchronous, acc.synchronous, prepend2), fold(eff.before_paint, acc.before_paint, prepend2), fold(eff.after_paint, acc.after_paint, prepend2));
  });
}

// build/dev/javascript/lustre/lustre/internals/mutable_map.ffi.mjs
function empty2() {
  return null;
}
function get(map6, key) {
  const value2 = map6?.get(key);
  if (value2 != null) {
    return new Ok(value2);
  } else {
    return new Error2(undefined);
  }
}
function has_key2(map6, key) {
  return map6 && map6.has(key);
}
function insert2(map6, key, value2) {
  map6 ??= new Map;
  map6.set(key, value2);
  return map6;
}
function remove(map6, key) {
  map6?.delete(key);
  return map6;
}

// build/dev/javascript/lustre/lustre/vdom/path.mjs
class Root extends CustomType {
}

class Key extends CustomType {
  constructor(key, parent) {
    super();
    this.key = key;
    this.parent = parent;
  }
}

class Index extends CustomType {
  constructor(index5, parent) {
    super();
    this.index = index5;
    this.parent = parent;
  }
}
function do_matches(loop$path, loop$candidates) {
  while (true) {
    let path = loop$path;
    let candidates = loop$candidates;
    if (candidates instanceof Empty) {
      return false;
    } else {
      let candidate = candidates.head;
      let rest = candidates.tail;
      let $ = starts_with(path, candidate);
      if ($) {
        return $;
      } else {
        loop$path = path;
        loop$candidates = rest;
      }
    }
  }
}
function add2(parent, index5, key) {
  if (key === "") {
    return new Index(index5, parent);
  } else {
    return new Key(key, parent);
  }
}
var root2 = /* @__PURE__ */ new Root;
var separator_element = "\t";
function do_to_string(loop$path, loop$acc) {
  while (true) {
    let path = loop$path;
    let acc = loop$acc;
    if (path instanceof Root) {
      if (acc instanceof Empty) {
        return "";
      } else {
        let segments = acc.tail;
        return concat2(segments);
      }
    } else if (path instanceof Key) {
      let key = path.key;
      let parent = path.parent;
      loop$path = parent;
      loop$acc = prepend(separator_element, prepend(key, acc));
    } else {
      let index5 = path.index;
      let parent = path.parent;
      loop$path = parent;
      loop$acc = prepend(separator_element, prepend(to_string(index5), acc));
    }
  }
}
function to_string4(path) {
  return do_to_string(path, toList([]));
}
function matches(path, candidates) {
  if (candidates instanceof Empty) {
    return false;
  } else {
    return do_matches(to_string4(path), candidates);
  }
}
var separator_event = `
`;
function event2(path, event3) {
  return do_to_string(path, toList([separator_event, event3]));
}

// build/dev/javascript/lustre/lustre/vdom/vnode.mjs
class Fragment extends CustomType {
  constructor(kind, key, mapper, children, keyed_children) {
    super();
    this.kind = kind;
    this.key = key;
    this.mapper = mapper;
    this.children = children;
    this.keyed_children = keyed_children;
  }
}
class Element2 extends CustomType {
  constructor(kind, key, mapper, namespace, tag, attributes, children, keyed_children, self_closing, void$) {
    super();
    this.kind = kind;
    this.key = key;
    this.mapper = mapper;
    this.namespace = namespace;
    this.tag = tag;
    this.attributes = attributes;
    this.children = children;
    this.keyed_children = keyed_children;
    this.self_closing = self_closing;
    this.void = void$;
  }
}
class Text extends CustomType {
  constructor(kind, key, mapper, content) {
    super();
    this.kind = kind;
    this.key = key;
    this.mapper = mapper;
    this.content = content;
  }
}
class UnsafeInnerHtml extends CustomType {
  constructor(kind, key, mapper, namespace, tag, attributes, inner_html) {
    super();
    this.kind = kind;
    this.key = key;
    this.mapper = mapper;
    this.namespace = namespace;
    this.tag = tag;
    this.attributes = attributes;
    this.inner_html = inner_html;
  }
}
function is_void_element(tag, namespace) {
  if (namespace === "") {
    if (tag === "area") {
      return true;
    } else if (tag === "base") {
      return true;
    } else if (tag === "br") {
      return true;
    } else if (tag === "col") {
      return true;
    } else if (tag === "embed") {
      return true;
    } else if (tag === "hr") {
      return true;
    } else if (tag === "img") {
      return true;
    } else if (tag === "input") {
      return true;
    } else if (tag === "link") {
      return true;
    } else if (tag === "meta") {
      return true;
    } else if (tag === "param") {
      return true;
    } else if (tag === "source") {
      return true;
    } else if (tag === "track") {
      return true;
    } else if (tag === "wbr") {
      return true;
    } else {
      return false;
    }
  } else {
    return false;
  }
}
function to_keyed(key, node) {
  if (node instanceof Fragment) {
    return new Fragment(node.kind, key, node.mapper, node.children, node.keyed_children);
  } else if (node instanceof Element2) {
    return new Element2(node.kind, key, node.mapper, node.namespace, node.tag, node.attributes, node.children, node.keyed_children, node.self_closing, node.void);
  } else if (node instanceof Text) {
    return new Text(node.kind, key, node.mapper, node.content);
  } else {
    return new UnsafeInnerHtml(node.kind, key, node.mapper, node.namespace, node.tag, node.attributes, node.inner_html);
  }
}
var fragment_kind = 0;
function fragment(key, mapper, children, keyed_children) {
  return new Fragment(fragment_kind, key, mapper, children, keyed_children);
}
var element_kind = 1;
function element(key, mapper, namespace, tag, attributes, children, keyed_children, self_closing, void$) {
  return new Element2(element_kind, key, mapper, namespace, tag, prepare(attributes), children, keyed_children, self_closing, void$ || is_void_element(tag, namespace));
}
var text_kind = 2;
function text(key, mapper, content) {
  return new Text(text_kind, key, mapper, content);
}
var unsafe_inner_html_kind = 3;

// build/dev/javascript/lustre/lustre/internals/equals.ffi.mjs
var isReferenceEqual = (a, b) => a === b;
var isEqual2 = (a, b) => {
  if (a === b) {
    return true;
  }
  if (a == null || b == null) {
    return false;
  }
  const type = typeof a;
  if (type !== typeof b) {
    return false;
  }
  if (type !== "object") {
    return false;
  }
  const ctor = a.constructor;
  if (ctor !== b.constructor) {
    return false;
  }
  if (Array.isArray(a)) {
    return areArraysEqual(a, b);
  }
  return areObjectsEqual(a, b);
};
var areArraysEqual = (a, b) => {
  let index5 = a.length;
  if (index5 !== b.length) {
    return false;
  }
  while (index5--) {
    if (!isEqual2(a[index5], b[index5])) {
      return false;
    }
  }
  return true;
};
var areObjectsEqual = (a, b) => {
  const properties = Object.keys(a);
  let index5 = properties.length;
  if (Object.keys(b).length !== index5) {
    return false;
  }
  while (index5--) {
    const property3 = properties[index5];
    if (!Object.hasOwn(b, property3)) {
      return false;
    }
    if (!isEqual2(a[property3], b[property3])) {
      return false;
    }
  }
  return true;
};

// build/dev/javascript/lustre/lustre/vdom/events.mjs
class Events extends CustomType {
  constructor(handlers, dispatched_paths, next_dispatched_paths) {
    super();
    this.handlers = handlers;
    this.dispatched_paths = dispatched_paths;
    this.next_dispatched_paths = next_dispatched_paths;
  }
}
function new$3() {
  return new Events(empty2(), empty_list, empty_list);
}
function tick(events) {
  return new Events(events.handlers, events.next_dispatched_paths, empty_list);
}
function do_remove_event(handlers, path, name2) {
  return remove(handlers, event2(path, name2));
}
function remove_event(events, path, name2) {
  let handlers = do_remove_event(events.handlers, path, name2);
  return new Events(handlers, events.dispatched_paths, events.next_dispatched_paths);
}
function remove_attributes(handlers, path, attributes) {
  return fold(attributes, handlers, (events, attribute3) => {
    if (attribute3 instanceof Event2) {
      let name2 = attribute3.name;
      return do_remove_event(events, path, name2);
    } else {
      return events;
    }
  });
}
function handle(events, path, name2, event3) {
  let next_dispatched_paths = prepend(path, events.next_dispatched_paths);
  let events$1 = new Events(events.handlers, events.dispatched_paths, next_dispatched_paths);
  let $ = get(events$1.handlers, path + separator_event + name2);
  if ($ instanceof Ok) {
    let handler = $[0];
    return [events$1, run(event3, handler)];
  } else {
    return [events$1, new Error2(toList([]))];
  }
}
function has_dispatched_events(events, path) {
  return matches(path, events.dispatched_paths);
}
function do_add_event(handlers, mapper, path, name2, handler) {
  return insert2(handlers, event2(path, name2), map2(handler, (handler2) => {
    return new Handler(handler2.prevent_default, handler2.stop_propagation, identity3(mapper)(handler2.message));
  }));
}
function add_event(events, mapper, path, name2, handler) {
  let handlers = do_add_event(events.handlers, mapper, path, name2, handler);
  return new Events(handlers, events.dispatched_paths, events.next_dispatched_paths);
}
function add_attributes(handlers, mapper, path, attributes) {
  return fold(attributes, handlers, (events, attribute3) => {
    if (attribute3 instanceof Event2) {
      let name2 = attribute3.name;
      let handler = attribute3.handler;
      return do_add_event(events, mapper, path, name2, handler);
    } else {
      return events;
    }
  });
}
function compose_mapper(mapper, child_mapper) {
  let $ = isReferenceEqual(mapper, identity3);
  let $1 = isReferenceEqual(child_mapper, identity3);
  if ($1) {
    return mapper;
  } else if ($) {
    return child_mapper;
  } else {
    return (msg) => {
      return mapper(child_mapper(msg));
    };
  }
}
function do_remove_children(loop$handlers, loop$path, loop$child_index, loop$children) {
  while (true) {
    let handlers = loop$handlers;
    let path = loop$path;
    let child_index = loop$child_index;
    let children = loop$children;
    if (children instanceof Empty) {
      return handlers;
    } else {
      let child = children.head;
      let rest = children.tail;
      let _pipe = handlers;
      let _pipe$1 = do_remove_child(_pipe, path, child_index, child);
      loop$handlers = _pipe$1;
      loop$path = path;
      loop$child_index = child_index + 1;
      loop$children = rest;
    }
  }
}
function do_remove_child(handlers, parent, child_index, child) {
  if (child instanceof Fragment) {
    let children = child.children;
    let path = add2(parent, child_index, child.key);
    return do_remove_children(handlers, path, 0, children);
  } else if (child instanceof Element2) {
    let attributes = child.attributes;
    let children = child.children;
    let path = add2(parent, child_index, child.key);
    let _pipe = handlers;
    let _pipe$1 = remove_attributes(_pipe, path, attributes);
    return do_remove_children(_pipe$1, path, 0, children);
  } else if (child instanceof Text) {
    return handlers;
  } else {
    let attributes = child.attributes;
    let path = add2(parent, child_index, child.key);
    return remove_attributes(handlers, path, attributes);
  }
}
function remove_child(events, parent, child_index, child) {
  let handlers = do_remove_child(events.handlers, parent, child_index, child);
  return new Events(handlers, events.dispatched_paths, events.next_dispatched_paths);
}
function do_add_children(loop$handlers, loop$mapper, loop$path, loop$child_index, loop$children) {
  while (true) {
    let handlers = loop$handlers;
    let mapper = loop$mapper;
    let path = loop$path;
    let child_index = loop$child_index;
    let children = loop$children;
    if (children instanceof Empty) {
      return handlers;
    } else {
      let child = children.head;
      let rest = children.tail;
      let _pipe = handlers;
      let _pipe$1 = do_add_child(_pipe, mapper, path, child_index, child);
      loop$handlers = _pipe$1;
      loop$mapper = mapper;
      loop$path = path;
      loop$child_index = child_index + 1;
      loop$children = rest;
    }
  }
}
function do_add_child(handlers, mapper, parent, child_index, child) {
  if (child instanceof Fragment) {
    let children = child.children;
    let path = add2(parent, child_index, child.key);
    let composed_mapper = compose_mapper(mapper, child.mapper);
    return do_add_children(handlers, composed_mapper, path, 0, children);
  } else if (child instanceof Element2) {
    let attributes = child.attributes;
    let children = child.children;
    let path = add2(parent, child_index, child.key);
    let composed_mapper = compose_mapper(mapper, child.mapper);
    let _pipe = handlers;
    let _pipe$1 = add_attributes(_pipe, composed_mapper, path, attributes);
    return do_add_children(_pipe$1, composed_mapper, path, 0, children);
  } else if (child instanceof Text) {
    return handlers;
  } else {
    let attributes = child.attributes;
    let path = add2(parent, child_index, child.key);
    let composed_mapper = compose_mapper(mapper, child.mapper);
    return add_attributes(handlers, composed_mapper, path, attributes);
  }
}
function add_child(events, mapper, parent, index5, child) {
  let handlers = do_add_child(events.handlers, mapper, parent, index5, child);
  return new Events(handlers, events.dispatched_paths, events.next_dispatched_paths);
}
function from_node(root3) {
  return add_child(new$3(), identity3, root2, 0, root3);
}
function add_children(events, mapper, path, child_index, children) {
  let handlers = do_add_children(events.handlers, mapper, path, child_index, children);
  return new Events(handlers, events.dispatched_paths, events.next_dispatched_paths);
}

// build/dev/javascript/lustre/lustre/element.mjs
function element2(tag, attributes, children) {
  return element("", identity3, "", tag, attributes, children, empty2(), false, false);
}
function text2(content) {
  return text("", identity3, content);
}
function none2() {
  return text("", identity3, "");
}
function map6(element3, f) {
  let mapper = identity3(compose_mapper(identity3(f), element3.mapper));
  if (element3 instanceof Fragment) {
    let children = element3.children;
    let keyed_children = element3.keyed_children;
    return new Fragment(element3.kind, element3.key, mapper, identity3(children), identity3(keyed_children));
  } else if (element3 instanceof Element2) {
    let attributes = element3.attributes;
    let children = element3.children;
    let keyed_children = element3.keyed_children;
    return new Element2(element3.kind, element3.key, mapper, element3.namespace, element3.tag, identity3(attributes), identity3(children), identity3(keyed_children), element3.self_closing, element3.void);
  } else if (element3 instanceof Text) {
    return identity3(element3);
  } else {
    let attributes = element3.attributes;
    return new UnsafeInnerHtml(element3.kind, element3.key, mapper, element3.namespace, element3.tag, identity3(attributes), element3.inner_html);
  }
}

// build/dev/javascript/lustre/lustre/element/html.mjs
function text3(content) {
  return text2(content);
}
function h1(attrs, children) {
  return element2("h1", attrs, children);
}
function h2(attrs, children) {
  return element2("h2", attrs, children);
}
function h3(attrs, children) {
  return element2("h3", attrs, children);
}
function div(attrs, children) {
  return element2("div", attrs, children);
}
function p(attrs, children) {
  return element2("p", attrs, children);
}
function a(attrs, children) {
  return element2("a", attrs, children);
}
function span(attrs, children) {
  return element2("span", attrs, children);
}
function img(attrs) {
  return element2("img", attrs, empty_list);
}
function button(attrs, children) {
  return element2("button", attrs, children);
}
function form(attrs, children) {
  return element2("form", attrs, children);
}
function input(attrs) {
  return element2("input", attrs, empty_list);
}
function label(attrs, children) {
  return element2("label", attrs, children);
}
function textarea(attrs, content) {
  return element2("textarea", prepend(property2("value", string3(content)), attrs), toList([text2(content)]));
}

// build/dev/javascript/lustre/lustre/vdom/patch.mjs
class Patch extends CustomType {
  constructor(index5, removed, changes, children) {
    super();
    this.index = index5;
    this.removed = removed;
    this.changes = changes;
    this.children = children;
  }
}
class ReplaceText extends CustomType {
  constructor(kind, content) {
    super();
    this.kind = kind;
    this.content = content;
  }
}
class ReplaceInnerHtml extends CustomType {
  constructor(kind, inner_html) {
    super();
    this.kind = kind;
    this.inner_html = inner_html;
  }
}
class Update extends CustomType {
  constructor(kind, added, removed) {
    super();
    this.kind = kind;
    this.added = added;
    this.removed = removed;
  }
}
class Move extends CustomType {
  constructor(kind, key, before) {
    super();
    this.kind = kind;
    this.key = key;
    this.before = before;
  }
}
class Replace extends CustomType {
  constructor(kind, index5, with$) {
    super();
    this.kind = kind;
    this.index = index5;
    this.with = with$;
  }
}
class Remove extends CustomType {
  constructor(kind, index5) {
    super();
    this.kind = kind;
    this.index = index5;
  }
}
class Insert extends CustomType {
  constructor(kind, children, before) {
    super();
    this.kind = kind;
    this.children = children;
    this.before = before;
  }
}
function new$5(index5, removed, changes, children) {
  return new Patch(index5, removed, changes, children);
}
var replace_text_kind = 0;
function replace_text(content) {
  return new ReplaceText(replace_text_kind, content);
}
var replace_inner_html_kind = 1;
function replace_inner_html(inner_html) {
  return new ReplaceInnerHtml(replace_inner_html_kind, inner_html);
}
var update_kind = 2;
function update(added, removed) {
  return new Update(update_kind, added, removed);
}
var move_kind = 3;
function move(key, before) {
  return new Move(move_kind, key, before);
}
var remove_kind = 4;
function remove2(index5) {
  return new Remove(remove_kind, index5);
}
var replace_kind = 5;
function replace2(index5, with$) {
  return new Replace(replace_kind, index5, with$);
}
var insert_kind = 6;
function insert3(children, before) {
  return new Insert(insert_kind, children, before);
}

// build/dev/javascript/lustre/lustre/runtime/transport.mjs
class Mount extends CustomType {
  constructor(kind, open_shadow_root, will_adopt_styles, observed_attributes, observed_properties, requested_contexts, provided_contexts, vdom) {
    super();
    this.kind = kind;
    this.open_shadow_root = open_shadow_root;
    this.will_adopt_styles = will_adopt_styles;
    this.observed_attributes = observed_attributes;
    this.observed_properties = observed_properties;
    this.requested_contexts = requested_contexts;
    this.provided_contexts = provided_contexts;
    this.vdom = vdom;
  }
}
class Reconcile extends CustomType {
  constructor(kind, patch) {
    super();
    this.kind = kind;
    this.patch = patch;
  }
}
class Emit extends CustomType {
  constructor(kind, name2, data) {
    super();
    this.kind = kind;
    this.name = name2;
    this.data = data;
  }
}
class Provide extends CustomType {
  constructor(kind, key, value2) {
    super();
    this.kind = kind;
    this.key = key;
    this.value = value2;
  }
}
class Batch extends CustomType {
  constructor(kind, messages) {
    super();
    this.kind = kind;
    this.messages = messages;
  }
}
class AttributeChanged extends CustomType {
  constructor(kind, name2, value2) {
    super();
    this.kind = kind;
    this.name = name2;
    this.value = value2;
  }
}
class PropertyChanged extends CustomType {
  constructor(kind, name2, value2) {
    super();
    this.kind = kind;
    this.name = name2;
    this.value = value2;
  }
}
class EventFired extends CustomType {
  constructor(kind, path, name2, event3) {
    super();
    this.kind = kind;
    this.path = path;
    this.name = name2;
    this.event = event3;
  }
}
class ContextProvided extends CustomType {
  constructor(kind, key, value2) {
    super();
    this.kind = kind;
    this.key = key;
    this.value = value2;
  }
}
var mount_kind = 0;
function mount(open_shadow_root, will_adopt_styles, observed_attributes, observed_properties, requested_contexts, provided_contexts, vdom) {
  return new Mount(mount_kind, open_shadow_root, will_adopt_styles, observed_attributes, observed_properties, requested_contexts, provided_contexts, vdom);
}
var reconcile_kind = 1;
function reconcile(patch) {
  return new Reconcile(reconcile_kind, patch);
}
var emit_kind = 2;
function emit(name2, data) {
  return new Emit(emit_kind, name2, data);
}
var provide_kind = 3;
function provide(key, value2) {
  return new Provide(provide_kind, key, value2);
}

// build/dev/javascript/lustre/lustre/vdom/diff.mjs
class Diff extends CustomType {
  constructor(patch, events) {
    super();
    this.patch = patch;
    this.events = events;
  }
}
class AttributeChange extends CustomType {
  constructor(added, removed, events) {
    super();
    this.added = added;
    this.removed = removed;
    this.events = events;
  }
}
function is_controlled(events, namespace, tag, path) {
  if (tag === "input" && namespace === "") {
    return has_dispatched_events(events, path);
  } else if (tag === "select" && namespace === "") {
    return has_dispatched_events(events, path);
  } else if (tag === "textarea" && namespace === "") {
    return has_dispatched_events(events, path);
  } else {
    return false;
  }
}
function diff_attributes(loop$controlled, loop$path, loop$mapper, loop$events, loop$old, loop$new, loop$added, loop$removed) {
  while (true) {
    let controlled = loop$controlled;
    let path = loop$path;
    let mapper = loop$mapper;
    let events = loop$events;
    let old = loop$old;
    let new$6 = loop$new;
    let added = loop$added;
    let removed = loop$removed;
    if (old instanceof Empty) {
      if (new$6 instanceof Empty) {
        return new AttributeChange(added, removed, events);
      } else {
        let $ = new$6.head;
        if ($ instanceof Event2) {
          let next = $;
          let new$1 = new$6.tail;
          let name2 = $.name;
          let handler = $.handler;
          let added$1 = prepend(next, added);
          let events$1 = add_event(events, mapper, path, name2, handler);
          loop$controlled = controlled;
          loop$path = path;
          loop$mapper = mapper;
          loop$events = events$1;
          loop$old = old;
          loop$new = new$1;
          loop$added = added$1;
          loop$removed = removed;
        } else {
          let next = $;
          let new$1 = new$6.tail;
          let added$1 = prepend(next, added);
          loop$controlled = controlled;
          loop$path = path;
          loop$mapper = mapper;
          loop$events = events;
          loop$old = old;
          loop$new = new$1;
          loop$added = added$1;
          loop$removed = removed;
        }
      }
    } else if (new$6 instanceof Empty) {
      let $ = old.head;
      if ($ instanceof Event2) {
        let prev = $;
        let old$1 = old.tail;
        let name2 = $.name;
        let removed$1 = prepend(prev, removed);
        let events$1 = remove_event(events, path, name2);
        loop$controlled = controlled;
        loop$path = path;
        loop$mapper = mapper;
        loop$events = events$1;
        loop$old = old$1;
        loop$new = new$6;
        loop$added = added;
        loop$removed = removed$1;
      } else {
        let prev = $;
        let old$1 = old.tail;
        let removed$1 = prepend(prev, removed);
        loop$controlled = controlled;
        loop$path = path;
        loop$mapper = mapper;
        loop$events = events;
        loop$old = old$1;
        loop$new = new$6;
        loop$added = added;
        loop$removed = removed$1;
      }
    } else {
      let prev = old.head;
      let remaining_old = old.tail;
      let next = new$6.head;
      let remaining_new = new$6.tail;
      let $ = compare3(prev, next);
      if ($ instanceof Lt) {
        if (prev instanceof Event2) {
          let name2 = prev.name;
          let removed$1 = prepend(prev, removed);
          let events$1 = remove_event(events, path, name2);
          loop$controlled = controlled;
          loop$path = path;
          loop$mapper = mapper;
          loop$events = events$1;
          loop$old = remaining_old;
          loop$new = new$6;
          loop$added = added;
          loop$removed = removed$1;
        } else {
          let removed$1 = prepend(prev, removed);
          loop$controlled = controlled;
          loop$path = path;
          loop$mapper = mapper;
          loop$events = events;
          loop$old = remaining_old;
          loop$new = new$6;
          loop$added = added;
          loop$removed = removed$1;
        }
      } else if ($ instanceof Eq) {
        if (prev instanceof Attribute) {
          if (next instanceof Attribute) {
            let _block;
            let $1 = next.name;
            if ($1 === "value") {
              _block = controlled || prev.value !== next.value;
            } else if ($1 === "checked") {
              _block = controlled || prev.value !== next.value;
            } else if ($1 === "selected") {
              _block = controlled || prev.value !== next.value;
            } else {
              _block = prev.value !== next.value;
            }
            let has_changes = _block;
            let _block$1;
            if (has_changes) {
              _block$1 = prepend(next, added);
            } else {
              _block$1 = added;
            }
            let added$1 = _block$1;
            loop$controlled = controlled;
            loop$path = path;
            loop$mapper = mapper;
            loop$events = events;
            loop$old = remaining_old;
            loop$new = remaining_new;
            loop$added = added$1;
            loop$removed = removed;
          } else if (next instanceof Event2) {
            let name2 = next.name;
            let handler = next.handler;
            let added$1 = prepend(next, added);
            let removed$1 = prepend(prev, removed);
            let events$1 = add_event(events, mapper, path, name2, handler);
            loop$controlled = controlled;
            loop$path = path;
            loop$mapper = mapper;
            loop$events = events$1;
            loop$old = remaining_old;
            loop$new = remaining_new;
            loop$added = added$1;
            loop$removed = removed$1;
          } else {
            let added$1 = prepend(next, added);
            let removed$1 = prepend(prev, removed);
            loop$controlled = controlled;
            loop$path = path;
            loop$mapper = mapper;
            loop$events = events;
            loop$old = remaining_old;
            loop$new = remaining_new;
            loop$added = added$1;
            loop$removed = removed$1;
          }
        } else if (prev instanceof Property) {
          if (next instanceof Property) {
            let _block;
            let $1 = next.name;
            if ($1 === "scrollLeft") {
              _block = true;
            } else if ($1 === "scrollRight") {
              _block = true;
            } else if ($1 === "value") {
              _block = controlled || !isEqual2(prev.value, next.value);
            } else if ($1 === "checked") {
              _block = controlled || !isEqual2(prev.value, next.value);
            } else if ($1 === "selected") {
              _block = controlled || !isEqual2(prev.value, next.value);
            } else {
              _block = !isEqual2(prev.value, next.value);
            }
            let has_changes = _block;
            let _block$1;
            if (has_changes) {
              _block$1 = prepend(next, added);
            } else {
              _block$1 = added;
            }
            let added$1 = _block$1;
            loop$controlled = controlled;
            loop$path = path;
            loop$mapper = mapper;
            loop$events = events;
            loop$old = remaining_old;
            loop$new = remaining_new;
            loop$added = added$1;
            loop$removed = removed;
          } else if (next instanceof Event2) {
            let name2 = next.name;
            let handler = next.handler;
            let added$1 = prepend(next, added);
            let removed$1 = prepend(prev, removed);
            let events$1 = add_event(events, mapper, path, name2, handler);
            loop$controlled = controlled;
            loop$path = path;
            loop$mapper = mapper;
            loop$events = events$1;
            loop$old = remaining_old;
            loop$new = remaining_new;
            loop$added = added$1;
            loop$removed = removed$1;
          } else {
            let added$1 = prepend(next, added);
            let removed$1 = prepend(prev, removed);
            loop$controlled = controlled;
            loop$path = path;
            loop$mapper = mapper;
            loop$events = events;
            loop$old = remaining_old;
            loop$new = remaining_new;
            loop$added = added$1;
            loop$removed = removed$1;
          }
        } else if (next instanceof Event2) {
          let name2 = next.name;
          let handler = next.handler;
          let has_changes = prev.prevent_default.kind !== next.prevent_default.kind || prev.stop_propagation.kind !== next.stop_propagation.kind || prev.immediate !== next.immediate || prev.debounce !== next.debounce || prev.throttle !== next.throttle;
          let _block;
          if (has_changes) {
            _block = prepend(next, added);
          } else {
            _block = added;
          }
          let added$1 = _block;
          let events$1 = add_event(events, mapper, path, name2, handler);
          loop$controlled = controlled;
          loop$path = path;
          loop$mapper = mapper;
          loop$events = events$1;
          loop$old = remaining_old;
          loop$new = remaining_new;
          loop$added = added$1;
          loop$removed = removed;
        } else {
          let name2 = prev.name;
          let added$1 = prepend(next, added);
          let removed$1 = prepend(prev, removed);
          let events$1 = remove_event(events, path, name2);
          loop$controlled = controlled;
          loop$path = path;
          loop$mapper = mapper;
          loop$events = events$1;
          loop$old = remaining_old;
          loop$new = remaining_new;
          loop$added = added$1;
          loop$removed = removed$1;
        }
      } else if (next instanceof Event2) {
        let name2 = next.name;
        let handler = next.handler;
        let added$1 = prepend(next, added);
        let events$1 = add_event(events, mapper, path, name2, handler);
        loop$controlled = controlled;
        loop$path = path;
        loop$mapper = mapper;
        loop$events = events$1;
        loop$old = old;
        loop$new = remaining_new;
        loop$added = added$1;
        loop$removed = removed;
      } else {
        let added$1 = prepend(next, added);
        loop$controlled = controlled;
        loop$path = path;
        loop$mapper = mapper;
        loop$events = events;
        loop$old = old;
        loop$new = remaining_new;
        loop$added = added$1;
        loop$removed = removed;
      }
    }
  }
}
function do_diff(loop$old, loop$old_keyed, loop$new, loop$new_keyed, loop$moved, loop$moved_offset, loop$removed, loop$node_index, loop$patch_index, loop$path, loop$changes, loop$children, loop$mapper, loop$events) {
  while (true) {
    let old = loop$old;
    let old_keyed = loop$old_keyed;
    let new$6 = loop$new;
    let new_keyed = loop$new_keyed;
    let moved = loop$moved;
    let moved_offset = loop$moved_offset;
    let removed = loop$removed;
    let node_index = loop$node_index;
    let patch_index = loop$patch_index;
    let path = loop$path;
    let changes = loop$changes;
    let children = loop$children;
    let mapper = loop$mapper;
    let events = loop$events;
    if (old instanceof Empty) {
      if (new$6 instanceof Empty) {
        return new Diff(new Patch(patch_index, removed, changes, children), events);
      } else {
        let events$1 = add_children(events, mapper, path, node_index, new$6);
        let insert4 = insert3(new$6, node_index - moved_offset);
        let changes$1 = prepend(insert4, changes);
        return new Diff(new Patch(patch_index, removed, changes$1, children), events$1);
      }
    } else if (new$6 instanceof Empty) {
      let prev = old.head;
      let old$1 = old.tail;
      let _block;
      let $ = prev.key === "" || !has_key2(moved, prev.key);
      if ($) {
        _block = removed + 1;
      } else {
        _block = removed;
      }
      let removed$1 = _block;
      let events$1 = remove_child(events, path, node_index, prev);
      loop$old = old$1;
      loop$old_keyed = old_keyed;
      loop$new = new$6;
      loop$new_keyed = new_keyed;
      loop$moved = moved;
      loop$moved_offset = moved_offset;
      loop$removed = removed$1;
      loop$node_index = node_index;
      loop$patch_index = patch_index;
      loop$path = path;
      loop$changes = changes;
      loop$children = children;
      loop$mapper = mapper;
      loop$events = events$1;
    } else {
      let prev = old.head;
      let next = new$6.head;
      if (prev.key !== next.key) {
        let old_remaining = old.tail;
        let new_remaining = new$6.tail;
        let next_did_exist = get(old_keyed, next.key);
        let prev_does_exist = has_key2(new_keyed, prev.key);
        if (prev_does_exist) {
          if (next_did_exist instanceof Ok) {
            let match = next_did_exist[0];
            let $ = has_key2(moved, prev.key);
            if ($) {
              loop$old = old_remaining;
              loop$old_keyed = old_keyed;
              loop$new = new$6;
              loop$new_keyed = new_keyed;
              loop$moved = moved;
              loop$moved_offset = moved_offset - 1;
              loop$removed = removed;
              loop$node_index = node_index;
              loop$patch_index = patch_index;
              loop$path = path;
              loop$changes = changes;
              loop$children = children;
              loop$mapper = mapper;
              loop$events = events;
            } else {
              let before = node_index - moved_offset;
              let changes$1 = prepend(move(next.key, before), changes);
              let moved$1 = insert2(moved, next.key, undefined);
              let moved_offset$1 = moved_offset + 1;
              loop$old = prepend(match, old);
              loop$old_keyed = old_keyed;
              loop$new = new$6;
              loop$new_keyed = new_keyed;
              loop$moved = moved$1;
              loop$moved_offset = moved_offset$1;
              loop$removed = removed;
              loop$node_index = node_index;
              loop$patch_index = patch_index;
              loop$path = path;
              loop$changes = changes$1;
              loop$children = children;
              loop$mapper = mapper;
              loop$events = events;
            }
          } else {
            let before = node_index - moved_offset;
            let events$1 = add_child(events, mapper, path, node_index, next);
            let insert4 = insert3(toList([next]), before);
            let changes$1 = prepend(insert4, changes);
            loop$old = old;
            loop$old_keyed = old_keyed;
            loop$new = new_remaining;
            loop$new_keyed = new_keyed;
            loop$moved = moved;
            loop$moved_offset = moved_offset + 1;
            loop$removed = removed;
            loop$node_index = node_index + 1;
            loop$patch_index = patch_index;
            loop$path = path;
            loop$changes = changes$1;
            loop$children = children;
            loop$mapper = mapper;
            loop$events = events$1;
          }
        } else if (next_did_exist instanceof Ok) {
          let index5 = node_index - moved_offset;
          let changes$1 = prepend(remove2(index5), changes);
          let events$1 = remove_child(events, path, node_index, prev);
          let moved_offset$1 = moved_offset - 1;
          loop$old = old_remaining;
          loop$old_keyed = old_keyed;
          loop$new = new$6;
          loop$new_keyed = new_keyed;
          loop$moved = moved;
          loop$moved_offset = moved_offset$1;
          loop$removed = removed;
          loop$node_index = node_index;
          loop$patch_index = patch_index;
          loop$path = path;
          loop$changes = changes$1;
          loop$children = children;
          loop$mapper = mapper;
          loop$events = events$1;
        } else {
          let change = replace2(node_index - moved_offset, next);
          let _block;
          let _pipe = events;
          let _pipe$1 = remove_child(_pipe, path, node_index, prev);
          _block = add_child(_pipe$1, mapper, path, node_index, next);
          let events$1 = _block;
          loop$old = old_remaining;
          loop$old_keyed = old_keyed;
          loop$new = new_remaining;
          loop$new_keyed = new_keyed;
          loop$moved = moved;
          loop$moved_offset = moved_offset;
          loop$removed = removed;
          loop$node_index = node_index + 1;
          loop$patch_index = patch_index;
          loop$path = path;
          loop$changes = prepend(change, changes);
          loop$children = children;
          loop$mapper = mapper;
          loop$events = events$1;
        }
      } else {
        let $ = old.head;
        if ($ instanceof Fragment) {
          let $1 = new$6.head;
          if ($1 instanceof Fragment) {
            let prev$1 = $;
            let old$1 = old.tail;
            let next$1 = $1;
            let new$1 = new$6.tail;
            let composed_mapper = compose_mapper(mapper, next$1.mapper);
            let child_path = add2(path, node_index, next$1.key);
            let child = do_diff(prev$1.children, prev$1.keyed_children, next$1.children, next$1.keyed_children, empty2(), 0, 0, 0, node_index, child_path, empty_list, empty_list, composed_mapper, events);
            let _block;
            let $2 = child.patch;
            let $3 = $2.changes;
            if ($3 instanceof Empty) {
              let $4 = $2.children;
              if ($4 instanceof Empty) {
                let $5 = $2.removed;
                if ($5 === 0) {
                  _block = children;
                } else {
                  _block = prepend(child.patch, children);
                }
              } else {
                _block = prepend(child.patch, children);
              }
            } else {
              _block = prepend(child.patch, children);
            }
            let children$1 = _block;
            loop$old = old$1;
            loop$old_keyed = old_keyed;
            loop$new = new$1;
            loop$new_keyed = new_keyed;
            loop$moved = moved;
            loop$moved_offset = moved_offset;
            loop$removed = removed;
            loop$node_index = node_index + 1;
            loop$patch_index = patch_index;
            loop$path = path;
            loop$changes = changes;
            loop$children = children$1;
            loop$mapper = mapper;
            loop$events = child.events;
          } else {
            let prev$1 = $;
            let old_remaining = old.tail;
            let next$1 = $1;
            let new_remaining = new$6.tail;
            let change = replace2(node_index - moved_offset, next$1);
            let _block;
            let _pipe = events;
            let _pipe$1 = remove_child(_pipe, path, node_index, prev$1);
            _block = add_child(_pipe$1, mapper, path, node_index, next$1);
            let events$1 = _block;
            loop$old = old_remaining;
            loop$old_keyed = old_keyed;
            loop$new = new_remaining;
            loop$new_keyed = new_keyed;
            loop$moved = moved;
            loop$moved_offset = moved_offset;
            loop$removed = removed;
            loop$node_index = node_index + 1;
            loop$patch_index = patch_index;
            loop$path = path;
            loop$changes = prepend(change, changes);
            loop$children = children;
            loop$mapper = mapper;
            loop$events = events$1;
          }
        } else if ($ instanceof Element2) {
          let $1 = new$6.head;
          if ($1 instanceof Element2) {
            let prev$1 = $;
            let next$1 = $1;
            if (prev$1.namespace === next$1.namespace && prev$1.tag === next$1.tag) {
              let old$1 = old.tail;
              let new$1 = new$6.tail;
              let composed_mapper = compose_mapper(mapper, next$1.mapper);
              let child_path = add2(path, node_index, next$1.key);
              let controlled = is_controlled(events, next$1.namespace, next$1.tag, child_path);
              let $2 = diff_attributes(controlled, child_path, composed_mapper, events, prev$1.attributes, next$1.attributes, empty_list, empty_list);
              let added_attrs;
              let removed_attrs;
              let events$1;
              added_attrs = $2.added;
              removed_attrs = $2.removed;
              events$1 = $2.events;
              let _block;
              if (added_attrs instanceof Empty && removed_attrs instanceof Empty) {
                _block = empty_list;
              } else {
                _block = toList([update(added_attrs, removed_attrs)]);
              }
              let initial_child_changes = _block;
              let child = do_diff(prev$1.children, prev$1.keyed_children, next$1.children, next$1.keyed_children, empty2(), 0, 0, 0, node_index, child_path, initial_child_changes, empty_list, composed_mapper, events$1);
              let _block$1;
              let $3 = child.patch;
              let $4 = $3.changes;
              if ($4 instanceof Empty) {
                let $5 = $3.children;
                if ($5 instanceof Empty) {
                  let $6 = $3.removed;
                  if ($6 === 0) {
                    _block$1 = children;
                  } else {
                    _block$1 = prepend(child.patch, children);
                  }
                } else {
                  _block$1 = prepend(child.patch, children);
                }
              } else {
                _block$1 = prepend(child.patch, children);
              }
              let children$1 = _block$1;
              loop$old = old$1;
              loop$old_keyed = old_keyed;
              loop$new = new$1;
              loop$new_keyed = new_keyed;
              loop$moved = moved;
              loop$moved_offset = moved_offset;
              loop$removed = removed;
              loop$node_index = node_index + 1;
              loop$patch_index = patch_index;
              loop$path = path;
              loop$changes = changes;
              loop$children = children$1;
              loop$mapper = mapper;
              loop$events = child.events;
            } else {
              let prev$2 = $;
              let old_remaining = old.tail;
              let next$2 = $1;
              let new_remaining = new$6.tail;
              let change = replace2(node_index - moved_offset, next$2);
              let _block;
              let _pipe = events;
              let _pipe$1 = remove_child(_pipe, path, node_index, prev$2);
              _block = add_child(_pipe$1, mapper, path, node_index, next$2);
              let events$1 = _block;
              loop$old = old_remaining;
              loop$old_keyed = old_keyed;
              loop$new = new_remaining;
              loop$new_keyed = new_keyed;
              loop$moved = moved;
              loop$moved_offset = moved_offset;
              loop$removed = removed;
              loop$node_index = node_index + 1;
              loop$patch_index = patch_index;
              loop$path = path;
              loop$changes = prepend(change, changes);
              loop$children = children;
              loop$mapper = mapper;
              loop$events = events$1;
            }
          } else {
            let prev$1 = $;
            let old_remaining = old.tail;
            let next$1 = $1;
            let new_remaining = new$6.tail;
            let change = replace2(node_index - moved_offset, next$1);
            let _block;
            let _pipe = events;
            let _pipe$1 = remove_child(_pipe, path, node_index, prev$1);
            _block = add_child(_pipe$1, mapper, path, node_index, next$1);
            let events$1 = _block;
            loop$old = old_remaining;
            loop$old_keyed = old_keyed;
            loop$new = new_remaining;
            loop$new_keyed = new_keyed;
            loop$moved = moved;
            loop$moved_offset = moved_offset;
            loop$removed = removed;
            loop$node_index = node_index + 1;
            loop$patch_index = patch_index;
            loop$path = path;
            loop$changes = prepend(change, changes);
            loop$children = children;
            loop$mapper = mapper;
            loop$events = events$1;
          }
        } else if ($ instanceof Text) {
          let $1 = new$6.head;
          if ($1 instanceof Text) {
            let prev$1 = $;
            let next$1 = $1;
            if (prev$1.content === next$1.content) {
              let old$1 = old.tail;
              let new$1 = new$6.tail;
              loop$old = old$1;
              loop$old_keyed = old_keyed;
              loop$new = new$1;
              loop$new_keyed = new_keyed;
              loop$moved = moved;
              loop$moved_offset = moved_offset;
              loop$removed = removed;
              loop$node_index = node_index + 1;
              loop$patch_index = patch_index;
              loop$path = path;
              loop$changes = changes;
              loop$children = children;
              loop$mapper = mapper;
              loop$events = events;
            } else {
              let old$1 = old.tail;
              let next$2 = $1;
              let new$1 = new$6.tail;
              let child = new$5(node_index, 0, toList([replace_text(next$2.content)]), empty_list);
              loop$old = old$1;
              loop$old_keyed = old_keyed;
              loop$new = new$1;
              loop$new_keyed = new_keyed;
              loop$moved = moved;
              loop$moved_offset = moved_offset;
              loop$removed = removed;
              loop$node_index = node_index + 1;
              loop$patch_index = patch_index;
              loop$path = path;
              loop$changes = changes;
              loop$children = prepend(child, children);
              loop$mapper = mapper;
              loop$events = events;
            }
          } else {
            let prev$1 = $;
            let old_remaining = old.tail;
            let next$1 = $1;
            let new_remaining = new$6.tail;
            let change = replace2(node_index - moved_offset, next$1);
            let _block;
            let _pipe = events;
            let _pipe$1 = remove_child(_pipe, path, node_index, prev$1);
            _block = add_child(_pipe$1, mapper, path, node_index, next$1);
            let events$1 = _block;
            loop$old = old_remaining;
            loop$old_keyed = old_keyed;
            loop$new = new_remaining;
            loop$new_keyed = new_keyed;
            loop$moved = moved;
            loop$moved_offset = moved_offset;
            loop$removed = removed;
            loop$node_index = node_index + 1;
            loop$patch_index = patch_index;
            loop$path = path;
            loop$changes = prepend(change, changes);
            loop$children = children;
            loop$mapper = mapper;
            loop$events = events$1;
          }
        } else {
          let $1 = new$6.head;
          if ($1 instanceof UnsafeInnerHtml) {
            let prev$1 = $;
            let old$1 = old.tail;
            let next$1 = $1;
            let new$1 = new$6.tail;
            let composed_mapper = compose_mapper(mapper, next$1.mapper);
            let child_path = add2(path, node_index, next$1.key);
            let $2 = diff_attributes(false, child_path, composed_mapper, events, prev$1.attributes, next$1.attributes, empty_list, empty_list);
            let added_attrs;
            let removed_attrs;
            let events$1;
            added_attrs = $2.added;
            removed_attrs = $2.removed;
            events$1 = $2.events;
            let _block;
            if (added_attrs instanceof Empty && removed_attrs instanceof Empty) {
              _block = empty_list;
            } else {
              _block = toList([update(added_attrs, removed_attrs)]);
            }
            let child_changes = _block;
            let _block$1;
            let $3 = prev$1.inner_html === next$1.inner_html;
            if ($3) {
              _block$1 = child_changes;
            } else {
              _block$1 = prepend(replace_inner_html(next$1.inner_html), child_changes);
            }
            let child_changes$1 = _block$1;
            let _block$2;
            if (child_changes$1 instanceof Empty) {
              _block$2 = children;
            } else {
              _block$2 = prepend(new$5(node_index, 0, child_changes$1, toList([])), children);
            }
            let children$1 = _block$2;
            loop$old = old$1;
            loop$old_keyed = old_keyed;
            loop$new = new$1;
            loop$new_keyed = new_keyed;
            loop$moved = moved;
            loop$moved_offset = moved_offset;
            loop$removed = removed;
            loop$node_index = node_index + 1;
            loop$patch_index = patch_index;
            loop$path = path;
            loop$changes = changes;
            loop$children = children$1;
            loop$mapper = mapper;
            loop$events = events$1;
          } else {
            let prev$1 = $;
            let old_remaining = old.tail;
            let next$1 = $1;
            let new_remaining = new$6.tail;
            let change = replace2(node_index - moved_offset, next$1);
            let _block;
            let _pipe = events;
            let _pipe$1 = remove_child(_pipe, path, node_index, prev$1);
            _block = add_child(_pipe$1, mapper, path, node_index, next$1);
            let events$1 = _block;
            loop$old = old_remaining;
            loop$old_keyed = old_keyed;
            loop$new = new_remaining;
            loop$new_keyed = new_keyed;
            loop$moved = moved;
            loop$moved_offset = moved_offset;
            loop$removed = removed;
            loop$node_index = node_index + 1;
            loop$patch_index = patch_index;
            loop$path = path;
            loop$changes = prepend(change, changes);
            loop$children = children;
            loop$mapper = mapper;
            loop$events = events$1;
          }
        }
      }
    }
  }
}
function diff(events, old, new$6) {
  return do_diff(toList([old]), empty2(), toList([new$6]), empty2(), empty2(), 0, 0, 0, 0, root2, empty_list, empty_list, identity3, tick(events));
}

// build/dev/javascript/lustre/lustre/vdom/reconciler.ffi.mjs
var setTimeout2 = globalThis.setTimeout;
var clearTimeout = globalThis.clearTimeout;
var createElementNS = (ns, name2) => document2().createElementNS(ns, name2);
var createTextNode = (data) => document2().createTextNode(data);
var createDocumentFragment = () => document2().createDocumentFragment();
var insertBefore = (parent, node, reference) => parent.insertBefore(node, reference);
var moveBefore = SUPPORTS_MOVE_BEFORE ? (parent, node, reference) => parent.moveBefore(node, reference) : insertBefore;
var removeChild = (parent, child) => parent.removeChild(child);
var getAttribute = (node, name2) => node.getAttribute(name2);
var setAttribute = (node, name2, value2) => node.setAttribute(name2, value2);
var removeAttribute = (node, name2) => node.removeAttribute(name2);
var addEventListener = (node, name2, handler, options) => node.addEventListener(name2, handler, options);
var removeEventListener = (node, name2, handler) => node.removeEventListener(name2, handler);
var setInnerHtml = (node, innerHtml) => node.innerHTML = innerHtml;
var setData = (node, data) => node.data = data;
var meta = Symbol("lustre");

class MetadataNode {
  constructor(kind, parent, node, key) {
    this.kind = kind;
    this.key = key;
    this.parent = parent;
    this.children = [];
    this.node = node;
    this.handlers = new Map;
    this.throttles = new Map;
    this.debouncers = new Map;
  }
  get parentNode() {
    return this.kind === fragment_kind ? this.node.parentNode : this.node;
  }
}
var insertMetadataChild = (kind, parent, node, index5, key) => {
  const child = new MetadataNode(kind, parent, node, key);
  node[meta] = child;
  parent?.children.splice(index5, 0, child);
  return child;
};
var getPath = (node) => {
  let path = "";
  for (let current = node[meta];current.parent; current = current.parent) {
    if (current.key) {
      path = `${separator_element}${current.key}${path}`;
    } else {
      const index5 = current.parent.children.indexOf(current);
      path = `${separator_element}${index5}${path}`;
    }
  }
  return path.slice(1);
};

class Reconciler {
  #root = null;
  #dispatch = () => {};
  #useServerEvents = false;
  #exposeKeys = false;
  constructor(root3, dispatch, { useServerEvents = false, exposeKeys = false } = {}) {
    this.#root = root3;
    this.#dispatch = dispatch;
    this.#useServerEvents = useServerEvents;
    this.#exposeKeys = exposeKeys;
  }
  mount(vdom) {
    insertMetadataChild(element_kind, null, this.#root, 0, null);
    this.#insertChild(this.#root, null, this.#root[meta], 0, vdom);
  }
  push(patch) {
    this.#stack.push({ node: this.#root[meta], patch });
    this.#reconcile();
  }
  #stack = [];
  #reconcile() {
    const stack = this.#stack;
    while (stack.length) {
      const { node, patch } = stack.pop();
      const { children: childNodes } = node;
      const { changes, removed, children: childPatches } = patch;
      iterate(changes, (change) => this.#patch(node, change));
      if (removed) {
        this.#removeChildren(node, childNodes.length - removed, removed);
      }
      iterate(childPatches, (childPatch) => {
        const child = childNodes[childPatch.index | 0];
        this.#stack.push({ node: child, patch: childPatch });
      });
    }
  }
  #patch(node, change) {
    switch (change.kind) {
      case replace_text_kind:
        this.#replaceText(node, change);
        break;
      case replace_inner_html_kind:
        this.#replaceInnerHtml(node, change);
        break;
      case update_kind:
        this.#update(node, change);
        break;
      case move_kind:
        this.#move(node, change);
        break;
      case remove_kind:
        this.#remove(node, change);
        break;
      case replace_kind:
        this.#replace(node, change);
        break;
      case insert_kind:
        this.#insert(node, change);
        break;
    }
  }
  #insert(parent, { children, before }) {
    const fragment2 = createDocumentFragment();
    const beforeEl = this.#getReference(parent, before);
    this.#insertChildren(fragment2, null, parent, before | 0, children);
    insertBefore(parent.parentNode, fragment2, beforeEl);
  }
  #replace(parent, { index: index5, with: child }) {
    this.#removeChildren(parent, index5 | 0, 1);
    const beforeEl = this.#getReference(parent, index5);
    this.#insertChild(parent.parentNode, beforeEl, parent, index5 | 0, child);
  }
  #getReference(node, index5) {
    index5 = index5 | 0;
    const { children } = node;
    const childCount = children.length;
    if (index5 < childCount) {
      return children[index5].node;
    }
    let lastChild = children[childCount - 1];
    if (!lastChild && node.kind !== fragment_kind)
      return null;
    if (!lastChild)
      lastChild = node;
    while (lastChild.kind === fragment_kind && lastChild.children.length) {
      lastChild = lastChild.children[lastChild.children.length - 1];
    }
    return lastChild.node.nextSibling;
  }
  #move(parent, { key, before }) {
    before = before | 0;
    const { children, parentNode } = parent;
    const beforeEl = children[before].node;
    let prev = children[before];
    for (let i = before + 1;i < children.length; ++i) {
      const next = children[i];
      children[i] = prev;
      prev = next;
      if (next.key === key) {
        children[before] = next;
        break;
      }
    }
    const { kind, node, children: prevChildren } = prev;
    moveBefore(parentNode, node, beforeEl);
    if (kind === fragment_kind) {
      this.#moveChildren(parentNode, prevChildren, beforeEl);
    }
  }
  #moveChildren(domParent, children, beforeEl) {
    for (let i = 0;i < children.length; ++i) {
      const { kind, node, children: nestedChildren } = children[i];
      moveBefore(domParent, node, beforeEl);
      if (kind === fragment_kind) {
        this.#moveChildren(domParent, nestedChildren, beforeEl);
      }
    }
  }
  #remove(parent, { index: index5 }) {
    this.#removeChildren(parent, index5, 1);
  }
  #removeChildren(parent, index5, count) {
    const { children, parentNode } = parent;
    const deleted = children.splice(index5, count);
    for (let i = 0;i < deleted.length; ++i) {
      const { kind, node, children: nestedChildren } = deleted[i];
      removeChild(parentNode, node);
      this.#removeDebouncers(deleted[i]);
      if (kind === fragment_kind) {
        deleted.push(...nestedChildren);
      }
    }
  }
  #removeDebouncers(node) {
    const { debouncers, children } = node;
    for (const { timeout } of debouncers.values()) {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
    debouncers.clear();
    iterate(children, (child) => this.#removeDebouncers(child));
  }
  #update({ node, handlers, throttles, debouncers }, { added, removed }) {
    iterate(removed, ({ name: name2 }) => {
      if (handlers.delete(name2)) {
        removeEventListener(node, name2, handleEvent);
        this.#updateDebounceThrottle(throttles, name2, 0);
        this.#updateDebounceThrottle(debouncers, name2, 0);
      } else {
        removeAttribute(node, name2);
        SYNCED_ATTRIBUTES[name2]?.removed?.(node, name2);
      }
    });
    iterate(added, (attribute3) => this.#createAttribute(node, attribute3));
  }
  #replaceText({ node }, { content }) {
    setData(node, content ?? "");
  }
  #replaceInnerHtml({ node }, { inner_html }) {
    setInnerHtml(node, inner_html ?? "");
  }
  #insertChildren(domParent, beforeEl, metaParent, index5, children) {
    iterate(children, (child) => this.#insertChild(domParent, beforeEl, metaParent, index5++, child));
  }
  #insertChild(domParent, beforeEl, metaParent, index5, vnode) {
    switch (vnode.kind) {
      case element_kind: {
        const node = this.#createElement(metaParent, index5, vnode);
        this.#insertChildren(node, null, node[meta], 0, vnode.children);
        insertBefore(domParent, node, beforeEl);
        break;
      }
      case text_kind: {
        const node = this.#createTextNode(metaParent, index5, vnode);
        insertBefore(domParent, node, beforeEl);
        break;
      }
      case fragment_kind: {
        const head = this.#createTextNode(metaParent, index5, vnode);
        insertBefore(domParent, head, beforeEl);
        this.#insertChildren(domParent, beforeEl, head[meta], 0, vnode.children);
        break;
      }
      case unsafe_inner_html_kind: {
        const node = this.#createElement(metaParent, index5, vnode);
        this.#replaceInnerHtml({ node }, vnode);
        insertBefore(domParent, node, beforeEl);
        break;
      }
    }
  }
  #createElement(parent, index5, { kind, key, tag, namespace, attributes }) {
    const node = createElementNS(namespace || NAMESPACE_HTML, tag);
    insertMetadataChild(kind, parent, node, index5, key);
    if (this.#exposeKeys && key) {
      setAttribute(node, "data-lustre-key", key);
    }
    iterate(attributes, (attribute3) => this.#createAttribute(node, attribute3));
    return node;
  }
  #createTextNode(parent, index5, { kind, key, content }) {
    const node = createTextNode(content ?? "");
    insertMetadataChild(kind, parent, node, index5, key);
    return node;
  }
  #createAttribute(node, attribute3) {
    const { debouncers, handlers, throttles } = node[meta];
    const {
      kind,
      name: name2,
      value: value2,
      prevent_default: prevent,
      debounce: debounceDelay,
      throttle: throttleDelay
    } = attribute3;
    switch (kind) {
      case attribute_kind: {
        const valueOrDefault = value2 ?? "";
        if (name2 === "virtual:defaultValue") {
          node.defaultValue = valueOrDefault;
          return;
        }
        if (valueOrDefault !== getAttribute(node, name2)) {
          setAttribute(node, name2, valueOrDefault);
        }
        SYNCED_ATTRIBUTES[name2]?.added?.(node, valueOrDefault);
        break;
      }
      case property_kind:
        node[name2] = value2;
        break;
      case event_kind: {
        if (handlers.has(name2)) {
          removeEventListener(node, name2, handleEvent);
        }
        const passive = prevent.kind === never_kind;
        addEventListener(node, name2, handleEvent, { passive });
        this.#updateDebounceThrottle(throttles, name2, throttleDelay);
        this.#updateDebounceThrottle(debouncers, name2, debounceDelay);
        handlers.set(name2, (event3) => this.#handleEvent(attribute3, event3));
        break;
      }
    }
  }
  #updateDebounceThrottle(map7, name2, delay) {
    const debounceOrThrottle = map7.get(name2);
    if (delay > 0) {
      if (debounceOrThrottle) {
        debounceOrThrottle.delay = delay;
      } else {
        map7.set(name2, { delay });
      }
    } else if (debounceOrThrottle) {
      const { timeout } = debounceOrThrottle;
      if (timeout) {
        clearTimeout(timeout);
      }
      map7.delete(name2);
    }
  }
  #handleEvent(attribute3, event3) {
    const { currentTarget, type } = event3;
    const { debouncers, throttles } = currentTarget[meta];
    const path = getPath(currentTarget);
    const {
      prevent_default: prevent,
      stop_propagation: stop,
      include,
      immediate
    } = attribute3;
    if (prevent.kind === always_kind)
      event3.preventDefault();
    if (stop.kind === always_kind)
      event3.stopPropagation();
    if (type === "submit") {
      event3.detail ??= {};
      event3.detail.formData = [
        ...new FormData(event3.target, event3.submitter).entries()
      ];
    }
    const data = this.#useServerEvents ? createServerEvent(event3, include ?? []) : event3;
    const throttle = throttles.get(type);
    if (throttle) {
      const now = Date.now();
      const last = throttle.last || 0;
      if (now > last + throttle.delay) {
        throttle.last = now;
        throttle.lastEvent = event3;
        this.#dispatch(data, path, type, immediate);
      }
    }
    const debounce = debouncers.get(type);
    if (debounce) {
      clearTimeout(debounce.timeout);
      debounce.timeout = setTimeout2(() => {
        if (event3 === throttles.get(type)?.lastEvent)
          return;
        this.#dispatch(data, path, type, immediate);
      }, debounce.delay);
    }
    if (!throttle && !debounce) {
      this.#dispatch(data, path, type, immediate);
    }
  }
}
var iterate = (list4, callback) => {
  if (Array.isArray(list4)) {
    for (let i = 0;i < list4.length; i++) {
      callback(list4[i]);
    }
  } else if (list4) {
    for (list4;list4.head; list4 = list4.tail) {
      callback(list4.head);
    }
  }
};
var handleEvent = (event3) => {
  const { currentTarget, type } = event3;
  const handler = currentTarget[meta].handlers.get(type);
  handler(event3);
};
var createServerEvent = (event3, include = []) => {
  const data = {};
  if (event3.type === "input" || event3.type === "change") {
    include.push("target.value");
  }
  if (event3.type === "submit") {
    include.push("detail.formData");
  }
  for (const property3 of include) {
    const path = property3.split(".");
    for (let i = 0, input2 = event3, output = data;i < path.length; i++) {
      if (i === path.length - 1) {
        output[path[i]] = input2[path[i]];
        break;
      }
      output = output[path[i]] ??= {};
      input2 = input2[path[i]];
    }
  }
  return data;
};
var syncedBooleanAttribute = (name2) => {
  return {
    added(node) {
      node[name2] = true;
    },
    removed(node) {
      node[name2] = false;
    }
  };
};
var syncedAttribute = (name2) => {
  return {
    added(node, value2) {
      node[name2] = value2;
    }
  };
};
var SYNCED_ATTRIBUTES = {
  checked: syncedBooleanAttribute("checked"),
  selected: syncedBooleanAttribute("selected"),
  value: syncedAttribute("value"),
  autofocus: {
    added(node) {
      queueMicrotask(() => {
        node.focus?.();
      });
    }
  },
  autoplay: {
    added(node) {
      try {
        node.play?.();
      } catch (e) {
        console.error(e);
      }
    }
  }
};

// build/dev/javascript/lustre/lustre/element/keyed.mjs
function do_extract_keyed_children(loop$key_children_pairs, loop$keyed_children, loop$children) {
  while (true) {
    let key_children_pairs = loop$key_children_pairs;
    let keyed_children = loop$keyed_children;
    let children = loop$children;
    if (key_children_pairs instanceof Empty) {
      return [keyed_children, reverse(children)];
    } else {
      let rest = key_children_pairs.tail;
      let key = key_children_pairs.head[0];
      let element$1 = key_children_pairs.head[1];
      let keyed_element = to_keyed(key, element$1);
      let _block;
      if (key === "") {
        _block = keyed_children;
      } else {
        _block = insert2(keyed_children, key, keyed_element);
      }
      let keyed_children$1 = _block;
      let children$1 = prepend(keyed_element, children);
      loop$key_children_pairs = rest;
      loop$keyed_children = keyed_children$1;
      loop$children = children$1;
    }
  }
}
function extract_keyed_children(children) {
  return do_extract_keyed_children(children, empty2(), empty_list);
}
function element3(tag, attributes, children) {
  let $ = extract_keyed_children(children);
  let keyed_children;
  let children$1;
  keyed_children = $[0];
  children$1 = $[1];
  return element("", identity3, "", tag, attributes, children$1, keyed_children, false, false);
}
function namespaced2(namespace, tag, attributes, children) {
  let $ = extract_keyed_children(children);
  let keyed_children;
  let children$1;
  keyed_children = $[0];
  children$1 = $[1];
  return element("", identity3, namespace, tag, attributes, children$1, keyed_children, false, false);
}
function fragment2(children) {
  let $ = extract_keyed_children(children);
  let keyed_children;
  let children$1;
  keyed_children = $[0];
  children$1 = $[1];
  return fragment("", identity3, children$1, keyed_children);
}

// build/dev/javascript/lustre/lustre/vdom/virtualise.ffi.mjs
var virtualise = (root3) => {
  const rootMeta = insertMetadataChild(element_kind, null, root3, 0, null);
  let virtualisableRootChildren = 0;
  for (let child = root3.firstChild;child; child = child.nextSibling) {
    if (canVirtualiseNode(child))
      virtualisableRootChildren += 1;
  }
  if (virtualisableRootChildren === 0) {
    const placeholder2 = document2().createTextNode("");
    insertMetadataChild(text_kind, rootMeta, placeholder2, 0, null);
    root3.replaceChildren(placeholder2);
    return none2();
  }
  if (virtualisableRootChildren === 1) {
    const children2 = virtualiseChildNodes(rootMeta, root3);
    return children2.head[1];
  }
  const fragmentHead = document2().createTextNode("");
  const fragmentMeta = insertMetadataChild(fragment_kind, rootMeta, fragmentHead, 0, null);
  const children = virtualiseChildNodes(fragmentMeta, root3);
  root3.insertBefore(fragmentHead, root3.firstChild);
  return fragment2(children);
};
var canVirtualiseNode = (node) => {
  switch (node.nodeType) {
    case ELEMENT_NODE:
      return true;
    case TEXT_NODE:
      return !!node.data;
    default:
      return false;
  }
};
var virtualiseNode = (meta2, node, key, index5) => {
  if (!canVirtualiseNode(node)) {
    return null;
  }
  switch (node.nodeType) {
    case ELEMENT_NODE: {
      const childMeta = insertMetadataChild(element_kind, meta2, node, index5, key);
      const tag = node.localName;
      const namespace = node.namespaceURI;
      const isHtmlElement = !namespace || namespace === NAMESPACE_HTML;
      if (isHtmlElement && INPUT_ELEMENTS.includes(tag)) {
        virtualiseInputEvents(tag, node);
      }
      const attributes = virtualiseAttributes(node);
      const children = virtualiseChildNodes(childMeta, node);
      const vnode = isHtmlElement ? element3(tag, attributes, children) : namespaced2(namespace, tag, attributes, children);
      return vnode;
    }
    case TEXT_NODE:
      insertMetadataChild(text_kind, meta2, node, index5, null);
      return text2(node.data);
    default:
      return null;
  }
};
var INPUT_ELEMENTS = ["input", "select", "textarea"];
var virtualiseInputEvents = (tag, node) => {
  const value2 = node.value;
  const checked = node.checked;
  if (tag === "input" && node.type === "checkbox" && !checked)
    return;
  if (tag === "input" && node.type === "radio" && !checked)
    return;
  if (node.type !== "checkbox" && node.type !== "radio" && !value2)
    return;
  queueMicrotask(() => {
    node.value = value2;
    node.checked = checked;
    node.dispatchEvent(new Event("input", { bubbles: true }));
    node.dispatchEvent(new Event("change", { bubbles: true }));
    if (document2().activeElement !== node) {
      node.dispatchEvent(new Event("blur", { bubbles: true }));
    }
  });
};
var virtualiseChildNodes = (meta2, node) => {
  let children = null;
  let child = node.firstChild;
  let ptr = null;
  let index5 = 0;
  while (child) {
    const key = child.nodeType === ELEMENT_NODE ? child.getAttribute("data-lustre-key") : null;
    if (key != null) {
      child.removeAttribute("data-lustre-key");
    }
    const vnode = virtualiseNode(meta2, child, key, index5);
    const next = child.nextSibling;
    if (vnode) {
      const list_node = new NonEmpty([key ?? "", vnode], null);
      if (ptr) {
        ptr = ptr.tail = list_node;
      } else {
        ptr = children = list_node;
      }
      index5 += 1;
    } else {
      node.removeChild(child);
    }
    child = next;
  }
  if (!ptr)
    return empty_list;
  ptr.tail = empty_list;
  return children;
};
var virtualiseAttributes = (node) => {
  let index5 = node.attributes.length;
  let attributes = empty_list;
  while (index5-- > 0) {
    const attr = node.attributes[index5];
    if (attr.name === "xmlns") {
      continue;
    }
    attributes = new NonEmpty(virtualiseAttribute(attr), attributes);
  }
  return attributes;
};
var virtualiseAttribute = (attr) => {
  const name2 = attr.localName;
  const value2 = attr.value;
  return attribute2(name2, value2);
};

// build/dev/javascript/lustre/lustre/runtime/client/runtime.ffi.mjs
var is_browser = () => !!document2();
class Runtime {
  constructor(root3, [model, effects], view, update2) {
    this.root = root3;
    this.#model = model;
    this.#view = view;
    this.#update = update2;
    this.root.addEventListener("context-request", (event3) => {
      if (!(event3.context && event3.callback))
        return;
      if (!this.#contexts.has(event3.context))
        return;
      event3.stopImmediatePropagation();
      const context = this.#contexts.get(event3.context);
      if (event3.subscribe) {
        const unsubscribe = () => {
          context.subscribers = context.subscribers.filter((subscriber) => subscriber !== event3.callback);
        };
        context.subscribers.push([event3.callback, unsubscribe]);
        event3.callback(context.value, unsubscribe);
      } else {
        event3.callback(context.value);
      }
    });
    this.#reconciler = new Reconciler(this.root, (event3, path, name2) => {
      const [events, result] = handle(this.#events, path, name2, event3);
      this.#events = events;
      if (result.isOk()) {
        const handler = result[0];
        if (handler.stop_propagation)
          event3.stopPropagation();
        if (handler.prevent_default)
          event3.preventDefault();
        this.dispatch(handler.message, false);
      }
    });
    this.#vdom = virtualise(this.root);
    this.#events = new$3();
    this.#shouldFlush = true;
    this.#tick(effects);
  }
  root = null;
  dispatch(msg, immediate = false) {
    this.#shouldFlush ||= immediate;
    if (this.#shouldQueue) {
      this.#queue.push(msg);
    } else {
      const [model, effects] = this.#update(this.#model, msg);
      this.#model = model;
      this.#tick(effects);
    }
  }
  emit(event3, data) {
    const target2 = this.root.host ?? this.root;
    target2.dispatchEvent(new CustomEvent(event3, {
      detail: data,
      bubbles: true,
      composed: true
    }));
  }
  provide(key, value2) {
    if (!this.#contexts.has(key)) {
      this.#contexts.set(key, { value: value2, subscribers: [] });
    } else {
      const context = this.#contexts.get(key);
      context.value = value2;
      for (let i = context.subscribers.length - 1;i >= 0; i--) {
        const [subscriber, unsubscribe] = context.subscribers[i];
        if (!subscriber) {
          context.subscribers.splice(i, 1);
          continue;
        }
        subscriber(value2, unsubscribe);
      }
    }
  }
  #model;
  #view;
  #update;
  #vdom;
  #events;
  #reconciler;
  #contexts = new Map;
  #shouldQueue = false;
  #queue = [];
  #beforePaint = empty_list;
  #afterPaint = empty_list;
  #renderTimer = null;
  #shouldFlush = false;
  #actions = {
    dispatch: (msg, immediate) => this.dispatch(msg, immediate),
    emit: (event3, data) => this.emit(event3, data),
    select: () => {},
    root: () => this.root,
    provide: (key, value2) => this.provide(key, value2)
  };
  #tick(effects) {
    this.#shouldQueue = true;
    while (true) {
      for (let list4 = effects.synchronous;list4.tail; list4 = list4.tail) {
        list4.head(this.#actions);
      }
      this.#beforePaint = listAppend(this.#beforePaint, effects.before_paint);
      this.#afterPaint = listAppend(this.#afterPaint, effects.after_paint);
      if (!this.#queue.length)
        break;
      [this.#model, effects] = this.#update(this.#model, this.#queue.shift());
    }
    this.#shouldQueue = false;
    if (this.#shouldFlush) {
      cancelAnimationFrame(this.#renderTimer);
      this.#render();
    } else if (!this.#renderTimer) {
      this.#renderTimer = requestAnimationFrame(() => {
        this.#render();
      });
    }
  }
  #render() {
    this.#shouldFlush = false;
    this.#renderTimer = null;
    const next = this.#view(this.#model);
    const { patch, events } = diff(this.#events, this.#vdom, next);
    this.#events = events;
    this.#vdom = next;
    this.#reconciler.push(patch);
    if (this.#beforePaint instanceof NonEmpty) {
      const effects = makeEffect(this.#beforePaint);
      this.#beforePaint = empty_list;
      queueMicrotask(() => {
        this.#shouldFlush = true;
        this.#tick(effects);
      });
    }
    if (this.#afterPaint instanceof NonEmpty) {
      const effects = makeEffect(this.#afterPaint);
      this.#afterPaint = empty_list;
      requestAnimationFrame(() => {
        this.#shouldFlush = true;
        this.#tick(effects);
      });
    }
  }
}
function makeEffect(synchronous) {
  return {
    synchronous,
    after_paint: empty_list,
    before_paint: empty_list
  };
}
function listAppend(a2, b) {
  if (a2 instanceof Empty) {
    return b;
  } else if (b instanceof Empty) {
    return a2;
  } else {
    return append(a2, b);
  }
}
var copiedStyleSheets = new WeakMap;

// build/dev/javascript/lustre/lustre/runtime/server/runtime.mjs
class ClientDispatchedMessage extends CustomType {
  constructor(message) {
    super();
    this.message = message;
  }
}
class ClientRegisteredCallback extends CustomType {
  constructor(callback) {
    super();
    this.callback = callback;
  }
}
class ClientDeregisteredCallback extends CustomType {
  constructor(callback) {
    super();
    this.callback = callback;
  }
}
class EffectDispatchedMessage extends CustomType {
  constructor(message) {
    super();
    this.message = message;
  }
}
class EffectEmitEvent extends CustomType {
  constructor(name2, data) {
    super();
    this.name = name2;
    this.data = data;
  }
}
class EffectProvidedValue extends CustomType {
  constructor(key, value2) {
    super();
    this.key = key;
    this.value = value2;
  }
}
class SystemRequestedShutdown extends CustomType {
}

// build/dev/javascript/lustre/lustre/component.mjs
class Config2 extends CustomType {
  constructor(open_shadow_root, adopt_styles, delegates_focus, attributes, properties, contexts, is_form_associated, on_form_autofill, on_form_reset, on_form_restore) {
    super();
    this.open_shadow_root = open_shadow_root;
    this.adopt_styles = adopt_styles;
    this.delegates_focus = delegates_focus;
    this.attributes = attributes;
    this.properties = properties;
    this.contexts = contexts;
    this.is_form_associated = is_form_associated;
    this.on_form_autofill = on_form_autofill;
    this.on_form_reset = on_form_reset;
    this.on_form_restore = on_form_restore;
  }
}
function new$6(options) {
  let init = new Config2(true, true, false, empty_list, empty_list, empty_list, false, option_none, option_none, option_none);
  return fold(options, init, (config, option) => {
    return option.apply(config);
  });
}

// build/dev/javascript/lustre/lustre/runtime/client/spa.ffi.mjs
class Spa {
  #runtime;
  constructor(root3, [init, effects], update2, view) {
    this.#runtime = new Runtime(root3, [init, effects], view, update2);
  }
  send(message) {
    switch (message.constructor) {
      case EffectDispatchedMessage: {
        this.dispatch(message.message, false);
        break;
      }
      case EffectEmitEvent: {
        this.emit(message.name, message.data);
        break;
      }
      case SystemRequestedShutdown:
        break;
    }
  }
  dispatch(msg, immediate) {
    this.#runtime.dispatch(msg, immediate);
  }
  emit(event3, data) {
    this.#runtime.emit(event3, data);
  }
}
var start = ({ init, update: update2, view }, selector, flags) => {
  if (!is_browser())
    return new Error2(new NotABrowser);
  const root3 = selector instanceof HTMLElement ? selector : document2().querySelector(selector);
  if (!root3)
    return new Error2(new ElementNotFound(selector));
  return new Ok(new Spa(root3, init(flags), update2, view));
};

// build/dev/javascript/lustre/lustre/runtime/server/runtime.ffi.mjs
class Runtime2 {
  #model;
  #update;
  #view;
  #config;
  #vdom;
  #events;
  #providers = new_map();
  #callbacks = /* @__PURE__ */ new Set;
  constructor([model, effects], update2, view, config) {
    this.#model = model;
    this.#update = update2;
    this.#view = view;
    this.#config = config;
    this.#vdom = this.#view(this.#model);
    this.#events = from_node(this.#vdom);
    this.#handle_effect(effects);
  }
  send(msg) {
    switch (msg.constructor) {
      case ClientDispatchedMessage: {
        const { message } = msg;
        const next = this.#handle_client_message(message);
        const diff2 = diff(this.#events, this.#vdom, next);
        this.#vdom = next;
        this.#events = diff2.events;
        this.broadcast(reconcile(diff2.patch));
        return;
      }
      case ClientRegisteredCallback: {
        const { callback } = msg;
        this.#callbacks.add(callback);
        callback(mount(this.#config.open_shadow_root, this.#config.adopt_styles, keys(this.#config.attributes), keys(this.#config.properties), keys(this.#config.contexts), this.#providers, this.#vdom));
        return;
      }
      case ClientDeregisteredCallback: {
        const { callback } = msg;
        this.#callbacks.delete(callback);
        return;
      }
      case EffectDispatchedMessage: {
        const { message } = msg;
        const [model, effect] = this.#update(this.#model, message);
        const next = this.#view(model);
        const diff2 = diff(this.#events, this.#vdom, next);
        this.#handle_effect(effect);
        this.#model = model;
        this.#vdom = next;
        this.#events = diff2.events;
        this.broadcast(reconcile(diff2.patch));
        return;
      }
      case EffectEmitEvent: {
        const { name: name2, data } = msg;
        this.broadcast(emit(name2, data));
        return;
      }
      case EffectProvidedValue: {
        const { key, value: value2 } = msg;
        this.#providers = insert(this.#providers, key, value2);
        this.broadcast(provide(key, value2));
        return;
      }
      case SystemRequestedShutdown: {
        this.#model = null;
        this.#update = null;
        this.#view = null;
        this.#config = null;
        this.#vdom = null;
        this.#events = null;
        this.#providers = null;
        this.#callbacks.clear();
        return;
      }
      default:
        return;
    }
  }
  broadcast(msg) {
    for (const callback of this.#callbacks) {
      callback(msg);
    }
  }
  #handle_client_message(msg) {
    switch (msg.constructor) {
      case Batch: {
        const { messages } = msg;
        let model = this.#model;
        let effect = none();
        for (let list4 = messages;list4.head; list4 = list4.tail) {
          const result = this.#handle_client_message(list4.head);
          if (result instanceof Ok) {
            model = result[0][0];
            effect = batch(List.fromArray([effect, result[0][1]]));
            break;
          }
        }
        this.#handle_effect(effect);
        this.#model = model;
        return this.#view(this.#model);
      }
      case AttributeChanged: {
        const { name: name2, value: value2 } = msg;
        const result = this.#handle_attribute_change(name2, value2);
        if (result instanceof Error2) {
          return this.#vdom;
        } else {
          const [model, effects] = this.#update(this.#model, result[0]);
          this.#handle_effect(effects);
          this.#model = model;
          return this.#view(this.#model);
        }
      }
      case PropertyChanged: {
        const { name: name2, value: value2 } = msg;
        const result = this.#handle_properties_change(name2, value2);
        if (result instanceof Error2) {
          return this.#vdom;
        } else {
          const [model, effects] = this.#update(this.#model, result[0]);
          this.#handle_effect(effects);
          this.#model = model;
          return this.#view(this.#model);
        }
      }
      case EventFired: {
        const { path, name: name2, event: event3 } = msg;
        const [events, result] = handle(this.#events, path, name2, event3);
        this.#events = events;
        if (result instanceof Error2) {
          return this.#vdom;
        } else {
          const [model, effects] = this.#update(this.#model, result[0].message);
          this.#handle_effect(effects);
          this.#model = model;
          return this.#view(this.#model);
        }
      }
      case ContextProvided: {
        const { key, value: value2 } = msg;
        let result = map_get(this.#config.contexts, key);
        if (result instanceof Error2) {
          return this.#vdom;
        }
        result = run(value2, result[0]);
        if (result instanceof Error2) {
          return this.#vdom;
        }
        const [model, effects] = this.#update(this.#model, result[0]);
        this.#handle_effect(effects);
        this.#model = model;
        return this.#view(this.#model);
      }
    }
  }
  #handle_attribute_change(name2, value2) {
    const result = map_get(this.#config.attributes, name2);
    switch (result.constructor) {
      case Ok:
        return result[0](value2);
      case Error2:
        return new Error2(undefined);
    }
  }
  #handle_properties_change(name2, value2) {
    const result = map_get(this.#config.properties, name2);
    switch (result.constructor) {
      case Ok:
        return result[0](value2);
      case Error2:
        return new Error2(undefined);
    }
  }
  #handle_effect(effect) {
    const dispatch = (message) => this.send(new EffectDispatchedMessage(message));
    const emit2 = (name2, data) => this.send(new EffectEmitEvent(name2, data));
    const select = () => {
      return;
    };
    const internals = () => {
      return;
    };
    const provide2 = (key, value2) => this.send(new EffectProvidedValue(key, value2));
    globalThis.queueMicrotask(() => {
      perform(effect, dispatch, emit2, select, internals, provide2);
    });
  }
}

// build/dev/javascript/lustre/lustre.mjs
class App extends CustomType {
  constructor(init, update2, view, config) {
    super();
    this.init = init;
    this.update = update2;
    this.view = view;
    this.config = config;
  }
}
class ElementNotFound extends CustomType {
  constructor(selector) {
    super();
    this.selector = selector;
  }
}
class NotABrowser extends CustomType {
}
function application(init, update2, view) {
  return new App(init, update2, view, new$6(empty_list));
}
function start3(app, selector, start_args) {
  return guard(!is_browser(), new Error2(new NotABrowser), () => {
    return start(app, selector, start_args);
  });
}

// build/dev/javascript/gleam_stdlib/gleam/pair.mjs
function new$7(first2, second) {
  return [first2, second];
}
// build/dev/javascript/modem/modem.ffi.mjs
var defaults = {
  handle_external_links: false,
  handle_internal_links: true
};
var initial_location = globalThis?.window?.location?.href;
var do_initial_uri = () => {
  if (!initial_location) {
    return new Error2(undefined);
  } else {
    return new Ok(uri_from_url(new URL(initial_location)));
  }
};
var do_init = (dispatch, options = defaults) => {
  document.addEventListener("click", (event3) => {
    const a2 = find_anchor(event3.target);
    if (!a2)
      return;
    try {
      const url = new URL(a2.href);
      const uri = uri_from_url(url);
      const is_external = url.host !== window.location.host;
      if (!options.handle_external_links && is_external)
        return;
      if (!options.handle_internal_links && !is_external)
        return;
      event3.preventDefault();
      if (!is_external) {
        window.history.pushState({}, "", a2.href);
        window.requestAnimationFrame(() => {
          if (url.hash) {
            document.getElementById(url.hash.slice(1))?.scrollIntoView();
          } else {
            window.scrollTo(0, 0);
          }
        });
      }
      return dispatch(uri);
    } catch {
      return;
    }
  });
  window.addEventListener("popstate", (e) => {
    e.preventDefault();
    const url = new URL(window.location.href);
    const uri = uri_from_url(url);
    window.requestAnimationFrame(() => {
      if (url.hash) {
        document.getElementById(url.hash.slice(1))?.scrollIntoView();
      } else {
        window.scrollTo(0, 0);
      }
    });
    dispatch(uri);
  });
  window.addEventListener("modem-push", ({ detail }) => {
    dispatch(detail);
  });
  window.addEventListener("modem-replace", ({ detail }) => {
    dispatch(detail);
  });
};
var do_push = (uri) => {
  window.history.pushState({}, "", to_string3(uri));
  window.requestAnimationFrame(() => {
    if (uri.fragment[0]) {
      document.getElementById(uri.fragment[0])?.scrollIntoView();
    }
  });
  window.dispatchEvent(new CustomEvent("modem-push", { detail: uri }));
};
var find_anchor = (el) => {
  if (!el || el.tagName === "BODY") {
    return null;
  } else if (el.tagName === "A") {
    return el;
  } else {
    return find_anchor(el.parentElement);
  }
};
var uri_from_url = (url) => {
  return new Uri(url.protocol ? new Some(url.protocol.slice(0, -1)) : new None, new None, url.hostname ? new Some(url.hostname) : new None, url.port ? new Some(Number(url.port)) : new None, url.pathname, url.search ? new Some(url.search.slice(1)) : new None, url.hash ? new Some(url.hash.slice(1)) : new None);
};

// build/dev/javascript/modem/modem.mjs
function init(handler) {
  return from((dispatch) => {
    return guard(!is_browser(), undefined, () => {
      return do_init((uri) => {
        let _pipe = uri;
        let _pipe$1 = handler(_pipe);
        return dispatch(_pipe$1);
      });
    });
  });
}
var relative = /* @__PURE__ */ new Uri(/* @__PURE__ */ new None, /* @__PURE__ */ new None, /* @__PURE__ */ new None, /* @__PURE__ */ new None, "", /* @__PURE__ */ new None, /* @__PURE__ */ new None);
function push(path, query, fragment3) {
  return from((_) => {
    return guard(!is_browser(), undefined, () => {
      return do_push(new Uri(relative.scheme, relative.userinfo, relative.host, relative.port, path, query, fragment3));
    });
  });
}
// build/dev/javascript/plinth/document_ffi.mjs
function querySelector(query) {
  let found = document.querySelector(query);
  if (!found) {
    return new Error2;
  }
  return new Ok(found);
}

// build/dev/javascript/plinth/element_ffi.mjs
function innerText(element4) {
  return element4.innerText;
}
// build/dev/javascript/shared/shared/profile.mjs
class HomeTown extends CustomType {
  constructor(name2, h3_index) {
    super();
    this.name = name2;
    this.h3_index = h3_index;
  }
}
class AvatarBlob extends CustomType {
  constructor(ref, mime_type, size2) {
    super();
    this.ref = ref;
    this.mime_type = mime_type;
    this.size = size2;
  }
}
class Profile extends CustomType {
  constructor(id2, uri, cid, did, handle2, display_name, description, avatar_url, avatar_blob, home_town, interests, indexed_at) {
    super();
    this.id = id2;
    this.uri = uri;
    this.cid = cid;
    this.did = did;
    this.handle = handle2;
    this.display_name = display_name;
    this.description = description;
    this.avatar_url = avatar_url;
    this.avatar_blob = avatar_blob;
    this.home_town = home_town;
    this.interests = interests;
    this.indexed_at = indexed_at;
  }
}
function home_town_decoder() {
  return field("name", string2, (name2) => {
    return field("value", string2, (h3_index) => {
      return success(new HomeTown(name2, h3_index));
    });
  });
}
function avatar_blob_decoder() {
  return field("ref", string2, (ref) => {
    return field("mime_type", string2, (mime_type) => {
      return field("size", int2, (size2) => {
        return success(new AvatarBlob(ref, mime_type, size2));
      });
    });
  });
}
function profile_decoder() {
  return field("id", string2, (id2) => {
    return field("uri", string2, (uri) => {
      return field("cid", string2, (cid) => {
        return field("did", string2, (did) => {
          return field("handle", optional(string2), (handle2) => {
            return field("display_name", optional(string2), (display_name) => {
              return field("description", optional(string2), (description) => {
                return field("avatar_url", optional(string2), (avatar_url) => {
                  return field("avatar_blob", optional(avatar_blob_decoder()), (avatar_blob) => {
                    return field("home_town", optional(home_town_decoder()), (home_town) => {
                      return field("interests", optional(list2(string2)), (interests) => {
                        return field("indexed_at", string2, (indexed_at) => {
                          return success(new Profile(id2, uri, cid, did, handle2, display_name, description, avatar_url, avatar_blob, home_town, interests, indexed_at));
                        });
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
}
// node_modules/h3-js/dist/browser/h3-js.es.js
var libh3 = function(libh32) {
  libh32 = libh32 || {};
  var Module = typeof libh32 !== "undefined" ? libh32 : {};
  var moduleOverrides = {};
  var key2;
  for (key2 in Module) {
    if (Module.hasOwnProperty(key2)) {
      moduleOverrides[key2] = Module[key2];
    }
  }
  var arguments_ = [];
  var scriptDirectory = "";
  function locateFile(path) {
    if (Module["locateFile"]) {
      return Module["locateFile"](path, scriptDirectory);
    }
    return scriptDirectory + path;
  }
  var readAsync;
  {
    if (typeof document !== "undefined" && document.currentScript) {
      scriptDirectory = document.currentScript.src;
    }
    if (scriptDirectory.indexOf("blob:") !== 0) {
      scriptDirectory = scriptDirectory.substr(0, scriptDirectory.lastIndexOf("/") + 1);
    } else {
      scriptDirectory = "";
    }
    readAsync = function readAsync(url, onload, onerror) {
      var xhr = new XMLHttpRequest;
      xhr.open("GET", url, true);
      xhr.responseType = "arraybuffer";
      xhr.onload = function xhr_onload() {
        if (xhr.status == 200 || xhr.status == 0 && xhr.response) {
          onload(xhr.response);
          return;
        }
        var data = tryParseAsDataURI(url);
        if (data) {
          onload(data.buffer);
          return;
        }
        onerror();
      };
      xhr.onerror = onerror;
      xhr.send(null);
    };
  }
  var out = Module["print"] || console.log.bind(console);
  var err = Module["printErr"] || console.warn.bind(console);
  for (key2 in moduleOverrides) {
    if (moduleOverrides.hasOwnProperty(key2)) {
      Module[key2] = moduleOverrides[key2];
    }
  }
  moduleOverrides = null;
  if (Module["arguments"]) {
    arguments_ = Module["arguments"];
  }
  var tempRet0 = 0;
  var setTempRet0 = function(value3) {
    tempRet0 = value3;
  };
  var getTempRet0 = function() {
    return tempRet0;
  };
  var GLOBAL_BASE = 8;
  function setValue2(ptr, value3, type, noSafe) {
    type = type || "i8";
    if (type.charAt(type.length - 1) === "*") {
      type = "i32";
    }
    switch (type) {
      case "i1":
        HEAP8[ptr >> 0] = value3;
        break;
      case "i8":
        HEAP8[ptr >> 0] = value3;
        break;
      case "i16":
        HEAP16[ptr >> 1] = value3;
        break;
      case "i32":
        HEAP32[ptr >> 2] = value3;
        break;
      case "i64":
        tempI64 = [value3 >>> 0, (tempDouble = value3, +Math_abs(tempDouble) >= 1 ? tempDouble > 0 ? (Math_min(+Math_floor(tempDouble / 4294967296), 4294967295) | 0) >>> 0 : ~~+Math_ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)], HEAP32[ptr >> 2] = tempI64[0], HEAP32[ptr + 4 >> 2] = tempI64[1];
        break;
      case "float":
        HEAPF32[ptr >> 2] = value3;
        break;
      case "double":
        HEAPF64[ptr >> 3] = value3;
        break;
      default:
        abort("invalid type for setValue: " + type);
    }
  }
  function getValue(ptr, type, noSafe) {
    type = type || "i8";
    if (type.charAt(type.length - 1) === "*") {
      type = "i32";
    }
    switch (type) {
      case "i1":
        return HEAP8[ptr >> 0];
      case "i8":
        return HEAP8[ptr >> 0];
      case "i16":
        return HEAP16[ptr >> 1];
      case "i32":
        return HEAP32[ptr >> 2];
      case "i64":
        return HEAP32[ptr >> 2];
      case "float":
        return HEAPF32[ptr >> 2];
      case "double":
        return HEAPF64[ptr >> 3];
      default:
        abort("invalid type for getValue: " + type);
    }
    return null;
  }
  var ABORT = false;
  function assert(condition, text4) {
    if (!condition) {
      abort("Assertion failed: " + text4);
    }
  }
  function getCFunc(ident) {
    var func = Module["_" + ident];
    assert(func, "Cannot call unknown function " + ident + ", make sure it is exported");
    return func;
  }
  function ccall(ident, returnType, argTypes, args, opts) {
    var toC = {
      string: function(str) {
        var ret2 = 0;
        if (str !== null && str !== undefined && str !== 0) {
          var len = (str.length << 2) + 1;
          ret2 = stackAlloc(len);
          stringToUTF8(str, ret2, len);
        }
        return ret2;
      },
      array: function(arr) {
        var ret2 = stackAlloc(arr.length);
        writeArrayToMemory(arr, ret2);
        return ret2;
      }
    };
    function convertReturnValue(ret2) {
      if (returnType === "string") {
        return UTF8ToString(ret2);
      }
      if (returnType === "boolean") {
        return Boolean(ret2);
      }
      return ret2;
    }
    var func = getCFunc(ident);
    var cArgs = [];
    var stack = 0;
    if (args) {
      for (var i = 0;i < args.length; i++) {
        var converter = toC[argTypes[i]];
        if (converter) {
          if (stack === 0) {
            stack = stackSave();
          }
          cArgs[i] = converter(args[i]);
        } else {
          cArgs[i] = args[i];
        }
      }
    }
    var ret = func.apply(null, cArgs);
    ret = convertReturnValue(ret);
    if (stack !== 0) {
      stackRestore(stack);
    }
    return ret;
  }
  function cwrap(ident, returnType, argTypes, opts) {
    argTypes = argTypes || [];
    var numericArgs = argTypes.every(function(type) {
      return type === "number";
    });
    var numericRet = returnType !== "string";
    if (numericRet && numericArgs && !opts) {
      return getCFunc(ident);
    }
    return function() {
      return ccall(ident, returnType, argTypes, arguments, opts);
    };
  }
  var UTF8Decoder = typeof TextDecoder !== "undefined" ? new TextDecoder("utf8") : undefined;
  function UTF8ArrayToString(u8Array, idx, maxBytesToRead) {
    var endIdx = idx + maxBytesToRead;
    var endPtr = idx;
    while (u8Array[endPtr] && !(endPtr >= endIdx)) {
      ++endPtr;
    }
    if (endPtr - idx > 16 && u8Array.subarray && UTF8Decoder) {
      return UTF8Decoder.decode(u8Array.subarray(idx, endPtr));
    } else {
      var str = "";
      while (idx < endPtr) {
        var u0 = u8Array[idx++];
        if (!(u0 & 128)) {
          str += String.fromCharCode(u0);
          continue;
        }
        var u1 = u8Array[idx++] & 63;
        if ((u0 & 224) == 192) {
          str += String.fromCharCode((u0 & 31) << 6 | u1);
          continue;
        }
        var u2 = u8Array[idx++] & 63;
        if ((u0 & 240) == 224) {
          u0 = (u0 & 15) << 12 | u1 << 6 | u2;
        } else {
          u0 = (u0 & 7) << 18 | u1 << 12 | u2 << 6 | u8Array[idx++] & 63;
        }
        if (u0 < 65536) {
          str += String.fromCharCode(u0);
        } else {
          var ch = u0 - 65536;
          str += String.fromCharCode(55296 | ch >> 10, 56320 | ch & 1023);
        }
      }
    }
    return str;
  }
  function UTF8ToString(ptr, maxBytesToRead) {
    return ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : "";
  }
  function stringToUTF8Array(str, outU8Array, outIdx, maxBytesToWrite) {
    if (!(maxBytesToWrite > 0)) {
      return 0;
    }
    var startIdx = outIdx;
    var endIdx = outIdx + maxBytesToWrite - 1;
    for (var i = 0;i < str.length; ++i) {
      var u = str.charCodeAt(i);
      if (u >= 55296 && u <= 57343) {
        var u1 = str.charCodeAt(++i);
        u = 65536 + ((u & 1023) << 10) | u1 & 1023;
      }
      if (u <= 127) {
        if (outIdx >= endIdx) {
          break;
        }
        outU8Array[outIdx++] = u;
      } else if (u <= 2047) {
        if (outIdx + 1 >= endIdx) {
          break;
        }
        outU8Array[outIdx++] = 192 | u >> 6;
        outU8Array[outIdx++] = 128 | u & 63;
      } else if (u <= 65535) {
        if (outIdx + 2 >= endIdx) {
          break;
        }
        outU8Array[outIdx++] = 224 | u >> 12;
        outU8Array[outIdx++] = 128 | u >> 6 & 63;
        outU8Array[outIdx++] = 128 | u & 63;
      } else {
        if (outIdx + 3 >= endIdx) {
          break;
        }
        outU8Array[outIdx++] = 240 | u >> 18;
        outU8Array[outIdx++] = 128 | u >> 12 & 63;
        outU8Array[outIdx++] = 128 | u >> 6 & 63;
        outU8Array[outIdx++] = 128 | u & 63;
      }
    }
    outU8Array[outIdx] = 0;
    return outIdx - startIdx;
  }
  function stringToUTF8(str, outPtr, maxBytesToWrite) {
    return stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite);
  }
  var UTF16Decoder = typeof TextDecoder !== "undefined" ? new TextDecoder("utf-16le") : undefined;
  function writeArrayToMemory(array3, buffer2) {
    HEAP8.set(array3, buffer2);
  }
  function alignUp(x, multiple) {
    if (x % multiple > 0) {
      x += multiple - x % multiple;
    }
    return x;
  }
  var buffer, HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;
  function updateGlobalBufferAndViews(buf) {
    buffer = buf;
    Module["HEAP8"] = HEAP8 = new Int8Array(buf);
    Module["HEAP16"] = HEAP16 = new Int16Array(buf);
    Module["HEAP32"] = HEAP32 = new Int32Array(buf);
    Module["HEAPU8"] = HEAPU8 = new Uint8Array(buf);
    Module["HEAPU16"] = HEAPU16 = new Uint16Array(buf);
    Module["HEAPU32"] = HEAPU32 = new Uint32Array(buf);
    Module["HEAPF32"] = HEAPF32 = new Float32Array(buf);
    Module["HEAPF64"] = HEAPF64 = new Float64Array(buf);
  }
  var DYNAMIC_BASE = 5271520, DYNAMICTOP_PTR = 28608;
  var INITIAL_TOTAL_MEMORY = Module["TOTAL_MEMORY"] || 33554432;
  if (Module["buffer"]) {
    buffer = Module["buffer"];
  } else {
    buffer = new ArrayBuffer(INITIAL_TOTAL_MEMORY);
  }
  INITIAL_TOTAL_MEMORY = buffer.byteLength;
  updateGlobalBufferAndViews(buffer);
  HEAP32[DYNAMICTOP_PTR >> 2] = DYNAMIC_BASE;
  function callRuntimeCallbacks(callbacks) {
    while (callbacks.length > 0) {
      var callback = callbacks.shift();
      if (typeof callback == "function") {
        callback();
        continue;
      }
      var func = callback.func;
      if (typeof func === "number") {
        if (callback.arg === undefined) {
          Module["dynCall_v"](func);
        } else {
          Module["dynCall_vi"](func, callback.arg);
        }
      } else {
        func(callback.arg === undefined ? null : callback.arg);
      }
    }
  }
  var __ATPRERUN__ = [];
  var __ATINIT__ = [];
  var __ATMAIN__ = [];
  var __ATPOSTRUN__ = [];
  function preRun() {
    if (Module["preRun"]) {
      if (typeof Module["preRun"] == "function") {
        Module["preRun"] = [Module["preRun"]];
      }
      while (Module["preRun"].length) {
        addOnPreRun(Module["preRun"].shift());
      }
    }
    callRuntimeCallbacks(__ATPRERUN__);
  }
  function initRuntime() {
    callRuntimeCallbacks(__ATINIT__);
  }
  function preMain() {
    callRuntimeCallbacks(__ATMAIN__);
  }
  function postRun() {
    if (Module["postRun"]) {
      if (typeof Module["postRun"] == "function") {
        Module["postRun"] = [Module["postRun"]];
      }
      while (Module["postRun"].length) {
        addOnPostRun(Module["postRun"].shift());
      }
    }
    callRuntimeCallbacks(__ATPOSTRUN__);
  }
  function addOnPreRun(cb) {
    __ATPRERUN__.unshift(cb);
  }
  function addOnPostRun(cb) {
    __ATPOSTRUN__.unshift(cb);
  }
  var Math_abs = Math.abs;
  var Math_ceil = Math.ceil;
  var Math_floor = Math.floor;
  var Math_min = Math.min;
  var runDependencies = 0;
  var runDependencyWatcher = null;
  var dependenciesFulfilled = null;
  function addRunDependency(id2) {
    runDependencies++;
    if (Module["monitorRunDependencies"]) {
      Module["monitorRunDependencies"](runDependencies);
    }
  }
  function removeRunDependency(id2) {
    runDependencies--;
    if (Module["monitorRunDependencies"]) {
      Module["monitorRunDependencies"](runDependencies);
    }
    if (runDependencies == 0) {
      if (runDependencyWatcher !== null) {
        clearInterval(runDependencyWatcher);
        runDependencyWatcher = null;
      }
      if (dependenciesFulfilled) {
        var callback = dependenciesFulfilled;
        dependenciesFulfilled = null;
        callback();
      }
    }
  }
  Module["preloadedImages"] = {};
  Module["preloadedAudios"] = {};
  var memoryInitializer = null;
  var dataURIPrefix = "data:application/octet-stream;base64,";
  function isDataURI(filename) {
    return String.prototype.startsWith ? filename.startsWith(dataURIPrefix) : filename.indexOf(dataURIPrefix) === 0;
  }
  var tempDouble;
  var tempI64;
  memoryInitializer = "data:application/octet-stream;base64,AAAAAAAAAAAAAAAAAQAAAAIAAAADAAAABAAAAAUAAAAGAAAAAQAAAAQAAAADAAAABgAAAAUAAAACAAAAAAAAAAIAAAADAAAAAQAAAAQAAAAGAAAAAAAAAAUAAAADAAAABgAAAAQAAAAFAAAAAAAAAAEAAAACAAAABAAAAAUAAAAGAAAAAAAAAAIAAAADAAAAAQAAAAUAAAACAAAAAAAAAAEAAAADAAAABgAAAAQAAAAGAAAAAAAAAAUAAAACAAAAAQAAAAQAAAADAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAEAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAIAAAADAAAAAAAAAAAAAAACAAAAAAAAAAEAAAADAAAAAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAABAAAAAYAAAAAAAAABQAAAAAAAAAAAAAABAAAAAUAAAAAAAAAAAAAAAAAAAACAAAAAAAAAAYAAAAAAAAABgAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAgAAAAMAAAAEAAAABQAAAAYAAAABAAAAAgAAAAMAAAAEAAAABQAAAAYAAAAAAAAAAgAAAAMAAAAEAAAABQAAAAYAAAAAAAAAAQAAAAMAAAAEAAAABQAAAAYAAAAAAAAAAQAAAAIAAAAEAAAABQAAAAYAAAAAAAAAAQAAAAIAAAADAAAABQAAAAYAAAAAAAAAAQAAAAIAAAADAAAABAAAAAYAAAAAAAAAAQAAAAIAAAADAAAABAAAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAwAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAgAAAAIAAAAAAAAAAAAAAAYAAAAAAAAAAwAAAAIAAAADAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAFAAAABAAAAAAAAAABAAAAAAAAAAAAAAAFAAAABQAAAAAAAAAAAAAAAAAAAAYAAAAAAAAABAAAAAAAAAAGAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAFAAAAAgAAAAQAAAADAAAACAAAAAEAAAAHAAAABgAAAAkAAAAAAAAAAwAAAAIAAAACAAAABgAAAAoAAAALAAAAAAAAAAEAAAAFAAAAAwAAAA0AAAABAAAABwAAAAQAAAAMAAAAAAAAAAQAAAB/AAAADwAAAAgAAAADAAAAAAAAAAwAAAAFAAAAAgAAABIAAAAKAAAACAAAAAAAAAAQAAAABgAAAA4AAAALAAAAEQAAAAEAAAAJAAAAAgAAAAcAAAAVAAAACQAAABMAAAADAAAADQAAAAEAAAAIAAAABQAAABYAAAAQAAAABAAAAAAAAAAPAAAACQAAABMAAAAOAAAAFAAAAAEAAAAHAAAABgAAAAoAAAALAAAAGAAAABcAAAAFAAAAAgAAABIAAAALAAAAEQAAABcAAAAZAAAAAgAAAAYAAAAKAAAADAAAABwAAAANAAAAGgAAAAQAAAAPAAAAAwAAAA0AAAAaAAAAFQAAAB0AAAADAAAADAAAAAcAAAAOAAAAfwAAABEAAAAbAAAACQAAABQAAAAGAAAADwAAABYAAAAcAAAAHwAAAAQAAAAIAAAADAAAABAAAAASAAAAIQAAAB4AAAAIAAAABQAAABYAAAARAAAACwAAAA4AAAAGAAAAIwAAABkAAAAbAAAAEgAAABgAAAAeAAAAIAAAAAUAAAAKAAAAEAAAABMAAAAiAAAAFAAAACQAAAAHAAAAFQAAAAkAAAAUAAAADgAAABMAAAAJAAAAKAAAABsAAAAkAAAAFQAAACYAAAATAAAAIgAAAA0AAAAdAAAABwAAABYAAAAQAAAAKQAAACEAAAAPAAAACAAAAB8AAAAXAAAAGAAAAAsAAAAKAAAAJwAAACUAAAAZAAAAGAAAAH8AAAAgAAAAJQAAAAoAAAAXAAAAEgAAABkAAAAXAAAAEQAAAAsAAAAtAAAAJwAAACMAAAAaAAAAKgAAAB0AAAArAAAADAAAABwAAAANAAAAGwAAACgAAAAjAAAALgAAAA4AAAAUAAAAEQAAABwAAAAfAAAAKgAAACwAAAAMAAAADwAAABoAAAAdAAAAKwAAACYAAAAvAAAADQAAABoAAAAVAAAAHgAAACAAAAAwAAAAMgAAABAAAAASAAAAIQAAAB8AAAApAAAALAAAADUAAAAPAAAAFgAAABwAAAAgAAAAHgAAABgAAAASAAAANAAAADIAAAAlAAAAIQAAAB4AAAAxAAAAMAAAABYAAAAQAAAAKQAAACIAAAATAAAAJgAAABUAAAA2AAAAJAAAADMAAAAjAAAALgAAAC0AAAA4AAAAEQAAABsAAAAZAAAAJAAAABQAAAAiAAAAEwAAADcAAAAoAAAANgAAACUAAAAnAAAANAAAADkAAAAYAAAAFwAAACAAAAAmAAAAfwAAACIAAAAzAAAAHQAAAC8AAAAVAAAAJwAAACUAAAAZAAAAFwAAADsAAAA5AAAALQAAACgAAAAbAAAAJAAAABQAAAA8AAAALgAAADcAAAApAAAAMQAAADUAAAA9AAAAFgAAACEAAAAfAAAAKgAAADoAAAArAAAAPgAAABwAAAAsAAAAGgAAACsAAAA+AAAALwAAAEAAAAAaAAAAKgAAAB0AAAAsAAAANQAAADoAAABBAAAAHAAAAB8AAAAqAAAALQAAACcAAAAjAAAAGQAAAD8AAAA7AAAAOAAAAC4AAAA8AAAAOAAAAEQAAAAbAAAAKAAAACMAAAAvAAAAJgAAACsAAAAdAAAARQAAADMAAABAAAAAMAAAADEAAAAeAAAAIQAAAEMAAABCAAAAMgAAADEAAAB/AAAAPQAAAEIAAAAhAAAAMAAAACkAAAAyAAAAMAAAACAAAAAeAAAARgAAAEMAAAA0AAAAMwAAAEUAAAA2AAAARwAAACYAAAAvAAAAIgAAADQAAAA5AAAARgAAAEoAAAAgAAAAJQAAADIAAAA1AAAAPQAAAEEAAABLAAAAHwAAACkAAAAsAAAANgAAAEcAAAA3AAAASQAAACIAAAAzAAAAJAAAADcAAAAoAAAANgAAACQAAABIAAAAPAAAAEkAAAA4AAAARAAAAD8AAABNAAAAIwAAAC4AAAAtAAAAOQAAADsAAABKAAAATgAAACUAAAAnAAAANAAAADoAAAB/AAAAPgAAAEwAAAAsAAAAQQAAACoAAAA7AAAAPwAAAE4AAABPAAAAJwAAAC0AAAA5AAAAPAAAAEgAAABEAAAAUAAAACgAAAA3AAAALgAAAD0AAAA1AAAAMQAAACkAAABRAAAASwAAAEIAAAA+AAAAKwAAADoAAAAqAAAAUgAAAEAAAABMAAAAPwAAAH8AAAA4AAAALQAAAE8AAAA7AAAATQAAAEAAAAAvAAAAPgAAACsAAABUAAAARQAAAFIAAABBAAAAOgAAADUAAAAsAAAAVgAAAEwAAABLAAAAQgAAAEMAAABRAAAAVQAAADEAAAAwAAAAPQAAAEMAAABCAAAAMgAAADAAAABXAAAAVQAAAEYAAABEAAAAOAAAADwAAAAuAAAAWgAAAE0AAABQAAAARQAAADMAAABAAAAALwAAAFkAAABHAAAAVAAAAEYAAABDAAAANAAAADIAAABTAAAAVwAAAEoAAABHAAAAWQAAAEkAAABbAAAAMwAAAEUAAAA2AAAASAAAAH8AAABJAAAANwAAAFAAAAA8AAAAWAAAAEkAAABbAAAASAAAAFgAAAA2AAAARwAAADcAAABKAAAATgAAAFMAAABcAAAANAAAADkAAABGAAAASwAAAEEAAAA9AAAANQAAAF4AAABWAAAAUQAAAEwAAABWAAAAUgAAAGAAAAA6AAAAQQAAAD4AAABNAAAAPwAAAEQAAAA4AAAAXQAAAE8AAABaAAAATgAAAEoAAAA7AAAAOQAAAF8AAABcAAAATwAAAE8AAABOAAAAPwAAADsAAABdAAAAXwAAAE0AAABQAAAARAAAAEgAAAA8AAAAYwAAAFoAAABYAAAAUQAAAFUAAABeAAAAZQAAAD0AAABCAAAASwAAAFIAAABgAAAAVAAAAGIAAAA+AAAATAAAAEAAAABTAAAAfwAAAEoAAABGAAAAZAAAAFcAAABcAAAAVAAAAEUAAABSAAAAQAAAAGEAAABZAAAAYgAAAFUAAABXAAAAZQAAAGYAAABCAAAAQwAAAFEAAABWAAAATAAAAEsAAABBAAAAaAAAAGAAAABeAAAAVwAAAFMAAABmAAAAZAAAAEMAAABGAAAAVQAAAFgAAABIAAAAWwAAAEkAAABjAAAAUAAAAGkAAABZAAAAYQAAAFsAAABnAAAARQAAAFQAAABHAAAAWgAAAE0AAABQAAAARAAAAGoAAABdAAAAYwAAAFsAAABJAAAAWQAAAEcAAABpAAAAWAAAAGcAAABcAAAAUwAAAE4AAABKAAAAbAAAAGQAAABfAAAAXQAAAE8AAABaAAAATQAAAG0AAABfAAAAagAAAF4AAABWAAAAUQAAAEsAAABrAAAAaAAAAGUAAABfAAAAXAAAAE8AAABOAAAAbQAAAGwAAABdAAAAYAAAAGgAAABiAAAAbgAAAEwAAABWAAAAUgAAAGEAAAB/AAAAYgAAAFQAAABnAAAAWQAAAG8AAABiAAAAbgAAAGEAAABvAAAAUgAAAGAAAABUAAAAYwAAAFAAAABpAAAAWAAAAGoAAABaAAAAcQAAAGQAAABmAAAAUwAAAFcAAABsAAAAcgAAAFwAAABlAAAAZgAAAGsAAABwAAAAUQAAAFUAAABeAAAAZgAAAGUAAABXAAAAVQAAAHIAAABwAAAAZAAAAGcAAABbAAAAYQAAAFkAAAB0AAAAaQAAAG8AAABoAAAAawAAAG4AAABzAAAAVgAAAF4AAABgAAAAaQAAAFgAAABnAAAAWwAAAHEAAABjAAAAdAAAAGoAAABdAAAAYwAAAFoAAAB1AAAAbQAAAHEAAABrAAAAfwAAAGUAAABeAAAAcwAAAGgAAABwAAAAbAAAAGQAAABfAAAAXAAAAHYAAAByAAAAbQAAAG0AAABsAAAAXQAAAF8AAAB1AAAAdgAAAGoAAABuAAAAYgAAAGgAAABgAAAAdwAAAG8AAABzAAAAbwAAAGEAAABuAAAAYgAAAHQAAABnAAAAdwAAAHAAAABrAAAAZgAAAGUAAAB4AAAAcwAAAHIAAABxAAAAYwAAAHQAAABpAAAAdQAAAGoAAAB5AAAAcgAAAHAAAABkAAAAZgAAAHYAAAB4AAAAbAAAAHMAAABuAAAAawAAAGgAAAB4AAAAdwAAAHAAAAB0AAAAZwAAAHcAAABvAAAAcQAAAGkAAAB5AAAAdQAAAH8AAABtAAAAdgAAAHEAAAB5AAAAagAAAHYAAAB4AAAAbAAAAHIAAAB1AAAAeQAAAG0AAAB3AAAAbwAAAHMAAABuAAAAeQAAAHQAAAB4AAAAeAAAAHMAAAByAAAAcAAAAHkAAAB3AAAAdgAAAHkAAAB0AAAAeAAAAHcAAAB1AAAAcQAAAHYAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAABAAAABQAAAAEAAAAAAAAAAAAAAAEAAAAAAAAAAQAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAACAAAABQAAAAEAAAAAAAAA/////wEAAAAAAAAAAwAAAAQAAAACAAAAAAAAAAAAAAABAAAAAAAAAAEAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAMAAAAFAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAAAAAAFAAAAAQAAAAAAAAAAAAAAAQAAAAMAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAEAAAADAAAAAAAAAAAAAAABAAAAAAAAAAMAAAADAAAAAwAAAAAAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAADAAAABQAAAAEAAAAAAAAAAAAAAAEAAAAAAAAAAQAAAAAAAAABAAAAAAAAAP////8DAAAAAAAAAAUAAAACAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAEAAAABQAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAMAAAADAAAAAwAAAAMAAAAAAAAAAwAAAAAAAAAAAAAAAAAAAAMAAAAFAAAABQAAAAAAAAAAAAAAAwAAAAMAAAADAAAAAAAAAAAAAAAAAAAAAAAAAAMAAAADAAAAAwAAAAAAAAADAAAAAAAAAAAAAAAAAAAAAAAAAAMAAAAFAAAABQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAQAAAAAAAAABAAAAAAAAAAMAAAADAAAAAwAAAAAAAAADAAAAAAAAAAAAAAD/////AwAAAAAAAAAFAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAADAAAAAAAAAAAAAAADAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAADAAAAAAAAAAAAAAAAAAAAAwAAAAMAAAAAAAAAAAAAAAEAAAAAAAAAAQAAAAAAAAABAAAAAAAAAAAAAAABAAAAAwAAAAAAAAAAAAAAAQAAAAAAAAADAAAAAwAAAAMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAMAAAADAAAAAwAAAAMAAAAAAAAAAwAAAAAAAAAAAAAAAQAAAAMAAAAAAAAAAAAAAAEAAAAAAAAAAwAAAAMAAAADAAAAAwAAAAAAAAADAAAAAAAAAAAAAAADAAAAAAAAAAMAAAAAAAAAAwAAAAAAAAAAAAAAAAAAAAMAAAAAAAAAAAAAAAMAAAAAAAAAAwAAAAAAAAAAAAAAAAAAAAMAAAADAAAAAAAAAP////8DAAAAAAAAAAUAAAACAAAAAAAAAAAAAAADAAAAAAAAAAAAAAADAAAAAwAAAAAAAAAAAAAAAwAAAAAAAAAAAAAAAwAAAAMAAAAAAAAAAAAAAAAAAAAAAAAAAwAAAAUAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAMAAAAFAAAABQAAAAAAAAAAAAAAAwAAAAMAAAADAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAwAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAwAAAAAAAAAAAAAAAwAAAAMAAAAAAAAAAAAAAAAAAAADAAAAAAAAAAMAAAAAAAAAAAAAAAMAAAADAAAAAwAAAAAAAAADAAAAAAAAAAAAAAADAAAAAwAAAAMAAAAAAAAAAwAAAAAAAAAAAAAA/////wMAAAAAAAAABQAAAAIAAAAAAAAAAAAAAAAAAAAAAAAAAwAAAAAAAAAAAAAAAwAAAAAAAAADAAAAAAAAAAAAAAAAAAAAAwAAAAMAAAAAAAAAAAAAAAMAAAAAAAAAAwAAAAAAAAADAAAAAAAAAAMAAAADAAAAAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwAAAAAAAAADAAAAAAAAAAMAAAAAAAAAAAAAAAMAAAAAAAAAAAAAAAMAAAADAAAAAAAAAAMAAAADAAAAAwAAAAAAAAAAAAAAAwAAAAAAAAAAAAAAAAAAAAMAAAAAAAAAAwAAAAAAAAAAAAAA/////wMAAAAAAAAABQAAAAIAAAAAAAAAAAAAAAMAAAADAAAAAwAAAAMAAAADAAAAAAAAAAAAAAADAAAAAwAAAAMAAAADAAAAAwAAAAAAAAAAAAAAAwAAAAMAAAADAAAAAwAAAAAAAAADAAAAAAAAAAMAAAADAAAAAwAAAAMAAAAAAAAAAwAAAAAAAAD/////AwAAAAAAAAAFAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAADAAAAAAAAAAAAAAADAAAAAAAAAAMAAAADAAAAAwAAAAAAAAADAAAAAAAAAAAAAAADAAAAAAAAAAAAAAAAAAAAAwAAAAMAAAAAAAAAAwAAAAAAAAAAAAAAAwAAAAMAAAAAAAAAAAAAAAMAAAADAAAAAwAAAAAAAAAAAAAAAAAAAAAAAAADAAAAAAAAAAAAAAADAAAAAwAAAAAAAAAAAAAAAAAAAAMAAAAAAAAAAAAAAAMAAAADAAAAAAAAAAAAAAAAAAAAAwAAAAAAAAADAAAAAAAAAAAAAAD/////AwAAAAAAAAAFAAAAAgAAAAAAAAAAAAAAAwAAAAMAAAADAAAAAAAAAAAAAAADAAAAAAAAAAMAAAADAAAAAwAAAAAAAAAAAAAAAwAAAAAAAAAAAAAAAAAAAAMAAAAAAAAAAAAAAAMAAAAAAAAAAwAAAAAAAAAAAAAAAAAAAAMAAAADAAAAAAAAAAAAAAAAAAAAAwAAAAAAAAAFAAAAAAAAAAAAAAADAAAAAwAAAAMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAADAAAAAQAAAAAAAAABAAAAAAAAAAAAAAABAAAAAwAAAAEAAAAAAAAAAQAAAAAAAAAAAAAAAwAAAAAAAAADAAAAAAAAAAMAAAAAAAAAAAAAAAMAAAAAAAAAAwAAAAAAAAADAAAAAAAAAP////8DAAAAAAAAAAUAAAACAAAAAAAAAAAAAAAAAAAAAwAAAAAAAAAAAAAAAwAAAAMAAAAAAAAAAAAAAAAAAAADAAAAAAAAAAMAAAAAAAAAAAAAAAMAAAAAAAAAAAAAAAMAAAADAAAAAAAAAAAAAAADAAAAAwAAAAMAAAADAAAAAwAAAAAAAAAAAAAAAAAAAAAAAAADAAAAAAAAAAUAAAAAAAAAAAAAAAMAAAADAAAAAwAAAAMAAAADAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAwAAAAMAAAADAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwAAAAAAAAAFAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAFAAAABQAAAAAAAAAAAAAAAAAAAAMAAAAAAAAAAAAAAAMAAAADAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAMAAAAAAAAAAwAAAAAAAAAAAAAA/////wMAAAAAAAAABQAAAAIAAAAAAAAAAAAAAAMAAAADAAAAAwAAAAAAAAAAAAAAAwAAAAAAAAAFAAAAAAAAAAAAAAAFAAAABQAAAAAAAAAAAAAAAAAAAAEAAAADAAAAAQAAAAAAAAABAAAAAAAAAAMAAAADAAAAAwAAAAAAAAAAAAAAAwAAAAAAAAADAAAAAwAAAAMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAADAAAAAQAAAAAAAAABAAAAAAAAAAMAAAADAAAAAwAAAAMAAAADAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAEAAAAAAAAAAwAAAAUAAAABAAAAAAAAAP////8DAAAAAAAAAAUAAAACAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAFAAAABQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAABAAAAAUAAAABAAAAAAAAAAMAAAADAAAAAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAAAAAAAAABQAAAAAAAAAAAAAAAAAAAAAAAAADAAAAAAAAAAUAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAIAAAAFAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAEAAAADAAAAAQAAAAAAAAABAAAAAAAAAAUAAAAAAAAAAAAAAAUAAAAFAAAAAAAAAAAAAAD/////AQAAAAAAAAADAAAABAAAAAIAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAUAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAFAAAAAAAAAAAAAAAFAAAABQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAQAAAAUAAAABAAAAAAAAAAAAAAABAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAEAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAAAAAAAAAAAAAEAAAD//////////wEAAAABAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAQAAAAEAAAAAAAAAAAAAAAAAAAADAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwAAAAEAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAsAAAACAAAAAAAAAAAAAAABAAAAAgAAAAYAAAAEAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAYAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAgAAAAAAAAABAAAAAQAAAAAAAAAAAAAAAAAAAAcAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAACAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAYAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAKAAAAAgAAAAAAAAAAAAAAAQAAAAEAAAAFAAAABgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAEAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAMAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAABAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAABwAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAsAAAABAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAHAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACgAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwAAAACAAAAAAAAAAAAAAABAAAAAwAAAAcAAAAGAAAAAQAAAAAAAAABAAAAAAAAAAAAAAAAAAAABwAAAAEAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAADAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAwAAAAAAAAABAAAAAQAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAGAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAADgAAAAIAAAAAAAAAAAAAAAEAAAAAAAAACQAAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACgAAAAEAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAQAAAAEAAAAAAAAAAAAAAAAAAAAMAAAAAQAAAAEAAAAAAAAAAAAAAAAAAAAAAAAABwAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAsAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADQAAAAIAAAAAAAAAAAAAAAEAAAAEAAAACAAAAAoAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAALAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAACQAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAGAAAAAgAAAAAAAAAAAAAAAQAAAAsAAAAPAAAACAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAkAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAOAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAAAAEAAAAAAAAAAQAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAQAAAAEAAAAAAAAAAAAAAAAAAAAIAAAAAQAAAAAAAAABAAAAAAAAAAAAAAAAAAAABQAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHAAAAAgAAAAAAAAAAAAAAAQAAAAwAAAAQAAAADAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAoAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADQAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAPAAAAAAAAAAEAAAABAAAAAAAAAAAAAAAAAAAADwAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAOAAAAAQAAAAEAAAAAAAAAAAAAAAAAAAAAAAAADQAAAAEAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAACAAAAAAAAAAAAAAABAAAACgAAABMAAAAIAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAkAAAABAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAOAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAEQAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAwAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEQAAAAAAAAABAAAAAQAAAAAAAAAAAAAAAAAAAA8AAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAQAAAAAQAAAAAAAAABAAAAAAAAAAAAAAAAAAAACQAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAANAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAAAAIAAAAAAAAAAAAAAAEAAAANAAAAEQAAAA0AAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAARAAAAAQAAAAAAAAABAAAAAAAAAAAAAAAAAAAAEwAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAA4AAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAATAAAAAAAAAAEAAAABAAAAAAAAAAAAAAAAAAAAEQAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAA0AAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAARAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAkAAAACAAAAAAAAAAAAAAABAAAADgAAABIAAAAPAAAAAQAAAAAAAAABAAAAAAAAAAAAAAAAAAAADwAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABIAAAAAAAAAAQAAAAEAAAAAAAAAAAAAAAAAAAASAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAEwAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAABEAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAATAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEgAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAABIAAAABAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAATAAAAAgAAAAAAAAAAAAAAAQAAAP//////////EwAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAATAAAAAQAAAAAAAAABAAAAAAAAAAAAAAAAAAAAEgAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAASAAAAAAAAABgAAAAAAAAAIQAAAAAAAAAeAAAAAAAAACAAAAADAAAAMQAAAAEAAAAwAAAAAwAAADIAAAADAAAACAAAAAAAAAAFAAAABQAAAAoAAAAFAAAAFgAAAAAAAAAQAAAAAAAAABIAAAAAAAAAKQAAAAEAAAAhAAAAAAAAAB4AAAAAAAAABAAAAAAAAAAAAAAABQAAAAIAAAAFAAAADwAAAAEAAAAIAAAAAAAAAAUAAAAFAAAAHwAAAAEAAAAWAAAAAAAAABAAAAAAAAAAAgAAAAAAAAAGAAAAAAAAAA4AAAAAAAAACgAAAAAAAAALAAAAAAAAABEAAAADAAAAGAAAAAEAAAAXAAAAAwAAABkAAAADAAAAAAAAAAAAAAABAAAABQAAAAkAAAAFAAAABQAAAAAAAAACAAAAAAAAAAYAAAAAAAAAEgAAAAEAAAAKAAAAAAAAAAsAAAAAAAAABAAAAAEAAAADAAAABQAAAAcAAAAFAAAACAAAAAEAAAAAAAAAAAAAAAEAAAAFAAAAEAAAAAEAAAAFAAAAAAAAAAIAAAAAAAAABwAAAAAAAAAVAAAAAAAAACYAAAAAAAAACQAAAAAAAAATAAAAAAAAACIAAAADAAAADgAAAAEAAAAUAAAAAwAAACQAAAADAAAAAwAAAAAAAAANAAAABQAAAB0AAAAFAAAAAQAAAAAAAAAHAAAAAAAAABUAAAAAAAAABgAAAAEAAAAJAAAAAAAAABMAAAAAAAAABAAAAAIAAAAMAAAABQAAABoAAAAFAAAAAAAAAAEAAAADAAAAAAAAAA0AAAAFAAAAAgAAAAEAAAABAAAAAAAAAAcAAAAAAAAAGgAAAAAAAAAqAAAAAAAAADoAAAAAAAAAHQAAAAAAAAArAAAAAAAAAD4AAAADAAAAJgAAAAEAAAAvAAAAAwAAAEAAAAADAAAADAAAAAAAAAAcAAAABQAAACwAAAAFAAAADQAAAAAAAAAaAAAAAAAAACoAAAAAAAAAFQAAAAEAAAAdAAAAAAAAACsAAAAAAAAABAAAAAMAAAAPAAAABQAAAB8AAAAFAAAAAwAAAAEAAAAMAAAAAAAAABwAAAAFAAAABwAAAAEAAAANAAAAAAAAABoAAAAAAAAAHwAAAAAAAAApAAAAAAAAADEAAAAAAAAALAAAAAAAAAA1AAAAAAAAAD0AAAADAAAAOgAAAAEAAABBAAAAAwAAAEsAAAADAAAADwAAAAAAAAAWAAAABQAAACEAAAAFAAAAHAAAAAAAAAAfAAAAAAAAACkAAAAAAAAAKgAAAAEAAAAsAAAAAAAAADUAAAAAAAAABAAAAAQAAAAIAAAABQAAABAAAAAFAAAADAAAAAEAAAAPAAAAAAAAABYAAAAFAAAAGgAAAAEAAAAcAAAAAAAAAB8AAAAAAAAAMgAAAAAAAAAwAAAAAAAAADEAAAADAAAAIAAAAAAAAAAeAAAAAwAAACEAAAADAAAAGAAAAAMAAAASAAAAAwAAABAAAAADAAAARgAAAAAAAABDAAAAAAAAAEIAAAADAAAANAAAAAMAAAAyAAAAAAAAADAAAAAAAAAAJQAAAAMAAAAgAAAAAAAAAB4AAAADAAAAUwAAAAAAAABXAAAAAwAAAFUAAAADAAAASgAAAAMAAABGAAAAAAAAAEMAAAAAAAAAOQAAAAEAAAA0AAAAAwAAADIAAAAAAAAAGQAAAAAAAAAXAAAAAAAAABgAAAADAAAAEQAAAAAAAAALAAAAAwAAAAoAAAADAAAADgAAAAMAAAAGAAAAAwAAAAIAAAADAAAALQAAAAAAAAAnAAAAAAAAACUAAAADAAAAIwAAAAMAAAAZAAAAAAAAABcAAAAAAAAAGwAAAAMAAAARAAAAAAAAAAsAAAADAAAAPwAAAAAAAAA7AAAAAwAAADkAAAADAAAAOAAAAAMAAAAtAAAAAAAAACcAAAAAAAAALgAAAAMAAAAjAAAAAwAAABkAAAAAAAAAJAAAAAAAAAAUAAAAAAAAAA4AAAADAAAAIgAAAAAAAAATAAAAAwAAAAkAAAADAAAAJgAAAAMAAAAVAAAAAwAAAAcAAAADAAAANwAAAAAAAAAoAAAAAAAAABsAAAADAAAANgAAAAMAAAAkAAAAAAAAABQAAAAAAAAAMwAAAAMAAAAiAAAAAAAAABMAAAADAAAASAAAAAAAAAA8AAAAAwAAAC4AAAADAAAASQAAAAMAAAA3AAAAAAAAACgAAAAAAAAARwAAAAMAAAA2AAAAAwAAACQAAAAAAAAAQAAAAAAAAAAvAAAAAAAAACYAAAADAAAAPgAAAAAAAAArAAAAAwAAAB0AAAADAAAAOgAAAAMAAAAqAAAAAwAAABoAAAADAAAAVAAAAAAAAABFAAAAAAAAADMAAAADAAAAUgAAAAMAAABAAAAAAAAAAC8AAAAAAAAATAAAAAMAAAA+AAAAAAAAACsAAAADAAAAYQAAAAAAAABZAAAAAwAAAEcAAAADAAAAYgAAAAMAAABUAAAAAAAAAEUAAAAAAAAAYAAAAAMAAABSAAAAAwAAAEAAAAAAAAAASwAAAAAAAABBAAAAAAAAADoAAAADAAAAPQAAAAAAAAA1AAAAAwAAACwAAAADAAAAMQAAAAMAAAApAAAAAwAAAB8AAAADAAAAXgAAAAAAAABWAAAAAAAAAEwAAAADAAAAUQAAAAMAAABLAAAAAAAAAEEAAAAAAAAAQgAAAAMAAAA9AAAAAAAAADUAAAADAAAAawAAAAAAAABoAAAAAwAAAGAAAAADAAAAZQAAAAMAAABeAAAAAAAAAFYAAAAAAAAAVQAAAAMAAABRAAAAAwAAAEsAAAAAAAAAOQAAAAAAAAA7AAAAAAAAAD8AAAADAAAASgAAAAAAAABOAAAAAwAAAE8AAAADAAAAUwAAAAMAAABcAAAAAwAAAF8AAAADAAAAJQAAAAAAAAAnAAAAAwAAAC0AAAADAAAANAAAAAAAAAA5AAAAAAAAADsAAAAAAAAARgAAAAMAAABKAAAAAAAAAE4AAAADAAAAGAAAAAAAAAAXAAAAAwAAABkAAAADAAAAIAAAAAMAAAAlAAAAAAAAACcAAAADAAAAMgAAAAMAAAA0AAAAAAAAADkAAAAAAAAALgAAAAAAAAA8AAAAAAAAAEgAAAADAAAAOAAAAAAAAABEAAAAAwAAAFAAAAADAAAAPwAAAAMAAABNAAAAAwAAAFoAAAADAAAAGwAAAAAAAAAoAAAAAwAAADcAAAADAAAAIwAAAAAAAAAuAAAAAAAAADwAAAAAAAAALQAAAAMAAAA4AAAAAAAAAEQAAAADAAAADgAAAAAAAAAUAAAAAwAAACQAAAADAAAAEQAAAAMAAAAbAAAAAAAAACgAAAADAAAAGQAAAAMAAAAjAAAAAAAAAC4AAAAAAAAARwAAAAAAAABZAAAAAAAAAGEAAAADAAAASQAAAAAAAABbAAAAAwAAAGcAAAADAAAASAAAAAMAAABYAAAAAwAAAGkAAAADAAAAMwAAAAAAAABFAAAAAwAAAFQAAAADAAAANgAAAAAAAABHAAAAAAAAAFkAAAAAAAAANwAAAAMAAABJAAAAAAAAAFsAAAADAAAAJgAAAAAAAAAvAAAAAwAAAEAAAAADAAAAIgAAAAMAAAAzAAAAAAAAAEUAAAADAAAAJAAAAAMAAAA2AAAAAAAAAEcAAAAAAAAAYAAAAAAAAABoAAAAAAAAAGsAAAADAAAAYgAAAAAAAABuAAAAAwAAAHMAAAADAAAAYQAAAAMAAABvAAAAAwAAAHcAAAADAAAATAAAAAAAAABWAAAAAwAAAF4AAAADAAAAUgAAAAAAAABgAAAAAAAAAGgAAAAAAAAAVAAAAAMAAABiAAAAAAAAAG4AAAADAAAAOgAAAAAAAABBAAAAAwAAAEsAAAADAAAAPgAAAAMAAABMAAAAAAAAAFYAAAADAAAAQAAAAAMAAABSAAAAAAAAAGAAAAAAAAAAVQAAAAAAAABXAAAAAAAAAFMAAAADAAAAZQAAAAAAAABmAAAAAwAAAGQAAAADAAAAawAAAAMAAABwAAAAAwAAAHIAAAADAAAAQgAAAAAAAABDAAAAAwAAAEYAAAADAAAAUQAAAAAAAABVAAAAAAAAAFcAAAAAAAAAXgAAAAMAAABlAAAAAAAAAGYAAAADAAAAMQAAAAAAAAAwAAAAAwAAADIAAAADAAAAPQAAAAMAAABCAAAAAAAAAEMAAAADAAAASwAAAAMAAABRAAAAAAAAAFUAAAAAAAAAXwAAAAAAAABcAAAAAAAAAFMAAAAAAAAATwAAAAAAAABOAAAAAAAAAEoAAAADAAAAPwAAAAEAAAA7AAAAAwAAADkAAAADAAAAbQAAAAAAAABsAAAAAAAAAGQAAAAFAAAAXQAAAAEAAABfAAAAAAAAAFwAAAAAAAAATQAAAAEAAABPAAAAAAAAAE4AAAAAAAAAdQAAAAQAAAB2AAAABQAAAHIAAAAFAAAAagAAAAEAAABtAAAAAAAAAGwAAAAAAAAAWgAAAAEAAABdAAAAAQAAAF8AAAAAAAAAWgAAAAAAAABNAAAAAAAAAD8AAAAAAAAAUAAAAAAAAABEAAAAAAAAADgAAAADAAAASAAAAAEAAAA8AAAAAwAAAC4AAAADAAAAagAAAAAAAABdAAAAAAAAAE8AAAAFAAAAYwAAAAEAAABaAAAAAAAAAE0AAAAAAAAAWAAAAAEAAABQAAAAAAAAAEQAAAAAAAAAdQAAAAMAAABtAAAABQAAAF8AAAAFAAAAcQAAAAEAAABqAAAAAAAAAF0AAAAAAAAAaQAAAAEAAABjAAAAAQAAAFoAAAAAAAAAaQAAAAAAAABYAAAAAAAAAEgAAAAAAAAAZwAAAAAAAABbAAAAAAAAAEkAAAADAAAAYQAAAAEAAABZAAAAAwAAAEcAAAADAAAAcQAAAAAAAABjAAAAAAAAAFAAAAAFAAAAdAAAAAEAAABpAAAAAAAAAFgAAAAAAAAAbwAAAAEAAABnAAAAAAAAAFsAAAAAAAAAdQAAAAIAAABqAAAABQAAAFoAAAAFAAAAeQAAAAEAAABxAAAAAAAAAGMAAAAAAAAAdwAAAAEAAAB0AAAAAQAAAGkAAAAAAAAAdwAAAAAAAABvAAAAAAAAAGEAAAAAAAAAcwAAAAAAAABuAAAAAAAAAGIAAAADAAAAawAAAAEAAABoAAAAAwAAAGAAAAADAAAAeQAAAAAAAAB0AAAAAAAAAGcAAAAFAAAAeAAAAAEAAAB3AAAAAAAAAG8AAAAAAAAAcAAAAAEAAABzAAAAAAAAAG4AAAAAAAAAdQAAAAEAAABxAAAABQAAAGkAAAAFAAAAdgAAAAEAAAB5AAAAAAAAAHQAAAAAAAAAcgAAAAEAAAB4AAAAAQAAAHcAAAAAAAAAcgAAAAAAAABwAAAAAAAAAGsAAAAAAAAAZAAAAAAAAABmAAAAAAAAAGUAAAADAAAAUwAAAAEAAABXAAAAAwAAAFUAAAADAAAAdgAAAAAAAAB4AAAAAAAAAHMAAAAFAAAAbAAAAAEAAAByAAAAAAAAAHAAAAAAAAAAXAAAAAEAAABkAAAAAAAAAGYAAAAAAAAAdQAAAAAAAAB5AAAABQAAAHcAAAAFAAAAbQAAAAEAAAB2AAAAAAAAAHgAAAAAAAAAXwAAAAEAAABsAAAAAQAAAHIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAEAAAAAAAAAAAAAAAEAAAABAAAAAQAAAAAAAAAAAAAAAQAAAAAAAAABAAAAAQAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAAAAGAAAAAgAAAAUAAAABAAAABAAAAAAAAAAAAAAABQAAAAMAAAABAAAABgAAAAQAAAACAAAAAAAAAH6iBfbytuk/Gq6akm/58z/Xrm0Liez0P5doSdOpSwRAWs602ULg8D/dT7Rcbo/1v1N1RQHFNOM/g9Snx7HW3L8HWsP8Q3jfP6VwOLosutk/9rjk1YQcxj+gnmKMsNn6P/HDeuPFY+M/YHwDjqKhB0Ci19/fCVrbP4UxKkDWOP6/pvljWa09tL9wi7wrQXjnv/Z6yLImkM2/3yTlOzY14D+m+WNZrT20PzwKVQnrQwNA9nrIsiaQzT/g40rFrRQFwPa45NWEHMa/kbslHEZq97/xw3rjxWPjv4cLC2SMBci/otff3wla27+rKF5oIAv0P1N1RQHFNOO/iDJPGyWHBUAHWsP8Q3jfvwQf/by16gXAfqIF9vK26b8XrO0Vh0r+v9eubQuJ7PS/BxLrA0ZZ479azrTZQuDwv1MK1EuItPw/yscgV9Z6FkAwHBR2WjQMQJNRzXsQ5vY/GlUHVJYKF0DONuFv2lMNQNCGZ28QJfk/0WUwoIL36D8ggDOMQuATQNqMOeAy/wZAWFYOYM+M2z/LWC4uH3oSQDE+LyTsMgRAkJzhRGWFGEDd4soovCQQQKqk0DJMEP8/rGmNdwOLBUAW2X/9xCbjP4hu3dcqJhNAzuYItRvdB0CgzW3zJW/sPxotm/Y2TxRAQAk9XmdDDEC1Kx9MKgT3P1M+NctcghZAFVqcLlb0C0Bgzd3sB2b2P77mZDPUWhZAFROHJpUGCEDAfma5CxXtPz1DWq/zYxRAmhYY5824F0DOuQKWSbAOQNCMqrvu3fs/L6DR22K2wT9nAAxPBU8RQGiN6mW43AFAZhu25b633D8c1YgmzowSQNM25BRKWARArGS08/lNxD+LFssHwmMRQLC5aNcxBgJABL9HT0WRF0CjCmJmOGEOQHsuaVzMP/s/TWJCaGGwBUCeu1PAPLzjP9nqN9DZOBNAKE4JcydbCkCGtbd1qjPzP8dgm9U8jhVAtPeKTkVwDkCeCLss5l37P401XMPLmBdAFd29VMVQDUBg0yA55h75Pz6odcYLCRdApBM4rBrkAkDyAVWgQxbRP4XDMnK20hFAymLlF7EmzD8GUgo9XBHlP3lbK7T9COc/k+OhPthhy7+YGEpnrOvCPzBFhLs15u4/epbqB6H4uz9IuuLF5svev6lzLKY31es/CaQ0envF5z8ZY0xlUADXv7zaz7HYEuI/CfbK1sn16T8uAQfWwxLWPzKn/YuFN94/5KdbC1AFu793fyCSnlfvPzK2y4doAMY/NRg5t1/X6b/shq4QJaHDP5yNIAKPOeI/vpn7BSE30r/X4YQrO6nrv78Ziv/Thto/DqJ1Y6+y5z9l51NaxFrlv8QlA65HOLS/86dxiEc96z+Hj0+LFjneP6LzBZ8LTc2/DaJ1Y6+y579l51NaxFrlP8QlA65HOLQ/8qdxiEc967+Jj0+LFjnev6LzBZ8LTc0/1qdbC1AFuz93fyCSnlfvvzK2y4doAMa/NRg5t1/X6T/vhq4QJaHDv5yNIAKPOeK/wJn7BSE30j/W4YQrO6nrP78Ziv/Thtq/CaQ0envF578XY0xlUADXP7zaz7HYEuK/CvbK1sn16b8rAQfWwxLWvzKn/YuFN96/zWLlF7EmzL8GUgo9XBHlv3lbK7T9COe/kOOhPthhyz+cGEpnrOvCvzBFhLs15u6/c5bqB6H4u79IuuLF5sveP6lzLKY31eu/AQAAAP////8HAAAA/////zEAAAD/////VwEAAP////9hCQAA/////6dBAAD/////kcsBAP/////3kAwA/////8H2VwAAAAAAAAAAAAAAAAACAAAA/////w4AAAD/////YgAAAP////+uAgAA/////8ISAAD/////ToMAAP////8ilwMA/////+4hGQD/////gu2vAAAAAAAAAAAAAAAAAAAAAAACAAAA//////////8BAAAAAwAAAP//////////////////////////////////////////////////////////////////////////AQAAAAAAAAACAAAA////////////////AwAAAP//////////////////////////////////////////////////////////////////////////AQAAAAAAAAACAAAA////////////////AwAAAP//////////////////////////////////////////////////////////////////////////AQAAAAAAAAACAAAA////////////////AwAAAP//////////////////////////////////////////////////////////AgAAAP//////////AQAAAAAAAAD/////////////////////AwAAAP////////////////////////////////////////////////////8DAAAA/////////////////////wAAAAD/////////////////////AQAAAP///////////////wIAAAD///////////////////////////////8DAAAA/////////////////////wAAAAD///////////////8CAAAAAQAAAP////////////////////////////////////////////////////8DAAAA/////////////////////wAAAAD///////////////8CAAAAAQAAAP////////////////////////////////////////////////////8DAAAA/////////////////////wAAAAD///////////////8CAAAAAQAAAP////////////////////////////////////////////////////8DAAAA/////////////////////wAAAAD///////////////8CAAAAAQAAAP////////////////////////////////////////////////////8BAAAAAgAAAP///////////////wAAAAD/////////////////////AwAAAP////////////////////////////////////////////////////8BAAAAAgAAAP///////////////wAAAAD/////////////////////AwAAAP////////////////////////////////////////////////////8BAAAAAgAAAP///////////////wAAAAD/////////////////////AwAAAP////////////////////////////////////////////////////8BAAAAAgAAAP///////////////wAAAAD/////////////////////AwAAAP///////////////////////////////wIAAAD///////////////8BAAAA/////////////////////wAAAAD/////////////////////AwAAAP////////////////////////////////////////////////////8DAAAA/////////////////////wAAAAABAAAA//////////8CAAAA//////////////////////////////////////////////////////////8DAAAA////////////////AgAAAAAAAAABAAAA//////////////////////////////////////////////////////////////////////////8DAAAA////////////////AgAAAAAAAAABAAAA//////////////////////////////////////////////////////////////////////////8DAAAA////////////////AgAAAAAAAAABAAAA//////////////////////////////////////////////////////////////////////////8DAAAAAQAAAP//////////AgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAACAAAAAAAAAAIAAAABAAAAAQAAAAIAAAACAAAAAAAAAAUAAAAFAAAAAAAAAAIAAAACAAAAAwAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAAAAAAAAgAAAAEAAAACAAAAAgAAAAIAAAAAAAAABQAAAAYAAAAAAAAAAgAAAAIAAAADAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAgAAAAAAAAACAAAAAQAAAAMAAAACAAAAAgAAAAAAAAAFAAAABwAAAAAAAAACAAAAAgAAAAMAAAADAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAACAAAAAAAAAAIAAAABAAAABAAAAAIAAAACAAAAAAAAAAUAAAAIAAAAAAAAAAIAAAACAAAAAwAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAwAAAAIAAAAAAAAAAgAAAAEAAAAAAAAAAgAAAAIAAAAAAAAABQAAAAkAAAAAAAAAAgAAAAIAAAADAAAABQAAAAAAAAAAAAAAAAAAAAAAAAAKAAAAAgAAAAIAAAAAAAAAAwAAAA4AAAACAAAAAAAAAAIAAAADAAAAAAAAAAAAAAACAAAAAgAAAAMAAAAGAAAAAAAAAAAAAAAAAAAAAAAAAAsAAAACAAAAAgAAAAAAAAADAAAACgAAAAIAAAAAAAAAAgAAAAMAAAABAAAAAAAAAAIAAAACAAAAAwAAAAcAAAAAAAAAAAAAAAAAAAAAAAAADAAAAAIAAAACAAAAAAAAAAMAAAALAAAAAgAAAAAAAAACAAAAAwAAAAIAAAAAAAAAAgAAAAIAAAADAAAACAAAAAAAAAAAAAAAAAAAAAAAAAANAAAAAgAAAAIAAAAAAAAAAwAAAAwAAAACAAAAAAAAAAIAAAADAAAAAwAAAAAAAAACAAAAAgAAAAMAAAAJAAAAAAAAAAAAAAAAAAAAAAAAAA4AAAACAAAAAgAAAAAAAAADAAAADQAAAAIAAAAAAAAAAgAAAAMAAAAEAAAAAAAAAAIAAAACAAAAAwAAAAoAAAAAAAAAAAAAAAAAAAAAAAAABQAAAAIAAAACAAAAAAAAAAMAAAAGAAAAAgAAAAAAAAACAAAAAwAAAA8AAAAAAAAAAgAAAAIAAAADAAAACwAAAAAAAAAAAAAAAAAAAAAAAAAGAAAAAgAAAAIAAAAAAAAAAwAAAAcAAAACAAAAAAAAAAIAAAADAAAAEAAAAAAAAAACAAAAAgAAAAMAAAAMAAAAAAAAAAAAAAAAAAAAAAAAAAcAAAACAAAAAgAAAAAAAAADAAAACAAAAAIAAAAAAAAAAgAAAAMAAAARAAAAAAAAAAIAAAACAAAAAwAAAA0AAAAAAAAAAAAAAAAAAAAAAAAACAAAAAIAAAACAAAAAAAAAAMAAAAJAAAAAgAAAAAAAAACAAAAAwAAABIAAAAAAAAAAgAAAAIAAAADAAAADgAAAAAAAAAAAAAAAAAAAAAAAAAJAAAAAgAAAAIAAAAAAAAAAwAAAAUAAAACAAAAAAAAAAIAAAADAAAAEwAAAAAAAAACAAAAAgAAAAMAAAAPAAAAAAAAAAAAAAAAAAAAAAAAABAAAAACAAAAAAAAAAIAAAABAAAAEwAAAAIAAAACAAAAAAAAAAUAAAAKAAAAAAAAAAIAAAACAAAAAwAAABAAAAAAAAAAAAAAAAAAAAAAAAAAEQAAAAIAAAAAAAAAAgAAAAEAAAAPAAAAAgAAAAIAAAAAAAAABQAAAAsAAAAAAAAAAgAAAAIAAAADAAAAEQAAAAAAAAAAAAAAAAAAAAAAAAASAAAAAgAAAAAAAAACAAAAAQAAABAAAAACAAAAAgAAAAAAAAAFAAAADAAAAAAAAAACAAAAAgAAAAMAAAASAAAAAAAAAAAAAAAAAAAAAAAAABMAAAACAAAAAAAAAAIAAAABAAAAEQAAAAIAAAACAAAAAAAAAAUAAAANAAAAAAAAAAIAAAACAAAAAwAAABMAAAAAAAAAAAAAAAAAAAAAAAAADwAAAAIAAAAAAAAAAgAAAAEAAAASAAAAAgAAAAIAAAAAAAAABQAAAA4AAAAAAAAAAgAAAAIAAAADAAAAAgAAAAEAAAAAAAAAAQAAAAIAAAAAAAAAAAAAAAIAAAABAAAAAAAAAAEAAAACAAAAAQAAAAAAAAACAAAAAAAAAAUAAAAEAAAAAAAAAAEAAAAFAAAAAAAAAAAAAAAFAAAABAAAAAAAAAABAAAABQAAAAQAAAAAAAAABQAAAAAAAAACAAAAAQAAAAAAAAABAAAAAgAAAAAAAAAAAAAAAgAAAAEAAAAAAAAAAQAAAAIAAAABAAAAAAAAAAIAAAACAAAAAAAAAAEAAAAAAAAAAAAAAAUAAAAEAAAAAAAAAAEAAAAFAAAAAAAAAAAAAAAFAAAABAAAAAAAAAABAAAABQAAAAQAAAAAAAAABQAAAAUAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAABAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAEAAAAAAAAAAAEAAAAAAQAAAAAAAAAAAQAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAABAAAAAAAAAAAAAQAAAAAAAAAAAAA6B6FaUp9QQTPXMuL4myJBraiDfBwx9UBYJseitzTIQOL5if9jqZtAnXX+Z+ycb0C3pucbhRBCQG8wJBYqpRRAlWbDCzCY5z/eFWBUEve6P/+qo4Q50Y4/D9YM3iCcYT8fcA2QJSA0P4ADxu0qAAc/BNcGolVJ2j5d9FACqwquPh9z7MthtI9CSUSYJke/YUJQ/64OyjU0Qpi0+HCmFQdCm3GfIVdh2kHsJ11kAyauQYC3UDFJOoFBSJsFV1OwU0FK5fcxX4AmQWhy/zZIt/lACqaCPsBjzUDbdUNIScugQMYQlVJ4MXNANiuq8GTvRUDxTXnulxEZQFZ8QX5kpuw/qmG/JwYFlEAluh3Q6DB+QKn4vyNq0GZAKOXekas+UUB8xabXXhI6QG63C2pLtSNAdDBtyNfLDUDyOcu67ID2P0rCMvRXAeE/Ki2TSVyzyT9Dk+8Sz2uzP5J+w5ARWp0/NQAoOiMuhj9YnP+RyMJwPxgW7TvQVFk/KgsLYF0kQz9g5dAC6IwzQcgHPVvDex1B1XjppodHBkHJq3OMM9fwQNvcmJ7wddlAInGPpQs/w0BRobq5EBmtQJZ2ai7n+ZVAtv2G5E+bgECG+gIfKBlpQK5f8jdI91JAL39sL/WpPEB8rGxhDqklQK6yUf43XhBAxL9y/tK8+D86XyZpgrHiPwAAAAD/////AAAAAAAAAAAAAAAAAAAAAAAAAAD/////////////////////////////////////AAAAAP////8AAAAAAAAAAAAAAAABAAAAAAAAAAAAAAD/////AAAAAAAAAAABAAAAAQAAAAAAAAAAAAAA/////wAAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAP////8FAAAABQAAAAAAAAAAAAAAAAAAAAAAAAD/////AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/////////////////////////////////////wAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP////////////////////////////////////8AAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAFAAAAAQAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/////////////////////////////////////AAAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAQAAAAEAAAABAAAAAAAAAAEAAAAAAAAABQAAAAEAAAABAAAAAAAAAAAAAAABAAAAAQAAAAAAAAABAAAAAQAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAQAAAAAAAQABAAABAQAAAAAAAQAAAAEAAAABAAEAAAAAAAAAAAAAAAAAAAAAquJYWJZl+D9jaeZNtj/zPwwdI9KqaeO/qGefXwdHdz+q4lhYlmX4P+OrlPMN3PI/DB0j0qpp47+7SQLV4VIEQKriWFiWZfg/r2kma3tz8T82eQmLqNIGwMRIWXMqSvo/fcCszPux9j+jara6ozTwP6hnn18HR3c/MSoKLequ8r+SabgA2nj0P7jBLbDOHO8/1Ym/ICfH4T+6lxjvlFXHv73m373LRPU/0vXyDVxo7T+ToKRHJXMAQF/33578aPE/pAyy64tD9T8+U/hCvyruPwxv8Y7YYwLAuXYr8NAiCEB4+LDK0Sn0P1Qeuy4j+eo/OMx50n7K7L+TrGB/nyf8v5ehC2fbYPM/aXMKexiT6z8mFRIMjg/zP7yUVwGGBNw/E6opHERf8z/z0wR2g9DqPw4pBpcOhvu/NbA29uWAA8DMaTExyXzyP02biiQ+Ruk/S8jz2/FKBEB1pzZnpbb9P7pQU4wLfPI//7ZcQXeG6D9CqEQvAYoIwDB2VB6sSgRAVyv8H5We8T+EHWF8XNPmPzB2wT8Nrrg/SEi+cX+w4L8of+GtdSDxP1sjk5AdouU/6ZjOVru13r8K0obqI6bxvwVbdNXyhfA/w5GG024n5z+rwmtMzP8BwLw9pSX49QXABe/2uQxP8D+b6wCzCvXkP7uGT87fK+Q/pz/JWw4coj+qoBf2J0nwP/yE3PUo0+I/vFJeHcaC+D96luSIqvntP/bf8sHUYu8/gZNN41mL4z9bhOqVOF4FwO6lmAh1hQhAbCVxbdhk7z+1C8NdDcfiPwG36x/0OQBAx0WJ76c2+D9nlSHXANfuP2HlfZ3gqOE/EwnVlVPg9r96+oHzEH//v5bXzdT1Auw/DM3GwLsA4D9p/8uoKcr+v+U9x5DQVAPAehjSdghb7D9sc1IetODgP8MVwwB1pu6/azPk6OGe978W8t/TUc3rP+0QMvYfP+A/RsG/QpSE8D+l3uwScxzgPwQaifgujuw/k1Vti1I43z8MAwLnSh0GQH5nYnwwZgJAiGUzWC5s6j8WyyI/BbLgPw4iUapGeQJAB3W+imnp/j9BLWR4ssrpP2t+gG5Pstk/cpBsfm6DCMCOpU9dOZsFQEv8nFypHeo/ehJ6i+6S2D9jqlGEmarLv7STC5TRiOa/bC+x8WZD6D9H3yUkWpDZP8gZvmCMuQLAreY19/eRBsCoPOc8UzzpP6KI/QV+y9g/t/MoboyWzT+Hv5q3Zu3Mvy2xROCT4uY/9gQitMMg1T9abAqhWMDkv1oLTavoUfG/PMUJP9CD5j+fHRX3t6fSPz7W2gk6bvs/WRnuHwqN9D8YFturGCTmP1EZczv0b9I/5t4exabB5D/1ESLh5fTEP9X2z6SYweQ/6lv3I2zT0D9zkRGNUNMAQKoSvc4EIfs/Xggt8wQI5T+mJHHg/w/SP4lhT/9t8vQ/DrZ/DbwH7D+XlhbYZrjkP34LIpFt6c4/lwfp8fLX9L+j96CTTf76v3WdNhEv9uM/d8c3o4lV0D/vFdCHVcsFwAHeDq0F1QhApbYqcZiN5D9KoilqByXLPwX0/diA0vq/0fo0GxnxAMBbaTkvlCzjP/RrFrWXrMs/UYTrky7jA0DB9f4FiZYAQEGAk/3QzeE/r/TeqE8t0D/OqjlsnPbvvz8RKU8JOfW/smSEbK/O4T8MzuyPm3DDP/rFtctq9gZAfb1EVEaSA0Dts5dVInnhP18SFMc79MM/7y34cw6LAMDFrRJsZO0DwC2KLvLSYuA/hx5wcUHewz+49SnK/4ruPyeS0PX9a+E/ZxaaLvvZ3z8WPu5T2QS8Pygo4RIvMqa/BJ0Kqsd0279cKW4ay8jdP3b05bmZ364/10/qtdxk2r+Bcz6CDMvpv54qOw+Amdw/qLV71pW7sT/YKc80nIPUP8OfIaBJ77G/LyTuD1un2z+diYu8efWzP1wU7ACkfwjAZroyPL1yBkAmv3lKJJbbPysKSE4W+p0/dIgqY79TA8ATLTOQ3tsGwJ2zweD/Xdg/XO/jXeFUaL8VW2qLFKfov1cA9Aa6XfK/tIa7YGgI2T+f3hu/sxqPv2nXdPpf3Pc/jkw8Jbda8j+tT/z8tGPVP1yBHpJd35k/KYvYOy1s8j/yz+kCQjPrP9+agH7x59g/PZfJ9aBhpr/rDKzvYBb+PwtkiaGCt/c/vb1mVr+f1T/JIHwHc8Govw7aeF6+9vG/Xv7kD6fp979isYioQYHVP7AIQZuSFrG/3z1AdUTnAUDN3XY9O7f9P0AdQ9ljYNQ/dJANJPTOrb8kLECUiiPlP4yF7UgmStA/9xGmXxCG1T9qZzix4W2zv2SGJRJVrPe/Fh9a2M/B/b8IexzFCoPSP9y1QFD2bLe/Q86cWLJe/b+mOOfYm78BwOTjkPAGE9E/8aPCUKu/ub9pPZyLCiUGwBA7Mev/BQlALOmrlRi+0j+AMJ/dKULBv7iLtL6a6QRAEMDV/yajAUDa62dE3crJP1P70RgBUbq/38hVnR6esT/s1tG10Z/Ov/zLwalHPss/dTS9NKTXx78nMcRzCIEHQAabxDsAmQRA0tyLK3gSyT+Aui7nOhDGv5Gs58z3WgHATN3forJuBMCAui7nOhDGP9Lciyt4Esm/WAJyHQ4c7z8UP5HFIs3iP3U0vTSk18c//MvBqUc+y7+cvv8HLg/Kvy1I/mHsI+K/U/vRGAFRuj/a62dE3crJv8p+WV8KlQjAuQ/nOP43B0CAMJ/dKULBPyzpq5UYvtK/ZoU+VoLh4L9etLlRUfvtv/GjwlCrv7k/5OOQ8AYT0b9DfT9FhufXPwUX8hJp+4u/3LVAUPZstz8IexzFCoPSv9+L609E5fQ/q9Fz7X2J7T9qZzix4W2zP/cRpl8QhtW/vtNilqGX+j8MOy7QJoL0P3SQDST0zq0/QB1D2WNg1L8IIjSvGNkDwGB8Jou2GAfAsAhBm5IWsT9isYioQYHVvyS9D3zb6uy/gnwRa7uM9L/JIHwHc8GoP729Zla/n9W/CsAHJZwmAEDEW6OYT1r6Pz2XyfWgYaY/35qAfvHn2L83Tdy4lS30vxf2/gZ0jPq/XIEekl3fmb+tT/z8tGPVvybPr2zJ1/+/K7mJ0ypVAsCf3hu/sxqPPwCGu2BoCNm/5oITrpZn+r+UDUyDP+n/v1zv413hVGg/nbPB4P9d2L9MlmkxNvgCQMtZlKE85v8/KwpIThb6nb8mv3lKJJbbv8+SZsTvOOc/pQCIIOYw0j+diYu8efWzvy8k7g9bp9u/kxYDa+pKtD9XlYvA8HnVv6i1e9aVu7G/nio7D4CZ3L/WR6rNh5EGwCkgQweBkghAdvTluZnfrr9cKW4ay8jdvxbjhr1f1QVAR5C0MzivAkAWPu5T2QS8v2cWmi772d+/cKj4lzLJCEBx2QJfYrMFQIcecHFB3sO/LYou8tJi4L+jr7lhO38BwIcI0Nb7xgTAXxIUxzv0w7/ts5dVInnhv0T+l8DZLfE/MP3FoFvS5D8MzuyPm3DDv7JkhGyvzuG/tzhzRIRc0b9Ovv3/0z7mv6/03qhPLdC/m4CT/dDN4b9dwjU5VCQBQBBJX1ntCv0/9GsWtZesy79baTkvlCzjv1mjYgEz++S/oW6KnOQW8b9KoilqByXLv6W2KnGYjeS/SmaKz3Vx9z+BZB5yxGHwP3fHN6OJVdC/dZ02ES/2478PuaBjLrXaP4/JU81pPaO/fgsikW3pzr+XlhbYZrjkv4tSn7YDbP0/f2LnFKlF9z+mJHHg/w/Sv14ILfMECOW/mfg4qYhR/b+OP+RQDCACwOpb9yNs09C/1fbPpJjB5L9pN2WOVZ3wv3hHy9nxIve/URlzO/Rv0r8YFturGCTmv1d1/KKR8QPA8gsy9qzSB8CfHRX3t6fSvzzFCT/Qg+a/EYStnrzV9r/2QJqI7Lb9v/YEIrTDINW/LbFE4JPi5r/7kQEs5fEDQHunnf4GeQBAooj9BX7L2L+oPOc8Uzzpv+ydYY2SSAfAL4HK6CRTB0BH3yUkWpDZv2wvsfFmQ+i/Ik0Yzruh6T8fM3LoGoDUP3oSeovukti/S/ycXKkd6r9rEv+7UWcHQCRIQe/GfwNAa36Abk+y2b9BLWR4ssrpv9KT87qa0bM/FTyktw823L8WyyI/BbLgv4hlM1gubOq/DizMp9Ki6r8b5ckdjVrzv5NVbYtSON+/BBqJ+C6O7L/dUBFqgyXYv00Wh18r7+q/7RAy9h8/4L8W8t/TUc3rv4RM5DKx3wDAfvWIj94aBcBsc1IetODgv3oY0nYIW+y/oGcTFF54AUDkJqS/FKX6PwzNxsC7AOC/ltfN1PUC7L+5Wrz/zHnzP6688w2rNOc/YeV9neCo4b9nlSHXANfuvw9RsxKjY/s/1V8GteXE8j+1C8NdDcfiv2wlcW3YZO+/IOywaA7Q8b9bFP+4Tg36v4GTTeNZi+O/9t/ywdRi77+tRc3yFR7eP2bkcHXJkLO//ITc9SjT4r+qoBf2J0nwv2YHKoswwfm/iQcLspCjAcCb6wCzCvXkvwXv9rkMT/C/YkuwYAMXBMApCNUai9kIwMORhtNuJ+e/BVt01fKF8L+ZqWEfvIjsP6h693QZYNk/WyOTkB2i5b8of+GtdSDxvwpaaulDSwVADMQAX+lOAECEHWF8XNPmv1cr/B+VnvG/XyFG6opcCMD/mtR32/UEQP+2XEF3hui/ulBTjAt88r/imfCfRP+yP9zbvtc8XeO/TZuKJD5G6b/MaTExyXzyvxiTQeElXOO/rbJRQVGN9L/z0wR2g9DqvxOqKRxEX/O/FDGCEei99j9x8zV4VYTmP2lzCnsYk+u/l6ELZ9tg878pRXacaDT/v3k6GZRqoQXAVB67LiP56r94+LDK0Sn0vwO6pZ9b7wFAvK0nKVcc9j8+U/hCvyruv6QMsuuLQ/W/FPhKFYv46j8MyxaDTOW/v9L18g1caO2/vebfvctE9b/7GD8ZrF3xv3gx1AR9bQDAuMEtsM4c77+SabgA2nj0v5xKFIwxsATArKNSBaKsB0Cjara6ozTwv33ArMz7sfa/dF2U0FcWCcDxL357DJX/P69pJmt7c/G/quJYWJZl+L/YntVJlnrSP4sRLzXM+fe/46uU8w3c8r+q4lhYlmX4v85lu5+QRwRAsI0H/WU8479jaeZNtj/zv6riWFiWZfi/sI0H/WU847/OZbufkEcEQHAoPUBrnss/9exKzDtFtT88wM8kax+gP9OqeKeAYog/MW0ItiZvcj+ph+smvt5bP2lCaV5dEUU/StaUmQDaLz+kK9y22BMYP0O3whZuMwI/IIbgZGWE6z7UkjYaEM3UPuezxwa9cr8+LybxRMnFpz6E1N8DbPiRPsYjySMvK3s+//////8fAAj//////zMQCP////9/MiAI/////28yMAj/////YzJACP///z9iMlAI////N2IyYAj///8zYjJwCP//vzNiMoAI//+rM2IykAj/f6szYjKgCP8PqzNiMrAI/wOrM2IywAi/A6szYjLQCJ8DqzNiMuAImQOrM2Iy8Aj//////z8PCP//////Kx8I/////38pLwj/////Pyk/CP////85KU8I////PzgpXwj///8POClvCP///w44KX8I//8fDjgpjwj//w8OOCmfCP9/DQ44Ka8I/w8NDjgpvwj/DQ0OOCnPCP8MDQ44Kd8IxwwNDjgp7wjEDA0OOCn/CAcAAAAHAAAAAQAAAAIAAAAEAAAAAwAAAAAAAAAAAAAABwAAAAMAAAABAAAAAgAAAAUAAAAEAAAAAAAAAAAAAAAEAAAABAAAAAAAAAACAAAAAQAAAAMAAAAOAAAABgAAAAsAAAACAAAABwAAAAEAAAAYAAAABQAAAAoAAAABAAAABgAAAAAAAAAmAAAABwAAAAwAAAADAAAACAAAAAIAAAAxAAAACQAAAA4AAAAAAAAABQAAAAQAAAA6AAAACAAAAA0AAAAEAAAACQAAAAMAAAA/AAAACwAAAAYAAAAPAAAACgAAABAAAABIAAAADAAAAAcAAAAQAAAACwAAABEAAABTAAAACgAAAAUAAAATAAAADgAAAA8AAABhAAAADQAAAAgAAAARAAAADAAAABIAAABrAAAADgAAAAkAAAASAAAADQAAABMAAAB1AAAADwAAABMAAAARAAAAEgAAABAAAAAGAAAAAgAAAAMAAAAFAAAABAAAAAAAAAAAAAAAAAAAAAYAAAACAAAAAwAAAAEAAAAFAAAABAAAAAAAAAAAAAAABwAAAAUAAAADAAAABAAAAAEAAAAAAAAAAgAAAAAAAAACAAAAAwAAAAEAAAAFAAAABAAAAAYAAAAAAAAAAAAAABgtRFT7Ifk/GC1EVPsh+b8YLURU+yEJQBgtRFT7IQnAYWxnb3MuYwBoM05laWdoYm9yUm90YXRpb25zAGNvb3JkaWprLmMAX3VwQXA3Q2hlY2tlZABfdXBBcDdyQ2hlY2tlZABkaXJlY3RlZEVkZ2UuYwBkaXJlY3RlZEVkZ2VUb0JvdW5kYXJ5AGFkamFjZW50RmFjZURpclt0bXBGaWprLmZhY2VdW2ZpamsuZmFjZV0gPT0gS0kAZmFjZWlqay5jAF9mYWNlSWprUGVudFRvQ2VsbEJvdW5kYXJ5AGFkamFjZW50RmFjZURpcltjZW50ZXJJSksuZmFjZV1bZmFjZTJdID09IEtJAF9mYWNlSWprVG9DZWxsQm91bmRhcnkAaDNJbmRleC5jAGNvbXBhY3RDZWxscwBsYXRMbmdUb0NlbGwAY2VsbFRvQ2hpbGRQb3MAdmFsaWRhdGVDaGlsZFBvcwBsYXRMbmcuYwBjZWxsQXJlYVJhZHMyAHBvbHlnb24tPm5leHQgPT0gTlVMTABsaW5rZWRHZW8uYwBhZGROZXdMaW5rZWRQb2x5Z29uAG5leHQgIT0gTlVMTABsb29wICE9IE5VTEwAYWRkTmV3TGlua2VkTG9vcABwb2x5Z29uLT5maXJzdCA9PSBOVUxMAGFkZExpbmtlZExvb3AAY29vcmQgIT0gTlVMTABhZGRMaW5rZWRDb29yZABsb29wLT5maXJzdCA9PSBOVUxMAGlubmVyTG9vcHMgIT0gTlVMTABub3JtYWxpemVNdWx0aVBvbHlnb24AYmJveGVzICE9IE5VTEwAY2FuZGlkYXRlcyAhPSBOVUxMAGZpbmRQb2x5Z29uRm9ySG9sZQBjYW5kaWRhdGVCQm94ZXMgIT0gTlVMTAByZXZEaXIgIT0gSU5WQUxJRF9ESUdJVABsb2NhbGlqLmMAY2VsbFRvTG9jYWxJamsAYmFzZUNlbGwgIT0gb3JpZ2luQmFzZUNlbGwAIShvcmlnaW5PblBlbnQgJiYgaW5kZXhPblBlbnQpAGJhc2VDZWxsID09IG9yaWdpbkJhc2VDZWxsAGJhc2VDZWxsICE9IElOVkFMSURfQkFTRV9DRUxMAGxvY2FsSWprVG9DZWxsACFfaXNCYXNlQ2VsbFBlbnRhZ29uKGJhc2VDZWxsKQBiYXNlQ2VsbFJvdGF0aW9ucyA+PSAwAGdyaWRQYXRoQ2VsbHMAcG9seWZpbGwuYwBpdGVyU3RlcFBvbHlnb25Db21wYWN0ADAAdmVydGV4LmMAY2VsbFRvVmVydGV4AGdyYXBoLT5idWNrZXRzICE9IE5VTEwAdmVydGV4R3JhcGguYwBpbml0VmVydGV4R3JhcGgAbm9kZSAhPSBOVUxMAGFkZFZlcnRleE5vZGU=";
  var tempDoublePtr = 28624;
  function demangle(func) {
    return func;
  }
  function demangleAll(text4) {
    var regex = /\b__Z[\w\d_]+/g;
    return text4.replace(regex, function(x) {
      var y = demangle(x);
      return x === y ? x : y + " [" + x + "]";
    });
  }
  function jsStackTrace() {
    var err2 = new Error;
    if (!err2.stack) {
      try {
        throw new Error(0);
      } catch (e) {
        err2 = e;
      }
      if (!err2.stack) {
        return "(no stack trace available)";
      }
    }
    return err2.stack.toString();
  }
  function stackTrace() {
    var js = jsStackTrace();
    if (Module["extraStackTrace"]) {
      js += `
` + Module["extraStackTrace"]();
    }
    return demangleAll(js);
  }
  function ___assert_fail(condition, filename, line, func) {
    abort("Assertion failed: " + UTF8ToString(condition) + ", at: " + [filename ? UTF8ToString(filename) : "unknown filename", line, func ? UTF8ToString(func) : "unknown function"]);
  }
  function _emscripten_get_heap_size() {
    return HEAP8.length;
  }
  function _emscripten_memcpy_big(dest, src2, num) {
    HEAPU8.set(HEAPU8.subarray(src2, src2 + num), dest);
  }
  function ___setErrNo(value3) {
    if (Module["___errno_location"]) {
      HEAP32[Module["___errno_location"]() >> 2] = value3;
    }
    return value3;
  }
  function abortOnCannotGrowMemory(requestedSize) {
    abort("OOM");
  }
  function emscripten_realloc_buffer(size2) {
    try {
      var newBuffer = new ArrayBuffer(size2);
      if (newBuffer.byteLength != size2) {
        return;
      }
      new Int8Array(newBuffer).set(HEAP8);
      _emscripten_replace_memory(newBuffer);
      updateGlobalBufferAndViews(newBuffer);
      return 1;
    } catch (e) {}
  }
  function _emscripten_resize_heap(requestedSize) {
    var oldSize = _emscripten_get_heap_size();
    var PAGE_MULTIPLE = 16777216;
    var LIMIT = 2147483648 - PAGE_MULTIPLE;
    if (requestedSize > LIMIT) {
      return false;
    }
    var MIN_TOTAL_MEMORY = 16777216;
    var newSize = Math.max(oldSize, MIN_TOTAL_MEMORY);
    while (newSize < requestedSize) {
      if (newSize <= 536870912) {
        newSize = alignUp(2 * newSize, PAGE_MULTIPLE);
      } else {
        newSize = Math.min(alignUp((3 * newSize + 2147483648) / 4, PAGE_MULTIPLE), LIMIT);
      }
    }
    var replacement = emscripten_realloc_buffer(newSize);
    if (!replacement) {
      return false;
    }
    return true;
  }
  var decodeBase64 = typeof atob === "function" ? atob : function(input2) {
    var keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    var output = "";
    var chr1, chr2, chr3;
    var enc1, enc2, enc3, enc4;
    var i = 0;
    input2 = input2.replace(/[^A-Za-z0-9\+\/\=]/g, "");
    do {
      enc1 = keyStr.indexOf(input2.charAt(i++));
      enc2 = keyStr.indexOf(input2.charAt(i++));
      enc3 = keyStr.indexOf(input2.charAt(i++));
      enc4 = keyStr.indexOf(input2.charAt(i++));
      chr1 = enc1 << 2 | enc2 >> 4;
      chr2 = (enc2 & 15) << 4 | enc3 >> 2;
      chr3 = (enc3 & 3) << 6 | enc4;
      output = output + String.fromCharCode(chr1);
      if (enc3 !== 64) {
        output = output + String.fromCharCode(chr2);
      }
      if (enc4 !== 64) {
        output = output + String.fromCharCode(chr3);
      }
    } while (i < input2.length);
    return output;
  };
  function intArrayFromBase64(s) {
    try {
      var decoded = decodeBase64(s);
      var bytes = new Uint8Array(decoded.length);
      for (var i = 0;i < decoded.length; ++i) {
        bytes[i] = decoded.charCodeAt(i);
      }
      return bytes;
    } catch (_) {
      throw new Error("Converting base64 string to bytes failed.");
    }
  }
  function tryParseAsDataURI(filename) {
    if (!isDataURI(filename)) {
      return;
    }
    return intArrayFromBase64(filename.slice(dataURIPrefix.length));
  }
  var asmGlobalArg = {
    Math,
    Int8Array,
    Int32Array,
    Uint8Array,
    Float32Array,
    Float64Array
  };
  var asmLibraryArg = {
    a: abort,
    b: setTempRet0,
    c: getTempRet0,
    d: ___assert_fail,
    e: ___setErrNo,
    f: _emscripten_get_heap_size,
    g: _emscripten_memcpy_big,
    h: _emscripten_resize_heap,
    i: abortOnCannotGrowMemory,
    j: demangle,
    k: demangleAll,
    l: emscripten_realloc_buffer,
    m: jsStackTrace,
    n: stackTrace,
    o: tempDoublePtr,
    p: DYNAMICTOP_PTR
  };
  var asm = function(global, env, buffer2) {
    "almost asm";
    var a2 = new global.Int8Array(buffer2), b = new global.Int32Array(buffer2), c = new global.Uint8Array(buffer2), d = new global.Float32Array(buffer2), e = new global.Float64Array(buffer2), f = env.o | 0, g = env.p | 0, p2 = global.Math.floor, q = global.Math.abs, r = global.Math.sqrt, s = global.Math.pow, t = global.Math.cos, u = global.Math.sin, v = global.Math.tan, w = global.Math.acos, x = global.Math.asin, y = global.Math.atan, z = global.Math.atan2, A = global.Math.ceil, B = global.Math.imul, C = global.Math.min, D = global.Math.max, E = global.Math.clz32, G = env.b, H = env.c, I = env.d, J = env.e, K = env.f, L = env.g, M = env.h, N = env.i, T = 28640;
    function W(newBuffer) {
      a2 = new Int8Array(newBuffer);
      c = new Uint8Array(newBuffer);
      b = new Int32Array(newBuffer);
      d = new Float32Array(newBuffer);
      e = new Float64Array(newBuffer);
      buffer2 = newBuffer;
      return true;
    }
    function X(a3) {
      a3 = a3 | 0;
      var b2 = 0;
      b2 = T;
      T = T + a3 | 0;
      T = T + 15 & -16;
      return b2 | 0;
    }
    function Y() {
      return T | 0;
    }
    function Z(a3) {
      a3 = a3 | 0;
      T = a3;
    }
    function _(a3, b2) {
      a3 = a3 | 0;
      b2 = b2 | 0;
      T = a3;
    }
    function $(a3, c2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      var d2 = 0, e2 = 0, f2 = 0;
      if ((a3 | 0) < 0) {
        c2 = 2;
        return c2 | 0;
      }
      if ((a3 | 0) > 13780509) {
        c2 = uc(15, c2) | 0;
        return c2 | 0;
      } else {
        d2 = ((a3 | 0) < 0) << 31 >> 31;
        f2 = Md(a3 | 0, d2 | 0, 3, 0) | 0;
        e2 = H() | 0;
        d2 = Gd(a3 | 0, d2 | 0, 1, 0) | 0;
        d2 = Md(f2 | 0, e2 | 0, d2 | 0, H() | 0) | 0;
        d2 = Gd(d2 | 0, H() | 0, 1, 0) | 0;
        a3 = H() | 0;
        b[c2 >> 2] = d2;
        b[c2 + 4 >> 2] = a3;
        c2 = 0;
        return c2 | 0;
      }
      return 0;
    }
    function aa(a3, b2, c2, d2) {
      a3 = a3 | 0;
      b2 = b2 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      return ba(a3, b2, c2, d2, 0) | 0;
    }
    function ba(a3, c2, d2, e2, f2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      var g2 = 0, h = 0, i = 0, j = 0, k = 0;
      j = T;
      T = T + 16 | 0;
      h = j;
      if (!(ca(a3, c2, d2, e2, f2) | 0)) {
        e2 = 0;
        T = j;
        return e2 | 0;
      }
      do {
        if ((d2 | 0) >= 0) {
          if ((d2 | 0) > 13780509) {
            g2 = uc(15, h) | 0;
            if (g2 | 0) {
              break;
            }
            i = h;
            h = b[i >> 2] | 0;
            i = b[i + 4 >> 2] | 0;
          } else {
            g2 = ((d2 | 0) < 0) << 31 >> 31;
            k = Md(d2 | 0, g2 | 0, 3, 0) | 0;
            i = H() | 0;
            g2 = Gd(d2 | 0, g2 | 0, 1, 0) | 0;
            g2 = Md(k | 0, i | 0, g2 | 0, H() | 0) | 0;
            g2 = Gd(g2 | 0, H() | 0, 1, 0) | 0;
            i = H() | 0;
            b[h >> 2] = g2;
            b[h + 4 >> 2] = i;
            h = g2;
          }
          Xd(e2 | 0, 0, h << 3 | 0) | 0;
          if (f2 | 0) {
            Xd(f2 | 0, 0, h << 2 | 0) | 0;
            g2 = da(a3, c2, d2, e2, f2, h, i, 0) | 0;
            break;
          }
          g2 = Fd(h, 4) | 0;
          if (!g2) {
            g2 = 13;
          } else {
            k = da(a3, c2, d2, e2, g2, h, i, 0) | 0;
            Ed(g2);
            g2 = k;
          }
        } else {
          g2 = 2;
        }
      } while (0);
      k = g2;
      T = j;
      return k | 0;
    }
    function ca(a3, c2, d2, e2, f2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      var g2 = 0, h = 0, i = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, p3 = 0, q2 = 0;
      q2 = T;
      T = T + 16 | 0;
      o = q2;
      p3 = q2 + 8 | 0;
      n = o;
      b[n >> 2] = a3;
      b[n + 4 >> 2] = c2;
      if ((d2 | 0) < 0) {
        p3 = 2;
        T = q2;
        return p3 | 0;
      }
      g2 = e2;
      b[g2 >> 2] = a3;
      b[g2 + 4 >> 2] = c2;
      g2 = (f2 | 0) != 0;
      if (g2) {
        b[f2 >> 2] = 0;
      }
      if (Hb(a3, c2) | 0) {
        p3 = 9;
        T = q2;
        return p3 | 0;
      }
      b[p3 >> 2] = 0;
      a:
        do {
          if ((d2 | 0) >= 1) {
            if (g2) {
              l = 1;
              k = 0;
              m = 0;
              n = 1;
              g2 = a3;
              while (true) {
                if (!(k | m)) {
                  g2 = ea(g2, c2, 4, p3, o) | 0;
                  if (g2 | 0) {
                    break a;
                  }
                  c2 = o;
                  g2 = b[c2 >> 2] | 0;
                  c2 = b[c2 + 4 >> 2] | 0;
                  if (Hb(g2, c2) | 0) {
                    g2 = 9;
                    break a;
                  }
                }
                g2 = ea(g2, c2, b[26800 + (m << 2) >> 2] | 0, p3, o) | 0;
                if (g2 | 0) {
                  break a;
                }
                c2 = o;
                g2 = b[c2 >> 2] | 0;
                c2 = b[c2 + 4 >> 2] | 0;
                a3 = e2 + (l << 3) | 0;
                b[a3 >> 2] = g2;
                b[a3 + 4 >> 2] = c2;
                b[f2 + (l << 2) >> 2] = n;
                a3 = k + 1 | 0;
                h = (a3 | 0) == (n | 0);
                i = m + 1 | 0;
                j = (i | 0) == 6;
                if (Hb(g2, c2) | 0) {
                  g2 = 9;
                  break a;
                }
                n = n + (j & h & 1) | 0;
                if ((n | 0) > (d2 | 0)) {
                  g2 = 0;
                  break;
                } else {
                  l = l + 1 | 0;
                  k = h ? 0 : a3;
                  m = h ? j ? 0 : i : m;
                }
              }
            } else {
              l = 1;
              k = 0;
              m = 0;
              n = 1;
              g2 = a3;
              while (true) {
                if (!(k | m)) {
                  g2 = ea(g2, c2, 4, p3, o) | 0;
                  if (g2 | 0) {
                    break a;
                  }
                  c2 = o;
                  g2 = b[c2 >> 2] | 0;
                  c2 = b[c2 + 4 >> 2] | 0;
                  if (Hb(g2, c2) | 0) {
                    g2 = 9;
                    break a;
                  }
                }
                g2 = ea(g2, c2, b[26800 + (m << 2) >> 2] | 0, p3, o) | 0;
                if (g2 | 0) {
                  break a;
                }
                c2 = o;
                g2 = b[c2 >> 2] | 0;
                c2 = b[c2 + 4 >> 2] | 0;
                a3 = e2 + (l << 3) | 0;
                b[a3 >> 2] = g2;
                b[a3 + 4 >> 2] = c2;
                a3 = k + 1 | 0;
                h = (a3 | 0) == (n | 0);
                i = m + 1 | 0;
                j = (i | 0) == 6;
                if (Hb(g2, c2) | 0) {
                  g2 = 9;
                  break a;
                }
                n = n + (j & h & 1) | 0;
                if ((n | 0) > (d2 | 0)) {
                  g2 = 0;
                  break;
                } else {
                  l = l + 1 | 0;
                  k = h ? 0 : a3;
                  m = h ? j ? 0 : i : m;
                }
              }
            }
          } else {
            g2 = 0;
          }
        } while (0);
      p3 = g2;
      T = q2;
      return p3 | 0;
    }
    function da(a3, c2, d2, e2, f2, g2, h, i) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      h = h | 0;
      i = i | 0;
      var j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, p3 = 0, q2 = 0, r2 = 0, s2 = 0;
      q2 = T;
      T = T + 16 | 0;
      o = q2 + 8 | 0;
      p3 = q2;
      j = Od(a3 | 0, c2 | 0, g2 | 0, h | 0) | 0;
      l = H() | 0;
      m = e2 + (j << 3) | 0;
      r2 = m;
      s2 = b[r2 >> 2] | 0;
      r2 = b[r2 + 4 >> 2] | 0;
      k = (s2 | 0) == (a3 | 0) & (r2 | 0) == (c2 | 0);
      if (!((s2 | 0) == 0 & (r2 | 0) == 0 | k)) {
        do {
          j = Gd(j | 0, l | 0, 1, 0) | 0;
          j = Nd(j | 0, H() | 0, g2 | 0, h | 0) | 0;
          l = H() | 0;
          m = e2 + (j << 3) | 0;
          s2 = m;
          r2 = b[s2 >> 2] | 0;
          s2 = b[s2 + 4 >> 2] | 0;
          k = (r2 | 0) == (a3 | 0) & (s2 | 0) == (c2 | 0);
        } while (!((r2 | 0) == 0 & (s2 | 0) == 0 | k));
      }
      j = f2 + (j << 2) | 0;
      if (k ? (b[j >> 2] | 0) <= (i | 0) : 0) {
        s2 = 0;
        T = q2;
        return s2 | 0;
      }
      s2 = m;
      b[s2 >> 2] = a3;
      b[s2 + 4 >> 2] = c2;
      b[j >> 2] = i;
      if ((i | 0) >= (d2 | 0)) {
        s2 = 0;
        T = q2;
        return s2 | 0;
      }
      k = i + 1 | 0;
      b[o >> 2] = 0;
      j = ea(a3, c2, 2, o, p3) | 0;
      switch (j | 0) {
        case 9: {
          n = 9;
          break;
        }
        case 0: {
          j = p3;
          j = da(b[j >> 2] | 0, b[j + 4 >> 2] | 0, d2, e2, f2, g2, h, k) | 0;
          if (!j) {
            n = 9;
          }
          break;
        }
        default:
      }
      a:
        do {
          if ((n | 0) == 9) {
            b[o >> 2] = 0;
            j = ea(a3, c2, 3, o, p3) | 0;
            switch (j | 0) {
              case 9:
                break;
              case 0: {
                j = p3;
                j = da(b[j >> 2] | 0, b[j + 4 >> 2] | 0, d2, e2, f2, g2, h, k) | 0;
                if (j | 0) {
                  break a;
                }
                break;
              }
              default:
                break a;
            }
            b[o >> 2] = 0;
            j = ea(a3, c2, 1, o, p3) | 0;
            switch (j | 0) {
              case 9:
                break;
              case 0: {
                j = p3;
                j = da(b[j >> 2] | 0, b[j + 4 >> 2] | 0, d2, e2, f2, g2, h, k) | 0;
                if (j | 0) {
                  break a;
                }
                break;
              }
              default:
                break a;
            }
            b[o >> 2] = 0;
            j = ea(a3, c2, 5, o, p3) | 0;
            switch (j | 0) {
              case 9:
                break;
              case 0: {
                j = p3;
                j = da(b[j >> 2] | 0, b[j + 4 >> 2] | 0, d2, e2, f2, g2, h, k) | 0;
                if (j | 0) {
                  break a;
                }
                break;
              }
              default:
                break a;
            }
            b[o >> 2] = 0;
            j = ea(a3, c2, 4, o, p3) | 0;
            switch (j | 0) {
              case 9:
                break;
              case 0: {
                j = p3;
                j = da(b[j >> 2] | 0, b[j + 4 >> 2] | 0, d2, e2, f2, g2, h, k) | 0;
                if (j | 0) {
                  break a;
                }
                break;
              }
              default:
                break a;
            }
            b[o >> 2] = 0;
            j = ea(a3, c2, 6, o, p3) | 0;
            switch (j | 0) {
              case 9:
                break;
              case 0: {
                j = p3;
                j = da(b[j >> 2] | 0, b[j + 4 >> 2] | 0, d2, e2, f2, g2, h, k) | 0;
                if (j | 0) {
                  break a;
                }
                break;
              }
              default:
                break a;
            }
            s2 = 0;
            T = q2;
            return s2 | 0;
          }
        } while (0);
      s2 = j;
      T = q2;
      return s2 | 0;
    }
    function ea(a3, c2, d2, e2, f2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      var g2 = 0, h = 0, i = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, p3 = 0;
      if (d2 >>> 0 > 6) {
        f2 = 1;
        return f2 | 0;
      }
      m = (b[e2 >> 2] | 0) % 6 | 0;
      b[e2 >> 2] = m;
      if ((m | 0) > 0) {
        g2 = 0;
        do {
          d2 = $a(d2) | 0;
          g2 = g2 + 1 | 0;
        } while ((g2 | 0) < (b[e2 >> 2] | 0));
      }
      m = Qd(a3 | 0, c2 | 0, 45) | 0;
      H() | 0;
      l = m & 127;
      if (l >>> 0 > 121) {
        f2 = 5;
        return f2 | 0;
      }
      j = Pb(a3, c2) | 0;
      g2 = Qd(a3 | 0, c2 | 0, 52) | 0;
      H() | 0;
      g2 = g2 & 15;
      a:
        do {
          if (!g2) {
            k = 8;
          } else {
            while (true) {
              h = (15 - g2 | 0) * 3 | 0;
              i = Qd(a3 | 0, c2 | 0, h | 0) | 0;
              H() | 0;
              i = i & 7;
              if ((i | 0) == 7) {
                c2 = 5;
                break;
              }
              p3 = (Vb(g2) | 0) == 0;
              g2 = g2 + -1 | 0;
              n = Rd(7, 0, h | 0) | 0;
              c2 = c2 & ~(H() | 0);
              o = Rd(b[(p3 ? 432 : 16) + (i * 28 | 0) + (d2 << 2) >> 2] | 0, 0, h | 0) | 0;
              h = H() | 0;
              d2 = b[(p3 ? 640 : 224) + (i * 28 | 0) + (d2 << 2) >> 2] | 0;
              a3 = o | a3 & ~n;
              c2 = h | c2;
              if (!d2) {
                d2 = 0;
                break a;
              }
              if (!g2) {
                k = 8;
                break a;
              }
            }
            return c2 | 0;
          }
        } while (0);
      if ((k | 0) == 8) {
        p3 = b[848 + (l * 28 | 0) + (d2 << 2) >> 2] | 0;
        o = Rd(p3 | 0, 0, 45) | 0;
        a3 = o | a3;
        c2 = H() | 0 | c2 & -1040385;
        d2 = b[4272 + (l * 28 | 0) + (d2 << 2) >> 2] | 0;
        if ((p3 & 127 | 0) == 127) {
          p3 = Rd(b[848 + (l * 28 | 0) + 20 >> 2] | 0, 0, 45) | 0;
          c2 = H() | 0 | c2 & -1040385;
          d2 = b[4272 + (l * 28 | 0) + 20 >> 2] | 0;
          a3 = Rb(p3 | a3, c2) | 0;
          c2 = H() | 0;
          b[e2 >> 2] = (b[e2 >> 2] | 0) + 1;
        }
      }
      i = Qd(a3 | 0, c2 | 0, 45) | 0;
      H() | 0;
      i = i & 127;
      b:
        do {
          if (!(oa(i) | 0)) {
            if ((d2 | 0) > 0) {
              g2 = 0;
              do {
                a3 = Rb(a3, c2) | 0;
                c2 = H() | 0;
                g2 = g2 + 1 | 0;
              } while ((g2 | 0) != (d2 | 0));
            }
          } else {
            c:
              do {
                if ((Pb(a3, c2) | 0) == 1) {
                  if ((l | 0) != (i | 0)) {
                    if (ua(i, b[7696 + (l * 28 | 0) >> 2] | 0) | 0) {
                      a3 = Tb(a3, c2) | 0;
                      h = 1;
                      c2 = H() | 0;
                      break;
                    } else {
                      I(27795, 26864, 533, 26872);
                    }
                  }
                  switch (j | 0) {
                    case 3: {
                      a3 = Rb(a3, c2) | 0;
                      c2 = H() | 0;
                      b[e2 >> 2] = (b[e2 >> 2] | 0) + 1;
                      h = 0;
                      break c;
                    }
                    case 5: {
                      a3 = Tb(a3, c2) | 0;
                      c2 = H() | 0;
                      b[e2 >> 2] = (b[e2 >> 2] | 0) + 5;
                      h = 0;
                      break c;
                    }
                    case 0: {
                      p3 = 9;
                      return p3 | 0;
                    }
                    default: {
                      p3 = 1;
                      return p3 | 0;
                    }
                  }
                } else {
                  h = 0;
                }
              } while (0);
            if ((d2 | 0) > 0) {
              g2 = 0;
              do {
                a3 = Qb(a3, c2) | 0;
                c2 = H() | 0;
                g2 = g2 + 1 | 0;
              } while ((g2 | 0) != (d2 | 0));
            }
            if ((l | 0) != (i | 0)) {
              if (!(pa(i) | 0)) {
                if ((h | 0) != 0 | (Pb(a3, c2) | 0) != 5) {
                  break;
                }
                b[e2 >> 2] = (b[e2 >> 2] | 0) + 1;
                break;
              }
              switch (m & 127) {
                case 8:
                case 118:
                  break b;
                default:
              }
              if ((Pb(a3, c2) | 0) != 3) {
                b[e2 >> 2] = (b[e2 >> 2] | 0) + 1;
              }
            }
          }
        } while (0);
      b[e2 >> 2] = ((b[e2 >> 2] | 0) + d2 | 0) % 6 | 0;
      p3 = f2;
      b[p3 >> 2] = a3;
      b[p3 + 4 >> 2] = c2;
      p3 = 0;
      return p3 | 0;
    }
    function fa(a3, b2, c2, d2) {
      a3 = a3 | 0;
      b2 = b2 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      if (!(ga(a3, b2, c2, d2) | 0)) {
        d2 = 0;
        return d2 | 0;
      }
      Xd(d2 | 0, 0, c2 * 48 | 0) | 0;
      d2 = ha(a3, b2, c2, d2) | 0;
      return d2 | 0;
    }
    function ga(a3, c2, d2, e2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      var f2 = 0, g2 = 0, h = 0, i = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, p3 = 0;
      p3 = T;
      T = T + 16 | 0;
      n = p3;
      o = p3 + 8 | 0;
      m = n;
      b[m >> 2] = a3;
      b[m + 4 >> 2] = c2;
      if ((d2 | 0) < 0) {
        o = 2;
        T = p3;
        return o | 0;
      }
      if (!d2) {
        o = e2;
        b[o >> 2] = a3;
        b[o + 4 >> 2] = c2;
        o = 0;
        T = p3;
        return o | 0;
      }
      b[o >> 2] = 0;
      a:
        do {
          if (!(Hb(a3, c2) | 0)) {
            f2 = 0;
            m = a3;
            do {
              a3 = ea(m, c2, 4, o, n) | 0;
              if (a3 | 0) {
                break a;
              }
              c2 = n;
              m = b[c2 >> 2] | 0;
              c2 = b[c2 + 4 >> 2] | 0;
              f2 = f2 + 1 | 0;
              if (Hb(m, c2) | 0) {
                a3 = 9;
                break a;
              }
            } while ((f2 | 0) < (d2 | 0));
            l = e2;
            b[l >> 2] = m;
            b[l + 4 >> 2] = c2;
            l = d2 + -1 | 0;
            k = 0;
            a3 = 1;
            do {
              f2 = 26800 + (k << 2) | 0;
              if ((k | 0) == 5) {
                h = b[f2 >> 2] | 0;
                g2 = 0;
                f2 = a3;
                while (true) {
                  a3 = n;
                  a3 = ea(b[a3 >> 2] | 0, b[a3 + 4 >> 2] | 0, h, o, n) | 0;
                  if (a3 | 0) {
                    break a;
                  }
                  if ((g2 | 0) != (l | 0)) {
                    j = n;
                    i = b[j >> 2] | 0;
                    j = b[j + 4 >> 2] | 0;
                    a3 = e2 + (f2 << 3) | 0;
                    b[a3 >> 2] = i;
                    b[a3 + 4 >> 2] = j;
                    if (!(Hb(i, j) | 0)) {
                      a3 = f2 + 1 | 0;
                    } else {
                      a3 = 9;
                      break a;
                    }
                  } else {
                    a3 = f2;
                  }
                  g2 = g2 + 1 | 0;
                  if ((g2 | 0) >= (d2 | 0)) {
                    break;
                  } else {
                    f2 = a3;
                  }
                }
              } else {
                h = n;
                j = b[f2 >> 2] | 0;
                i = 0;
                f2 = a3;
                g2 = b[h >> 2] | 0;
                h = b[h + 4 >> 2] | 0;
                while (true) {
                  a3 = ea(g2, h, j, o, n) | 0;
                  if (a3 | 0) {
                    break a;
                  }
                  h = n;
                  g2 = b[h >> 2] | 0;
                  h = b[h + 4 >> 2] | 0;
                  a3 = e2 + (f2 << 3) | 0;
                  b[a3 >> 2] = g2;
                  b[a3 + 4 >> 2] = h;
                  a3 = f2 + 1 | 0;
                  if (Hb(g2, h) | 0) {
                    a3 = 9;
                    break a;
                  }
                  i = i + 1 | 0;
                  if ((i | 0) >= (d2 | 0)) {
                    break;
                  } else {
                    f2 = a3;
                  }
                }
              }
              k = k + 1 | 0;
            } while (k >>> 0 < 6);
            a3 = n;
            a3 = ((m | 0) == (b[a3 >> 2] | 0) ? (c2 | 0) == (b[a3 + 4 >> 2] | 0) : 0) ? 0 : 9;
          } else {
            a3 = 9;
          }
        } while (0);
      o = a3;
      T = p3;
      return o | 0;
    }
    function ha(a3, c2, d2, e2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      var f2 = 0, g2 = 0, h = 0, i = 0, j = 0, k = 0, l = 0, m = 0, n = 0;
      m = T;
      T = T + 16 | 0;
      h = m;
      if (!d2) {
        b[e2 >> 2] = a3;
        b[e2 + 4 >> 2] = c2;
        e2 = 0;
        T = m;
        return e2 | 0;
      }
      do {
        if ((d2 | 0) >= 0) {
          if ((d2 | 0) > 13780509) {
            f2 = uc(15, h) | 0;
            if (f2 | 0) {
              break;
            }
            g2 = h;
            f2 = b[g2 >> 2] | 0;
            g2 = b[g2 + 4 >> 2] | 0;
          } else {
            f2 = ((d2 | 0) < 0) << 31 >> 31;
            l = Md(d2 | 0, f2 | 0, 3, 0) | 0;
            g2 = H() | 0;
            f2 = Gd(d2 | 0, f2 | 0, 1, 0) | 0;
            f2 = Md(l | 0, g2 | 0, f2 | 0, H() | 0) | 0;
            f2 = Gd(f2 | 0, H() | 0, 1, 0) | 0;
            g2 = H() | 0;
            l = h;
            b[l >> 2] = f2;
            b[l + 4 >> 2] = g2;
          }
          k = Fd(f2, 8) | 0;
          if (!k) {
            f2 = 13;
          } else {
            l = Fd(f2, 4) | 0;
            if (!l) {
              Ed(k);
              f2 = 13;
              break;
            }
            f2 = da(a3, c2, d2, k, l, f2, g2, 0) | 0;
            if (f2 | 0) {
              Ed(k);
              Ed(l);
              break;
            }
            c2 = b[h >> 2] | 0;
            h = b[h + 4 >> 2] | 0;
            if ((h | 0) > 0 | (h | 0) == 0 & c2 >>> 0 > 0) {
              f2 = 0;
              i = 0;
              j = 0;
              do {
                a3 = k + (i << 3) | 0;
                g2 = b[a3 >> 2] | 0;
                a3 = b[a3 + 4 >> 2] | 0;
                if (!((g2 | 0) == 0 & (a3 | 0) == 0) ? (b[l + (i << 2) >> 2] | 0) == (d2 | 0) : 0) {
                  n = e2 + (f2 << 3) | 0;
                  b[n >> 2] = g2;
                  b[n + 4 >> 2] = a3;
                  f2 = f2 + 1 | 0;
                }
                i = Gd(i | 0, j | 0, 1, 0) | 0;
                j = H() | 0;
              } while ((j | 0) < (h | 0) | (j | 0) == (h | 0) & i >>> 0 < c2 >>> 0);
            }
            Ed(k);
            Ed(l);
            f2 = 0;
          }
        } else {
          f2 = 2;
        }
      } while (0);
      n = f2;
      T = m;
      return n | 0;
    }
    function ia(a3, c2, d2, e2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      var f2 = 0, g2 = 0, h = 0, i = 0, j = 0, k = 0;
      i = T;
      T = T + 16 | 0;
      g2 = i;
      h = i + 8 | 0;
      f2 = (Hb(a3, c2) | 0) == 0;
      f2 = f2 ? 1 : 2;
      while (true) {
        b[h >> 2] = 0;
        k = (ea(a3, c2, f2, h, g2) | 0) == 0;
        j = g2;
        if (k & ((b[j >> 2] | 0) == (d2 | 0) ? (b[j + 4 >> 2] | 0) == (e2 | 0) : 0)) {
          a3 = 4;
          break;
        }
        f2 = f2 + 1 | 0;
        if (f2 >>> 0 >= 7) {
          f2 = 7;
          a3 = 4;
          break;
        }
      }
      if ((a3 | 0) == 4) {
        T = i;
        return f2 | 0;
      }
      return 0;
    }
    function ja(a3, c2, d2, e2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      var f2 = 0, g2 = 0, h = 0, i = 0, j = 0, k = 0;
      i = T;
      T = T + 48 | 0;
      f2 = i + 16 | 0;
      g2 = i + 8 | 0;
      h = i;
      d2 = Xc(d2) | 0;
      if (d2 | 0) {
        h = d2;
        T = i;
        return h | 0;
      }
      k = a3;
      j = b[k + 4 >> 2] | 0;
      d2 = g2;
      b[d2 >> 2] = b[k >> 2];
      b[d2 + 4 >> 2] = j;
      Wc(g2, f2);
      d2 = Ha(f2, c2, h) | 0;
      if (!d2) {
        c2 = b[g2 >> 2] | 0;
        g2 = b[a3 + 8 >> 2] | 0;
        if ((g2 | 0) > 0) {
          f2 = b[a3 + 12 >> 2] | 0;
          d2 = 0;
          do {
            c2 = (b[f2 + (d2 << 3) >> 2] | 0) + c2 | 0;
            d2 = d2 + 1 | 0;
          } while ((d2 | 0) < (g2 | 0));
        }
        d2 = h;
        f2 = b[d2 >> 2] | 0;
        d2 = b[d2 + 4 >> 2] | 0;
        g2 = ((c2 | 0) < 0) << 31 >> 31;
        if ((d2 | 0) < (g2 | 0) | (d2 | 0) == (g2 | 0) & f2 >>> 0 < c2 >>> 0) {
          d2 = h;
          b[d2 >> 2] = c2;
          b[d2 + 4 >> 2] = g2;
          d2 = g2;
        } else {
          c2 = f2;
        }
        j = Gd(c2 | 0, d2 | 0, 12, 0) | 0;
        k = H() | 0;
        d2 = h;
        b[d2 >> 2] = j;
        b[d2 + 4 >> 2] = k;
        d2 = e2;
        b[d2 >> 2] = j;
        b[d2 + 4 >> 2] = k;
        d2 = 0;
      }
      k = d2;
      T = i;
      return k | 0;
    }
    function ka(a3, c2, d2, f2, g2, h, i) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      h = h | 0;
      i = i | 0;
      var j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, p3 = 0, q2 = 0, r2 = 0, s2 = 0, t2 = 0, u2 = 0, v2 = 0, w2 = 0, x2 = 0, y2 = 0, z2 = 0, A2 = 0, B2 = 0, C2 = 0, D2 = 0, E2 = 0, F = 0, G2 = 0, I2 = 0, J2 = 0, K2 = 0, L2 = 0, M2 = 0;
      I2 = T;
      T = T + 64 | 0;
      D2 = I2 + 48 | 0;
      E2 = I2 + 32 | 0;
      F = I2 + 24 | 0;
      x2 = I2 + 8 | 0;
      y2 = I2;
      k = b[a3 >> 2] | 0;
      if ((k | 0) <= 0) {
        G2 = 0;
        T = I2;
        return G2 | 0;
      }
      z2 = a3 + 4 | 0;
      A2 = D2 + 8 | 0;
      B2 = E2 + 8 | 0;
      C2 = x2 + 8 | 0;
      j = 0;
      v2 = 0;
      while (true) {
        l = b[z2 >> 2] | 0;
        u2 = l + (v2 << 4) | 0;
        b[D2 >> 2] = b[u2 >> 2];
        b[D2 + 4 >> 2] = b[u2 + 4 >> 2];
        b[D2 + 8 >> 2] = b[u2 + 8 >> 2];
        b[D2 + 12 >> 2] = b[u2 + 12 >> 2];
        if ((v2 | 0) == (k + -1 | 0)) {
          b[E2 >> 2] = b[l >> 2];
          b[E2 + 4 >> 2] = b[l + 4 >> 2];
          b[E2 + 8 >> 2] = b[l + 8 >> 2];
          b[E2 + 12 >> 2] = b[l + 12 >> 2];
        } else {
          u2 = l + (v2 + 1 << 4) | 0;
          b[E2 >> 2] = b[u2 >> 2];
          b[E2 + 4 >> 2] = b[u2 + 4 >> 2];
          b[E2 + 8 >> 2] = b[u2 + 8 >> 2];
          b[E2 + 12 >> 2] = b[u2 + 12 >> 2];
        }
        k = Ia(D2, E2, f2, F) | 0;
        a:
          do {
            if (!k) {
              k = F;
              l = b[k >> 2] | 0;
              k = b[k + 4 >> 2] | 0;
              if ((k | 0) > 0 | (k | 0) == 0 & l >>> 0 > 0) {
                t2 = 0;
                u2 = 0;
                b:
                  while (true) {
                    K2 = 1 / (+(l >>> 0) + 4294967296 * +(k | 0));
                    M2 = +e[D2 >> 3];
                    k = Hd(l | 0, k | 0, t2 | 0, u2 | 0) | 0;
                    L2 = +(k >>> 0) + 4294967296 * +(H() | 0);
                    J2 = +(t2 >>> 0) + 4294967296 * +(u2 | 0);
                    e[x2 >> 3] = K2 * (M2 * L2) + K2 * (+e[E2 >> 3] * J2);
                    e[C2 >> 3] = K2 * (+e[A2 >> 3] * L2) + K2 * (+e[B2 >> 3] * J2);
                    k = Wb(x2, f2, y2) | 0;
                    if (k | 0) {
                      j = k;
                      break;
                    }
                    s2 = y2;
                    r2 = b[s2 >> 2] | 0;
                    s2 = b[s2 + 4 >> 2] | 0;
                    o = Od(r2 | 0, s2 | 0, c2 | 0, d2 | 0) | 0;
                    m = H() | 0;
                    k = i + (o << 3) | 0;
                    n = k;
                    l = b[n >> 2] | 0;
                    n = b[n + 4 >> 2] | 0;
                    c:
                      do {
                        if ((l | 0) == 0 & (n | 0) == 0) {
                          w2 = k;
                          G2 = 16;
                        } else {
                          p3 = 0;
                          q2 = 0;
                          while (true) {
                            if ((p3 | 0) > (d2 | 0) | (p3 | 0) == (d2 | 0) & q2 >>> 0 > c2 >>> 0) {
                              j = 1;
                              break b;
                            }
                            if ((l | 0) == (r2 | 0) & (n | 0) == (s2 | 0)) {
                              break c;
                            }
                            k = Gd(o | 0, m | 0, 1, 0) | 0;
                            o = Nd(k | 0, H() | 0, c2 | 0, d2 | 0) | 0;
                            m = H() | 0;
                            q2 = Gd(q2 | 0, p3 | 0, 1, 0) | 0;
                            p3 = H() | 0;
                            k = i + (o << 3) | 0;
                            n = k;
                            l = b[n >> 2] | 0;
                            n = b[n + 4 >> 2] | 0;
                            if ((l | 0) == 0 & (n | 0) == 0) {
                              w2 = k;
                              G2 = 16;
                              break;
                            }
                          }
                        }
                      } while (0);
                    if ((G2 | 0) == 16 ? (G2 = 0, !((r2 | 0) == 0 & (s2 | 0) == 0)) : 0) {
                      q2 = w2;
                      b[q2 >> 2] = r2;
                      b[q2 + 4 >> 2] = s2;
                      q2 = h + (b[g2 >> 2] << 3) | 0;
                      b[q2 >> 2] = r2;
                      b[q2 + 4 >> 2] = s2;
                      q2 = g2;
                      q2 = Gd(b[q2 >> 2] | 0, b[q2 + 4 >> 2] | 0, 1, 0) | 0;
                      r2 = H() | 0;
                      s2 = g2;
                      b[s2 >> 2] = q2;
                      b[s2 + 4 >> 2] = r2;
                    }
                    t2 = Gd(t2 | 0, u2 | 0, 1, 0) | 0;
                    u2 = H() | 0;
                    k = F;
                    l = b[k >> 2] | 0;
                    k = b[k + 4 >> 2] | 0;
                    if (!((k | 0) > (u2 | 0) | (k | 0) == (u2 | 0) & l >>> 0 > t2 >>> 0)) {
                      l = 1;
                      break a;
                    }
                  }
                l = 0;
              } else {
                l = 1;
              }
            } else {
              l = 0;
              j = k;
            }
          } while (0);
        v2 = v2 + 1 | 0;
        if (!l) {
          G2 = 21;
          break;
        }
        k = b[a3 >> 2] | 0;
        if ((v2 | 0) >= (k | 0)) {
          j = 0;
          G2 = 21;
          break;
        }
      }
      if ((G2 | 0) == 21) {
        T = I2;
        return j | 0;
      }
      return 0;
    }
    function la(a3, c2, d2, e2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      var f2 = 0, g2 = 0, h = 0, i = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, p3 = 0, q2 = 0, r2 = 0, s2 = 0, t2 = 0, u2 = 0, v2 = 0, w2 = 0, x2 = 0, y2 = 0, z2 = 0, A2 = 0, B2 = 0, C2 = 0, D2 = 0, E2 = 0, F = 0, G2 = 0, I2 = 0, J2 = 0, K2 = 0;
      K2 = T;
      T = T + 112 | 0;
      F = K2 + 80 | 0;
      j = K2 + 72 | 0;
      G2 = K2;
      I2 = K2 + 56 | 0;
      f2 = Xc(d2) | 0;
      if (f2 | 0) {
        J2 = f2;
        T = K2;
        return J2 | 0;
      }
      k = a3 + 8 | 0;
      J2 = Dd((b[k >> 2] << 5) + 32 | 0) | 0;
      if (!J2) {
        J2 = 13;
        T = K2;
        return J2 | 0;
      }
      Yc(a3, J2);
      f2 = Xc(d2) | 0;
      if (!f2) {
        D2 = a3;
        E2 = b[D2 + 4 >> 2] | 0;
        f2 = j;
        b[f2 >> 2] = b[D2 >> 2];
        b[f2 + 4 >> 2] = E2;
        Wc(j, F);
        f2 = Ha(F, c2, G2) | 0;
        if (!f2) {
          f2 = b[j >> 2] | 0;
          g2 = b[k >> 2] | 0;
          if ((g2 | 0) > 0) {
            h = b[a3 + 12 >> 2] | 0;
            d2 = 0;
            do {
              f2 = (b[h + (d2 << 3) >> 2] | 0) + f2 | 0;
              d2 = d2 + 1 | 0;
            } while ((d2 | 0) != (g2 | 0));
            d2 = f2;
          } else {
            d2 = f2;
          }
          f2 = G2;
          g2 = b[f2 >> 2] | 0;
          f2 = b[f2 + 4 >> 2] | 0;
          h = ((d2 | 0) < 0) << 31 >> 31;
          if ((f2 | 0) < (h | 0) | (f2 | 0) == (h | 0) & g2 >>> 0 < d2 >>> 0) {
            f2 = G2;
            b[f2 >> 2] = d2;
            b[f2 + 4 >> 2] = h;
            f2 = h;
          } else {
            d2 = g2;
          }
          D2 = Gd(d2 | 0, f2 | 0, 12, 0) | 0;
          E2 = H() | 0;
          f2 = G2;
          b[f2 >> 2] = D2;
          b[f2 + 4 >> 2] = E2;
          f2 = 0;
        } else {
          D2 = 0;
          E2 = 0;
        }
        if (!f2) {
          d2 = Fd(D2, 8) | 0;
          if (!d2) {
            Ed(J2);
            J2 = 13;
            T = K2;
            return J2 | 0;
          }
          i = Fd(D2, 8) | 0;
          if (!i) {
            Ed(J2);
            Ed(d2);
            J2 = 13;
            T = K2;
            return J2 | 0;
          }
          B2 = F;
          b[B2 >> 2] = 0;
          b[B2 + 4 >> 2] = 0;
          B2 = a3;
          C2 = b[B2 + 4 >> 2] | 0;
          f2 = j;
          b[f2 >> 2] = b[B2 >> 2];
          b[f2 + 4 >> 2] = C2;
          f2 = ka(j, D2, E2, c2, F, d2, i) | 0;
          a:
            do {
              if (!f2) {
                b:
                  do {
                    if ((b[k >> 2] | 0) > 0) {
                      h = a3 + 12 | 0;
                      g2 = 0;
                      while (true) {
                        f2 = ka((b[h >> 2] | 0) + (g2 << 3) | 0, D2, E2, c2, F, d2, i) | 0;
                        g2 = g2 + 1 | 0;
                        if (f2 | 0) {
                          break;
                        }
                        if ((g2 | 0) >= (b[k >> 2] | 0)) {
                          break b;
                        }
                      }
                      Ed(d2);
                      Ed(i);
                      Ed(J2);
                      break a;
                    }
                  } while (0);
                if ((E2 | 0) > 0 | (E2 | 0) == 0 & D2 >>> 0 > 0) {
                  Xd(i | 0, 0, D2 << 3 | 0) | 0;
                }
                C2 = F;
                B2 = b[C2 + 4 >> 2] | 0;
                c:
                  do {
                    if ((B2 | 0) > 0 | (B2 | 0) == 0 & (b[C2 >> 2] | 0) >>> 0 > 0) {
                      y2 = d2;
                      z2 = i;
                      A2 = d2;
                      B2 = i;
                      C2 = d2;
                      f2 = d2;
                      v2 = d2;
                      w2 = i;
                      x2 = i;
                      d2 = i;
                      d:
                        while (true) {
                          r2 = 0;
                          s2 = 0;
                          t2 = 0;
                          u2 = 0;
                          g2 = 0;
                          h = 0;
                          while (true) {
                            i = G2;
                            j = i + 56 | 0;
                            do {
                              b[i >> 2] = 0;
                              i = i + 4 | 0;
                            } while ((i | 0) < (j | 0));
                            c2 = y2 + (r2 << 3) | 0;
                            k = b[c2 >> 2] | 0;
                            c2 = b[c2 + 4 >> 2] | 0;
                            if (ca(k, c2, 1, G2, 0) | 0) {
                              i = G2;
                              j = i + 56 | 0;
                              do {
                                b[i >> 2] = 0;
                                i = i + 4 | 0;
                              } while ((i | 0) < (j | 0));
                              i = Fd(7, 4) | 0;
                              if (i | 0) {
                                da(k, c2, 1, G2, i, 7, 0, 0) | 0;
                                Ed(i);
                              }
                            }
                            q2 = 0;
                            while (true) {
                              p3 = G2 + (q2 << 3) | 0;
                              o = b[p3 >> 2] | 0;
                              p3 = b[p3 + 4 >> 2] | 0;
                              e:
                                do {
                                  if ((o | 0) == 0 & (p3 | 0) == 0) {
                                    i = g2;
                                    j = h;
                                  } else {
                                    l = Od(o | 0, p3 | 0, D2 | 0, E2 | 0) | 0;
                                    k = H() | 0;
                                    i = e2 + (l << 3) | 0;
                                    c2 = i;
                                    j = b[c2 >> 2] | 0;
                                    c2 = b[c2 + 4 >> 2] | 0;
                                    if (!((j | 0) == 0 & (c2 | 0) == 0)) {
                                      m = 0;
                                      n = 0;
                                      do {
                                        if ((m | 0) > (E2 | 0) | (m | 0) == (E2 | 0) & n >>> 0 > D2 >>> 0) {
                                          break d;
                                        }
                                        if ((j | 0) == (o | 0) & (c2 | 0) == (p3 | 0)) {
                                          i = g2;
                                          j = h;
                                          break e;
                                        }
                                        i = Gd(l | 0, k | 0, 1, 0) | 0;
                                        l = Nd(i | 0, H() | 0, D2 | 0, E2 | 0) | 0;
                                        k = H() | 0;
                                        n = Gd(n | 0, m | 0, 1, 0) | 0;
                                        m = H() | 0;
                                        i = e2 + (l << 3) | 0;
                                        c2 = i;
                                        j = b[c2 >> 2] | 0;
                                        c2 = b[c2 + 4 >> 2] | 0;
                                      } while (!((j | 0) == 0 & (c2 | 0) == 0));
                                    }
                                    if ((o | 0) == 0 & (p3 | 0) == 0) {
                                      i = g2;
                                      j = h;
                                      break;
                                    }
                                    Zb(o, p3, I2) | 0;
                                    if (Zc(a3, J2, I2) | 0) {
                                      n = Gd(g2 | 0, h | 0, 1, 0) | 0;
                                      h = H() | 0;
                                      m = i;
                                      b[m >> 2] = o;
                                      b[m + 4 >> 2] = p3;
                                      g2 = z2 + (g2 << 3) | 0;
                                      b[g2 >> 2] = o;
                                      b[g2 + 4 >> 2] = p3;
                                      g2 = n;
                                    }
                                    i = g2;
                                    j = h;
                                  }
                                } while (0);
                              q2 = q2 + 1 | 0;
                              if (q2 >>> 0 >= 7) {
                                break;
                              } else {
                                g2 = i;
                                h = j;
                              }
                            }
                            r2 = Gd(r2 | 0, s2 | 0, 1, 0) | 0;
                            s2 = H() | 0;
                            t2 = Gd(t2 | 0, u2 | 0, 1, 0) | 0;
                            u2 = H() | 0;
                            h = F;
                            g2 = b[h >> 2] | 0;
                            h = b[h + 4 >> 2] | 0;
                            if (!((u2 | 0) < (h | 0) | (u2 | 0) == (h | 0) & t2 >>> 0 < g2 >>> 0)) {
                              break;
                            } else {
                              g2 = i;
                              h = j;
                            }
                          }
                          if ((h | 0) > 0 | (h | 0) == 0 & g2 >>> 0 > 0) {
                            g2 = 0;
                            h = 0;
                            do {
                              u2 = y2 + (g2 << 3) | 0;
                              b[u2 >> 2] = 0;
                              b[u2 + 4 >> 2] = 0;
                              g2 = Gd(g2 | 0, h | 0, 1, 0) | 0;
                              h = H() | 0;
                              u2 = F;
                              t2 = b[u2 + 4 >> 2] | 0;
                            } while ((h | 0) < (t2 | 0) | ((h | 0) == (t2 | 0) ? g2 >>> 0 < (b[u2 >> 2] | 0) >>> 0 : 0));
                          }
                          u2 = F;
                          b[u2 >> 2] = i;
                          b[u2 + 4 >> 2] = j;
                          if ((j | 0) > 0 | (j | 0) == 0 & i >>> 0 > 0) {
                            q2 = d2;
                            r2 = x2;
                            s2 = C2;
                            t2 = w2;
                            u2 = z2;
                            d2 = v2;
                            x2 = f2;
                            w2 = A2;
                            v2 = q2;
                            f2 = r2;
                            C2 = B2;
                            B2 = s2;
                            A2 = t2;
                            z2 = y2;
                            y2 = u2;
                          } else {
                            break c;
                          }
                        }
                      Ed(A2);
                      Ed(B2);
                      Ed(J2);
                      f2 = 1;
                      break a;
                    } else {
                      f2 = i;
                    }
                  } while (0);
                Ed(J2);
                Ed(d2);
                Ed(f2);
                f2 = 0;
              } else {
                Ed(d2);
                Ed(i);
                Ed(J2);
              }
            } while (0);
          J2 = f2;
          T = K2;
          return J2 | 0;
        }
      }
      Ed(J2);
      J2 = f2;
      T = K2;
      return J2 | 0;
    }
    function ma(a3, c2, d2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      var e2 = 0, f2 = 0, g2 = 0, h = 0, i = 0, j = 0, k = 0, l = 0;
      l = T;
      T = T + 176 | 0;
      j = l;
      if ((c2 | 0) < 1) {
        ud(d2, 0, 0);
        k = 0;
        T = l;
        return k | 0;
      }
      i = a3;
      i = Qd(b[i >> 2] | 0, b[i + 4 >> 2] | 0, 52) | 0;
      H() | 0;
      ud(d2, (c2 | 0) > 6 ? c2 : 6, i & 15);
      i = 0;
      while (true) {
        e2 = a3 + (i << 3) | 0;
        e2 = _b(b[e2 >> 2] | 0, b[e2 + 4 >> 2] | 0, j) | 0;
        if (e2 | 0) {
          break;
        }
        e2 = b[j >> 2] | 0;
        if ((e2 | 0) > 0) {
          h = 0;
          do {
            g2 = j + 8 + (h << 4) | 0;
            h = h + 1 | 0;
            e2 = j + 8 + (((h | 0) % (e2 | 0) | 0) << 4) | 0;
            f2 = zd(d2, e2, g2) | 0;
            if (!f2) {
              yd(d2, g2, e2) | 0;
            } else {
              xd(d2, f2) | 0;
            }
            e2 = b[j >> 2] | 0;
          } while ((h | 0) < (e2 | 0));
        }
        i = i + 1 | 0;
        if ((i | 0) >= (c2 | 0)) {
          e2 = 0;
          k = 13;
          break;
        }
      }
      if ((k | 0) == 13) {
        T = l;
        return e2 | 0;
      }
      vd(d2);
      k = e2;
      T = l;
      return k | 0;
    }
    function na(a3, c2, d2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      var e2 = 0, f2 = 0, g2 = 0, h = 0;
      g2 = T;
      T = T + 32 | 0;
      e2 = g2;
      f2 = g2 + 16 | 0;
      a3 = ma(a3, c2, f2) | 0;
      if (a3 | 0) {
        d2 = a3;
        T = g2;
        return d2 | 0;
      }
      b[d2 >> 2] = 0;
      b[d2 + 4 >> 2] = 0;
      b[d2 + 8 >> 2] = 0;
      a3 = wd(f2) | 0;
      if (a3 | 0) {
        do {
          c2 = Cc(d2) | 0;
          do {
            Dc(c2, a3) | 0;
            h = a3 + 16 | 0;
            b[e2 >> 2] = b[h >> 2];
            b[e2 + 4 >> 2] = b[h + 4 >> 2];
            b[e2 + 8 >> 2] = b[h + 8 >> 2];
            b[e2 + 12 >> 2] = b[h + 12 >> 2];
            xd(f2, a3) | 0;
            a3 = Ad(f2, e2) | 0;
          } while ((a3 | 0) != 0);
          a3 = wd(f2) | 0;
        } while ((a3 | 0) != 0);
      }
      vd(f2);
      a3 = Fc(d2) | 0;
      if (!a3) {
        h = 0;
        T = g2;
        return h | 0;
      }
      Ec(d2);
      h = a3;
      T = g2;
      return h | 0;
    }
    function oa(a3) {
      a3 = a3 | 0;
      if (a3 >>> 0 > 121) {
        a3 = 0;
        return a3 | 0;
      }
      a3 = b[7696 + (a3 * 28 | 0) + 16 >> 2] | 0;
      return a3 | 0;
    }
    function pa(a3) {
      a3 = a3 | 0;
      return (a3 | 0) == 4 | (a3 | 0) == 117 | 0;
    }
    function qa(a3) {
      a3 = a3 | 0;
      return b[11120 + ((b[a3 >> 2] | 0) * 216 | 0) + ((b[a3 + 4 >> 2] | 0) * 72 | 0) + ((b[a3 + 8 >> 2] | 0) * 24 | 0) + (b[a3 + 12 >> 2] << 3) >> 2] | 0;
    }
    function ra(a3) {
      a3 = a3 | 0;
      return b[11120 + ((b[a3 >> 2] | 0) * 216 | 0) + ((b[a3 + 4 >> 2] | 0) * 72 | 0) + ((b[a3 + 8 >> 2] | 0) * 24 | 0) + (b[a3 + 12 >> 2] << 3) + 4 >> 2] | 0;
    }
    function sa(a3, c2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      a3 = 7696 + (a3 * 28 | 0) | 0;
      b[c2 >> 2] = b[a3 >> 2];
      b[c2 + 4 >> 2] = b[a3 + 4 >> 2];
      b[c2 + 8 >> 2] = b[a3 + 8 >> 2];
      b[c2 + 12 >> 2] = b[a3 + 12 >> 2];
      return;
    }
    function ta(a3, c2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      var d2 = 0, e2 = 0;
      if (c2 >>> 0 > 20) {
        c2 = -1;
        return c2 | 0;
      }
      do {
        if ((b[11120 + (c2 * 216 | 0) >> 2] | 0) != (a3 | 0)) {
          if ((b[11120 + (c2 * 216 | 0) + 8 >> 2] | 0) != (a3 | 0)) {
            if ((b[11120 + (c2 * 216 | 0) + 16 >> 2] | 0) != (a3 | 0)) {
              if ((b[11120 + (c2 * 216 | 0) + 24 >> 2] | 0) != (a3 | 0)) {
                if ((b[11120 + (c2 * 216 | 0) + 32 >> 2] | 0) != (a3 | 0)) {
                  if ((b[11120 + (c2 * 216 | 0) + 40 >> 2] | 0) != (a3 | 0)) {
                    if ((b[11120 + (c2 * 216 | 0) + 48 >> 2] | 0) != (a3 | 0)) {
                      if ((b[11120 + (c2 * 216 | 0) + 56 >> 2] | 0) != (a3 | 0)) {
                        if ((b[11120 + (c2 * 216 | 0) + 64 >> 2] | 0) != (a3 | 0)) {
                          if ((b[11120 + (c2 * 216 | 0) + 72 >> 2] | 0) != (a3 | 0)) {
                            if ((b[11120 + (c2 * 216 | 0) + 80 >> 2] | 0) != (a3 | 0)) {
                              if ((b[11120 + (c2 * 216 | 0) + 88 >> 2] | 0) != (a3 | 0)) {
                                if ((b[11120 + (c2 * 216 | 0) + 96 >> 2] | 0) != (a3 | 0)) {
                                  if ((b[11120 + (c2 * 216 | 0) + 104 >> 2] | 0) != (a3 | 0)) {
                                    if ((b[11120 + (c2 * 216 | 0) + 112 >> 2] | 0) != (a3 | 0)) {
                                      if ((b[11120 + (c2 * 216 | 0) + 120 >> 2] | 0) != (a3 | 0)) {
                                        if ((b[11120 + (c2 * 216 | 0) + 128 >> 2] | 0) != (a3 | 0)) {
                                          if ((b[11120 + (c2 * 216 | 0) + 136 >> 2] | 0) == (a3 | 0)) {
                                            a3 = 2;
                                            d2 = 1;
                                            e2 = 2;
                                          } else {
                                            if ((b[11120 + (c2 * 216 | 0) + 144 >> 2] | 0) == (a3 | 0)) {
                                              a3 = 0;
                                              d2 = 2;
                                              e2 = 0;
                                              break;
                                            }
                                            if ((b[11120 + (c2 * 216 | 0) + 152 >> 2] | 0) == (a3 | 0)) {
                                              a3 = 0;
                                              d2 = 2;
                                              e2 = 1;
                                              break;
                                            }
                                            if ((b[11120 + (c2 * 216 | 0) + 160 >> 2] | 0) == (a3 | 0)) {
                                              a3 = 0;
                                              d2 = 2;
                                              e2 = 2;
                                              break;
                                            }
                                            if ((b[11120 + (c2 * 216 | 0) + 168 >> 2] | 0) == (a3 | 0)) {
                                              a3 = 1;
                                              d2 = 2;
                                              e2 = 0;
                                              break;
                                            }
                                            if ((b[11120 + (c2 * 216 | 0) + 176 >> 2] | 0) == (a3 | 0)) {
                                              a3 = 1;
                                              d2 = 2;
                                              e2 = 1;
                                              break;
                                            }
                                            if ((b[11120 + (c2 * 216 | 0) + 184 >> 2] | 0) == (a3 | 0)) {
                                              a3 = 1;
                                              d2 = 2;
                                              e2 = 2;
                                              break;
                                            }
                                            if ((b[11120 + (c2 * 216 | 0) + 192 >> 2] | 0) == (a3 | 0)) {
                                              a3 = 2;
                                              d2 = 2;
                                              e2 = 0;
                                              break;
                                            }
                                            if ((b[11120 + (c2 * 216 | 0) + 200 >> 2] | 0) == (a3 | 0)) {
                                              a3 = 2;
                                              d2 = 2;
                                              e2 = 1;
                                              break;
                                            }
                                            if ((b[11120 + (c2 * 216 | 0) + 208 >> 2] | 0) == (a3 | 0)) {
                                              a3 = 2;
                                              d2 = 2;
                                              e2 = 2;
                                              break;
                                            } else {
                                              a3 = -1;
                                            }
                                            return a3 | 0;
                                          }
                                        } else {
                                          a3 = 2;
                                          d2 = 1;
                                          e2 = 1;
                                        }
                                      } else {
                                        a3 = 2;
                                        d2 = 1;
                                        e2 = 0;
                                      }
                                    } else {
                                      a3 = 1;
                                      d2 = 1;
                                      e2 = 2;
                                    }
                                  } else {
                                    a3 = 1;
                                    d2 = 1;
                                    e2 = 1;
                                  }
                                } else {
                                  a3 = 1;
                                  d2 = 1;
                                  e2 = 0;
                                }
                              } else {
                                a3 = 0;
                                d2 = 1;
                                e2 = 2;
                              }
                            } else {
                              a3 = 0;
                              d2 = 1;
                              e2 = 1;
                            }
                          } else {
                            a3 = 0;
                            d2 = 1;
                            e2 = 0;
                          }
                        } else {
                          a3 = 2;
                          d2 = 0;
                          e2 = 2;
                        }
                      } else {
                        a3 = 2;
                        d2 = 0;
                        e2 = 1;
                      }
                    } else {
                      a3 = 2;
                      d2 = 0;
                      e2 = 0;
                    }
                  } else {
                    a3 = 1;
                    d2 = 0;
                    e2 = 2;
                  }
                } else {
                  a3 = 1;
                  d2 = 0;
                  e2 = 1;
                }
              } else {
                a3 = 1;
                d2 = 0;
                e2 = 0;
              }
            } else {
              a3 = 0;
              d2 = 0;
              e2 = 2;
            }
          } else {
            a3 = 0;
            d2 = 0;
            e2 = 1;
          }
        } else {
          a3 = 0;
          d2 = 0;
          e2 = 0;
        }
      } while (0);
      c2 = b[11120 + (c2 * 216 | 0) + (d2 * 72 | 0) + (a3 * 24 | 0) + (e2 << 3) + 4 >> 2] | 0;
      return c2 | 0;
    }
    function ua(a3, c2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      if ((b[7696 + (a3 * 28 | 0) + 20 >> 2] | 0) == (c2 | 0)) {
        c2 = 1;
        return c2 | 0;
      }
      c2 = (b[7696 + (a3 * 28 | 0) + 24 >> 2] | 0) == (c2 | 0);
      return c2 | 0;
    }
    function va(a3, c2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      return b[848 + (a3 * 28 | 0) + (c2 << 2) >> 2] | 0;
    }
    function wa(a3, c2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      if ((b[848 + (a3 * 28 | 0) >> 2] | 0) == (c2 | 0)) {
        c2 = 0;
        return c2 | 0;
      }
      if ((b[848 + (a3 * 28 | 0) + 4 >> 2] | 0) == (c2 | 0)) {
        c2 = 1;
        return c2 | 0;
      }
      if ((b[848 + (a3 * 28 | 0) + 8 >> 2] | 0) == (c2 | 0)) {
        c2 = 2;
        return c2 | 0;
      }
      if ((b[848 + (a3 * 28 | 0) + 12 >> 2] | 0) == (c2 | 0)) {
        c2 = 3;
        return c2 | 0;
      }
      if ((b[848 + (a3 * 28 | 0) + 16 >> 2] | 0) == (c2 | 0)) {
        c2 = 4;
        return c2 | 0;
      }
      if ((b[848 + (a3 * 28 | 0) + 20 >> 2] | 0) == (c2 | 0)) {
        c2 = 5;
        return c2 | 0;
      } else {
        return ((b[848 + (a3 * 28 | 0) + 24 >> 2] | 0) == (c2 | 0) ? 6 : 7) | 0;
      }
      return 0;
    }
    function xa() {
      return 122;
    }
    function ya(a3) {
      a3 = a3 | 0;
      var c2 = 0, d2 = 0, e2 = 0;
      c2 = 0;
      do {
        Rd(c2 | 0, 0, 45) | 0;
        e2 = H() | 0 | 134225919;
        d2 = a3 + (c2 << 3) | 0;
        b[d2 >> 2] = -1;
        b[d2 + 4 >> 2] = e2;
        c2 = c2 + 1 | 0;
      } while ((c2 | 0) != 122);
      return 0;
    }
    function za(a3) {
      a3 = a3 | 0;
      var b2 = 0, c2 = 0, d2 = 0;
      d2 = +e[a3 + 16 >> 3];
      c2 = +e[a3 + 24 >> 3];
      b2 = d2 - c2;
      return +(d2 < c2 ? b2 + 6.283185307179586 : b2);
    }
    function Aa(a3) {
      a3 = a3 | 0;
      return +e[a3 + 16 >> 3] < +e[a3 + 24 >> 3] | 0;
    }
    function Ba(a3) {
      a3 = a3 | 0;
      return +(+e[a3 >> 3] - +e[a3 + 8 >> 3]);
    }
    function Ca(a3, b2) {
      a3 = a3 | 0;
      b2 = b2 | 0;
      var c2 = 0, d2 = 0, f2 = 0;
      c2 = +e[b2 >> 3];
      if (!(c2 >= +e[a3 + 8 >> 3])) {
        b2 = 0;
        return b2 | 0;
      }
      if (!(c2 <= +e[a3 >> 3])) {
        b2 = 0;
        return b2 | 0;
      }
      d2 = +e[a3 + 16 >> 3];
      c2 = +e[a3 + 24 >> 3];
      f2 = +e[b2 + 8 >> 3];
      b2 = f2 >= c2;
      a3 = f2 <= d2 & 1;
      if (d2 < c2) {
        if (b2) {
          a3 = 1;
        }
      } else if (!b2) {
        a3 = 0;
      }
      b2 = (a3 | 0) != 0;
      return b2 | 0;
    }
    function Da(a3, b2) {
      a3 = a3 | 0;
      b2 = b2 | 0;
      var c2 = 0, d2 = 0, f2 = 0, g2 = 0, h = 0, i = 0, j = 0, k = 0, l = 0;
      if (+e[a3 >> 3] < +e[b2 + 8 >> 3]) {
        d2 = 0;
        return d2 | 0;
      }
      if (+e[a3 + 8 >> 3] > +e[b2 >> 3]) {
        d2 = 0;
        return d2 | 0;
      }
      g2 = +e[a3 + 16 >> 3];
      c2 = a3 + 24 | 0;
      l = +e[c2 >> 3];
      h = g2 < l;
      d2 = b2 + 16 | 0;
      k = +e[d2 >> 3];
      f2 = b2 + 24 | 0;
      j = +e[f2 >> 3];
      i = k < j;
      b2 = l - k < j - g2;
      a3 = h ? i | b2 ? 1 : 2 : 0;
      b2 = i ? h ? 1 : b2 ? 2 : 1 : 0;
      g2 = +kc(g2, a3);
      if (g2 < +kc(+e[f2 >> 3], b2)) {
        i = 0;
        return i | 0;
      }
      l = +kc(+e[c2 >> 3], a3);
      if (l > +kc(+e[d2 >> 3], b2)) {
        i = 0;
        return i | 0;
      }
      i = 1;
      return i | 0;
    }
    function Ea(a3, c2, d2, f2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      f2 = f2 | 0;
      var g2 = 0, h = 0, i = 0, j = 0, k = 0;
      h = +e[a3 + 16 >> 3];
      k = +e[a3 + 24 >> 3];
      a3 = h < k;
      j = +e[c2 + 16 >> 3];
      i = +e[c2 + 24 >> 3];
      g2 = j < i;
      c2 = k - j < i - h;
      b[d2 >> 2] = a3 ? g2 | c2 ? 1 : 2 : 0;
      b[f2 >> 2] = g2 ? a3 ? 1 : c2 ? 2 : 1 : 0;
      return;
    }
    function Fa(a3, b2) {
      a3 = a3 | 0;
      b2 = b2 | 0;
      var c2 = 0, d2 = 0, f2 = 0, g2 = 0, h = 0, i = 0, j = 0, k = 0, l = 0;
      if (+e[a3 >> 3] < +e[b2 >> 3]) {
        d2 = 0;
        return d2 | 0;
      }
      if (+e[a3 + 8 >> 3] > +e[b2 + 8 >> 3]) {
        d2 = 0;
        return d2 | 0;
      }
      d2 = a3 + 16 | 0;
      j = +e[d2 >> 3];
      g2 = +e[a3 + 24 >> 3];
      h = j < g2;
      c2 = b2 + 16 | 0;
      l = +e[c2 >> 3];
      f2 = b2 + 24 | 0;
      k = +e[f2 >> 3];
      i = l < k;
      b2 = g2 - l < k - j;
      a3 = h ? i | b2 ? 1 : 2 : 0;
      b2 = i ? h ? 1 : b2 ? 2 : 1 : 0;
      g2 = +kc(g2, a3);
      if (!(g2 <= +kc(+e[f2 >> 3], b2))) {
        i = 0;
        return i | 0;
      }
      l = +kc(+e[d2 >> 3], a3);
      i = l >= +kc(+e[c2 >> 3], b2);
      return i | 0;
    }
    function Ga(a3, c2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      var d2 = 0, f2 = 0, g2 = 0, h = 0, i = 0, j = 0;
      g2 = T;
      T = T + 176 | 0;
      f2 = g2;
      b[f2 >> 2] = 4;
      j = +e[c2 >> 3];
      e[f2 + 8 >> 3] = j;
      h = +e[c2 + 16 >> 3];
      e[f2 + 16 >> 3] = h;
      e[f2 + 24 >> 3] = j;
      j = +e[c2 + 24 >> 3];
      e[f2 + 32 >> 3] = j;
      i = +e[c2 + 8 >> 3];
      e[f2 + 40 >> 3] = i;
      e[f2 + 48 >> 3] = j;
      e[f2 + 56 >> 3] = i;
      e[f2 + 64 >> 3] = h;
      c2 = f2 + 72 | 0;
      d2 = c2 + 96 | 0;
      do {
        b[c2 >> 2] = 0;
        c2 = c2 + 4 | 0;
      } while ((c2 | 0) < (d2 | 0));
      Wd(a3 | 0, f2 | 0, 168) | 0;
      T = g2;
      return;
    }
    function Ha(a3, c2, d2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      var g2 = 0, h = 0, i = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, r2 = 0, s2 = 0, t2 = 0, u2 = 0, v2 = 0;
      t2 = T;
      T = T + 288 | 0;
      n = t2 + 264 | 0;
      o = t2 + 96 | 0;
      m = t2;
      k = m;
      l = k + 96 | 0;
      do {
        b[k >> 2] = 0;
        k = k + 4 | 0;
      } while ((k | 0) < (l | 0));
      c2 = cc(c2, m) | 0;
      if (c2 | 0) {
        s2 = c2;
        T = t2;
        return s2 | 0;
      }
      l = m;
      m = b[l >> 2] | 0;
      l = b[l + 4 >> 2] | 0;
      Zb(m, l, n) | 0;
      _b(m, l, o) | 0;
      j = +mc(n, o + 8 | 0);
      e[n >> 3] = +e[a3 >> 3];
      l = n + 8 | 0;
      e[l >> 3] = +e[a3 + 16 >> 3];
      e[o >> 3] = +e[a3 + 8 >> 3];
      m = o + 8 | 0;
      e[m >> 3] = +e[a3 + 24 >> 3];
      h = +mc(n, o);
      v2 = +e[l >> 3] - +e[m >> 3];
      i = +q(+v2);
      u2 = +e[n >> 3] - +e[o >> 3];
      g2 = +q(+u2);
      if (!(v2 == 0 | u2 == 0) ? (v2 = +Td(+i, +g2), v2 = +A(+(h * h / +Ud(+(v2 / +Ud(+i, +g2)), 3) / (j * (j * 2.59807621135) * 0.8))), e[f >> 3] = v2, r2 = ~~v2 >>> 0, s2 = +q(v2) >= 1 ? v2 > 0 ? ~~+C(+p2(v2 / 4294967296), 4294967295) >>> 0 : ~~+A((v2 - +(~~v2 >>> 0)) / 4294967296) >>> 0 : 0, !((b[f + 4 >> 2] & 2146435072 | 0) == 2146435072)) : 0) {
        o = (r2 | 0) == 0 & (s2 | 0) == 0;
        c2 = d2;
        b[c2 >> 2] = o ? 1 : r2;
        b[c2 + 4 >> 2] = o ? 0 : s2;
        c2 = 0;
      } else {
        c2 = 1;
      }
      s2 = c2;
      T = t2;
      return s2 | 0;
    }
    function Ia(a3, c2, d2, g2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      g2 = g2 | 0;
      var h = 0, i = 0, j = 0, k = 0, l = 0, m = 0, n = 0;
      m = T;
      T = T + 288 | 0;
      j = m + 264 | 0;
      k = m + 96 | 0;
      l = m;
      h = l;
      i = h + 96 | 0;
      do {
        b[h >> 2] = 0;
        h = h + 4 | 0;
      } while ((h | 0) < (i | 0));
      d2 = cc(d2, l) | 0;
      if (d2 | 0) {
        g2 = d2;
        T = m;
        return g2 | 0;
      }
      d2 = l;
      h = b[d2 >> 2] | 0;
      d2 = b[d2 + 4 >> 2] | 0;
      Zb(h, d2, j) | 0;
      _b(h, d2, k) | 0;
      n = +mc(j, k + 8 | 0);
      n = +A(+(+mc(a3, c2) / (n * 2)));
      e[f >> 3] = n;
      d2 = ~~n >>> 0;
      h = +q(n) >= 1 ? n > 0 ? ~~+C(+p2(n / 4294967296), 4294967295) >>> 0 : ~~+A((n - +(~~n >>> 0)) / 4294967296) >>> 0 : 0;
      if ((b[f + 4 >> 2] & 2146435072 | 0) == 2146435072) {
        g2 = 1;
        T = m;
        return g2 | 0;
      }
      l = (d2 | 0) == 0 & (h | 0) == 0;
      b[g2 >> 2] = l ? 1 : d2;
      b[g2 + 4 >> 2] = l ? 0 : h;
      g2 = 0;
      T = m;
      return g2 | 0;
    }
    function Ja(a3, b2) {
      a3 = a3 | 0;
      b2 = +b2;
      var c2 = 0, d2 = 0, f2 = 0, g2 = 0, h = 0, i = 0, j = 0, k = 0, l = 0;
      g2 = a3 + 16 | 0;
      h = +e[g2 >> 3];
      c2 = a3 + 24 | 0;
      f2 = +e[c2 >> 3];
      d2 = h - f2;
      d2 = h < f2 ? d2 + 6.283185307179586 : d2;
      k = +e[a3 >> 3];
      i = a3 + 8 | 0;
      j = +e[i >> 3];
      l = k - j;
      d2 = (d2 * b2 - d2) * 0.5;
      b2 = (l * b2 - l) * 0.5;
      k = k + b2;
      e[a3 >> 3] = k > 1.5707963267948966 ? 1.5707963267948966 : k;
      b2 = j - b2;
      e[i >> 3] = b2 < -1.5707963267948966 ? -1.5707963267948966 : b2;
      b2 = h + d2;
      b2 = b2 > 3.141592653589793 ? b2 + -6.283185307179586 : b2;
      e[g2 >> 3] = b2 < -3.141592653589793 ? b2 + 6.283185307179586 : b2;
      b2 = f2 - d2;
      b2 = b2 > 3.141592653589793 ? b2 + -6.283185307179586 : b2;
      e[c2 >> 3] = b2 < -3.141592653589793 ? b2 + 6.283185307179586 : b2;
      return;
    }
    function Ka(a3, c2, d2, e2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      b[a3 >> 2] = c2;
      b[a3 + 4 >> 2] = d2;
      b[a3 + 8 >> 2] = e2;
      return;
    }
    function La(a3, c2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      var d2 = 0, f2 = 0, g2 = 0, h = 0, i = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0;
      n = c2 + 8 | 0;
      b[n >> 2] = 0;
      k = +e[a3 >> 3];
      i = +q(+k);
      l = +e[a3 + 8 >> 3];
      j = +q(+l) * 1.1547005383792515;
      i = i + j * 0.5;
      d2 = ~~i;
      a3 = ~~j;
      i = i - +(d2 | 0);
      j = j - +(a3 | 0);
      do {
        if (i < 0.5) {
          if (i < 0.3333333333333333) {
            b[c2 >> 2] = d2;
            if (j < (i + 1) * 0.5) {
              b[c2 + 4 >> 2] = a3;
              break;
            } else {
              a3 = a3 + 1 | 0;
              b[c2 + 4 >> 2] = a3;
              break;
            }
          } else {
            o = 1 - i;
            a3 = (!(j < o) & 1) + a3 | 0;
            b[c2 + 4 >> 2] = a3;
            if (o <= j & j < i * 2) {
              d2 = d2 + 1 | 0;
              b[c2 >> 2] = d2;
              break;
            } else {
              b[c2 >> 2] = d2;
              break;
            }
          }
        } else {
          if (!(i < 0.6666666666666666)) {
            d2 = d2 + 1 | 0;
            b[c2 >> 2] = d2;
            if (j < i * 0.5) {
              b[c2 + 4 >> 2] = a3;
              break;
            } else {
              a3 = a3 + 1 | 0;
              b[c2 + 4 >> 2] = a3;
              break;
            }
          }
          if (j < 1 - i) {
            b[c2 + 4 >> 2] = a3;
            if (i * 2 + -1 < j) {
              b[c2 >> 2] = d2;
              break;
            }
          } else {
            a3 = a3 + 1 | 0;
            b[c2 + 4 >> 2] = a3;
          }
          d2 = d2 + 1 | 0;
          b[c2 >> 2] = d2;
        }
      } while (0);
      do {
        if (k < 0) {
          if (!(a3 & 1)) {
            m = (a3 | 0) / 2 | 0;
            m = Hd(d2 | 0, ((d2 | 0) < 0) << 31 >> 31 | 0, m | 0, ((m | 0) < 0) << 31 >> 31 | 0) | 0;
            d2 = ~~(+(d2 | 0) - (+(m >>> 0) + 4294967296 * +(H() | 0)) * 2);
            b[c2 >> 2] = d2;
            break;
          } else {
            m = (a3 + 1 | 0) / 2 | 0;
            m = Hd(d2 | 0, ((d2 | 0) < 0) << 31 >> 31 | 0, m | 0, ((m | 0) < 0) << 31 >> 31 | 0) | 0;
            d2 = ~~(+(d2 | 0) - ((+(m >>> 0) + 4294967296 * +(H() | 0)) * 2 + 1));
            b[c2 >> 2] = d2;
            break;
          }
        }
      } while (0);
      m = c2 + 4 | 0;
      if (l < 0) {
        d2 = d2 - ((a3 << 1 | 1 | 0) / 2 | 0) | 0;
        b[c2 >> 2] = d2;
        a3 = 0 - a3 | 0;
        b[m >> 2] = a3;
      }
      f2 = a3 - d2 | 0;
      if ((d2 | 0) < 0) {
        g2 = 0 - d2 | 0;
        b[m >> 2] = f2;
        b[n >> 2] = g2;
        b[c2 >> 2] = 0;
        a3 = f2;
        d2 = 0;
      } else {
        g2 = 0;
      }
      if ((a3 | 0) < 0) {
        d2 = d2 - a3 | 0;
        b[c2 >> 2] = d2;
        g2 = g2 - a3 | 0;
        b[n >> 2] = g2;
        b[m >> 2] = 0;
        a3 = 0;
      }
      h = d2 - g2 | 0;
      f2 = a3 - g2 | 0;
      if ((g2 | 0) < 0) {
        b[c2 >> 2] = h;
        b[m >> 2] = f2;
        b[n >> 2] = 0;
        a3 = f2;
        d2 = h;
        g2 = 0;
      }
      f2 = (a3 | 0) < (d2 | 0) ? a3 : d2;
      f2 = (g2 | 0) < (f2 | 0) ? g2 : f2;
      if ((f2 | 0) <= 0) {
        return;
      }
      b[c2 >> 2] = d2 - f2;
      b[m >> 2] = a3 - f2;
      b[n >> 2] = g2 - f2;
      return;
    }
    function Ma(a3) {
      a3 = a3 | 0;
      var c2 = 0, d2 = 0, e2 = 0, f2 = 0, g2 = 0, h = 0;
      c2 = b[a3 >> 2] | 0;
      h = a3 + 4 | 0;
      d2 = b[h >> 2] | 0;
      if ((c2 | 0) < 0) {
        d2 = d2 - c2 | 0;
        b[h >> 2] = d2;
        g2 = a3 + 8 | 0;
        b[g2 >> 2] = (b[g2 >> 2] | 0) - c2;
        b[a3 >> 2] = 0;
        c2 = 0;
      }
      if ((d2 | 0) < 0) {
        c2 = c2 - d2 | 0;
        b[a3 >> 2] = c2;
        g2 = a3 + 8 | 0;
        f2 = (b[g2 >> 2] | 0) - d2 | 0;
        b[g2 >> 2] = f2;
        b[h >> 2] = 0;
        d2 = 0;
      } else {
        f2 = a3 + 8 | 0;
        g2 = f2;
        f2 = b[f2 >> 2] | 0;
      }
      if ((f2 | 0) < 0) {
        c2 = c2 - f2 | 0;
        b[a3 >> 2] = c2;
        d2 = d2 - f2 | 0;
        b[h >> 2] = d2;
        b[g2 >> 2] = 0;
        f2 = 0;
      }
      e2 = (d2 | 0) < (c2 | 0) ? d2 : c2;
      e2 = (f2 | 0) < (e2 | 0) ? f2 : e2;
      if ((e2 | 0) <= 0) {
        return;
      }
      b[a3 >> 2] = c2 - e2;
      b[h >> 2] = d2 - e2;
      b[g2 >> 2] = f2 - e2;
      return;
    }
    function Na(a3, c2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      var d2 = 0, f2 = 0;
      f2 = b[a3 + 8 >> 2] | 0;
      d2 = +((b[a3 + 4 >> 2] | 0) - f2 | 0);
      e[c2 >> 3] = +((b[a3 >> 2] | 0) - f2 | 0) - d2 * 0.5;
      e[c2 + 8 >> 3] = d2 * 0.8660254037844386;
      return;
    }
    function Oa(a3, c2, d2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      b[d2 >> 2] = (b[c2 >> 2] | 0) + (b[a3 >> 2] | 0);
      b[d2 + 4 >> 2] = (b[c2 + 4 >> 2] | 0) + (b[a3 + 4 >> 2] | 0);
      b[d2 + 8 >> 2] = (b[c2 + 8 >> 2] | 0) + (b[a3 + 8 >> 2] | 0);
      return;
    }
    function Pa(a3, c2, d2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      b[d2 >> 2] = (b[a3 >> 2] | 0) - (b[c2 >> 2] | 0);
      b[d2 + 4 >> 2] = (b[a3 + 4 >> 2] | 0) - (b[c2 + 4 >> 2] | 0);
      b[d2 + 8 >> 2] = (b[a3 + 8 >> 2] | 0) - (b[c2 + 8 >> 2] | 0);
      return;
    }
    function Qa(a3, c2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      var d2 = 0, e2 = 0;
      d2 = B(b[a3 >> 2] | 0, c2) | 0;
      b[a3 >> 2] = d2;
      d2 = a3 + 4 | 0;
      e2 = B(b[d2 >> 2] | 0, c2) | 0;
      b[d2 >> 2] = e2;
      a3 = a3 + 8 | 0;
      c2 = B(b[a3 >> 2] | 0, c2) | 0;
      b[a3 >> 2] = c2;
      return;
    }
    function Ra(a3) {
      a3 = a3 | 0;
      var c2 = 0, d2 = 0, e2 = 0, f2 = 0, g2 = 0, h = 0, i = 0;
      h = b[a3 >> 2] | 0;
      i = (h | 0) < 0;
      e2 = (b[a3 + 4 >> 2] | 0) - (i ? h : 0) | 0;
      g2 = (e2 | 0) < 0;
      f2 = (g2 ? 0 - e2 | 0 : 0) + ((b[a3 + 8 >> 2] | 0) - (i ? h : 0)) | 0;
      d2 = (f2 | 0) < 0;
      a3 = d2 ? 0 : f2;
      c2 = (g2 ? 0 : e2) - (d2 ? f2 : 0) | 0;
      f2 = (i ? 0 : h) - (g2 ? e2 : 0) - (d2 ? f2 : 0) | 0;
      d2 = (c2 | 0) < (f2 | 0) ? c2 : f2;
      d2 = (a3 | 0) < (d2 | 0) ? a3 : d2;
      e2 = (d2 | 0) > 0;
      a3 = a3 - (e2 ? d2 : 0) | 0;
      c2 = c2 - (e2 ? d2 : 0) | 0;
      a:
        do {
          switch (f2 - (e2 ? d2 : 0) | 0) {
            case 0:
              switch (c2 | 0) {
                case 0: {
                  i = (a3 | 0) == 0 ? 0 : (a3 | 0) == 1 ? 1 : 7;
                  return i | 0;
                }
                case 1: {
                  i = (a3 | 0) == 0 ? 2 : (a3 | 0) == 1 ? 3 : 7;
                  return i | 0;
                }
                default:
                  break a;
              }
            case 1:
              switch (c2 | 0) {
                case 0: {
                  i = (a3 | 0) == 0 ? 4 : (a3 | 0) == 1 ? 5 : 7;
                  return i | 0;
                }
                case 1: {
                  if (!a3) {
                    a3 = 6;
                  } else {
                    break a;
                  }
                  return a3 | 0;
                }
                default:
                  break a;
              }
            default:
          }
        } while (0);
      i = 7;
      return i | 0;
    }
    function Sa(a3) {
      a3 = a3 | 0;
      var c2 = 0, d2 = 0, e2 = 0, f2 = 0, g2 = 0, h = 0, i = 0, j = 0, k = 0;
      j = a3 + 8 | 0;
      h = b[j >> 2] | 0;
      i = (b[a3 >> 2] | 0) - h | 0;
      k = a3 + 4 | 0;
      h = (b[k >> 2] | 0) - h | 0;
      if (i >>> 0 > 715827881 | h >>> 0 > 715827881) {
        e2 = (i | 0) > 0;
        f2 = 2147483647 - i | 0;
        g2 = -2147483648 - i | 0;
        if (e2 ? (f2 | 0) < (i | 0) : (g2 | 0) > (i | 0)) {
          k = 1;
          return k | 0;
        }
        d2 = i << 1;
        if (e2 ? (2147483647 - d2 | 0) < (i | 0) : (-2147483648 - d2 | 0) > (i | 0)) {
          k = 1;
          return k | 0;
        }
        if ((h | 0) > 0 ? (2147483647 - h | 0) < (h | 0) : (-2147483648 - h | 0) > (h | 0)) {
          k = 1;
          return k | 0;
        }
        c2 = i * 3 | 0;
        d2 = h << 1;
        if ((e2 ? (f2 | 0) < (d2 | 0) : (g2 | 0) > (d2 | 0)) ? 1 : (i | 0) > -1 ? (c2 | -2147483648 | 0) >= (h | 0) : (c2 ^ -2147483648 | 0) < (h | 0)) {
          k = 1;
          return k | 0;
        }
      } else {
        d2 = h << 1;
        c2 = i * 3 | 0;
      }
      e2 = Cd(+(c2 - h | 0) * 0.14285714285714285) | 0;
      b[a3 >> 2] = e2;
      f2 = Cd(+(d2 + i | 0) * 0.14285714285714285) | 0;
      b[k >> 2] = f2;
      b[j >> 2] = 0;
      d2 = (f2 | 0) < (e2 | 0);
      c2 = d2 ? e2 : f2;
      d2 = d2 ? f2 : e2;
      if ((d2 | 0) < 0) {
        if ((d2 | 0) == -2147483648 ? 1 : (c2 | 0) > 0 ? (2147483647 - c2 | 0) < (d2 | 0) : (-2147483648 - c2 | 0) > (d2 | 0)) {
          I(27795, 26892, 354, 26903);
        }
        if ((c2 | 0) > -1 ? (c2 | -2147483648 | 0) >= (d2 | 0) : (c2 ^ -2147483648 | 0) < (d2 | 0)) {
          I(27795, 26892, 354, 26903);
        }
      }
      c2 = f2 - e2 | 0;
      if ((e2 | 0) < 0) {
        d2 = 0 - e2 | 0;
        b[k >> 2] = c2;
        b[j >> 2] = d2;
        b[a3 >> 2] = 0;
        e2 = 0;
      } else {
        c2 = f2;
        d2 = 0;
      }
      if ((c2 | 0) < 0) {
        e2 = e2 - c2 | 0;
        b[a3 >> 2] = e2;
        d2 = d2 - c2 | 0;
        b[j >> 2] = d2;
        b[k >> 2] = 0;
        c2 = 0;
      }
      g2 = e2 - d2 | 0;
      f2 = c2 - d2 | 0;
      if ((d2 | 0) < 0) {
        b[a3 >> 2] = g2;
        b[k >> 2] = f2;
        b[j >> 2] = 0;
        c2 = f2;
        f2 = g2;
        d2 = 0;
      } else {
        f2 = e2;
      }
      e2 = (c2 | 0) < (f2 | 0) ? c2 : f2;
      e2 = (d2 | 0) < (e2 | 0) ? d2 : e2;
      if ((e2 | 0) <= 0) {
        k = 0;
        return k | 0;
      }
      b[a3 >> 2] = f2 - e2;
      b[k >> 2] = c2 - e2;
      b[j >> 2] = d2 - e2;
      k = 0;
      return k | 0;
    }
    function Ta(a3) {
      a3 = a3 | 0;
      var c2 = 0, d2 = 0, e2 = 0, f2 = 0, g2 = 0, h = 0, i = 0, j = 0;
      h = a3 + 8 | 0;
      f2 = b[h >> 2] | 0;
      g2 = (b[a3 >> 2] | 0) - f2 | 0;
      i = a3 + 4 | 0;
      f2 = (b[i >> 2] | 0) - f2 | 0;
      if (g2 >>> 0 > 715827881 | f2 >>> 0 > 715827881) {
        d2 = (g2 | 0) > 0;
        if (d2 ? (2147483647 - g2 | 0) < (g2 | 0) : (-2147483648 - g2 | 0) > (g2 | 0)) {
          i = 1;
          return i | 0;
        }
        c2 = g2 << 1;
        e2 = (f2 | 0) > 0;
        if (e2 ? (2147483647 - f2 | 0) < (f2 | 0) : (-2147483648 - f2 | 0) > (f2 | 0)) {
          i = 1;
          return i | 0;
        }
        j = f2 << 1;
        if (e2 ? (2147483647 - j | 0) < (f2 | 0) : (-2147483648 - j | 0) > (f2 | 0)) {
          j = 1;
          return j | 0;
        }
        if (d2 ? (2147483647 - c2 | 0) < (f2 | 0) : (-2147483648 - c2 | 0) > (f2 | 0)) {
          j = 1;
          return j | 0;
        }
        d2 = f2 * 3 | 0;
        if ((f2 | 0) > -1 ? (d2 | -2147483648 | 0) >= (g2 | 0) : (d2 ^ -2147483648 | 0) < (g2 | 0)) {
          j = 1;
          return j | 0;
        }
      } else {
        d2 = f2 * 3 | 0;
        c2 = g2 << 1;
      }
      e2 = Cd(+(c2 + f2 | 0) * 0.14285714285714285) | 0;
      b[a3 >> 2] = e2;
      f2 = Cd(+(d2 - g2 | 0) * 0.14285714285714285) | 0;
      b[i >> 2] = f2;
      b[h >> 2] = 0;
      d2 = (f2 | 0) < (e2 | 0);
      c2 = d2 ? e2 : f2;
      d2 = d2 ? f2 : e2;
      if ((d2 | 0) < 0) {
        if ((d2 | 0) == -2147483648 ? 1 : (c2 | 0) > 0 ? (2147483647 - c2 | 0) < (d2 | 0) : (-2147483648 - c2 | 0) > (d2 | 0)) {
          I(27795, 26892, 402, 26917);
        }
        if ((c2 | 0) > -1 ? (c2 | -2147483648 | 0) >= (d2 | 0) : (c2 ^ -2147483648 | 0) < (d2 | 0)) {
          I(27795, 26892, 402, 26917);
        }
      }
      c2 = f2 - e2 | 0;
      if ((e2 | 0) < 0) {
        d2 = 0 - e2 | 0;
        b[i >> 2] = c2;
        b[h >> 2] = d2;
        b[a3 >> 2] = 0;
        e2 = 0;
      } else {
        c2 = f2;
        d2 = 0;
      }
      if ((c2 | 0) < 0) {
        e2 = e2 - c2 | 0;
        b[a3 >> 2] = e2;
        d2 = d2 - c2 | 0;
        b[h >> 2] = d2;
        b[i >> 2] = 0;
        c2 = 0;
      }
      g2 = e2 - d2 | 0;
      f2 = c2 - d2 | 0;
      if ((d2 | 0) < 0) {
        b[a3 >> 2] = g2;
        b[i >> 2] = f2;
        b[h >> 2] = 0;
        c2 = f2;
        f2 = g2;
        d2 = 0;
      } else {
        f2 = e2;
      }
      e2 = (c2 | 0) < (f2 | 0) ? c2 : f2;
      e2 = (d2 | 0) < (e2 | 0) ? d2 : e2;
      if ((e2 | 0) <= 0) {
        j = 0;
        return j | 0;
      }
      b[a3 >> 2] = f2 - e2;
      b[i >> 2] = c2 - e2;
      b[h >> 2] = d2 - e2;
      j = 0;
      return j | 0;
    }
    function Ua(a3) {
      a3 = a3 | 0;
      var c2 = 0, d2 = 0, e2 = 0, f2 = 0, g2 = 0, h = 0, i = 0;
      h = a3 + 8 | 0;
      d2 = b[h >> 2] | 0;
      c2 = (b[a3 >> 2] | 0) - d2 | 0;
      i = a3 + 4 | 0;
      d2 = (b[i >> 2] | 0) - d2 | 0;
      e2 = Cd(+((c2 * 3 | 0) - d2 | 0) * 0.14285714285714285) | 0;
      b[a3 >> 2] = e2;
      c2 = Cd(+((d2 << 1) + c2 | 0) * 0.14285714285714285) | 0;
      b[i >> 2] = c2;
      b[h >> 2] = 0;
      d2 = c2 - e2 | 0;
      if ((e2 | 0) < 0) {
        g2 = 0 - e2 | 0;
        b[i >> 2] = d2;
        b[h >> 2] = g2;
        b[a3 >> 2] = 0;
        c2 = d2;
        e2 = 0;
        d2 = g2;
      } else {
        d2 = 0;
      }
      if ((c2 | 0) < 0) {
        e2 = e2 - c2 | 0;
        b[a3 >> 2] = e2;
        d2 = d2 - c2 | 0;
        b[h >> 2] = d2;
        b[i >> 2] = 0;
        c2 = 0;
      }
      g2 = e2 - d2 | 0;
      f2 = c2 - d2 | 0;
      if ((d2 | 0) < 0) {
        b[a3 >> 2] = g2;
        b[i >> 2] = f2;
        b[h >> 2] = 0;
        c2 = f2;
        f2 = g2;
        d2 = 0;
      } else {
        f2 = e2;
      }
      e2 = (c2 | 0) < (f2 | 0) ? c2 : f2;
      e2 = (d2 | 0) < (e2 | 0) ? d2 : e2;
      if ((e2 | 0) <= 0) {
        return;
      }
      b[a3 >> 2] = f2 - e2;
      b[i >> 2] = c2 - e2;
      b[h >> 2] = d2 - e2;
      return;
    }
    function Va(a3) {
      a3 = a3 | 0;
      var c2 = 0, d2 = 0, e2 = 0, f2 = 0, g2 = 0, h = 0, i = 0;
      h = a3 + 8 | 0;
      d2 = b[h >> 2] | 0;
      c2 = (b[a3 >> 2] | 0) - d2 | 0;
      i = a3 + 4 | 0;
      d2 = (b[i >> 2] | 0) - d2 | 0;
      e2 = Cd(+((c2 << 1) + d2 | 0) * 0.14285714285714285) | 0;
      b[a3 >> 2] = e2;
      c2 = Cd(+((d2 * 3 | 0) - c2 | 0) * 0.14285714285714285) | 0;
      b[i >> 2] = c2;
      b[h >> 2] = 0;
      d2 = c2 - e2 | 0;
      if ((e2 | 0) < 0) {
        g2 = 0 - e2 | 0;
        b[i >> 2] = d2;
        b[h >> 2] = g2;
        b[a3 >> 2] = 0;
        c2 = d2;
        e2 = 0;
        d2 = g2;
      } else {
        d2 = 0;
      }
      if ((c2 | 0) < 0) {
        e2 = e2 - c2 | 0;
        b[a3 >> 2] = e2;
        d2 = d2 - c2 | 0;
        b[h >> 2] = d2;
        b[i >> 2] = 0;
        c2 = 0;
      }
      g2 = e2 - d2 | 0;
      f2 = c2 - d2 | 0;
      if ((d2 | 0) < 0) {
        b[a3 >> 2] = g2;
        b[i >> 2] = f2;
        b[h >> 2] = 0;
        c2 = f2;
        f2 = g2;
        d2 = 0;
      } else {
        f2 = e2;
      }
      e2 = (c2 | 0) < (f2 | 0) ? c2 : f2;
      e2 = (d2 | 0) < (e2 | 0) ? d2 : e2;
      if ((e2 | 0) <= 0) {
        return;
      }
      b[a3 >> 2] = f2 - e2;
      b[i >> 2] = c2 - e2;
      b[h >> 2] = d2 - e2;
      return;
    }
    function Wa(a3) {
      a3 = a3 | 0;
      var c2 = 0, d2 = 0, e2 = 0, f2 = 0, g2 = 0, h = 0, i = 0;
      c2 = b[a3 >> 2] | 0;
      h = a3 + 4 | 0;
      d2 = b[h >> 2] | 0;
      i = a3 + 8 | 0;
      e2 = b[i >> 2] | 0;
      f2 = d2 + (c2 * 3 | 0) | 0;
      b[a3 >> 2] = f2;
      d2 = e2 + (d2 * 3 | 0) | 0;
      b[h >> 2] = d2;
      c2 = (e2 * 3 | 0) + c2 | 0;
      b[i >> 2] = c2;
      e2 = d2 - f2 | 0;
      if ((f2 | 0) < 0) {
        c2 = c2 - f2 | 0;
        b[h >> 2] = e2;
        b[i >> 2] = c2;
        b[a3 >> 2] = 0;
        d2 = e2;
        e2 = 0;
      } else {
        e2 = f2;
      }
      if ((d2 | 0) < 0) {
        e2 = e2 - d2 | 0;
        b[a3 >> 2] = e2;
        c2 = c2 - d2 | 0;
        b[i >> 2] = c2;
        b[h >> 2] = 0;
        d2 = 0;
      }
      g2 = e2 - c2 | 0;
      f2 = d2 - c2 | 0;
      if ((c2 | 0) < 0) {
        b[a3 >> 2] = g2;
        b[h >> 2] = f2;
        b[i >> 2] = 0;
        e2 = g2;
        c2 = 0;
      } else {
        f2 = d2;
      }
      d2 = (f2 | 0) < (e2 | 0) ? f2 : e2;
      d2 = (c2 | 0) < (d2 | 0) ? c2 : d2;
      if ((d2 | 0) <= 0) {
        return;
      }
      b[a3 >> 2] = e2 - d2;
      b[h >> 2] = f2 - d2;
      b[i >> 2] = c2 - d2;
      return;
    }
    function Xa(a3) {
      a3 = a3 | 0;
      var c2 = 0, d2 = 0, e2 = 0, f2 = 0, g2 = 0, h = 0, i = 0;
      f2 = b[a3 >> 2] | 0;
      h = a3 + 4 | 0;
      c2 = b[h >> 2] | 0;
      i = a3 + 8 | 0;
      d2 = b[i >> 2] | 0;
      e2 = (c2 * 3 | 0) + f2 | 0;
      f2 = d2 + (f2 * 3 | 0) | 0;
      b[a3 >> 2] = f2;
      b[h >> 2] = e2;
      c2 = (d2 * 3 | 0) + c2 | 0;
      b[i >> 2] = c2;
      d2 = e2 - f2 | 0;
      if ((f2 | 0) < 0) {
        c2 = c2 - f2 | 0;
        b[h >> 2] = d2;
        b[i >> 2] = c2;
        b[a3 >> 2] = 0;
        f2 = 0;
      } else {
        d2 = e2;
      }
      if ((d2 | 0) < 0) {
        f2 = f2 - d2 | 0;
        b[a3 >> 2] = f2;
        c2 = c2 - d2 | 0;
        b[i >> 2] = c2;
        b[h >> 2] = 0;
        d2 = 0;
      }
      g2 = f2 - c2 | 0;
      e2 = d2 - c2 | 0;
      if ((c2 | 0) < 0) {
        b[a3 >> 2] = g2;
        b[h >> 2] = e2;
        b[i >> 2] = 0;
        f2 = g2;
        c2 = 0;
      } else {
        e2 = d2;
      }
      d2 = (e2 | 0) < (f2 | 0) ? e2 : f2;
      d2 = (c2 | 0) < (d2 | 0) ? c2 : d2;
      if ((d2 | 0) <= 0) {
        return;
      }
      b[a3 >> 2] = f2 - d2;
      b[h >> 2] = e2 - d2;
      b[i >> 2] = c2 - d2;
      return;
    }
    function Ya(a3, c2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      var d2 = 0, e2 = 0, f2 = 0, g2 = 0, h = 0, i = 0;
      if ((c2 + -1 | 0) >>> 0 >= 6) {
        return;
      }
      f2 = (b[15440 + (c2 * 12 | 0) >> 2] | 0) + (b[a3 >> 2] | 0) | 0;
      b[a3 >> 2] = f2;
      i = a3 + 4 | 0;
      e2 = (b[15440 + (c2 * 12 | 0) + 4 >> 2] | 0) + (b[i >> 2] | 0) | 0;
      b[i >> 2] = e2;
      h = a3 + 8 | 0;
      c2 = (b[15440 + (c2 * 12 | 0) + 8 >> 2] | 0) + (b[h >> 2] | 0) | 0;
      b[h >> 2] = c2;
      d2 = e2 - f2 | 0;
      if ((f2 | 0) < 0) {
        c2 = c2 - f2 | 0;
        b[i >> 2] = d2;
        b[h >> 2] = c2;
        b[a3 >> 2] = 0;
        e2 = 0;
      } else {
        d2 = e2;
        e2 = f2;
      }
      if ((d2 | 0) < 0) {
        e2 = e2 - d2 | 0;
        b[a3 >> 2] = e2;
        c2 = c2 - d2 | 0;
        b[h >> 2] = c2;
        b[i >> 2] = 0;
        d2 = 0;
      }
      g2 = e2 - c2 | 0;
      f2 = d2 - c2 | 0;
      if ((c2 | 0) < 0) {
        b[a3 >> 2] = g2;
        b[i >> 2] = f2;
        b[h >> 2] = 0;
        e2 = g2;
        c2 = 0;
      } else {
        f2 = d2;
      }
      d2 = (f2 | 0) < (e2 | 0) ? f2 : e2;
      d2 = (c2 | 0) < (d2 | 0) ? c2 : d2;
      if ((d2 | 0) <= 0) {
        return;
      }
      b[a3 >> 2] = e2 - d2;
      b[i >> 2] = f2 - d2;
      b[h >> 2] = c2 - d2;
      return;
    }
    function Za(a3) {
      a3 = a3 | 0;
      var c2 = 0, d2 = 0, e2 = 0, f2 = 0, g2 = 0, h = 0, i = 0;
      f2 = b[a3 >> 2] | 0;
      h = a3 + 4 | 0;
      c2 = b[h >> 2] | 0;
      i = a3 + 8 | 0;
      d2 = b[i >> 2] | 0;
      e2 = c2 + f2 | 0;
      f2 = d2 + f2 | 0;
      b[a3 >> 2] = f2;
      b[h >> 2] = e2;
      c2 = d2 + c2 | 0;
      b[i >> 2] = c2;
      d2 = e2 - f2 | 0;
      if ((f2 | 0) < 0) {
        c2 = c2 - f2 | 0;
        b[h >> 2] = d2;
        b[i >> 2] = c2;
        b[a3 >> 2] = 0;
        e2 = 0;
      } else {
        d2 = e2;
        e2 = f2;
      }
      if ((d2 | 0) < 0) {
        e2 = e2 - d2 | 0;
        b[a3 >> 2] = e2;
        c2 = c2 - d2 | 0;
        b[i >> 2] = c2;
        b[h >> 2] = 0;
        d2 = 0;
      }
      g2 = e2 - c2 | 0;
      f2 = d2 - c2 | 0;
      if ((c2 | 0) < 0) {
        b[a3 >> 2] = g2;
        b[h >> 2] = f2;
        b[i >> 2] = 0;
        e2 = g2;
        c2 = 0;
      } else {
        f2 = d2;
      }
      d2 = (f2 | 0) < (e2 | 0) ? f2 : e2;
      d2 = (c2 | 0) < (d2 | 0) ? c2 : d2;
      if ((d2 | 0) <= 0) {
        return;
      }
      b[a3 >> 2] = e2 - d2;
      b[h >> 2] = f2 - d2;
      b[i >> 2] = c2 - d2;
      return;
    }
    function _a(a3) {
      a3 = a3 | 0;
      var c2 = 0, d2 = 0, e2 = 0, f2 = 0, g2 = 0, h = 0, i = 0;
      c2 = b[a3 >> 2] | 0;
      h = a3 + 4 | 0;
      e2 = b[h >> 2] | 0;
      i = a3 + 8 | 0;
      d2 = b[i >> 2] | 0;
      f2 = e2 + c2 | 0;
      b[a3 >> 2] = f2;
      e2 = d2 + e2 | 0;
      b[h >> 2] = e2;
      c2 = d2 + c2 | 0;
      b[i >> 2] = c2;
      d2 = e2 - f2 | 0;
      if ((f2 | 0) < 0) {
        c2 = c2 - f2 | 0;
        b[h >> 2] = d2;
        b[i >> 2] = c2;
        b[a3 >> 2] = 0;
        e2 = 0;
      } else {
        d2 = e2;
        e2 = f2;
      }
      if ((d2 | 0) < 0) {
        e2 = e2 - d2 | 0;
        b[a3 >> 2] = e2;
        c2 = c2 - d2 | 0;
        b[i >> 2] = c2;
        b[h >> 2] = 0;
        d2 = 0;
      }
      g2 = e2 - c2 | 0;
      f2 = d2 - c2 | 0;
      if ((c2 | 0) < 0) {
        b[a3 >> 2] = g2;
        b[h >> 2] = f2;
        b[i >> 2] = 0;
        e2 = g2;
        c2 = 0;
      } else {
        f2 = d2;
      }
      d2 = (f2 | 0) < (e2 | 0) ? f2 : e2;
      d2 = (c2 | 0) < (d2 | 0) ? c2 : d2;
      if ((d2 | 0) <= 0) {
        return;
      }
      b[a3 >> 2] = e2 - d2;
      b[h >> 2] = f2 - d2;
      b[i >> 2] = c2 - d2;
      return;
    }
    function $a(a3) {
      a3 = a3 | 0;
      switch (a3 | 0) {
        case 1: {
          a3 = 5;
          break;
        }
        case 5: {
          a3 = 4;
          break;
        }
        case 4: {
          a3 = 6;
          break;
        }
        case 6: {
          a3 = 2;
          break;
        }
        case 2: {
          a3 = 3;
          break;
        }
        case 3: {
          a3 = 1;
          break;
        }
        default:
      }
      return a3 | 0;
    }
    function ab(a3) {
      a3 = a3 | 0;
      switch (a3 | 0) {
        case 1: {
          a3 = 3;
          break;
        }
        case 3: {
          a3 = 2;
          break;
        }
        case 2: {
          a3 = 6;
          break;
        }
        case 6: {
          a3 = 4;
          break;
        }
        case 4: {
          a3 = 5;
          break;
        }
        case 5: {
          a3 = 1;
          break;
        }
        default:
      }
      return a3 | 0;
    }
    function bb(a3) {
      a3 = a3 | 0;
      var c2 = 0, d2 = 0, e2 = 0, f2 = 0, g2 = 0, h = 0, i = 0;
      c2 = b[a3 >> 2] | 0;
      h = a3 + 4 | 0;
      d2 = b[h >> 2] | 0;
      i = a3 + 8 | 0;
      e2 = b[i >> 2] | 0;
      f2 = d2 + (c2 << 1) | 0;
      b[a3 >> 2] = f2;
      d2 = e2 + (d2 << 1) | 0;
      b[h >> 2] = d2;
      c2 = (e2 << 1) + c2 | 0;
      b[i >> 2] = c2;
      e2 = d2 - f2 | 0;
      if ((f2 | 0) < 0) {
        c2 = c2 - f2 | 0;
        b[h >> 2] = e2;
        b[i >> 2] = c2;
        b[a3 >> 2] = 0;
        d2 = e2;
        e2 = 0;
      } else {
        e2 = f2;
      }
      if ((d2 | 0) < 0) {
        e2 = e2 - d2 | 0;
        b[a3 >> 2] = e2;
        c2 = c2 - d2 | 0;
        b[i >> 2] = c2;
        b[h >> 2] = 0;
        d2 = 0;
      }
      g2 = e2 - c2 | 0;
      f2 = d2 - c2 | 0;
      if ((c2 | 0) < 0) {
        b[a3 >> 2] = g2;
        b[h >> 2] = f2;
        b[i >> 2] = 0;
        e2 = g2;
        c2 = 0;
      } else {
        f2 = d2;
      }
      d2 = (f2 | 0) < (e2 | 0) ? f2 : e2;
      d2 = (c2 | 0) < (d2 | 0) ? c2 : d2;
      if ((d2 | 0) <= 0) {
        return;
      }
      b[a3 >> 2] = e2 - d2;
      b[h >> 2] = f2 - d2;
      b[i >> 2] = c2 - d2;
      return;
    }
    function cb(a3) {
      a3 = a3 | 0;
      var c2 = 0, d2 = 0, e2 = 0, f2 = 0, g2 = 0, h = 0, i = 0;
      f2 = b[a3 >> 2] | 0;
      h = a3 + 4 | 0;
      c2 = b[h >> 2] | 0;
      i = a3 + 8 | 0;
      d2 = b[i >> 2] | 0;
      e2 = (c2 << 1) + f2 | 0;
      f2 = d2 + (f2 << 1) | 0;
      b[a3 >> 2] = f2;
      b[h >> 2] = e2;
      c2 = (d2 << 1) + c2 | 0;
      b[i >> 2] = c2;
      d2 = e2 - f2 | 0;
      if ((f2 | 0) < 0) {
        c2 = c2 - f2 | 0;
        b[h >> 2] = d2;
        b[i >> 2] = c2;
        b[a3 >> 2] = 0;
        f2 = 0;
      } else {
        d2 = e2;
      }
      if ((d2 | 0) < 0) {
        f2 = f2 - d2 | 0;
        b[a3 >> 2] = f2;
        c2 = c2 - d2 | 0;
        b[i >> 2] = c2;
        b[h >> 2] = 0;
        d2 = 0;
      }
      g2 = f2 - c2 | 0;
      e2 = d2 - c2 | 0;
      if ((c2 | 0) < 0) {
        b[a3 >> 2] = g2;
        b[h >> 2] = e2;
        b[i >> 2] = 0;
        f2 = g2;
        c2 = 0;
      } else {
        e2 = d2;
      }
      d2 = (e2 | 0) < (f2 | 0) ? e2 : f2;
      d2 = (c2 | 0) < (d2 | 0) ? c2 : d2;
      if ((d2 | 0) <= 0) {
        return;
      }
      b[a3 >> 2] = f2 - d2;
      b[h >> 2] = e2 - d2;
      b[i >> 2] = c2 - d2;
      return;
    }
    function db(a3, c2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      var d2 = 0, e2 = 0, f2 = 0, g2 = 0, h = 0, i = 0;
      h = (b[a3 >> 2] | 0) - (b[c2 >> 2] | 0) | 0;
      i = (h | 0) < 0;
      e2 = (b[a3 + 4 >> 2] | 0) - (b[c2 + 4 >> 2] | 0) - (i ? h : 0) | 0;
      g2 = (e2 | 0) < 0;
      f2 = (i ? 0 - h | 0 : 0) + (b[a3 + 8 >> 2] | 0) - (b[c2 + 8 >> 2] | 0) + (g2 ? 0 - e2 | 0 : 0) | 0;
      a3 = (f2 | 0) < 0;
      c2 = a3 ? 0 : f2;
      d2 = (g2 ? 0 : e2) - (a3 ? f2 : 0) | 0;
      f2 = (i ? 0 : h) - (g2 ? e2 : 0) - (a3 ? f2 : 0) | 0;
      a3 = (d2 | 0) < (f2 | 0) ? d2 : f2;
      a3 = (c2 | 0) < (a3 | 0) ? c2 : a3;
      e2 = (a3 | 0) > 0;
      c2 = c2 - (e2 ? a3 : 0) | 0;
      d2 = d2 - (e2 ? a3 : 0) | 0;
      a3 = f2 - (e2 ? a3 : 0) | 0;
      a3 = (a3 | 0) > -1 ? a3 : 0 - a3 | 0;
      d2 = (d2 | 0) > -1 ? d2 : 0 - d2 | 0;
      c2 = (c2 | 0) > -1 ? c2 : 0 - c2 | 0;
      c2 = (d2 | 0) > (c2 | 0) ? d2 : c2;
      return ((a3 | 0) > (c2 | 0) ? a3 : c2) | 0;
    }
    function eb(a3, c2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      var d2 = 0;
      d2 = b[a3 + 8 >> 2] | 0;
      b[c2 >> 2] = (b[a3 >> 2] | 0) - d2;
      b[c2 + 4 >> 2] = (b[a3 + 4 >> 2] | 0) - d2;
      return;
    }
    function fb(a3, c2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      var d2 = 0, e2 = 0, f2 = 0, g2 = 0, h = 0, i = 0;
      e2 = b[a3 >> 2] | 0;
      b[c2 >> 2] = e2;
      f2 = b[a3 + 4 >> 2] | 0;
      h = c2 + 4 | 0;
      b[h >> 2] = f2;
      i = c2 + 8 | 0;
      b[i >> 2] = 0;
      d2 = (f2 | 0) < (e2 | 0);
      a3 = d2 ? e2 : f2;
      d2 = d2 ? f2 : e2;
      if ((d2 | 0) < 0) {
        if ((d2 | 0) == -2147483648 ? 1 : (a3 | 0) > 0 ? (2147483647 - a3 | 0) < (d2 | 0) : (-2147483648 - a3 | 0) > (d2 | 0)) {
          c2 = 1;
          return c2 | 0;
        }
        if ((a3 | 0) > -1 ? (a3 | -2147483648 | 0) >= (d2 | 0) : (a3 ^ -2147483648 | 0) < (d2 | 0)) {
          c2 = 1;
          return c2 | 0;
        }
      }
      a3 = f2 - e2 | 0;
      if ((e2 | 0) < 0) {
        d2 = 0 - e2 | 0;
        b[h >> 2] = a3;
        b[i >> 2] = d2;
        b[c2 >> 2] = 0;
        e2 = 0;
      } else {
        a3 = f2;
        d2 = 0;
      }
      if ((a3 | 0) < 0) {
        e2 = e2 - a3 | 0;
        b[c2 >> 2] = e2;
        d2 = d2 - a3 | 0;
        b[i >> 2] = d2;
        b[h >> 2] = 0;
        a3 = 0;
      }
      g2 = e2 - d2 | 0;
      f2 = a3 - d2 | 0;
      if ((d2 | 0) < 0) {
        b[c2 >> 2] = g2;
        b[h >> 2] = f2;
        b[i >> 2] = 0;
        a3 = f2;
        f2 = g2;
        d2 = 0;
      } else {
        f2 = e2;
      }
      e2 = (a3 | 0) < (f2 | 0) ? a3 : f2;
      e2 = (d2 | 0) < (e2 | 0) ? d2 : e2;
      if ((e2 | 0) <= 0) {
        c2 = 0;
        return c2 | 0;
      }
      b[c2 >> 2] = f2 - e2;
      b[h >> 2] = a3 - e2;
      b[i >> 2] = d2 - e2;
      c2 = 0;
      return c2 | 0;
    }
    function gb(a3) {
      a3 = a3 | 0;
      var c2 = 0, d2 = 0, e2 = 0, f2 = 0;
      c2 = a3 + 8 | 0;
      f2 = b[c2 >> 2] | 0;
      d2 = f2 - (b[a3 >> 2] | 0) | 0;
      b[a3 >> 2] = d2;
      e2 = a3 + 4 | 0;
      a3 = (b[e2 >> 2] | 0) - f2 | 0;
      b[e2 >> 2] = a3;
      b[c2 >> 2] = 0 - (a3 + d2);
      return;
    }
    function hb(a3) {
      a3 = a3 | 0;
      var c2 = 0, d2 = 0, e2 = 0, f2 = 0, g2 = 0, h = 0, i = 0;
      d2 = b[a3 >> 2] | 0;
      c2 = 0 - d2 | 0;
      b[a3 >> 2] = c2;
      h = a3 + 8 | 0;
      b[h >> 2] = 0;
      i = a3 + 4 | 0;
      e2 = b[i >> 2] | 0;
      f2 = e2 + d2 | 0;
      if ((d2 | 0) > 0) {
        b[i >> 2] = f2;
        b[h >> 2] = d2;
        b[a3 >> 2] = 0;
        c2 = 0;
        e2 = f2;
      } else {
        d2 = 0;
      }
      if ((e2 | 0) < 0) {
        g2 = c2 - e2 | 0;
        b[a3 >> 2] = g2;
        d2 = d2 - e2 | 0;
        b[h >> 2] = d2;
        b[i >> 2] = 0;
        f2 = g2 - d2 | 0;
        c2 = 0 - d2 | 0;
        if ((d2 | 0) < 0) {
          b[a3 >> 2] = f2;
          b[i >> 2] = c2;
          b[h >> 2] = 0;
          e2 = c2;
          d2 = 0;
        } else {
          e2 = 0;
          f2 = g2;
        }
      } else {
        f2 = c2;
      }
      c2 = (e2 | 0) < (f2 | 0) ? e2 : f2;
      c2 = (d2 | 0) < (c2 | 0) ? d2 : c2;
      if ((c2 | 0) <= 0) {
        return;
      }
      b[a3 >> 2] = f2 - c2;
      b[i >> 2] = e2 - c2;
      b[h >> 2] = d2 - c2;
      return;
    }
    function ib(a3, c2, d2, e2, f2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      var g2 = 0, h = 0, i = 0, j = 0, k = 0, l = 0, m = 0;
      m = T;
      T = T + 64 | 0;
      l = m;
      i = m + 56 | 0;
      if (!(true & (c2 & 2013265920 | 0) == 134217728 & (true & (e2 & 2013265920 | 0) == 134217728))) {
        f2 = 5;
        T = m;
        return f2 | 0;
      }
      if ((a3 | 0) == (d2 | 0) & (c2 | 0) == (e2 | 0)) {
        b[f2 >> 2] = 0;
        f2 = 0;
        T = m;
        return f2 | 0;
      }
      h = Qd(a3 | 0, c2 | 0, 52) | 0;
      H() | 0;
      h = h & 15;
      k = Qd(d2 | 0, e2 | 0, 52) | 0;
      H() | 0;
      if ((h | 0) != (k & 15 | 0)) {
        f2 = 12;
        T = m;
        return f2 | 0;
      }
      g2 = h + -1 | 0;
      if (h >>> 0 > 1) {
        Fb(a3, c2, g2, l) | 0;
        Fb(d2, e2, g2, i) | 0;
        k = l;
        j = b[k >> 2] | 0;
        k = b[k + 4 >> 2] | 0;
        a:
          do {
            if ((j | 0) == (b[i >> 2] | 0) ? (k | 0) == (b[i + 4 >> 2] | 0) : 0) {
              h = (h ^ 15) * 3 | 0;
              g2 = Qd(a3 | 0, c2 | 0, h | 0) | 0;
              H() | 0;
              g2 = g2 & 7;
              h = Qd(d2 | 0, e2 | 0, h | 0) | 0;
              H() | 0;
              h = h & 7;
              do {
                if (!((g2 | 0) == 0 | (h | 0) == 0)) {
                  if ((g2 | 0) == 7) {
                    g2 = 5;
                  } else {
                    if ((g2 | 0) == 1 | (h | 0) == 1 ? Hb(j, k) | 0 : 0) {
                      g2 = 5;
                      break;
                    }
                    if ((b[15536 + (g2 << 2) >> 2] | 0) != (h | 0) ? (b[15568 + (g2 << 2) >> 2] | 0) != (h | 0) : 0) {
                      break a;
                    }
                    b[f2 >> 2] = 1;
                    g2 = 0;
                  }
                } else {
                  b[f2 >> 2] = 1;
                  g2 = 0;
                }
              } while (0);
              f2 = g2;
              T = m;
              return f2 | 0;
            }
          } while (0);
      }
      g2 = l;
      h = g2 + 56 | 0;
      do {
        b[g2 >> 2] = 0;
        g2 = g2 + 4 | 0;
      } while ((g2 | 0) < (h | 0));
      aa(a3, c2, 1, l) | 0;
      c2 = l;
      if (((((!((b[c2 >> 2] | 0) == (d2 | 0) ? (b[c2 + 4 >> 2] | 0) == (e2 | 0) : 0) ? (c2 = l + 8 | 0, !((b[c2 >> 2] | 0) == (d2 | 0) ? (b[c2 + 4 >> 2] | 0) == (e2 | 0) : 0)) : 0) ? (c2 = l + 16 | 0, !((b[c2 >> 2] | 0) == (d2 | 0) ? (b[c2 + 4 >> 2] | 0) == (e2 | 0) : 0)) : 0) ? (c2 = l + 24 | 0, !((b[c2 >> 2] | 0) == (d2 | 0) ? (b[c2 + 4 >> 2] | 0) == (e2 | 0) : 0)) : 0) ? (c2 = l + 32 | 0, !((b[c2 >> 2] | 0) == (d2 | 0) ? (b[c2 + 4 >> 2] | 0) == (e2 | 0) : 0)) : 0) ? (c2 = l + 40 | 0, !((b[c2 >> 2] | 0) == (d2 | 0) ? (b[c2 + 4 >> 2] | 0) == (e2 | 0) : 0)) : 0) {
        g2 = l + 48 | 0;
        g2 = ((b[g2 >> 2] | 0) == (d2 | 0) ? (b[g2 + 4 >> 2] | 0) == (e2 | 0) : 0) & 1;
      } else {
        g2 = 1;
      }
      b[f2 >> 2] = g2;
      f2 = 0;
      T = m;
      return f2 | 0;
    }
    function jb(a3, c2, d2, e2, f2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      d2 = ia(a3, c2, d2, e2) | 0;
      if ((d2 | 0) == 7) {
        f2 = 11;
        return f2 | 0;
      }
      e2 = Rd(d2 | 0, 0, 56) | 0;
      c2 = c2 & -2130706433 | (H() | 0) | 268435456;
      b[f2 >> 2] = a3 | e2;
      b[f2 + 4 >> 2] = c2;
      f2 = 0;
      return f2 | 0;
    }
    function kb(a3, c2, d2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      if (!(true & (c2 & 2013265920 | 0) == 268435456)) {
        d2 = 6;
        return d2 | 0;
      }
      b[d2 >> 2] = a3;
      b[d2 + 4 >> 2] = c2 & -2130706433 | 134217728;
      d2 = 0;
      return d2 | 0;
    }
    function lb(a3, c2, d2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      var e2 = 0, f2 = 0, g2 = 0;
      f2 = T;
      T = T + 16 | 0;
      e2 = f2;
      b[e2 >> 2] = 0;
      if (!(true & (c2 & 2013265920 | 0) == 268435456)) {
        e2 = 6;
        T = f2;
        return e2 | 0;
      }
      g2 = Qd(a3 | 0, c2 | 0, 56) | 0;
      H() | 0;
      e2 = ea(a3, c2 & -2130706433 | 134217728, g2 & 7, e2, d2) | 0;
      T = f2;
      return e2 | 0;
    }
    function mb(a3, b2) {
      a3 = a3 | 0;
      b2 = b2 | 0;
      var c2 = 0;
      c2 = Qd(a3 | 0, b2 | 0, 56) | 0;
      H() | 0;
      switch (c2 & 7) {
        case 0:
        case 7: {
          c2 = 0;
          return c2 | 0;
        }
        default:
      }
      c2 = b2 & -2130706433 | 134217728;
      if (!(true & (b2 & 2013265920 | 0) == 268435456)) {
        c2 = 0;
        return c2 | 0;
      }
      if (true & (b2 & 117440512 | 0) == 16777216 & (Hb(a3, c2) | 0) != 0) {
        c2 = 0;
        return c2 | 0;
      }
      c2 = Db(a3, c2) | 0;
      return c2 | 0;
    }
    function nb(a3, c2, d2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      var e2 = 0, f2 = 0, g2 = 0, h = 0;
      f2 = T;
      T = T + 16 | 0;
      e2 = f2;
      if (!(true & (c2 & 2013265920 | 0) == 268435456)) {
        e2 = 6;
        T = f2;
        return e2 | 0;
      }
      g2 = c2 & -2130706433 | 134217728;
      h = d2;
      b[h >> 2] = a3;
      b[h + 4 >> 2] = g2;
      b[e2 >> 2] = 0;
      c2 = Qd(a3 | 0, c2 | 0, 56) | 0;
      H() | 0;
      e2 = ea(a3, g2, c2 & 7, e2, d2 + 8 | 0) | 0;
      T = f2;
      return e2 | 0;
    }
    function ob(a3, c2, d2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      var e2 = 0, f2 = 0;
      f2 = (Hb(a3, c2) | 0) == 0;
      c2 = c2 & -2130706433;
      e2 = d2;
      b[e2 >> 2] = f2 ? a3 : 0;
      b[e2 + 4 >> 2] = f2 ? c2 | 285212672 : 0;
      e2 = d2 + 8 | 0;
      b[e2 >> 2] = a3;
      b[e2 + 4 >> 2] = c2 | 301989888;
      e2 = d2 + 16 | 0;
      b[e2 >> 2] = a3;
      b[e2 + 4 >> 2] = c2 | 318767104;
      e2 = d2 + 24 | 0;
      b[e2 >> 2] = a3;
      b[e2 + 4 >> 2] = c2 | 335544320;
      e2 = d2 + 32 | 0;
      b[e2 >> 2] = a3;
      b[e2 + 4 >> 2] = c2 | 352321536;
      d2 = d2 + 40 | 0;
      b[d2 >> 2] = a3;
      b[d2 + 4 >> 2] = c2 | 369098752;
      return 0;
    }
    function pb(a3, c2, d2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      var e2 = 0, f2 = 0, g2 = 0, h = 0;
      h = T;
      T = T + 16 | 0;
      f2 = h;
      g2 = c2 & -2130706433 | 134217728;
      if (!(true & (c2 & 2013265920 | 0) == 268435456)) {
        g2 = 6;
        T = h;
        return g2 | 0;
      }
      e2 = Qd(a3 | 0, c2 | 0, 56) | 0;
      H() | 0;
      e2 = od(a3, g2, e2 & 7) | 0;
      if ((e2 | 0) == -1) {
        b[d2 >> 2] = 0;
        g2 = 6;
        T = h;
        return g2 | 0;
      }
      if (Yb(a3, g2, f2) | 0) {
        I(27795, 26932, 282, 26947);
      }
      c2 = Qd(a3 | 0, c2 | 0, 52) | 0;
      H() | 0;
      c2 = c2 & 15;
      if (!(Hb(a3, g2) | 0)) {
        zb(f2, c2, e2, 2, d2);
      } else {
        vb(f2, c2, e2, 2, d2);
      }
      g2 = 0;
      T = h;
      return g2 | 0;
    }
    function qb(a3, b2, c2) {
      a3 = a3 | 0;
      b2 = b2 | 0;
      c2 = c2 | 0;
      var d2 = 0, e2 = 0;
      d2 = T;
      T = T + 16 | 0;
      e2 = d2;
      rb(a3, b2, c2, e2);
      La(e2, c2 + 4 | 0);
      T = d2;
      return;
    }
    function rb(a3, c2, d2, f2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      f2 = f2 | 0;
      var g2 = 0, h = 0, i = 0, j = 0, k = 0;
      j = T;
      T = T + 16 | 0;
      k = j;
      sb(a3, d2, k);
      h = +w(+(1 - +e[k >> 3] * 0.5));
      if (h < 0.0000000000000001) {
        b[f2 >> 2] = 0;
        b[f2 + 4 >> 2] = 0;
        b[f2 + 8 >> 2] = 0;
        b[f2 + 12 >> 2] = 0;
        T = j;
        return;
      }
      k = b[d2 >> 2] | 0;
      g2 = +e[15920 + (k * 24 | 0) >> 3];
      g2 = +ic(g2 - +ic(+oc(15600 + (k << 4) | 0, a3)));
      if (!(Vb(c2) | 0)) {
        i = g2;
      } else {
        i = +ic(g2 + -0.3334731722518321);
      }
      g2 = +v(+h) * 2.618033988749896;
      if ((c2 | 0) > 0) {
        a3 = 0;
        do {
          g2 = g2 * 2.6457513110645907;
          a3 = a3 + 1 | 0;
        } while ((a3 | 0) != (c2 | 0));
      }
      h = +t(+i) * g2;
      e[f2 >> 3] = h;
      i = +u(+i) * g2;
      e[f2 + 8 >> 3] = i;
      T = j;
      return;
    }
    function sb(a3, c2, d2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      var f2 = 0, g2 = 0, h = 0;
      h = T;
      T = T + 32 | 0;
      g2 = h;
      nd(a3, g2);
      b[c2 >> 2] = 0;
      e[d2 >> 3] = 5;
      f2 = +md(16400, g2);
      if (f2 < +e[d2 >> 3]) {
        b[c2 >> 2] = 0;
        e[d2 >> 3] = f2;
      }
      f2 = +md(16424, g2);
      if (f2 < +e[d2 >> 3]) {
        b[c2 >> 2] = 1;
        e[d2 >> 3] = f2;
      }
      f2 = +md(16448, g2);
      if (f2 < +e[d2 >> 3]) {
        b[c2 >> 2] = 2;
        e[d2 >> 3] = f2;
      }
      f2 = +md(16472, g2);
      if (f2 < +e[d2 >> 3]) {
        b[c2 >> 2] = 3;
        e[d2 >> 3] = f2;
      }
      f2 = +md(16496, g2);
      if (f2 < +e[d2 >> 3]) {
        b[c2 >> 2] = 4;
        e[d2 >> 3] = f2;
      }
      f2 = +md(16520, g2);
      if (f2 < +e[d2 >> 3]) {
        b[c2 >> 2] = 5;
        e[d2 >> 3] = f2;
      }
      f2 = +md(16544, g2);
      if (f2 < +e[d2 >> 3]) {
        b[c2 >> 2] = 6;
        e[d2 >> 3] = f2;
      }
      f2 = +md(16568, g2);
      if (f2 < +e[d2 >> 3]) {
        b[c2 >> 2] = 7;
        e[d2 >> 3] = f2;
      }
      f2 = +md(16592, g2);
      if (f2 < +e[d2 >> 3]) {
        b[c2 >> 2] = 8;
        e[d2 >> 3] = f2;
      }
      f2 = +md(16616, g2);
      if (f2 < +e[d2 >> 3]) {
        b[c2 >> 2] = 9;
        e[d2 >> 3] = f2;
      }
      f2 = +md(16640, g2);
      if (f2 < +e[d2 >> 3]) {
        b[c2 >> 2] = 10;
        e[d2 >> 3] = f2;
      }
      f2 = +md(16664, g2);
      if (f2 < +e[d2 >> 3]) {
        b[c2 >> 2] = 11;
        e[d2 >> 3] = f2;
      }
      f2 = +md(16688, g2);
      if (f2 < +e[d2 >> 3]) {
        b[c2 >> 2] = 12;
        e[d2 >> 3] = f2;
      }
      f2 = +md(16712, g2);
      if (f2 < +e[d2 >> 3]) {
        b[c2 >> 2] = 13;
        e[d2 >> 3] = f2;
      }
      f2 = +md(16736, g2);
      if (f2 < +e[d2 >> 3]) {
        b[c2 >> 2] = 14;
        e[d2 >> 3] = f2;
      }
      f2 = +md(16760, g2);
      if (f2 < +e[d2 >> 3]) {
        b[c2 >> 2] = 15;
        e[d2 >> 3] = f2;
      }
      f2 = +md(16784, g2);
      if (f2 < +e[d2 >> 3]) {
        b[c2 >> 2] = 16;
        e[d2 >> 3] = f2;
      }
      f2 = +md(16808, g2);
      if (f2 < +e[d2 >> 3]) {
        b[c2 >> 2] = 17;
        e[d2 >> 3] = f2;
      }
      f2 = +md(16832, g2);
      if (f2 < +e[d2 >> 3]) {
        b[c2 >> 2] = 18;
        e[d2 >> 3] = f2;
      }
      f2 = +md(16856, g2);
      if (!(f2 < +e[d2 >> 3])) {
        T = h;
        return;
      }
      b[c2 >> 2] = 19;
      e[d2 >> 3] = f2;
      T = h;
      return;
    }
    function tb(a3, c2, d2, f2, g2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      var h = 0, i = 0, j = 0;
      h = +jd(a3);
      if (h < 0.0000000000000001) {
        c2 = 15600 + (c2 << 4) | 0;
        b[g2 >> 2] = b[c2 >> 2];
        b[g2 + 4 >> 2] = b[c2 + 4 >> 2];
        b[g2 + 8 >> 2] = b[c2 + 8 >> 2];
        b[g2 + 12 >> 2] = b[c2 + 12 >> 2];
        return;
      }
      i = +z(+ +e[a3 + 8 >> 3], + +e[a3 >> 3]);
      if ((d2 | 0) > 0) {
        a3 = 0;
        do {
          h = h * 0.37796447300922725;
          a3 = a3 + 1 | 0;
        } while ((a3 | 0) != (d2 | 0));
      }
      j = h * 0.3333333333333333;
      if (!f2) {
        h = +y(+(h * 0.381966011250105));
        if (Vb(d2) | 0) {
          i = +ic(i + 0.3334731722518321);
        }
      } else {
        d2 = (Vb(d2) | 0) == 0;
        h = +y(+((d2 ? j : j * 0.37796447300922725) * 0.381966011250105));
      }
      pc(15600 + (c2 << 4) | 0, +ic(+e[15920 + (c2 * 24 | 0) >> 3] - i), h, g2);
      return;
    }
    function ub(a3, c2, d2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      var e2 = 0, f2 = 0;
      e2 = T;
      T = T + 16 | 0;
      f2 = e2;
      Na(a3 + 4 | 0, f2);
      tb(f2, b[a3 >> 2] | 0, c2, 0, d2);
      T = e2;
      return;
    }
    function vb(a3, c2, d2, f2, g2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      var h = 0, i = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, p3 = 0, q2 = 0, r2 = 0, s2 = 0, t2 = 0, u2 = 0, v2 = 0, w2 = 0, x2 = 0, y2 = 0, z2 = 0, A2 = 0, B2 = 0, C2 = 0, D2 = 0, E2 = 0, F = 0, G2 = 0, H2 = 0, J2 = 0;
      G2 = T;
      T = T + 272 | 0;
      h = G2 + 256 | 0;
      u2 = G2 + 240 | 0;
      D2 = G2;
      E2 = G2 + 224 | 0;
      F = G2 + 208 | 0;
      v2 = G2 + 176 | 0;
      w2 = G2 + 160 | 0;
      x2 = G2 + 192 | 0;
      y2 = G2 + 144 | 0;
      z2 = G2 + 128 | 0;
      A2 = G2 + 112 | 0;
      B2 = G2 + 96 | 0;
      C2 = G2 + 80 | 0;
      b[h >> 2] = c2;
      b[u2 >> 2] = b[a3 >> 2];
      b[u2 + 4 >> 2] = b[a3 + 4 >> 2];
      b[u2 + 8 >> 2] = b[a3 + 8 >> 2];
      b[u2 + 12 >> 2] = b[a3 + 12 >> 2];
      wb(u2, h, D2);
      b[g2 >> 2] = 0;
      u2 = f2 + d2 + ((f2 | 0) == 5 & 1) | 0;
      if ((u2 | 0) <= (d2 | 0)) {
        T = G2;
        return;
      }
      k = b[h >> 2] | 0;
      l = E2 + 4 | 0;
      m = v2 + 4 | 0;
      n = d2 + 5 | 0;
      o = 16880 + (k << 2) | 0;
      p3 = 16960 + (k << 2) | 0;
      q2 = z2 + 8 | 0;
      r2 = A2 + 8 | 0;
      s2 = B2 + 8 | 0;
      t2 = F + 4 | 0;
      j = d2;
      a:
        while (true) {
          i = D2 + (((j | 0) % 5 | 0) << 4) | 0;
          b[F >> 2] = b[i >> 2];
          b[F + 4 >> 2] = b[i + 4 >> 2];
          b[F + 8 >> 2] = b[i + 8 >> 2];
          b[F + 12 >> 2] = b[i + 12 >> 2];
          do {} while ((xb(F, k, 0, 1) | 0) == 2);
          if ((j | 0) > (d2 | 0) & (Vb(c2) | 0) != 0) {
            b[v2 >> 2] = b[F >> 2];
            b[v2 + 4 >> 2] = b[F + 4 >> 2];
            b[v2 + 8 >> 2] = b[F + 8 >> 2];
            b[v2 + 12 >> 2] = b[F + 12 >> 2];
            Na(l, w2);
            f2 = b[v2 >> 2] | 0;
            h = b[17040 + (f2 * 80 | 0) + (b[E2 >> 2] << 2) >> 2] | 0;
            b[v2 >> 2] = b[18640 + (f2 * 80 | 0) + (h * 20 | 0) >> 2];
            i = b[18640 + (f2 * 80 | 0) + (h * 20 | 0) + 16 >> 2] | 0;
            if ((i | 0) > 0) {
              a3 = 0;
              do {
                Za(m);
                a3 = a3 + 1 | 0;
              } while ((a3 | 0) < (i | 0));
            }
            i = 18640 + (f2 * 80 | 0) + (h * 20 | 0) + 4 | 0;
            b[x2 >> 2] = b[i >> 2];
            b[x2 + 4 >> 2] = b[i + 4 >> 2];
            b[x2 + 8 >> 2] = b[i + 8 >> 2];
            Qa(x2, (b[o >> 2] | 0) * 3 | 0);
            Oa(m, x2, m);
            Ma(m);
            Na(m, y2);
            H2 = +(b[p3 >> 2] | 0);
            e[z2 >> 3] = H2 * 3;
            e[q2 >> 3] = 0;
            J2 = H2 * -1.5;
            e[A2 >> 3] = J2;
            e[r2 >> 3] = H2 * 2.598076211353316;
            e[B2 >> 3] = J2;
            e[s2 >> 3] = H2 * -2.598076211353316;
            switch (b[17040 + ((b[v2 >> 2] | 0) * 80 | 0) + (b[F >> 2] << 2) >> 2] | 0) {
              case 1: {
                a3 = A2;
                f2 = z2;
                break;
              }
              case 3: {
                a3 = B2;
                f2 = A2;
                break;
              }
              case 2: {
                a3 = z2;
                f2 = B2;
                break;
              }
              default: {
                a3 = 12;
                break a;
              }
            }
            kd(w2, y2, f2, a3, C2);
            tb(C2, b[v2 >> 2] | 0, k, 1, g2 + 8 + (b[g2 >> 2] << 4) | 0);
            b[g2 >> 2] = (b[g2 >> 2] | 0) + 1;
          }
          if ((j | 0) < (n | 0)) {
            Na(t2, v2);
            tb(v2, b[F >> 2] | 0, k, 1, g2 + 8 + (b[g2 >> 2] << 4) | 0);
            b[g2 >> 2] = (b[g2 >> 2] | 0) + 1;
          }
          b[E2 >> 2] = b[F >> 2];
          b[E2 + 4 >> 2] = b[F + 4 >> 2];
          b[E2 + 8 >> 2] = b[F + 8 >> 2];
          b[E2 + 12 >> 2] = b[F + 12 >> 2];
          j = j + 1 | 0;
          if ((j | 0) >= (u2 | 0)) {
            a3 = 3;
            break;
          }
        }
      if ((a3 | 0) == 3) {
        T = G2;
        return;
      } else if ((a3 | 0) == 12) {
        I(26970, 27017, 572, 27027);
      }
    }
    function wb(a3, c2, d2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      var e2 = 0, f2 = 0, g2 = 0, h = 0, i = 0, j = 0;
      j = T;
      T = T + 128 | 0;
      e2 = j + 64 | 0;
      f2 = j;
      g2 = e2;
      h = 20240;
      i = g2 + 60 | 0;
      do {
        b[g2 >> 2] = b[h >> 2];
        g2 = g2 + 4 | 0;
        h = h + 4 | 0;
      } while ((g2 | 0) < (i | 0));
      g2 = f2;
      h = 20304;
      i = g2 + 60 | 0;
      do {
        b[g2 >> 2] = b[h >> 2];
        g2 = g2 + 4 | 0;
        h = h + 4 | 0;
      } while ((g2 | 0) < (i | 0));
      i = (Vb(b[c2 >> 2] | 0) | 0) == 0;
      e2 = i ? e2 : f2;
      f2 = a3 + 4 | 0;
      bb(f2);
      cb(f2);
      if (Vb(b[c2 >> 2] | 0) | 0) {
        Xa(f2);
        b[c2 >> 2] = (b[c2 >> 2] | 0) + 1;
      }
      b[d2 >> 2] = b[a3 >> 2];
      c2 = d2 + 4 | 0;
      Oa(f2, e2, c2);
      Ma(c2);
      b[d2 + 16 >> 2] = b[a3 >> 2];
      c2 = d2 + 20 | 0;
      Oa(f2, e2 + 12 | 0, c2);
      Ma(c2);
      b[d2 + 32 >> 2] = b[a3 >> 2];
      c2 = d2 + 36 | 0;
      Oa(f2, e2 + 24 | 0, c2);
      Ma(c2);
      b[d2 + 48 >> 2] = b[a3 >> 2];
      c2 = d2 + 52 | 0;
      Oa(f2, e2 + 36 | 0, c2);
      Ma(c2);
      b[d2 + 64 >> 2] = b[a3 >> 2];
      d2 = d2 + 68 | 0;
      Oa(f2, e2 + 48 | 0, d2);
      Ma(d2);
      T = j;
      return;
    }
    function xb(a3, c2, d2, e2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      var f2 = 0, g2 = 0, h = 0, i = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, p3 = 0;
      p3 = T;
      T = T + 32 | 0;
      n = p3 + 12 | 0;
      i = p3;
      o = a3 + 4 | 0;
      m = b[16960 + (c2 << 2) >> 2] | 0;
      l = (e2 | 0) != 0;
      m = l ? m * 3 | 0 : m;
      f2 = b[o >> 2] | 0;
      k = a3 + 8 | 0;
      h = b[k >> 2] | 0;
      if (l) {
        g2 = a3 + 12 | 0;
        e2 = b[g2 >> 2] | 0;
        f2 = h + f2 + e2 | 0;
        if ((f2 | 0) == (m | 0)) {
          o = 1;
          T = p3;
          return o | 0;
        } else {
          j = g2;
        }
      } else {
        j = a3 + 12 | 0;
        e2 = b[j >> 2] | 0;
        f2 = h + f2 + e2 | 0;
      }
      if ((f2 | 0) <= (m | 0)) {
        o = 0;
        T = p3;
        return o | 0;
      }
      do {
        if ((e2 | 0) > 0) {
          e2 = b[a3 >> 2] | 0;
          if ((h | 0) > 0) {
            g2 = 18640 + (e2 * 80 | 0) + 60 | 0;
            e2 = a3;
            break;
          }
          e2 = 18640 + (e2 * 80 | 0) + 40 | 0;
          if (!d2) {
            g2 = e2;
            e2 = a3;
          } else {
            Ka(n, m, 0, 0);
            Pa(o, n, i);
            _a(i);
            Oa(i, n, o);
            g2 = e2;
            e2 = a3;
          }
        } else {
          g2 = 18640 + ((b[a3 >> 2] | 0) * 80 | 0) + 20 | 0;
          e2 = a3;
        }
      } while (0);
      b[e2 >> 2] = b[g2 >> 2];
      f2 = g2 + 16 | 0;
      if ((b[f2 >> 2] | 0) > 0) {
        e2 = 0;
        do {
          Za(o);
          e2 = e2 + 1 | 0;
        } while ((e2 | 0) < (b[f2 >> 2] | 0));
      }
      a3 = g2 + 4 | 0;
      b[n >> 2] = b[a3 >> 2];
      b[n + 4 >> 2] = b[a3 + 4 >> 2];
      b[n + 8 >> 2] = b[a3 + 8 >> 2];
      c2 = b[16880 + (c2 << 2) >> 2] | 0;
      Qa(n, l ? c2 * 3 | 0 : c2);
      Oa(o, n, o);
      Ma(o);
      if (l) {
        e2 = ((b[k >> 2] | 0) + (b[o >> 2] | 0) + (b[j >> 2] | 0) | 0) == (m | 0) ? 1 : 2;
      } else {
        e2 = 2;
      }
      o = e2;
      T = p3;
      return o | 0;
    }
    function yb(a3, b2) {
      a3 = a3 | 0;
      b2 = b2 | 0;
      var c2 = 0;
      do {
        c2 = xb(a3, b2, 0, 1) | 0;
      } while ((c2 | 0) == 2);
      return c2 | 0;
    }
    function zb(a3, c2, d2, f2, g2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      var h = 0, i = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, p3 = 0, q2 = 0, r2 = 0, s2 = 0, t2 = 0, u2 = 0, v2 = 0, w2 = 0, x2 = 0, y2 = 0, z2 = 0, A2 = 0, B2 = 0, C2 = 0, D2 = 0;
      B2 = T;
      T = T + 240 | 0;
      h = B2 + 224 | 0;
      x2 = B2 + 208 | 0;
      y2 = B2;
      z2 = B2 + 192 | 0;
      A2 = B2 + 176 | 0;
      s2 = B2 + 160 | 0;
      t2 = B2 + 144 | 0;
      u2 = B2 + 128 | 0;
      v2 = B2 + 112 | 0;
      w2 = B2 + 96 | 0;
      b[h >> 2] = c2;
      b[x2 >> 2] = b[a3 >> 2];
      b[x2 + 4 >> 2] = b[a3 + 4 >> 2];
      b[x2 + 8 >> 2] = b[a3 + 8 >> 2];
      b[x2 + 12 >> 2] = b[a3 + 12 >> 2];
      Ab(x2, h, y2);
      b[g2 >> 2] = 0;
      r2 = f2 + d2 + ((f2 | 0) == 6 & 1) | 0;
      if ((r2 | 0) <= (d2 | 0)) {
        T = B2;
        return;
      }
      k = b[h >> 2] | 0;
      l = d2 + 6 | 0;
      m = 16960 + (k << 2) | 0;
      n = t2 + 8 | 0;
      o = u2 + 8 | 0;
      p3 = v2 + 8 | 0;
      q2 = z2 + 4 | 0;
      i = 0;
      j = d2;
      f2 = -1;
      a:
        while (true) {
          h = (j | 0) % 6 | 0;
          a3 = y2 + (h << 4) | 0;
          b[z2 >> 2] = b[a3 >> 2];
          b[z2 + 4 >> 2] = b[a3 + 4 >> 2];
          b[z2 + 8 >> 2] = b[a3 + 8 >> 2];
          b[z2 + 12 >> 2] = b[a3 + 12 >> 2];
          a3 = i;
          i = xb(z2, k, 0, 1) | 0;
          if ((j | 0) > (d2 | 0) & (Vb(c2) | 0) != 0 ? (a3 | 0) != 1 ? (b[z2 >> 2] | 0) != (f2 | 0) : 0 : 0) {
            Na(y2 + (((h + 5 | 0) % 6 | 0) << 4) + 4 | 0, A2);
            Na(y2 + (h << 4) + 4 | 0, s2);
            C2 = +(b[m >> 2] | 0);
            e[t2 >> 3] = C2 * 3;
            e[n >> 3] = 0;
            D2 = C2 * -1.5;
            e[u2 >> 3] = D2;
            e[o >> 3] = C2 * 2.598076211353316;
            e[v2 >> 3] = D2;
            e[p3 >> 3] = C2 * -2.598076211353316;
            h = b[x2 >> 2] | 0;
            switch (b[17040 + (h * 80 | 0) + (((f2 | 0) == (h | 0) ? b[z2 >> 2] | 0 : f2) << 2) >> 2] | 0) {
              case 1: {
                a3 = u2;
                f2 = t2;
                break;
              }
              case 3: {
                a3 = v2;
                f2 = u2;
                break;
              }
              case 2: {
                a3 = t2;
                f2 = v2;
                break;
              }
              default: {
                a3 = 8;
                break a;
              }
            }
            kd(A2, s2, f2, a3, w2);
            if (!(ld(A2, w2) | 0) ? !(ld(s2, w2) | 0) : 0) {
              tb(w2, b[x2 >> 2] | 0, k, 1, g2 + 8 + (b[g2 >> 2] << 4) | 0);
              b[g2 >> 2] = (b[g2 >> 2] | 0) + 1;
            }
          }
          if ((j | 0) < (l | 0)) {
            Na(q2, A2);
            tb(A2, b[z2 >> 2] | 0, k, 1, g2 + 8 + (b[g2 >> 2] << 4) | 0);
            b[g2 >> 2] = (b[g2 >> 2] | 0) + 1;
          }
          j = j + 1 | 0;
          if ((j | 0) >= (r2 | 0)) {
            a3 = 3;
            break;
          } else {
            f2 = b[z2 >> 2] | 0;
          }
        }
      if ((a3 | 0) == 3) {
        T = B2;
        return;
      } else if ((a3 | 0) == 8) {
        I(27054, 27017, 737, 27099);
      }
    }
    function Ab(a3, c2, d2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      var e2 = 0, f2 = 0, g2 = 0, h = 0, i = 0, j = 0;
      j = T;
      T = T + 160 | 0;
      e2 = j + 80 | 0;
      f2 = j;
      g2 = e2;
      h = 20368;
      i = g2 + 72 | 0;
      do {
        b[g2 >> 2] = b[h >> 2];
        g2 = g2 + 4 | 0;
        h = h + 4 | 0;
      } while ((g2 | 0) < (i | 0));
      g2 = f2;
      h = 20448;
      i = g2 + 72 | 0;
      do {
        b[g2 >> 2] = b[h >> 2];
        g2 = g2 + 4 | 0;
        h = h + 4 | 0;
      } while ((g2 | 0) < (i | 0));
      i = (Vb(b[c2 >> 2] | 0) | 0) == 0;
      e2 = i ? e2 : f2;
      f2 = a3 + 4 | 0;
      bb(f2);
      cb(f2);
      if (Vb(b[c2 >> 2] | 0) | 0) {
        Xa(f2);
        b[c2 >> 2] = (b[c2 >> 2] | 0) + 1;
      }
      b[d2 >> 2] = b[a3 >> 2];
      c2 = d2 + 4 | 0;
      Oa(f2, e2, c2);
      Ma(c2);
      b[d2 + 16 >> 2] = b[a3 >> 2];
      c2 = d2 + 20 | 0;
      Oa(f2, e2 + 12 | 0, c2);
      Ma(c2);
      b[d2 + 32 >> 2] = b[a3 >> 2];
      c2 = d2 + 36 | 0;
      Oa(f2, e2 + 24 | 0, c2);
      Ma(c2);
      b[d2 + 48 >> 2] = b[a3 >> 2];
      c2 = d2 + 52 | 0;
      Oa(f2, e2 + 36 | 0, c2);
      Ma(c2);
      b[d2 + 64 >> 2] = b[a3 >> 2];
      c2 = d2 + 68 | 0;
      Oa(f2, e2 + 48 | 0, c2);
      Ma(c2);
      b[d2 + 80 >> 2] = b[a3 >> 2];
      d2 = d2 + 84 | 0;
      Oa(f2, e2 + 60 | 0, d2);
      Ma(d2);
      T = j;
      return;
    }
    function Bb(a3, b2) {
      a3 = a3 | 0;
      b2 = b2 | 0;
      b2 = Qd(a3 | 0, b2 | 0, 52) | 0;
      H() | 0;
      return b2 & 15 | 0;
    }
    function Cb(a3, b2) {
      a3 = a3 | 0;
      b2 = b2 | 0;
      b2 = Qd(a3 | 0, b2 | 0, 45) | 0;
      H() | 0;
      return b2 & 127 | 0;
    }
    function Db(b2, c2) {
      b2 = b2 | 0;
      c2 = c2 | 0;
      var d2 = 0, e2 = 0, f2 = 0, g2 = 0, h = 0;
      if (!(true & (c2 & -16777216 | 0) == 134217728)) {
        b2 = 0;
        return b2 | 0;
      }
      e2 = Qd(b2 | 0, c2 | 0, 52) | 0;
      H() | 0;
      e2 = e2 & 15;
      d2 = Qd(b2 | 0, c2 | 0, 45) | 0;
      H() | 0;
      d2 = d2 & 127;
      if (d2 >>> 0 > 121) {
        b2 = 0;
        return b2 | 0;
      }
      h = (e2 ^ 15) * 3 | 0;
      f2 = Qd(b2 | 0, c2 | 0, h | 0) | 0;
      h = Rd(f2 | 0, H() | 0, h | 0) | 0;
      f2 = H() | 0;
      g2 = Hd(-1227133514, -1171, h | 0, f2 | 0) | 0;
      if (!((h & 613566756 & g2 | 0) == 0 & (f2 & 4681 & (H() | 0) | 0) == 0)) {
        h = 0;
        return h | 0;
      }
      h = (e2 * 3 | 0) + 19 | 0;
      g2 = Rd(~b2 | 0, ~c2 | 0, h | 0) | 0;
      h = Qd(g2 | 0, H() | 0, h | 0) | 0;
      if (!((e2 | 0) == 15 | (h | 0) == 0 & (H() | 0) == 0)) {
        h = 0;
        return h | 0;
      }
      if (!(a2[20528 + d2 >> 0] | 0)) {
        h = 1;
        return h | 0;
      }
      c2 = c2 & 8191;
      if ((b2 | 0) == 0 & (c2 | 0) == 0) {
        h = 1;
        return h | 0;
      } else {
        h = Sd(b2 | 0, c2 | 0, 0) | 0;
        H() | 0;
        return ((63 - h | 0) % 3 | 0 | 0) != 0 | 0;
      }
      return 0;
    }
    function Eb(a3, c2, d2, e2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      var f2 = 0, g2 = 0, h = 0, i = 0;
      f2 = Rd(c2 | 0, 0, 52) | 0;
      g2 = H() | 0;
      d2 = Rd(d2 | 0, 0, 45) | 0;
      d2 = g2 | (H() | 0) | 134225919;
      if ((c2 | 0) < 1) {
        g2 = -1;
        e2 = d2;
        c2 = a3;
        b[c2 >> 2] = g2;
        a3 = a3 + 4 | 0;
        b[a3 >> 2] = e2;
        return;
      }
      g2 = 1;
      f2 = -1;
      while (true) {
        h = (15 - g2 | 0) * 3 | 0;
        i = Rd(7, 0, h | 0) | 0;
        d2 = d2 & ~(H() | 0);
        h = Rd(e2 | 0, 0, h | 0) | 0;
        f2 = f2 & ~i | h;
        d2 = d2 | (H() | 0);
        if ((g2 | 0) == (c2 | 0)) {
          break;
        } else {
          g2 = g2 + 1 | 0;
        }
      }
      i = a3;
      h = i;
      b[h >> 2] = f2;
      i = i + 4 | 0;
      b[i >> 2] = d2;
      return;
    }
    function Fb(a3, c2, d2, e2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      var f2 = 0, g2 = 0;
      g2 = Qd(a3 | 0, c2 | 0, 52) | 0;
      H() | 0;
      g2 = g2 & 15;
      if (d2 >>> 0 > 15) {
        e2 = 4;
        return e2 | 0;
      }
      if ((g2 | 0) < (d2 | 0)) {
        e2 = 12;
        return e2 | 0;
      }
      if ((g2 | 0) == (d2 | 0)) {
        b[e2 >> 2] = a3;
        b[e2 + 4 >> 2] = c2;
        e2 = 0;
        return e2 | 0;
      }
      f2 = Rd(d2 | 0, 0, 52) | 0;
      f2 = f2 | a3;
      a3 = H() | 0 | c2 & -15728641;
      if ((g2 | 0) > (d2 | 0)) {
        do {
          c2 = Rd(7, 0, (14 - d2 | 0) * 3 | 0) | 0;
          d2 = d2 + 1 | 0;
          f2 = c2 | f2;
          a3 = H() | 0 | a3;
        } while ((d2 | 0) < (g2 | 0));
      }
      b[e2 >> 2] = f2;
      b[e2 + 4 >> 2] = a3;
      e2 = 0;
      return e2 | 0;
    }
    function Gb(a3, c2, d2, e2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      var f2 = 0, g2 = 0, h = 0;
      g2 = Qd(a3 | 0, c2 | 0, 52) | 0;
      H() | 0;
      g2 = g2 & 15;
      if (!((d2 | 0) < 16 & (g2 | 0) <= (d2 | 0))) {
        e2 = 4;
        return e2 | 0;
      }
      f2 = d2 - g2 | 0;
      d2 = Qd(a3 | 0, c2 | 0, 45) | 0;
      H() | 0;
      a:
        do {
          if (!(oa(d2 & 127) | 0)) {
            d2 = Oc(7, 0, f2, ((f2 | 0) < 0) << 31 >> 31) | 0;
            f2 = H() | 0;
          } else {
            b:
              do {
                if (g2 | 0) {
                  d2 = 1;
                  while (true) {
                    h = Rd(7, 0, (15 - d2 | 0) * 3 | 0) | 0;
                    if (!((h & a3 | 0) == 0 & ((H() | 0) & c2 | 0) == 0)) {
                      break;
                    }
                    if (d2 >>> 0 < g2 >>> 0) {
                      d2 = d2 + 1 | 0;
                    } else {
                      break b;
                    }
                  }
                  d2 = Oc(7, 0, f2, ((f2 | 0) < 0) << 31 >> 31) | 0;
                  f2 = H() | 0;
                  break a;
                }
              } while (0);
            d2 = Oc(7, 0, f2, ((f2 | 0) < 0) << 31 >> 31) | 0;
            d2 = Md(d2 | 0, H() | 0, 5, 0) | 0;
            d2 = Gd(d2 | 0, H() | 0, -5, -1) | 0;
            d2 = Kd(d2 | 0, H() | 0, 6, 0) | 0;
            d2 = Gd(d2 | 0, H() | 0, 1, 0) | 0;
            f2 = H() | 0;
          }
        } while (0);
      h = e2;
      b[h >> 2] = d2;
      b[h + 4 >> 2] = f2;
      h = 0;
      return h | 0;
    }
    function Hb(a3, b2) {
      a3 = a3 | 0;
      b2 = b2 | 0;
      var c2 = 0, d2 = 0, e2 = 0;
      e2 = Qd(a3 | 0, b2 | 0, 45) | 0;
      H() | 0;
      if (!(oa(e2 & 127) | 0)) {
        e2 = 0;
        return e2 | 0;
      }
      e2 = Qd(a3 | 0, b2 | 0, 52) | 0;
      H() | 0;
      e2 = e2 & 15;
      a:
        do {
          if (!e2) {
            c2 = 0;
          } else {
            d2 = 1;
            while (true) {
              c2 = Qd(a3 | 0, b2 | 0, (15 - d2 | 0) * 3 | 0) | 0;
              H() | 0;
              c2 = c2 & 7;
              if (c2 | 0) {
                break a;
              }
              if (d2 >>> 0 < e2 >>> 0) {
                d2 = d2 + 1 | 0;
              } else {
                c2 = 0;
                break;
              }
            }
          }
        } while (0);
      e2 = (c2 | 0) == 0 & 1;
      return e2 | 0;
    }
    function Ib(a3, c2, d2, e2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      var f2 = 0, g2 = 0, h = 0, i = 0;
      h = T;
      T = T + 16 | 0;
      g2 = h;
      fc(g2, a3, c2, d2);
      c2 = g2;
      a3 = b[c2 >> 2] | 0;
      c2 = b[c2 + 4 >> 2] | 0;
      if ((a3 | 0) == 0 & (c2 | 0) == 0) {
        T = h;
        return 0;
      }
      f2 = 0;
      d2 = 0;
      do {
        i = e2 + (f2 << 3) | 0;
        b[i >> 2] = a3;
        b[i + 4 >> 2] = c2;
        f2 = Gd(f2 | 0, d2 | 0, 1, 0) | 0;
        d2 = H() | 0;
        hc(g2);
        i = g2;
        a3 = b[i >> 2] | 0;
        c2 = b[i + 4 >> 2] | 0;
      } while (!((a3 | 0) == 0 & (c2 | 0) == 0));
      T = h;
      return 0;
    }
    function Jb(a3, b2, c2, d2) {
      a3 = a3 | 0;
      b2 = b2 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      if ((d2 | 0) < (c2 | 0)) {
        c2 = b2;
        d2 = a3;
        G(c2 | 0);
        return d2 | 0;
      }
      c2 = Rd(-1, -1, ((d2 - c2 | 0) * 3 | 0) + 3 | 0) | 0;
      d2 = Rd(~c2 | 0, ~(H() | 0) | 0, (15 - d2 | 0) * 3 | 0) | 0;
      c2 = ~(H() | 0) & b2;
      d2 = ~d2 & a3;
      G(c2 | 0);
      return d2 | 0;
    }
    function Kb(a3, c2, d2, e2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      var f2 = 0;
      f2 = Qd(a3 | 0, c2 | 0, 52) | 0;
      H() | 0;
      f2 = f2 & 15;
      if (!((d2 | 0) < 16 & (f2 | 0) <= (d2 | 0))) {
        e2 = 4;
        return e2 | 0;
      }
      if ((f2 | 0) < (d2 | 0)) {
        f2 = Rd(-1, -1, ((d2 + -1 - f2 | 0) * 3 | 0) + 3 | 0) | 0;
        f2 = Rd(~f2 | 0, ~(H() | 0) | 0, (15 - d2 | 0) * 3 | 0) | 0;
        c2 = ~(H() | 0) & c2;
        a3 = ~f2 & a3;
      }
      f2 = Rd(d2 | 0, 0, 52) | 0;
      d2 = c2 & -15728641 | (H() | 0);
      b[e2 >> 2] = a3 | f2;
      b[e2 + 4 >> 2] = d2;
      e2 = 0;
      return e2 | 0;
    }
    function Lb(a3, c2, d2, e2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      var f2 = 0, g2 = 0, h = 0, i = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, p3 = 0, q2 = 0, r2 = 0, s2 = 0, t2 = 0, u2 = 0, v2 = 0, w2 = 0, x2 = 0, y2 = 0, z2 = 0, A2 = 0, B2 = 0, C2 = 0, D2 = 0, E2 = 0;
      if ((d2 | 0) == 0 & (e2 | 0) == 0) {
        E2 = 0;
        return E2 | 0;
      }
      f2 = a3;
      g2 = b[f2 >> 2] | 0;
      f2 = b[f2 + 4 >> 2] | 0;
      if (true & (f2 & 15728640 | 0) == 0) {
        if (!((e2 | 0) > 0 | (e2 | 0) == 0 & d2 >>> 0 > 0)) {
          E2 = 0;
          return E2 | 0;
        }
        E2 = c2;
        b[E2 >> 2] = g2;
        b[E2 + 4 >> 2] = f2;
        if ((d2 | 0) == 1 & (e2 | 0) == 0) {
          E2 = 0;
          return E2 | 0;
        }
        f2 = 1;
        g2 = 0;
        do {
          C2 = a3 + (f2 << 3) | 0;
          D2 = b[C2 + 4 >> 2] | 0;
          E2 = c2 + (f2 << 3) | 0;
          b[E2 >> 2] = b[C2 >> 2];
          b[E2 + 4 >> 2] = D2;
          f2 = Gd(f2 | 0, g2 | 0, 1, 0) | 0;
          g2 = H() | 0;
        } while ((g2 | 0) < (e2 | 0) | (g2 | 0) == (e2 | 0) & f2 >>> 0 < d2 >>> 0);
        f2 = 0;
        return f2 | 0;
      }
      B2 = d2 << 3;
      D2 = Dd(B2) | 0;
      if (!D2) {
        E2 = 13;
        return E2 | 0;
      }
      Wd(D2 | 0, a3 | 0, B2 | 0) | 0;
      C2 = Fd(d2, 8) | 0;
      if (!C2) {
        Ed(D2);
        E2 = 13;
        return E2 | 0;
      }
      a:
        while (true) {
          f2 = D2;
          k = b[f2 >> 2] | 0;
          f2 = b[f2 + 4 >> 2] | 0;
          z2 = Qd(k | 0, f2 | 0, 52) | 0;
          H() | 0;
          z2 = z2 & 15;
          A2 = z2 + -1 | 0;
          y2 = (z2 | 0) != 0;
          x2 = (e2 | 0) > 0 | (e2 | 0) == 0 & d2 >>> 0 > 0;
          b:
            do {
              if (y2 & x2) {
                t2 = Rd(A2 | 0, 0, 52) | 0;
                u2 = H() | 0;
                if (A2 >>> 0 > 15) {
                  if (!((k | 0) == 0 & (f2 | 0) == 0)) {
                    E2 = 16;
                    break a;
                  }
                  g2 = 0;
                  a3 = 0;
                  while (true) {
                    g2 = Gd(g2 | 0, a3 | 0, 1, 0) | 0;
                    a3 = H() | 0;
                    if (!((a3 | 0) < (e2 | 0) | (a3 | 0) == (e2 | 0) & g2 >>> 0 < d2 >>> 0)) {
                      break b;
                    }
                    h = D2 + (g2 << 3) | 0;
                    w2 = b[h >> 2] | 0;
                    h = b[h + 4 >> 2] | 0;
                    if (!((w2 | 0) == 0 & (h | 0) == 0)) {
                      f2 = h;
                      E2 = 16;
                      break a;
                    }
                  }
                }
                i = k;
                a3 = f2;
                g2 = 0;
                h = 0;
                while (true) {
                  if (!((i | 0) == 0 & (a3 | 0) == 0)) {
                    if (!(true & (a3 & 117440512 | 0) == 0)) {
                      E2 = 21;
                      break a;
                    }
                    l = Qd(i | 0, a3 | 0, 52) | 0;
                    H() | 0;
                    l = l & 15;
                    if ((l | 0) < (A2 | 0)) {
                      f2 = 12;
                      E2 = 27;
                      break a;
                    }
                    if ((l | 0) != (A2 | 0)) {
                      i = i | t2;
                      a3 = a3 & -15728641 | u2;
                      if (l >>> 0 >= z2 >>> 0) {
                        j = A2;
                        do {
                          w2 = Rd(7, 0, (14 - j | 0) * 3 | 0) | 0;
                          j = j + 1 | 0;
                          i = w2 | i;
                          a3 = H() | 0 | a3;
                        } while (j >>> 0 < l >>> 0);
                      }
                    }
                    n = Od(i | 0, a3 | 0, d2 | 0, e2 | 0) | 0;
                    o = H() | 0;
                    j = C2 + (n << 3) | 0;
                    l = j;
                    m = b[l >> 2] | 0;
                    l = b[l + 4 >> 2] | 0;
                    if (!((m | 0) == 0 & (l | 0) == 0)) {
                      r2 = 0;
                      s2 = 0;
                      do {
                        if ((r2 | 0) > (e2 | 0) | (r2 | 0) == (e2 | 0) & s2 >>> 0 > d2 >>> 0) {
                          E2 = 31;
                          break a;
                        }
                        if ((m | 0) == (i | 0) & (l & -117440513 | 0) == (a3 | 0)) {
                          p3 = Qd(m | 0, l | 0, 56) | 0;
                          H() | 0;
                          p3 = p3 & 7;
                          q2 = p3 + 1 | 0;
                          w2 = Qd(m | 0, l | 0, 45) | 0;
                          H() | 0;
                          c:
                            do {
                              if (!(oa(w2 & 127) | 0)) {
                                l = 7;
                              } else {
                                m = Qd(m | 0, l | 0, 52) | 0;
                                H() | 0;
                                m = m & 15;
                                if (!m) {
                                  l = 6;
                                  break;
                                }
                                l = 1;
                                while (true) {
                                  w2 = Rd(7, 0, (15 - l | 0) * 3 | 0) | 0;
                                  if (!((w2 & i | 0) == 0 & ((H() | 0) & a3 | 0) == 0)) {
                                    l = 7;
                                    break c;
                                  }
                                  if (l >>> 0 < m >>> 0) {
                                    l = l + 1 | 0;
                                  } else {
                                    l = 6;
                                    break;
                                  }
                                }
                              }
                            } while (0);
                          if ((p3 + 2 | 0) >>> 0 > l >>> 0) {
                            E2 = 41;
                            break a;
                          }
                          w2 = Rd(q2 | 0, 0, 56) | 0;
                          a3 = H() | 0 | a3 & -117440513;
                          v2 = j;
                          b[v2 >> 2] = 0;
                          b[v2 + 4 >> 2] = 0;
                          i = w2 | i;
                        } else {
                          n = Gd(n | 0, o | 0, 1, 0) | 0;
                          n = Nd(n | 0, H() | 0, d2 | 0, e2 | 0) | 0;
                          o = H() | 0;
                        }
                        s2 = Gd(s2 | 0, r2 | 0, 1, 0) | 0;
                        r2 = H() | 0;
                        j = C2 + (n << 3) | 0;
                        l = j;
                        m = b[l >> 2] | 0;
                        l = b[l + 4 >> 2] | 0;
                      } while (!((m | 0) == 0 & (l | 0) == 0));
                    }
                    w2 = j;
                    b[w2 >> 2] = i;
                    b[w2 + 4 >> 2] = a3;
                  }
                  g2 = Gd(g2 | 0, h | 0, 1, 0) | 0;
                  h = H() | 0;
                  if (!((h | 0) < (e2 | 0) | (h | 0) == (e2 | 0) & g2 >>> 0 < d2 >>> 0)) {
                    break b;
                  }
                  a3 = D2 + (g2 << 3) | 0;
                  i = b[a3 >> 2] | 0;
                  a3 = b[a3 + 4 >> 2] | 0;
                }
              }
            } while (0);
          w2 = Gd(d2 | 0, e2 | 0, 5, 0) | 0;
          v2 = H() | 0;
          if (v2 >>> 0 < 0 | (v2 | 0) == 0 & w2 >>> 0 < 11) {
            E2 = 85;
            break;
          }
          w2 = Kd(d2 | 0, e2 | 0, 6, 0) | 0;
          H() | 0;
          w2 = Fd(w2, 8) | 0;
          if (!w2) {
            E2 = 48;
            break;
          }
          do {
            if (x2) {
              q2 = 0;
              a3 = 0;
              p3 = 0;
              r2 = 0;
              while (true) {
                l = C2 + (q2 << 3) | 0;
                h = l;
                g2 = b[h >> 2] | 0;
                h = b[h + 4 >> 2] | 0;
                if (!((g2 | 0) == 0 & (h | 0) == 0)) {
                  m = Qd(g2 | 0, h | 0, 56) | 0;
                  H() | 0;
                  m = m & 7;
                  i = m + 1 | 0;
                  n = h & -117440513;
                  v2 = Qd(g2 | 0, h | 0, 45) | 0;
                  H() | 0;
                  d:
                    do {
                      if (oa(v2 & 127) | 0) {
                        o = Qd(g2 | 0, h | 0, 52) | 0;
                        H() | 0;
                        o = o & 15;
                        if (o | 0) {
                          j = 1;
                          while (true) {
                            v2 = Rd(7, 0, (15 - j | 0) * 3 | 0) | 0;
                            if (!((g2 & v2 | 0) == 0 & (n & (H() | 0) | 0) == 0)) {
                              break d;
                            }
                            if (j >>> 0 < o >>> 0) {
                              j = j + 1 | 0;
                            } else {
                              break;
                            }
                          }
                        }
                        h = Rd(i | 0, 0, 56) | 0;
                        g2 = h | g2;
                        h = H() | 0 | n;
                        i = l;
                        b[i >> 2] = g2;
                        b[i + 4 >> 2] = h;
                        i = m + 2 | 0;
                      }
                    } while (0);
                  if ((i | 0) == 7) {
                    v2 = w2 + (a3 << 3) | 0;
                    b[v2 >> 2] = g2;
                    b[v2 + 4 >> 2] = h & -117440513;
                    a3 = Gd(a3 | 0, p3 | 0, 1, 0) | 0;
                    v2 = H() | 0;
                  } else {
                    v2 = p3;
                  }
                } else {
                  v2 = p3;
                }
                q2 = Gd(q2 | 0, r2 | 0, 1, 0) | 0;
                r2 = H() | 0;
                if (!((r2 | 0) < (e2 | 0) | (r2 | 0) == (e2 | 0) & q2 >>> 0 < d2 >>> 0)) {
                  break;
                } else {
                  p3 = v2;
                }
              }
              if (x2) {
                s2 = A2 >>> 0 > 15;
                t2 = Rd(A2 | 0, 0, 52) | 0;
                u2 = H() | 0;
                if (!y2) {
                  g2 = 0;
                  j = 0;
                  i = 0;
                  h = 0;
                  while (true) {
                    if (!((k | 0) == 0 & (f2 | 0) == 0)) {
                      A2 = c2 + (g2 << 3) | 0;
                      b[A2 >> 2] = k;
                      b[A2 + 4 >> 2] = f2;
                      g2 = Gd(g2 | 0, j | 0, 1, 0) | 0;
                      j = H() | 0;
                    }
                    i = Gd(i | 0, h | 0, 1, 0) | 0;
                    h = H() | 0;
                    if (!((h | 0) < (e2 | 0) | (h | 0) == (e2 | 0) & i >>> 0 < d2 >>> 0)) {
                      break;
                    }
                    f2 = D2 + (i << 3) | 0;
                    k = b[f2 >> 2] | 0;
                    f2 = b[f2 + 4 >> 2] | 0;
                  }
                  f2 = v2;
                  break;
                }
                g2 = 0;
                j = 0;
                h = 0;
                i = 0;
                while (true) {
                  do {
                    if (!((k | 0) == 0 & (f2 | 0) == 0)) {
                      o = Qd(k | 0, f2 | 0, 52) | 0;
                      H() | 0;
                      o = o & 15;
                      if (s2 | (o | 0) < (A2 | 0)) {
                        E2 = 80;
                        break a;
                      }
                      if ((o | 0) != (A2 | 0)) {
                        l = k | t2;
                        m = f2 & -15728641 | u2;
                        if (o >>> 0 >= z2 >>> 0) {
                          n = A2;
                          do {
                            y2 = Rd(7, 0, (14 - n | 0) * 3 | 0) | 0;
                            n = n + 1 | 0;
                            l = y2 | l;
                            m = H() | 0 | m;
                          } while (n >>> 0 < o >>> 0);
                        }
                      } else {
                        l = k;
                        m = f2;
                      }
                      p3 = Od(l | 0, m | 0, d2 | 0, e2 | 0) | 0;
                      n = 0;
                      o = 0;
                      r2 = H() | 0;
                      do {
                        if ((n | 0) > (e2 | 0) | (n | 0) == (e2 | 0) & o >>> 0 > d2 >>> 0) {
                          E2 = 81;
                          break a;
                        }
                        y2 = C2 + (p3 << 3) | 0;
                        q2 = b[y2 + 4 >> 2] | 0;
                        if ((q2 & -117440513 | 0) == (m | 0) ? (b[y2 >> 2] | 0) == (l | 0) : 0) {
                          E2 = 65;
                          break;
                        }
                        y2 = Gd(p3 | 0, r2 | 0, 1, 0) | 0;
                        p3 = Nd(y2 | 0, H() | 0, d2 | 0, e2 | 0) | 0;
                        r2 = H() | 0;
                        o = Gd(o | 0, n | 0, 1, 0) | 0;
                        n = H() | 0;
                        y2 = C2 + (p3 << 3) | 0;
                      } while (!((b[y2 >> 2] | 0) == (l | 0) ? (b[y2 + 4 >> 2] | 0) == (m | 0) : 0));
                      if ((E2 | 0) == 65 ? (E2 = 0, true & (q2 & 117440512 | 0) == 100663296) : 0) {
                        break;
                      }
                      y2 = c2 + (g2 << 3) | 0;
                      b[y2 >> 2] = k;
                      b[y2 + 4 >> 2] = f2;
                      g2 = Gd(g2 | 0, j | 0, 1, 0) | 0;
                      j = H() | 0;
                    }
                  } while (0);
                  h = Gd(h | 0, i | 0, 1, 0) | 0;
                  i = H() | 0;
                  if (!((i | 0) < (e2 | 0) | (i | 0) == (e2 | 0) & h >>> 0 < d2 >>> 0)) {
                    break;
                  }
                  f2 = D2 + (h << 3) | 0;
                  k = b[f2 >> 2] | 0;
                  f2 = b[f2 + 4 >> 2] | 0;
                }
                f2 = v2;
              } else {
                g2 = 0;
                f2 = v2;
              }
            } else {
              g2 = 0;
              a3 = 0;
              f2 = 0;
            }
          } while (0);
          Xd(C2 | 0, 0, B2 | 0) | 0;
          Wd(D2 | 0, w2 | 0, a3 << 3 | 0) | 0;
          Ed(w2);
          if ((a3 | 0) == 0 & (f2 | 0) == 0) {
            E2 = 89;
            break;
          } else {
            c2 = c2 + (g2 << 3) | 0;
            e2 = f2;
            d2 = a3;
          }
        }
      if ((E2 | 0) == 16) {
        if (true & (f2 & 117440512 | 0) == 0) {
          f2 = 4;
          E2 = 27;
        } else {
          E2 = 21;
        }
      } else if ((E2 | 0) == 31) {
        I(27795, 27122, 529, 27132);
      } else if ((E2 | 0) == 41) {
        Ed(D2);
        Ed(C2);
        E2 = 10;
        return E2 | 0;
      } else if ((E2 | 0) == 48) {
        Ed(D2);
        Ed(C2);
        E2 = 13;
        return E2 | 0;
      } else if ((E2 | 0) == 80) {
        I(27795, 27122, 620, 27132);
      } else if ((E2 | 0) == 81) {
        I(27795, 27122, 632, 27132);
      } else if ((E2 | 0) == 85) {
        Wd(c2 | 0, D2 | 0, d2 << 3 | 0) | 0;
        E2 = 89;
      }
      if ((E2 | 0) == 21) {
        Ed(D2);
        Ed(C2);
        E2 = 5;
        return E2 | 0;
      } else if ((E2 | 0) == 27) {
        Ed(D2);
        Ed(C2);
        E2 = f2;
        return E2 | 0;
      } else if ((E2 | 0) == 89) {
        Ed(D2);
        Ed(C2);
        E2 = 0;
        return E2 | 0;
      }
      return 0;
    }
    function Mb(a3, c2, d2, e2, f2, g2, h) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      h = h | 0;
      var i = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, p3 = 0, q2 = 0;
      q2 = T;
      T = T + 16 | 0;
      p3 = q2;
      if (!((d2 | 0) > 0 | (d2 | 0) == 0 & c2 >>> 0 > 0)) {
        p3 = 0;
        T = q2;
        return p3 | 0;
      }
      if ((h | 0) >= 16) {
        p3 = 12;
        T = q2;
        return p3 | 0;
      }
      n = 0;
      o = 0;
      m = 0;
      i = 0;
      a:
        while (true) {
          k = a3 + (n << 3) | 0;
          j = b[k >> 2] | 0;
          k = b[k + 4 >> 2] | 0;
          l = Qd(j | 0, k | 0, 52) | 0;
          H() | 0;
          if ((l & 15 | 0) > (h | 0)) {
            i = 12;
            j = 11;
            break;
          }
          fc(p3, j, k, h);
          l = p3;
          k = b[l >> 2] | 0;
          l = b[l + 4 >> 2] | 0;
          if ((k | 0) == 0 & (l | 0) == 0) {
            j = m;
          } else {
            j = m;
            do {
              if (!((i | 0) < (g2 | 0) | (i | 0) == (g2 | 0) & j >>> 0 < f2 >>> 0)) {
                j = 10;
                break a;
              }
              m = e2 + (j << 3) | 0;
              b[m >> 2] = k;
              b[m + 4 >> 2] = l;
              j = Gd(j | 0, i | 0, 1, 0) | 0;
              i = H() | 0;
              hc(p3);
              m = p3;
              k = b[m >> 2] | 0;
              l = b[m + 4 >> 2] | 0;
            } while (!((k | 0) == 0 & (l | 0) == 0));
          }
          n = Gd(n | 0, o | 0, 1, 0) | 0;
          o = H() | 0;
          if (!((o | 0) < (d2 | 0) | (o | 0) == (d2 | 0) & n >>> 0 < c2 >>> 0)) {
            i = 0;
            j = 11;
            break;
          } else {
            m = j;
          }
        }
      if ((j | 0) == 10) {
        p3 = 14;
        T = q2;
        return p3 | 0;
      } else if ((j | 0) == 11) {
        T = q2;
        return i | 0;
      }
      return 0;
    }
    function Nb(a3, c2, d2, e2, f2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      var g2 = 0, h = 0, i = 0, j = 0, k = 0, l = 0, m = 0, n = 0;
      n = T;
      T = T + 16 | 0;
      m = n;
      a:
        do {
          if ((d2 | 0) > 0 | (d2 | 0) == 0 & c2 >>> 0 > 0) {
            k = 0;
            h = 0;
            g2 = 0;
            l = 0;
            while (true) {
              j = a3 + (k << 3) | 0;
              i = b[j >> 2] | 0;
              j = b[j + 4 >> 2] | 0;
              if (!((i | 0) == 0 & (j | 0) == 0)) {
                j = (Gb(i, j, e2, m) | 0) == 0;
                i = m;
                h = Gd(b[i >> 2] | 0, b[i + 4 >> 2] | 0, h | 0, g2 | 0) | 0;
                g2 = H() | 0;
                if (!j) {
                  g2 = 12;
                  break;
                }
              }
              k = Gd(k | 0, l | 0, 1, 0) | 0;
              l = H() | 0;
              if (!((l | 0) < (d2 | 0) | (l | 0) == (d2 | 0) & k >>> 0 < c2 >>> 0)) {
                break a;
              }
            }
            T = n;
            return g2 | 0;
          } else {
            h = 0;
            g2 = 0;
          }
        } while (0);
      b[f2 >> 2] = h;
      b[f2 + 4 >> 2] = g2;
      f2 = 0;
      T = n;
      return f2 | 0;
    }
    function Ob(a3, b2) {
      a3 = a3 | 0;
      b2 = b2 | 0;
      b2 = Qd(a3 | 0, b2 | 0, 52) | 0;
      H() | 0;
      return b2 & 1 | 0;
    }
    function Pb(a3, b2) {
      a3 = a3 | 0;
      b2 = b2 | 0;
      var c2 = 0, d2 = 0, e2 = 0;
      e2 = Qd(a3 | 0, b2 | 0, 52) | 0;
      H() | 0;
      e2 = e2 & 15;
      if (!e2) {
        e2 = 0;
        return e2 | 0;
      }
      d2 = 1;
      while (true) {
        c2 = Qd(a3 | 0, b2 | 0, (15 - d2 | 0) * 3 | 0) | 0;
        H() | 0;
        c2 = c2 & 7;
        if (c2 | 0) {
          d2 = 5;
          break;
        }
        if (d2 >>> 0 < e2 >>> 0) {
          d2 = d2 + 1 | 0;
        } else {
          c2 = 0;
          d2 = 5;
          break;
        }
      }
      if ((d2 | 0) == 5) {
        return c2 | 0;
      }
      return 0;
    }
    function Qb(a3, b2) {
      a3 = a3 | 0;
      b2 = b2 | 0;
      var c2 = 0, d2 = 0, e2 = 0, f2 = 0, g2 = 0, h = 0, i = 0;
      i = Qd(a3 | 0, b2 | 0, 52) | 0;
      H() | 0;
      i = i & 15;
      if (!i) {
        h = b2;
        i = a3;
        G(h | 0);
        return i | 0;
      }
      h = 1;
      c2 = 0;
      while (true) {
        f2 = (15 - h | 0) * 3 | 0;
        d2 = Rd(7, 0, f2 | 0) | 0;
        e2 = H() | 0;
        g2 = Qd(a3 | 0, b2 | 0, f2 | 0) | 0;
        H() | 0;
        f2 = Rd($a(g2 & 7) | 0, 0, f2 | 0) | 0;
        g2 = H() | 0;
        a3 = f2 | a3 & ~d2;
        b2 = g2 | b2 & ~e2;
        a:
          do {
            if (!c2) {
              if (!((f2 & d2 | 0) == 0 & (g2 & e2 | 0) == 0)) {
                d2 = Qd(a3 | 0, b2 | 0, 52) | 0;
                H() | 0;
                d2 = d2 & 15;
                if (!d2) {
                  c2 = 1;
                } else {
                  c2 = 1;
                  b:
                    while (true) {
                      g2 = Qd(a3 | 0, b2 | 0, (15 - c2 | 0) * 3 | 0) | 0;
                      H() | 0;
                      switch (g2 & 7) {
                        case 1:
                          break b;
                        case 0:
                          break;
                        default: {
                          c2 = 1;
                          break a;
                        }
                      }
                      if (c2 >>> 0 < d2 >>> 0) {
                        c2 = c2 + 1 | 0;
                      } else {
                        c2 = 1;
                        break a;
                      }
                    }
                  c2 = 1;
                  while (true) {
                    g2 = (15 - c2 | 0) * 3 | 0;
                    e2 = Qd(a3 | 0, b2 | 0, g2 | 0) | 0;
                    H() | 0;
                    f2 = Rd(7, 0, g2 | 0) | 0;
                    b2 = b2 & ~(H() | 0);
                    g2 = Rd($a(e2 & 7) | 0, 0, g2 | 0) | 0;
                    a3 = a3 & ~f2 | g2;
                    b2 = b2 | (H() | 0);
                    if (c2 >>> 0 < d2 >>> 0) {
                      c2 = c2 + 1 | 0;
                    } else {
                      c2 = 1;
                      break;
                    }
                  }
                }
              } else {
                c2 = 0;
              }
            }
          } while (0);
        if (h >>> 0 < i >>> 0) {
          h = h + 1 | 0;
        } else {
          break;
        }
      }
      G(b2 | 0);
      return a3 | 0;
    }
    function Rb(a3, b2) {
      a3 = a3 | 0;
      b2 = b2 | 0;
      var c2 = 0, d2 = 0, e2 = 0, f2 = 0, g2 = 0;
      d2 = Qd(a3 | 0, b2 | 0, 52) | 0;
      H() | 0;
      d2 = d2 & 15;
      if (!d2) {
        c2 = b2;
        d2 = a3;
        G(c2 | 0);
        return d2 | 0;
      }
      c2 = 1;
      while (true) {
        f2 = (15 - c2 | 0) * 3 | 0;
        g2 = Qd(a3 | 0, b2 | 0, f2 | 0) | 0;
        H() | 0;
        e2 = Rd(7, 0, f2 | 0) | 0;
        b2 = b2 & ~(H() | 0);
        f2 = Rd($a(g2 & 7) | 0, 0, f2 | 0) | 0;
        a3 = f2 | a3 & ~e2;
        b2 = H() | 0 | b2;
        if (c2 >>> 0 < d2 >>> 0) {
          c2 = c2 + 1 | 0;
        } else {
          break;
        }
      }
      G(b2 | 0);
      return a3 | 0;
    }
    function Sb(a3, b2) {
      a3 = a3 | 0;
      b2 = b2 | 0;
      var c2 = 0, d2 = 0, e2 = 0, f2 = 0, g2 = 0, h = 0, i = 0;
      i = Qd(a3 | 0, b2 | 0, 52) | 0;
      H() | 0;
      i = i & 15;
      if (!i) {
        h = b2;
        i = a3;
        G(h | 0);
        return i | 0;
      }
      h = 1;
      c2 = 0;
      while (true) {
        f2 = (15 - h | 0) * 3 | 0;
        d2 = Rd(7, 0, f2 | 0) | 0;
        e2 = H() | 0;
        g2 = Qd(a3 | 0, b2 | 0, f2 | 0) | 0;
        H() | 0;
        f2 = Rd(ab(g2 & 7) | 0, 0, f2 | 0) | 0;
        g2 = H() | 0;
        a3 = f2 | a3 & ~d2;
        b2 = g2 | b2 & ~e2;
        a:
          do {
            if (!c2) {
              if (!((f2 & d2 | 0) == 0 & (g2 & e2 | 0) == 0)) {
                d2 = Qd(a3 | 0, b2 | 0, 52) | 0;
                H() | 0;
                d2 = d2 & 15;
                if (!d2) {
                  c2 = 1;
                } else {
                  c2 = 1;
                  b:
                    while (true) {
                      g2 = Qd(a3 | 0, b2 | 0, (15 - c2 | 0) * 3 | 0) | 0;
                      H() | 0;
                      switch (g2 & 7) {
                        case 1:
                          break b;
                        case 0:
                          break;
                        default: {
                          c2 = 1;
                          break a;
                        }
                      }
                      if (c2 >>> 0 < d2 >>> 0) {
                        c2 = c2 + 1 | 0;
                      } else {
                        c2 = 1;
                        break a;
                      }
                    }
                  c2 = 1;
                  while (true) {
                    e2 = (15 - c2 | 0) * 3 | 0;
                    f2 = Rd(7, 0, e2 | 0) | 0;
                    g2 = b2 & ~(H() | 0);
                    b2 = Qd(a3 | 0, b2 | 0, e2 | 0) | 0;
                    H() | 0;
                    b2 = Rd(ab(b2 & 7) | 0, 0, e2 | 0) | 0;
                    a3 = a3 & ~f2 | b2;
                    b2 = g2 | (H() | 0);
                    if (c2 >>> 0 < d2 >>> 0) {
                      c2 = c2 + 1 | 0;
                    } else {
                      c2 = 1;
                      break;
                    }
                  }
                }
              } else {
                c2 = 0;
              }
            }
          } while (0);
        if (h >>> 0 < i >>> 0) {
          h = h + 1 | 0;
        } else {
          break;
        }
      }
      G(b2 | 0);
      return a3 | 0;
    }
    function Tb(a3, b2) {
      a3 = a3 | 0;
      b2 = b2 | 0;
      var c2 = 0, d2 = 0, e2 = 0, f2 = 0, g2 = 0;
      d2 = Qd(a3 | 0, b2 | 0, 52) | 0;
      H() | 0;
      d2 = d2 & 15;
      if (!d2) {
        c2 = b2;
        d2 = a3;
        G(c2 | 0);
        return d2 | 0;
      }
      c2 = 1;
      while (true) {
        g2 = (15 - c2 | 0) * 3 | 0;
        f2 = Rd(7, 0, g2 | 0) | 0;
        e2 = b2 & ~(H() | 0);
        b2 = Qd(a3 | 0, b2 | 0, g2 | 0) | 0;
        H() | 0;
        b2 = Rd(ab(b2 & 7) | 0, 0, g2 | 0) | 0;
        a3 = b2 | a3 & ~f2;
        b2 = H() | 0 | e2;
        if (c2 >>> 0 < d2 >>> 0) {
          c2 = c2 + 1 | 0;
        } else {
          break;
        }
      }
      G(b2 | 0);
      return a3 | 0;
    }
    function Ub(a3, c2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      var d2 = 0, e2 = 0, f2 = 0, g2 = 0, h = 0, i = 0, j = 0, k = 0, l = 0;
      j = T;
      T = T + 64 | 0;
      i = j + 40 | 0;
      e2 = j + 24 | 0;
      f2 = j + 12 | 0;
      g2 = j;
      Rd(c2 | 0, 0, 52) | 0;
      d2 = H() | 0 | 134225919;
      if (!c2) {
        if ((b[a3 + 4 >> 2] | 0) > 2) {
          h = 0;
          i = 0;
          G(h | 0);
          T = j;
          return i | 0;
        }
        if ((b[a3 + 8 >> 2] | 0) > 2) {
          h = 0;
          i = 0;
          G(h | 0);
          T = j;
          return i | 0;
        }
        if ((b[a3 + 12 >> 2] | 0) > 2) {
          h = 0;
          i = 0;
          G(h | 0);
          T = j;
          return i | 0;
        }
        Rd(qa(a3) | 0, 0, 45) | 0;
        h = H() | 0 | d2;
        i = -1;
        G(h | 0);
        T = j;
        return i | 0;
      }
      b[i >> 2] = b[a3 >> 2];
      b[i + 4 >> 2] = b[a3 + 4 >> 2];
      b[i + 8 >> 2] = b[a3 + 8 >> 2];
      b[i + 12 >> 2] = b[a3 + 12 >> 2];
      h = i + 4 | 0;
      if ((c2 | 0) > 0) {
        a3 = -1;
        while (true) {
          b[e2 >> 2] = b[h >> 2];
          b[e2 + 4 >> 2] = b[h + 4 >> 2];
          b[e2 + 8 >> 2] = b[h + 8 >> 2];
          if (!(c2 & 1)) {
            Va(h);
            b[f2 >> 2] = b[h >> 2];
            b[f2 + 4 >> 2] = b[h + 4 >> 2];
            b[f2 + 8 >> 2] = b[h + 8 >> 2];
            Xa(f2);
          } else {
            Ua(h);
            b[f2 >> 2] = b[h >> 2];
            b[f2 + 4 >> 2] = b[h + 4 >> 2];
            b[f2 + 8 >> 2] = b[h + 8 >> 2];
            Wa(f2);
          }
          Pa(e2, f2, g2);
          Ma(g2);
          l = (15 - c2 | 0) * 3 | 0;
          k = Rd(7, 0, l | 0) | 0;
          d2 = d2 & ~(H() | 0);
          l = Rd(Ra(g2) | 0, 0, l | 0) | 0;
          a3 = l | a3 & ~k;
          d2 = H() | 0 | d2;
          if ((c2 | 0) > 1) {
            c2 = c2 + -1 | 0;
          } else {
            break;
          }
        }
      } else {
        a3 = -1;
      }
      a:
        do {
          if (((b[h >> 2] | 0) <= 2 ? (b[i + 8 >> 2] | 0) <= 2 : 0) ? (b[i + 12 >> 2] | 0) <= 2 : 0) {
            e2 = qa(i) | 0;
            c2 = Rd(e2 | 0, 0, 45) | 0;
            c2 = c2 | a3;
            a3 = H() | 0 | d2 & -1040385;
            g2 = ra(i) | 0;
            if (!(oa(e2) | 0)) {
              if ((g2 | 0) <= 0) {
                break;
              }
              f2 = 0;
              while (true) {
                e2 = Qd(c2 | 0, a3 | 0, 52) | 0;
                H() | 0;
                e2 = e2 & 15;
                if (e2) {
                  d2 = 1;
                  while (true) {
                    l = (15 - d2 | 0) * 3 | 0;
                    i = Qd(c2 | 0, a3 | 0, l | 0) | 0;
                    H() | 0;
                    k = Rd(7, 0, l | 0) | 0;
                    a3 = a3 & ~(H() | 0);
                    l = Rd($a(i & 7) | 0, 0, l | 0) | 0;
                    c2 = c2 & ~k | l;
                    a3 = a3 | (H() | 0);
                    if (d2 >>> 0 < e2 >>> 0) {
                      d2 = d2 + 1 | 0;
                    } else {
                      break;
                    }
                  }
                }
                f2 = f2 + 1 | 0;
                if ((f2 | 0) == (g2 | 0)) {
                  break a;
                }
              }
            }
            f2 = Qd(c2 | 0, a3 | 0, 52) | 0;
            H() | 0;
            f2 = f2 & 15;
            b:
              do {
                if (f2) {
                  d2 = 1;
                  c:
                    while (true) {
                      l = Qd(c2 | 0, a3 | 0, (15 - d2 | 0) * 3 | 0) | 0;
                      H() | 0;
                      switch (l & 7) {
                        case 1:
                          break c;
                        case 0:
                          break;
                        default:
                          break b;
                      }
                      if (d2 >>> 0 < f2 >>> 0) {
                        d2 = d2 + 1 | 0;
                      } else {
                        break b;
                      }
                    }
                  if (ua(e2, b[i >> 2] | 0) | 0) {
                    d2 = 1;
                    while (true) {
                      i = (15 - d2 | 0) * 3 | 0;
                      k = Rd(7, 0, i | 0) | 0;
                      l = a3 & ~(H() | 0);
                      a3 = Qd(c2 | 0, a3 | 0, i | 0) | 0;
                      H() | 0;
                      a3 = Rd(ab(a3 & 7) | 0, 0, i | 0) | 0;
                      c2 = c2 & ~k | a3;
                      a3 = l | (H() | 0);
                      if (d2 >>> 0 < f2 >>> 0) {
                        d2 = d2 + 1 | 0;
                      } else {
                        break;
                      }
                    }
                  } else {
                    d2 = 1;
                    while (true) {
                      l = (15 - d2 | 0) * 3 | 0;
                      i = Qd(c2 | 0, a3 | 0, l | 0) | 0;
                      H() | 0;
                      k = Rd(7, 0, l | 0) | 0;
                      a3 = a3 & ~(H() | 0);
                      l = Rd($a(i & 7) | 0, 0, l | 0) | 0;
                      c2 = c2 & ~k | l;
                      a3 = a3 | (H() | 0);
                      if (d2 >>> 0 < f2 >>> 0) {
                        d2 = d2 + 1 | 0;
                      } else {
                        break;
                      }
                    }
                  }
                }
              } while (0);
            if ((g2 | 0) > 0) {
              d2 = 0;
              do {
                c2 = Qb(c2, a3) | 0;
                a3 = H() | 0;
                d2 = d2 + 1 | 0;
              } while ((d2 | 0) != (g2 | 0));
            }
          } else {
            c2 = 0;
            a3 = 0;
          }
        } while (0);
      k = a3;
      l = c2;
      G(k | 0);
      T = j;
      return l | 0;
    }
    function Vb(a3) {
      a3 = a3 | 0;
      return (a3 | 0) % 2 | 0 | 0;
    }
    function Wb(a3, c2, d2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      var e2 = 0, f2 = 0;
      f2 = T;
      T = T + 16 | 0;
      e2 = f2;
      if (c2 >>> 0 > 15) {
        e2 = 4;
        T = f2;
        return e2 | 0;
      }
      if ((b[a3 + 4 >> 2] & 2146435072 | 0) == 2146435072) {
        e2 = 3;
        T = f2;
        return e2 | 0;
      }
      if ((b[a3 + 8 + 4 >> 2] & 2146435072 | 0) == 2146435072) {
        e2 = 3;
        T = f2;
        return e2 | 0;
      }
      qb(a3, c2, e2);
      c2 = Ub(e2, c2) | 0;
      e2 = H() | 0;
      b[d2 >> 2] = c2;
      b[d2 + 4 >> 2] = e2;
      if ((c2 | 0) == 0 & (e2 | 0) == 0) {
        I(27795, 27122, 959, 27145);
      }
      e2 = 0;
      T = f2;
      return e2 | 0;
    }
    function Xb(a3, c2, d2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      var e2 = 0, f2 = 0, g2 = 0, h = 0;
      f2 = d2 + 4 | 0;
      g2 = Qd(a3 | 0, c2 | 0, 52) | 0;
      H() | 0;
      g2 = g2 & 15;
      h = Qd(a3 | 0, c2 | 0, 45) | 0;
      H() | 0;
      e2 = (g2 | 0) == 0;
      if (!(oa(h & 127) | 0)) {
        if (e2) {
          h = 0;
          return h | 0;
        }
        if ((b[f2 >> 2] | 0) == 0 ? (b[d2 + 8 >> 2] | 0) == 0 : 0) {
          e2 = (b[d2 + 12 >> 2] | 0) != 0 & 1;
        } else {
          e2 = 1;
        }
      } else if (e2) {
        h = 1;
        return h | 0;
      } else {
        e2 = 1;
      }
      d2 = 1;
      while (true) {
        if (!(d2 & 1)) {
          Xa(f2);
        } else {
          Wa(f2);
        }
        h = Qd(a3 | 0, c2 | 0, (15 - d2 | 0) * 3 | 0) | 0;
        H() | 0;
        Ya(f2, h & 7);
        if (d2 >>> 0 < g2 >>> 0) {
          d2 = d2 + 1 | 0;
        } else {
          break;
        }
      }
      return e2 | 0;
    }
    function Yb(a3, c2, d2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      var e2 = 0, f2 = 0, g2 = 0, h = 0, i = 0, j = 0, k = 0, l = 0;
      l = T;
      T = T + 16 | 0;
      j = l;
      k = Qd(a3 | 0, c2 | 0, 45) | 0;
      H() | 0;
      k = k & 127;
      if (k >>> 0 > 121) {
        b[d2 >> 2] = 0;
        b[d2 + 4 >> 2] = 0;
        b[d2 + 8 >> 2] = 0;
        b[d2 + 12 >> 2] = 0;
        k = 5;
        T = l;
        return k | 0;
      }
      a:
        do {
          if ((oa(k) | 0) != 0 ? (g2 = Qd(a3 | 0, c2 | 0, 52) | 0, H() | 0, g2 = g2 & 15, (g2 | 0) != 0) : 0) {
            e2 = 1;
            b:
              while (true) {
                i = Qd(a3 | 0, c2 | 0, (15 - e2 | 0) * 3 | 0) | 0;
                H() | 0;
                switch (i & 7) {
                  case 5:
                    break b;
                  case 0:
                    break;
                  default: {
                    e2 = c2;
                    break a;
                  }
                }
                if (e2 >>> 0 < g2 >>> 0) {
                  e2 = e2 + 1 | 0;
                } else {
                  e2 = c2;
                  break a;
                }
              }
            f2 = 1;
            e2 = c2;
            while (true) {
              c2 = (15 - f2 | 0) * 3 | 0;
              h = Rd(7, 0, c2 | 0) | 0;
              i = e2 & ~(H() | 0);
              e2 = Qd(a3 | 0, e2 | 0, c2 | 0) | 0;
              H() | 0;
              e2 = Rd(ab(e2 & 7) | 0, 0, c2 | 0) | 0;
              a3 = a3 & ~h | e2;
              e2 = i | (H() | 0);
              if (f2 >>> 0 < g2 >>> 0) {
                f2 = f2 + 1 | 0;
              } else {
                break;
              }
            }
          } else {
            e2 = c2;
          }
        } while (0);
      i = 7696 + (k * 28 | 0) | 0;
      b[d2 >> 2] = b[i >> 2];
      b[d2 + 4 >> 2] = b[i + 4 >> 2];
      b[d2 + 8 >> 2] = b[i + 8 >> 2];
      b[d2 + 12 >> 2] = b[i + 12 >> 2];
      if (!(Xb(a3, e2, d2) | 0)) {
        k = 0;
        T = l;
        return k | 0;
      }
      h = d2 + 4 | 0;
      b[j >> 2] = b[h >> 2];
      b[j + 4 >> 2] = b[h + 4 >> 2];
      b[j + 8 >> 2] = b[h + 8 >> 2];
      g2 = Qd(a3 | 0, e2 | 0, 52) | 0;
      H() | 0;
      i = g2 & 15;
      if (!(g2 & 1)) {
        g2 = i;
      } else {
        Xa(h);
        g2 = i + 1 | 0;
      }
      if (!(oa(k) | 0)) {
        e2 = 0;
      } else {
        c:
          do {
            if (!i) {
              e2 = 0;
            } else {
              c2 = 1;
              while (true) {
                f2 = Qd(a3 | 0, e2 | 0, (15 - c2 | 0) * 3 | 0) | 0;
                H() | 0;
                f2 = f2 & 7;
                if (f2 | 0) {
                  e2 = f2;
                  break c;
                }
                if (c2 >>> 0 < i >>> 0) {
                  c2 = c2 + 1 | 0;
                } else {
                  e2 = 0;
                  break;
                }
              }
            }
          } while (0);
        e2 = (e2 | 0) == 4 & 1;
      }
      if (!(xb(d2, g2, e2, 0) | 0)) {
        if ((g2 | 0) != (i | 0)) {
          b[h >> 2] = b[j >> 2];
          b[h + 4 >> 2] = b[j + 4 >> 2];
          b[h + 8 >> 2] = b[j + 8 >> 2];
        }
      } else {
        if (oa(k) | 0) {
          do {} while ((xb(d2, g2, 0, 0) | 0) != 0);
        }
        if ((g2 | 0) != (i | 0)) {
          Va(h);
        }
      }
      k = 0;
      T = l;
      return k | 0;
    }
    function Zb(a3, b2, c2) {
      a3 = a3 | 0;
      b2 = b2 | 0;
      c2 = c2 | 0;
      var d2 = 0, e2 = 0, f2 = 0;
      f2 = T;
      T = T + 16 | 0;
      d2 = f2;
      e2 = Yb(a3, b2, d2) | 0;
      if (e2 | 0) {
        T = f2;
        return e2 | 0;
      }
      e2 = Qd(a3 | 0, b2 | 0, 52) | 0;
      H() | 0;
      ub(d2, e2 & 15, c2);
      e2 = 0;
      T = f2;
      return e2 | 0;
    }
    function _b(a3, b2, c2) {
      a3 = a3 | 0;
      b2 = b2 | 0;
      c2 = c2 | 0;
      var d2 = 0, e2 = 0, f2 = 0, g2 = 0, h = 0;
      g2 = T;
      T = T + 16 | 0;
      f2 = g2;
      d2 = Yb(a3, b2, f2) | 0;
      if (d2 | 0) {
        f2 = d2;
        T = g2;
        return f2 | 0;
      }
      d2 = Qd(a3 | 0, b2 | 0, 45) | 0;
      H() | 0;
      d2 = (oa(d2 & 127) | 0) == 0;
      e2 = Qd(a3 | 0, b2 | 0, 52) | 0;
      H() | 0;
      e2 = e2 & 15;
      a:
        do {
          if (!d2) {
            if (e2 | 0) {
              d2 = 1;
              while (true) {
                h = Rd(7, 0, (15 - d2 | 0) * 3 | 0) | 0;
                if (!((h & a3 | 0) == 0 & ((H() | 0) & b2 | 0) == 0)) {
                  break a;
                }
                if (d2 >>> 0 < e2 >>> 0) {
                  d2 = d2 + 1 | 0;
                } else {
                  break;
                }
              }
            }
            vb(f2, e2, 0, 5, c2);
            h = 0;
            T = g2;
            return h | 0;
          }
        } while (0);
      zb(f2, e2, 0, 6, c2);
      h = 0;
      T = g2;
      return h | 0;
    }
    function $b(a3, c2, d2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      var e2 = 0, f2 = 0, g2 = 0;
      f2 = Qd(a3 | 0, c2 | 0, 45) | 0;
      H() | 0;
      if (!(oa(f2 & 127) | 0)) {
        f2 = 2;
        b[d2 >> 2] = f2;
        return 0;
      }
      f2 = Qd(a3 | 0, c2 | 0, 52) | 0;
      H() | 0;
      f2 = f2 & 15;
      if (!f2) {
        f2 = 5;
        b[d2 >> 2] = f2;
        return 0;
      }
      e2 = 1;
      while (true) {
        g2 = Rd(7, 0, (15 - e2 | 0) * 3 | 0) | 0;
        if (!((g2 & a3 | 0) == 0 & ((H() | 0) & c2 | 0) == 0)) {
          e2 = 2;
          a3 = 6;
          break;
        }
        if (e2 >>> 0 < f2 >>> 0) {
          e2 = e2 + 1 | 0;
        } else {
          e2 = 5;
          a3 = 6;
          break;
        }
      }
      if ((a3 | 0) == 6) {
        b[d2 >> 2] = e2;
        return 0;
      }
      return 0;
    }
    function ac(a3, c2, d2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      var e2 = 0, f2 = 0, g2 = 0, h = 0, i = 0, j = 0, k = 0, l = 0, m = 0;
      m = T;
      T = T + 128 | 0;
      k = m + 112 | 0;
      g2 = m + 96 | 0;
      l = m;
      f2 = Qd(a3 | 0, c2 | 0, 52) | 0;
      H() | 0;
      i = f2 & 15;
      b[k >> 2] = i;
      h = Qd(a3 | 0, c2 | 0, 45) | 0;
      H() | 0;
      h = h & 127;
      a:
        do {
          if (oa(h) | 0) {
            if (i | 0) {
              e2 = 1;
              while (true) {
                j = Rd(7, 0, (15 - e2 | 0) * 3 | 0) | 0;
                if (!((j & a3 | 0) == 0 & ((H() | 0) & c2 | 0) == 0)) {
                  f2 = 0;
                  break a;
                }
                if (e2 >>> 0 < i >>> 0) {
                  e2 = e2 + 1 | 0;
                } else {
                  break;
                }
              }
            }
            if (!(f2 & 1)) {
              j = Rd(i + 1 | 0, 0, 52) | 0;
              l = H() | 0 | c2 & -15728641;
              k = Rd(7, 0, (14 - i | 0) * 3 | 0) | 0;
              l = ac((j | a3) & ~k, l & ~(H() | 0), d2) | 0;
              T = m;
              return l | 0;
            } else {
              f2 = 1;
            }
          } else {
            f2 = 0;
          }
        } while (0);
      e2 = Yb(a3, c2, g2) | 0;
      if (!e2) {
        if (f2) {
          wb(g2, k, l);
          j = 5;
        } else {
          Ab(g2, k, l);
          j = 6;
        }
        b:
          do {
            if (oa(h) | 0) {
              if (!i) {
                a3 = 5;
              } else {
                e2 = 1;
                while (true) {
                  h = Rd(7, 0, (15 - e2 | 0) * 3 | 0) | 0;
                  if (!((h & a3 | 0) == 0 & ((H() | 0) & c2 | 0) == 0)) {
                    a3 = 2;
                    break b;
                  }
                  if (e2 >>> 0 < i >>> 0) {
                    e2 = e2 + 1 | 0;
                  } else {
                    a3 = 5;
                    break;
                  }
                }
              }
            } else {
              a3 = 2;
            }
          } while (0);
        Xd(d2 | 0, -1, a3 << 2 | 0) | 0;
        c:
          do {
            if (f2) {
              g2 = 0;
              while (true) {
                h = l + (g2 << 4) | 0;
                yb(h, b[k >> 2] | 0) | 0;
                h = b[h >> 2] | 0;
                i = b[d2 >> 2] | 0;
                if ((i | 0) == -1 | (i | 0) == (h | 0)) {
                  e2 = d2;
                } else {
                  f2 = 0;
                  do {
                    f2 = f2 + 1 | 0;
                    if (f2 >>> 0 >= a3 >>> 0) {
                      e2 = 1;
                      break c;
                    }
                    e2 = d2 + (f2 << 2) | 0;
                    i = b[e2 >> 2] | 0;
                  } while (!((i | 0) == -1 | (i | 0) == (h | 0)));
                }
                b[e2 >> 2] = h;
                g2 = g2 + 1 | 0;
                if (g2 >>> 0 >= j >>> 0) {
                  e2 = 0;
                  break;
                }
              }
            } else {
              g2 = 0;
              while (true) {
                h = l + (g2 << 4) | 0;
                xb(h, b[k >> 2] | 0, 0, 1) | 0;
                h = b[h >> 2] | 0;
                i = b[d2 >> 2] | 0;
                if ((i | 0) == -1 | (i | 0) == (h | 0)) {
                  e2 = d2;
                } else {
                  f2 = 0;
                  do {
                    f2 = f2 + 1 | 0;
                    if (f2 >>> 0 >= a3 >>> 0) {
                      e2 = 1;
                      break c;
                    }
                    e2 = d2 + (f2 << 2) | 0;
                    i = b[e2 >> 2] | 0;
                  } while (!((i | 0) == -1 | (i | 0) == (h | 0)));
                }
                b[e2 >> 2] = h;
                g2 = g2 + 1 | 0;
                if (g2 >>> 0 >= j >>> 0) {
                  e2 = 0;
                  break;
                }
              }
            }
          } while (0);
      }
      l = e2;
      T = m;
      return l | 0;
    }
    function bc() {
      return 12;
    }
    function cc(a3, c2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      var d2 = 0, e2 = 0, f2 = 0, g2 = 0, h = 0, i = 0, j = 0;
      if (a3 >>> 0 > 15) {
        i = 4;
        return i | 0;
      }
      Rd(a3 | 0, 0, 52) | 0;
      i = H() | 0 | 134225919;
      if (!a3) {
        d2 = 0;
        e2 = 0;
        do {
          if (oa(e2) | 0) {
            Rd(e2 | 0, 0, 45) | 0;
            h = i | (H() | 0);
            a3 = c2 + (d2 << 3) | 0;
            b[a3 >> 2] = -1;
            b[a3 + 4 >> 2] = h;
            d2 = d2 + 1 | 0;
          }
          e2 = e2 + 1 | 0;
        } while ((e2 | 0) != 122);
        d2 = 0;
        return d2 | 0;
      }
      d2 = 0;
      h = 0;
      do {
        if (oa(h) | 0) {
          Rd(h | 0, 0, 45) | 0;
          e2 = 1;
          f2 = -1;
          g2 = i | (H() | 0);
          while (true) {
            j = Rd(7, 0, (15 - e2 | 0) * 3 | 0) | 0;
            f2 = f2 & ~j;
            g2 = g2 & ~(H() | 0);
            if ((e2 | 0) == (a3 | 0)) {
              break;
            } else {
              e2 = e2 + 1 | 0;
            }
          }
          j = c2 + (d2 << 3) | 0;
          b[j >> 2] = f2;
          b[j + 4 >> 2] = g2;
          d2 = d2 + 1 | 0;
        }
        h = h + 1 | 0;
      } while ((h | 0) != 122);
      d2 = 0;
      return d2 | 0;
    }
    function dc(a3, c2, d2, e2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      var f2 = 0, g2 = 0, h = 0, i = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, p3 = 0, q2 = 0, r2 = 0, s2 = 0, t2 = 0;
      t2 = T;
      T = T + 16 | 0;
      r2 = t2;
      s2 = Qd(a3 | 0, c2 | 0, 52) | 0;
      H() | 0;
      s2 = s2 & 15;
      if (d2 >>> 0 > 15) {
        s2 = 4;
        T = t2;
        return s2 | 0;
      }
      if ((s2 | 0) < (d2 | 0)) {
        s2 = 12;
        T = t2;
        return s2 | 0;
      }
      if ((s2 | 0) != (d2 | 0)) {
        g2 = Rd(d2 | 0, 0, 52) | 0;
        g2 = g2 | a3;
        i = H() | 0 | c2 & -15728641;
        if ((s2 | 0) > (d2 | 0)) {
          j = d2;
          do {
            q2 = Rd(7, 0, (14 - j | 0) * 3 | 0) | 0;
            j = j + 1 | 0;
            g2 = q2 | g2;
            i = H() | 0 | i;
          } while ((j | 0) < (s2 | 0));
          q2 = g2;
        } else {
          q2 = g2;
        }
      } else {
        q2 = a3;
        i = c2;
      }
      p3 = Qd(q2 | 0, i | 0, 45) | 0;
      H() | 0;
      a:
        do {
          if (oa(p3 & 127) | 0) {
            j = Qd(q2 | 0, i | 0, 52) | 0;
            H() | 0;
            j = j & 15;
            if (j | 0) {
              g2 = 1;
              while (true) {
                p3 = Rd(7, 0, (15 - g2 | 0) * 3 | 0) | 0;
                if (!((p3 & q2 | 0) == 0 & ((H() | 0) & i | 0) == 0)) {
                  k = 33;
                  break a;
                }
                if (g2 >>> 0 < j >>> 0) {
                  g2 = g2 + 1 | 0;
                } else {
                  break;
                }
              }
            }
            p3 = e2;
            b[p3 >> 2] = 0;
            b[p3 + 4 >> 2] = 0;
            if ((s2 | 0) > (d2 | 0)) {
              p3 = c2 & -15728641;
              o = s2;
              while (true) {
                n = o;
                o = o + -1 | 0;
                if (o >>> 0 > 15 | (s2 | 0) < (o | 0)) {
                  k = 19;
                  break;
                }
                if ((s2 | 0) != (o | 0)) {
                  g2 = Rd(o | 0, 0, 52) | 0;
                  g2 = g2 | a3;
                  j = H() | 0 | p3;
                  if ((s2 | 0) < (n | 0)) {
                    m = g2;
                  } else {
                    k = o;
                    do {
                      m = Rd(7, 0, (14 - k | 0) * 3 | 0) | 0;
                      k = k + 1 | 0;
                      g2 = m | g2;
                      j = H() | 0 | j;
                    } while ((k | 0) < (s2 | 0));
                    m = g2;
                  }
                } else {
                  m = a3;
                  j = c2;
                }
                l = Qd(m | 0, j | 0, 45) | 0;
                H() | 0;
                if (!(oa(l & 127) | 0)) {
                  g2 = 0;
                } else {
                  l = Qd(m | 0, j | 0, 52) | 0;
                  H() | 0;
                  l = l & 15;
                  b:
                    do {
                      if (!l) {
                        g2 = 0;
                      } else {
                        k = 1;
                        while (true) {
                          g2 = Qd(m | 0, j | 0, (15 - k | 0) * 3 | 0) | 0;
                          H() | 0;
                          g2 = g2 & 7;
                          if (g2 | 0) {
                            break b;
                          }
                          if (k >>> 0 < l >>> 0) {
                            k = k + 1 | 0;
                          } else {
                            g2 = 0;
                            break;
                          }
                        }
                      }
                    } while (0);
                  g2 = (g2 | 0) == 0 & 1;
                }
                j = Qd(a3 | 0, c2 | 0, (15 - n | 0) * 3 | 0) | 0;
                H() | 0;
                j = j & 7;
                if ((j | 0) == 7) {
                  f2 = 5;
                  k = 42;
                  break;
                }
                g2 = (g2 | 0) != 0;
                if ((j | 0) == 1 & g2) {
                  f2 = 5;
                  k = 42;
                  break;
                }
                m = j + (((j | 0) != 0 & g2) << 31 >> 31) | 0;
                if (m | 0) {
                  k = s2 - n | 0;
                  k = Oc(7, 0, k, ((k | 0) < 0) << 31 >> 31) | 0;
                  l = H() | 0;
                  if (g2) {
                    g2 = Md(k | 0, l | 0, 5, 0) | 0;
                    g2 = Gd(g2 | 0, H() | 0, -5, -1) | 0;
                    g2 = Kd(g2 | 0, H() | 0, 6, 0) | 0;
                    g2 = Gd(g2 | 0, H() | 0, 1, 0) | 0;
                    j = H() | 0;
                  } else {
                    g2 = k;
                    j = l;
                  }
                  n = m + -1 | 0;
                  n = Md(k | 0, l | 0, n | 0, ((n | 0) < 0) << 31 >> 31 | 0) | 0;
                  n = Gd(g2 | 0, j | 0, n | 0, H() | 0) | 0;
                  m = H() | 0;
                  l = e2;
                  l = Gd(n | 0, m | 0, b[l >> 2] | 0, b[l + 4 >> 2] | 0) | 0;
                  m = H() | 0;
                  n = e2;
                  b[n >> 2] = l;
                  b[n + 4 >> 2] = m;
                }
                if ((o | 0) <= (d2 | 0)) {
                  k = 37;
                  break;
                }
              }
              if ((k | 0) == 19) {
                I(27795, 27122, 1276, 27158);
              } else if ((k | 0) == 37) {
                h = e2;
                f2 = b[h + 4 >> 2] | 0;
                h = b[h >> 2] | 0;
                break;
              } else if ((k | 0) == 42) {
                T = t2;
                return f2 | 0;
              }
            } else {
              f2 = 0;
              h = 0;
            }
          } else {
            k = 33;
          }
        } while (0);
      c:
        do {
          if ((k | 0) == 33) {
            p3 = e2;
            b[p3 >> 2] = 0;
            b[p3 + 4 >> 2] = 0;
            if ((s2 | 0) > (d2 | 0)) {
              g2 = s2;
              while (true) {
                f2 = Qd(a3 | 0, c2 | 0, (15 - g2 | 0) * 3 | 0) | 0;
                H() | 0;
                f2 = f2 & 7;
                if ((f2 | 0) == 7) {
                  f2 = 5;
                  break;
                }
                h = s2 - g2 | 0;
                h = Oc(7, 0, h, ((h | 0) < 0) << 31 >> 31) | 0;
                f2 = Md(h | 0, H() | 0, f2 | 0, 0) | 0;
                h = H() | 0;
                p3 = e2;
                h = Gd(b[p3 >> 2] | 0, b[p3 + 4 >> 2] | 0, f2 | 0, h | 0) | 0;
                f2 = H() | 0;
                p3 = e2;
                b[p3 >> 2] = h;
                b[p3 + 4 >> 2] = f2;
                g2 = g2 + -1 | 0;
                if ((g2 | 0) <= (d2 | 0)) {
                  break c;
                }
              }
              T = t2;
              return f2 | 0;
            } else {
              f2 = 0;
              h = 0;
            }
          }
        } while (0);
      if (Gb(q2, i, s2, r2) | 0) {
        I(27795, 27122, 1236, 27173);
      }
      s2 = r2;
      r2 = b[s2 + 4 >> 2] | 0;
      if (((f2 | 0) > -1 | (f2 | 0) == -1 & h >>> 0 > 4294967295) & ((r2 | 0) > (f2 | 0) | ((r2 | 0) == (f2 | 0) ? (b[s2 >> 2] | 0) >>> 0 > h >>> 0 : 0))) {
        s2 = 0;
        T = t2;
        return s2 | 0;
      } else {
        I(27795, 27122, 1316, 27158);
      }
      return 0;
    }
    function ec(a3, c2, d2, e2, f2, g2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      var h = 0, i = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, p3 = 0, q2 = 0;
      m = T;
      T = T + 16 | 0;
      h = m;
      if (f2 >>> 0 > 15) {
        g2 = 4;
        T = m;
        return g2 | 0;
      }
      i = Qd(d2 | 0, e2 | 0, 52) | 0;
      H() | 0;
      i = i & 15;
      if ((i | 0) > (f2 | 0)) {
        g2 = 12;
        T = m;
        return g2 | 0;
      }
      if (Gb(d2, e2, f2, h) | 0) {
        I(27795, 27122, 1236, 27173);
      }
      l = h;
      k = b[l + 4 >> 2] | 0;
      if (!(((c2 | 0) > -1 | (c2 | 0) == -1 & a3 >>> 0 > 4294967295) & ((k | 0) > (c2 | 0) | ((k | 0) == (c2 | 0) ? (b[l >> 2] | 0) >>> 0 > a3 >>> 0 : 0)))) {
        g2 = 2;
        T = m;
        return g2 | 0;
      }
      l = f2 - i | 0;
      f2 = Rd(f2 | 0, 0, 52) | 0;
      j = H() | 0 | e2 & -15728641;
      k = g2;
      b[k >> 2] = f2 | d2;
      b[k + 4 >> 2] = j;
      k = Qd(d2 | 0, e2 | 0, 45) | 0;
      H() | 0;
      a:
        do {
          if (oa(k & 127) | 0) {
            if (i | 0) {
              h = 1;
              while (true) {
                k = Rd(7, 0, (15 - h | 0) * 3 | 0) | 0;
                if (!((k & d2 | 0) == 0 & ((H() | 0) & e2 | 0) == 0)) {
                  break a;
                }
                if (h >>> 0 < i >>> 0) {
                  h = h + 1 | 0;
                } else {
                  break;
                }
              }
            }
            if ((l | 0) < 1) {
              g2 = 0;
              T = m;
              return g2 | 0;
            }
            k = i ^ 15;
            e2 = -1;
            j = 1;
            h = 1;
            while (true) {
              i = l - j | 0;
              i = Oc(7, 0, i, ((i | 0) < 0) << 31 >> 31) | 0;
              d2 = H() | 0;
              do {
                if (h) {
                  h = Md(i | 0, d2 | 0, 5, 0) | 0;
                  h = Gd(h | 0, H() | 0, -5, -1) | 0;
                  h = Kd(h | 0, H() | 0, 6, 0) | 0;
                  f2 = H() | 0;
                  if ((c2 | 0) > (f2 | 0) | (c2 | 0) == (f2 | 0) & a3 >>> 0 > h >>> 0) {
                    c2 = Gd(a3 | 0, c2 | 0, -1, -1) | 0;
                    c2 = Hd(c2 | 0, H() | 0, h | 0, f2 | 0) | 0;
                    h = H() | 0;
                    n = g2;
                    p3 = b[n >> 2] | 0;
                    n = b[n + 4 >> 2] | 0;
                    q2 = (k + e2 | 0) * 3 | 0;
                    o = Rd(7, 0, q2 | 0) | 0;
                    n = n & ~(H() | 0);
                    e2 = Kd(c2 | 0, h | 0, i | 0, d2 | 0) | 0;
                    a3 = H() | 0;
                    f2 = Gd(e2 | 0, a3 | 0, 2, 0) | 0;
                    q2 = Rd(f2 | 0, H() | 0, q2 | 0) | 0;
                    n = H() | 0 | n;
                    f2 = g2;
                    b[f2 >> 2] = q2 | p3 & ~o;
                    b[f2 + 4 >> 2] = n;
                    a3 = Md(e2 | 0, a3 | 0, i | 0, d2 | 0) | 0;
                    a3 = Hd(c2 | 0, h | 0, a3 | 0, H() | 0) | 0;
                    h = 0;
                    c2 = H() | 0;
                    break;
                  } else {
                    q2 = g2;
                    o = b[q2 >> 2] | 0;
                    q2 = b[q2 + 4 >> 2] | 0;
                    p3 = Rd(7, 0, (k + e2 | 0) * 3 | 0) | 0;
                    q2 = q2 & ~(H() | 0);
                    h = g2;
                    b[h >> 2] = o & ~p3;
                    b[h + 4 >> 2] = q2;
                    h = 1;
                    break;
                  }
                } else {
                  o = g2;
                  f2 = b[o >> 2] | 0;
                  o = b[o + 4 >> 2] | 0;
                  e2 = (k + e2 | 0) * 3 | 0;
                  n = Rd(7, 0, e2 | 0) | 0;
                  o = o & ~(H() | 0);
                  q2 = Kd(a3 | 0, c2 | 0, i | 0, d2 | 0) | 0;
                  h = H() | 0;
                  e2 = Rd(q2 | 0, h | 0, e2 | 0) | 0;
                  o = H() | 0 | o;
                  p3 = g2;
                  b[p3 >> 2] = e2 | f2 & ~n;
                  b[p3 + 4 >> 2] = o;
                  h = Md(q2 | 0, h | 0, i | 0, d2 | 0) | 0;
                  a3 = Hd(a3 | 0, c2 | 0, h | 0, H() | 0) | 0;
                  h = 0;
                  c2 = H() | 0;
                }
              } while (0);
              if ((l | 0) > (j | 0)) {
                e2 = ~j;
                j = j + 1 | 0;
              } else {
                c2 = 0;
                break;
              }
            }
            T = m;
            return c2 | 0;
          }
        } while (0);
      if ((l | 0) < 1) {
        q2 = 0;
        T = m;
        return q2 | 0;
      }
      f2 = i ^ 15;
      h = 1;
      while (true) {
        p3 = l - h | 0;
        p3 = Oc(7, 0, p3, ((p3 | 0) < 0) << 31 >> 31) | 0;
        q2 = H() | 0;
        j = g2;
        d2 = b[j >> 2] | 0;
        j = b[j + 4 >> 2] | 0;
        i = (f2 - h | 0) * 3 | 0;
        e2 = Rd(7, 0, i | 0) | 0;
        j = j & ~(H() | 0);
        n = Kd(a3 | 0, c2 | 0, p3 | 0, q2 | 0) | 0;
        o = H() | 0;
        i = Rd(n | 0, o | 0, i | 0) | 0;
        j = H() | 0 | j;
        k = g2;
        b[k >> 2] = i | d2 & ~e2;
        b[k + 4 >> 2] = j;
        q2 = Md(n | 0, o | 0, p3 | 0, q2 | 0) | 0;
        a3 = Hd(a3 | 0, c2 | 0, q2 | 0, H() | 0) | 0;
        c2 = H() | 0;
        if ((l | 0) <= (h | 0)) {
          c2 = 0;
          break;
        } else {
          h = h + 1 | 0;
        }
      }
      T = m;
      return c2 | 0;
    }
    function fc(a3, c2, d2, e2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      var f2 = 0, g2 = 0, h = 0;
      f2 = Qd(c2 | 0, d2 | 0, 52) | 0;
      H() | 0;
      f2 = f2 & 15;
      if ((c2 | 0) == 0 & (d2 | 0) == 0 | ((e2 | 0) > 15 | (f2 | 0) > (e2 | 0))) {
        g2 = -1;
        c2 = -1;
        d2 = 0;
        f2 = 0;
      } else {
        c2 = Jb(c2, d2, f2 + 1 | 0, e2) | 0;
        h = (H() | 0) & -15728641;
        d2 = Rd(e2 | 0, 0, 52) | 0;
        d2 = c2 | d2;
        h = h | (H() | 0);
        c2 = (Hb(d2, h) | 0) == 0;
        g2 = f2;
        c2 = c2 ? -1 : e2;
        f2 = h;
      }
      h = a3;
      b[h >> 2] = d2;
      b[h + 4 >> 2] = f2;
      b[a3 + 8 >> 2] = g2;
      b[a3 + 12 >> 2] = c2;
      return;
    }
    function gc(a3, c2, d2, e2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      var f2 = 0, g2 = 0;
      f2 = Qd(a3 | 0, c2 | 0, 52) | 0;
      H() | 0;
      f2 = f2 & 15;
      g2 = e2 + 8 | 0;
      b[g2 >> 2] = f2;
      if ((a3 | 0) == 0 & (c2 | 0) == 0 | ((d2 | 0) > 15 | (f2 | 0) > (d2 | 0))) {
        d2 = e2;
        b[d2 >> 2] = 0;
        b[d2 + 4 >> 2] = 0;
        b[g2 >> 2] = -1;
        b[e2 + 12 >> 2] = -1;
        return;
      }
      a3 = Jb(a3, c2, f2 + 1 | 0, d2) | 0;
      g2 = (H() | 0) & -15728641;
      f2 = Rd(d2 | 0, 0, 52) | 0;
      f2 = a3 | f2;
      g2 = g2 | (H() | 0);
      a3 = e2;
      b[a3 >> 2] = f2;
      b[a3 + 4 >> 2] = g2;
      a3 = e2 + 12 | 0;
      if (!(Hb(f2, g2) | 0)) {
        b[a3 >> 2] = -1;
        return;
      } else {
        b[a3 >> 2] = d2;
        return;
      }
    }
    function hc(a3) {
      a3 = a3 | 0;
      var c2 = 0, d2 = 0, e2 = 0, f2 = 0, g2 = 0, h = 0, i = 0, j = 0, k = 0;
      d2 = a3;
      c2 = b[d2 >> 2] | 0;
      d2 = b[d2 + 4 >> 2] | 0;
      if ((c2 | 0) == 0 & (d2 | 0) == 0) {
        return;
      }
      e2 = Qd(c2 | 0, d2 | 0, 52) | 0;
      H() | 0;
      e2 = e2 & 15;
      i = Rd(1, 0, (e2 ^ 15) * 3 | 0) | 0;
      c2 = Gd(i | 0, H() | 0, c2 | 0, d2 | 0) | 0;
      d2 = H() | 0;
      i = a3;
      b[i >> 2] = c2;
      b[i + 4 >> 2] = d2;
      i = a3 + 8 | 0;
      h = b[i >> 2] | 0;
      if ((e2 | 0) < (h | 0)) {
        return;
      }
      j = a3 + 12 | 0;
      g2 = e2;
      while (true) {
        if ((g2 | 0) == (h | 0)) {
          e2 = 5;
          break;
        }
        k = (g2 | 0) == (b[j >> 2] | 0);
        f2 = (15 - g2 | 0) * 3 | 0;
        e2 = Qd(c2 | 0, d2 | 0, f2 | 0) | 0;
        H() | 0;
        e2 = e2 & 7;
        if (k & ((e2 | 0) == 1 & true)) {
          e2 = 7;
          break;
        }
        if (!((e2 | 0) == 7 & true)) {
          e2 = 10;
          break;
        }
        k = Rd(1, 0, f2 | 0) | 0;
        c2 = Gd(c2 | 0, d2 | 0, k | 0, H() | 0) | 0;
        d2 = H() | 0;
        k = a3;
        b[k >> 2] = c2;
        b[k + 4 >> 2] = d2;
        if ((g2 | 0) > (h | 0)) {
          g2 = g2 + -1 | 0;
        } else {
          e2 = 10;
          break;
        }
      }
      if ((e2 | 0) == 5) {
        k = a3;
        b[k >> 2] = 0;
        b[k + 4 >> 2] = 0;
        b[i >> 2] = -1;
        b[j >> 2] = -1;
        return;
      } else if ((e2 | 0) == 7) {
        h = Rd(1, 0, f2 | 0) | 0;
        h = Gd(c2 | 0, d2 | 0, h | 0, H() | 0) | 0;
        i = H() | 0;
        k = a3;
        b[k >> 2] = h;
        b[k + 4 >> 2] = i;
        b[j >> 2] = g2 + -1;
        return;
      } else if ((e2 | 0) == 10) {
        return;
      }
    }
    function ic(a3) {
      a3 = +a3;
      var b2 = 0;
      b2 = a3 < 0 ? a3 + 6.283185307179586 : a3;
      return +(!(a3 >= 6.283185307179586) ? b2 : b2 + -6.283185307179586);
    }
    function jc(a3, b2) {
      a3 = a3 | 0;
      b2 = b2 | 0;
      if (!(+q(+(+e[a3 >> 3] - +e[b2 >> 3])) < 0.000000000017453292519943298)) {
        b2 = 0;
        return b2 | 0;
      }
      b2 = +q(+(+e[a3 + 8 >> 3] - +e[b2 + 8 >> 3])) < 0.000000000017453292519943298;
      return b2 | 0;
    }
    function kc(a3, b2) {
      a3 = +a3;
      b2 = b2 | 0;
      switch (b2 | 0) {
        case 1: {
          a3 = a3 < 0 ? a3 + 6.283185307179586 : a3;
          break;
        }
        case 2: {
          a3 = a3 > 0 ? a3 + -6.283185307179586 : a3;
          break;
        }
        default:
      }
      return +a3;
    }
    function lc(a3, b2) {
      a3 = a3 | 0;
      b2 = b2 | 0;
      var c2 = 0, d2 = 0, f2 = 0, g2 = 0;
      f2 = +e[b2 >> 3];
      d2 = +e[a3 >> 3];
      g2 = +u(+((f2 - d2) * 0.5));
      c2 = +u(+((+e[b2 + 8 >> 3] - +e[a3 + 8 >> 3]) * 0.5));
      c2 = g2 * g2 + c2 * (+t(+f2) * +t(+d2) * c2);
      return +(+z(+ +r(+c2), + +r(+(1 - c2))) * 2);
    }
    function mc(a3, b2) {
      a3 = a3 | 0;
      b2 = b2 | 0;
      var c2 = 0, d2 = 0, f2 = 0, g2 = 0;
      f2 = +e[b2 >> 3];
      d2 = +e[a3 >> 3];
      g2 = +u(+((f2 - d2) * 0.5));
      c2 = +u(+((+e[b2 + 8 >> 3] - +e[a3 + 8 >> 3]) * 0.5));
      c2 = g2 * g2 + c2 * (+t(+f2) * +t(+d2) * c2);
      return +(+z(+ +r(+c2), + +r(+(1 - c2))) * 2 * 6371.007180918475);
    }
    function nc(a3, b2) {
      a3 = a3 | 0;
      b2 = b2 | 0;
      var c2 = 0, d2 = 0, f2 = 0, g2 = 0;
      f2 = +e[b2 >> 3];
      d2 = +e[a3 >> 3];
      g2 = +u(+((f2 - d2) * 0.5));
      c2 = +u(+((+e[b2 + 8 >> 3] - +e[a3 + 8 >> 3]) * 0.5));
      c2 = g2 * g2 + c2 * (+t(+f2) * +t(+d2) * c2);
      return +(+z(+ +r(+c2), + +r(+(1 - c2))) * 2 * 6371.007180918475 * 1000);
    }
    function oc(a3, b2) {
      a3 = a3 | 0;
      b2 = b2 | 0;
      var c2 = 0, d2 = 0, f2 = 0, g2 = 0, h = 0;
      g2 = +e[b2 >> 3];
      d2 = +t(+g2);
      f2 = +e[b2 + 8 >> 3] - +e[a3 + 8 >> 3];
      h = d2 * +u(+f2);
      c2 = +e[a3 >> 3];
      return + +z(+h, +(+u(+g2) * +t(+c2) - +t(+f2) * (d2 * +u(+c2))));
    }
    function pc(a3, c2, d2, f2) {
      a3 = a3 | 0;
      c2 = +c2;
      d2 = +d2;
      f2 = f2 | 0;
      var g2 = 0, h = 0, i = 0, j = 0;
      if (d2 < 0.0000000000000001) {
        b[f2 >> 2] = b[a3 >> 2];
        b[f2 + 4 >> 2] = b[a3 + 4 >> 2];
        b[f2 + 8 >> 2] = b[a3 + 8 >> 2];
        b[f2 + 12 >> 2] = b[a3 + 12 >> 2];
        return;
      }
      h = c2 < 0 ? c2 + 6.283185307179586 : c2;
      h = !(c2 >= 6.283185307179586) ? h : h + -6.283185307179586;
      do {
        if (h < 0.0000000000000001) {
          c2 = +e[a3 >> 3] + d2;
          e[f2 >> 3] = c2;
          g2 = f2;
        } else {
          g2 = +q(+(h + -3.141592653589793)) < 0.0000000000000001;
          c2 = +e[a3 >> 3];
          if (g2) {
            c2 = c2 - d2;
            e[f2 >> 3] = c2;
            g2 = f2;
            break;
          }
          i = +t(+d2);
          d2 = +u(+d2);
          c2 = i * +u(+c2) + +t(+h) * (d2 * +t(+c2));
          c2 = c2 > 1 ? 1 : c2;
          c2 = +x(+(c2 < -1 ? -1 : c2));
          e[f2 >> 3] = c2;
          if (+q(+(c2 + -1.5707963267948966)) < 0.0000000000000001) {
            e[f2 >> 3] = 1.5707963267948966;
            e[f2 + 8 >> 3] = 0;
            return;
          }
          if (+q(+(c2 + 1.5707963267948966)) < 0.0000000000000001) {
            e[f2 >> 3] = -1.5707963267948966;
            e[f2 + 8 >> 3] = 0;
            return;
          }
          j = 1 / +t(+c2);
          h = d2 * +u(+h) * j;
          d2 = +e[a3 >> 3];
          c2 = j * ((i - +u(+c2) * +u(+d2)) / +t(+d2));
          i = h > 1 ? 1 : h;
          c2 = c2 > 1 ? 1 : c2;
          c2 = +e[a3 + 8 >> 3] + +z(+(i < -1 ? -1 : i), +(c2 < -1 ? -1 : c2));
          if (c2 > 3.141592653589793) {
            do {
              c2 = c2 + -6.283185307179586;
            } while (c2 > 3.141592653589793);
          }
          if (c2 < -3.141592653589793) {
            do {
              c2 = c2 + 6.283185307179586;
            } while (c2 < -3.141592653589793);
          }
          e[f2 + 8 >> 3] = c2;
          return;
        }
      } while (0);
      if (+q(+(c2 + -1.5707963267948966)) < 0.0000000000000001) {
        e[g2 >> 3] = 1.5707963267948966;
        e[f2 + 8 >> 3] = 0;
        return;
      }
      if (+q(+(c2 + 1.5707963267948966)) < 0.0000000000000001) {
        e[g2 >> 3] = -1.5707963267948966;
        e[f2 + 8 >> 3] = 0;
        return;
      }
      c2 = +e[a3 + 8 >> 3];
      if (c2 > 3.141592653589793) {
        do {
          c2 = c2 + -6.283185307179586;
        } while (c2 > 3.141592653589793);
      }
      if (c2 < -3.141592653589793) {
        do {
          c2 = c2 + 6.283185307179586;
        } while (c2 < -3.141592653589793);
      }
      e[f2 + 8 >> 3] = c2;
      return;
    }
    function qc(a3, b2) {
      a3 = a3 | 0;
      b2 = b2 | 0;
      if (a3 >>> 0 > 15) {
        b2 = 4;
        return b2 | 0;
      }
      e[b2 >> 3] = +e[20656 + (a3 << 3) >> 3];
      b2 = 0;
      return b2 | 0;
    }
    function rc(a3, b2) {
      a3 = a3 | 0;
      b2 = b2 | 0;
      if (a3 >>> 0 > 15) {
        b2 = 4;
        return b2 | 0;
      }
      e[b2 >> 3] = +e[20784 + (a3 << 3) >> 3];
      b2 = 0;
      return b2 | 0;
    }
    function sc(a3, b2) {
      a3 = a3 | 0;
      b2 = b2 | 0;
      if (a3 >>> 0 > 15) {
        b2 = 4;
        return b2 | 0;
      }
      e[b2 >> 3] = +e[20912 + (a3 << 3) >> 3];
      b2 = 0;
      return b2 | 0;
    }
    function tc(a3, b2) {
      a3 = a3 | 0;
      b2 = b2 | 0;
      if (a3 >>> 0 > 15) {
        b2 = 4;
        return b2 | 0;
      }
      e[b2 >> 3] = +e[21040 + (a3 << 3) >> 3];
      b2 = 0;
      return b2 | 0;
    }
    function uc(a3, c2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      var d2 = 0;
      if (a3 >>> 0 > 15) {
        c2 = 4;
        return c2 | 0;
      }
      d2 = Oc(7, 0, a3, ((a3 | 0) < 0) << 31 >> 31) | 0;
      d2 = Md(d2 | 0, H() | 0, 120, 0) | 0;
      a3 = H() | 0;
      b[c2 >> 2] = d2 | 2;
      b[c2 + 4 >> 2] = a3;
      c2 = 0;
      return c2 | 0;
    }
    function vc(a3, b2, c2) {
      a3 = a3 | 0;
      b2 = b2 | 0;
      c2 = c2 | 0;
      var d2 = 0, f2 = 0, g2 = 0, h = 0, i = 0, j = 0, k = 0, l = 0, m = 0, n = 0;
      n = +e[b2 >> 3];
      l = +e[a3 >> 3];
      j = +u(+((n - l) * 0.5));
      g2 = +e[b2 + 8 >> 3];
      k = +e[a3 + 8 >> 3];
      h = +u(+((g2 - k) * 0.5));
      i = +t(+l);
      m = +t(+n);
      h = j * j + h * (m * i * h);
      h = +z(+ +r(+h), + +r(+(1 - h))) * 2;
      j = +e[c2 >> 3];
      n = +u(+((j - n) * 0.5));
      d2 = +e[c2 + 8 >> 3];
      g2 = +u(+((d2 - g2) * 0.5));
      f2 = +t(+j);
      g2 = n * n + g2 * (m * f2 * g2);
      g2 = +z(+ +r(+g2), + +r(+(1 - g2))) * 2;
      j = +u(+((l - j) * 0.5));
      d2 = +u(+((k - d2) * 0.5));
      d2 = j * j + d2 * (i * f2 * d2);
      d2 = +z(+ +r(+d2), + +r(+(1 - d2))) * 2;
      f2 = (h + g2 + d2) * 0.5;
      return +(+y(+ +r(+(+v(+(f2 * 0.5)) * +v(+((f2 - h) * 0.5)) * +v(+((f2 - g2) * 0.5)) * +v(+((f2 - d2) * 0.5))))) * 4);
    }
    function wc(a3, c2, d2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      var f2 = 0, g2 = 0, h = 0, i = 0, j = 0;
      j = T;
      T = T + 192 | 0;
      h = j + 168 | 0;
      i = j;
      g2 = Zb(a3, c2, h) | 0;
      if (g2 | 0) {
        d2 = g2;
        T = j;
        return d2 | 0;
      }
      if (_b(a3, c2, i) | 0) {
        I(27795, 27190, 415, 27199);
      }
      c2 = b[i >> 2] | 0;
      if ((c2 | 0) > 0) {
        f2 = +vc(i + 8 | 0, i + 8 + (((c2 | 0) != 1 & 1) << 4) | 0, h) + 0;
        if ((c2 | 0) != 1) {
          a3 = 1;
          do {
            g2 = a3;
            a3 = a3 + 1 | 0;
            f2 = f2 + +vc(i + 8 + (g2 << 4) | 0, i + 8 + (((a3 | 0) % (c2 | 0) | 0) << 4) | 0, h);
          } while ((a3 | 0) < (c2 | 0));
        }
      } else {
        f2 = 0;
      }
      e[d2 >> 3] = f2;
      d2 = 0;
      T = j;
      return d2 | 0;
    }
    function xc(a3, b2, c2) {
      a3 = a3 | 0;
      b2 = b2 | 0;
      c2 = c2 | 0;
      a3 = wc(a3, b2, c2) | 0;
      if (a3 | 0) {
        return a3 | 0;
      }
      e[c2 >> 3] = +e[c2 >> 3] * 6371.007180918475 * 6371.007180918475;
      return a3 | 0;
    }
    function yc(a3, b2, c2) {
      a3 = a3 | 0;
      b2 = b2 | 0;
      c2 = c2 | 0;
      a3 = wc(a3, b2, c2) | 0;
      if (a3 | 0) {
        return a3 | 0;
      }
      e[c2 >> 3] = +e[c2 >> 3] * 6371.007180918475 * 6371.007180918475 * 1000 * 1000;
      return a3 | 0;
    }
    function zc(a3, c2, d2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      var f2 = 0, g2 = 0, h = 0, i = 0, j = 0, k = 0, l = 0, m = 0;
      j = T;
      T = T + 176 | 0;
      i = j;
      a3 = pb(a3, c2, i) | 0;
      if (a3 | 0) {
        i = a3;
        T = j;
        return i | 0;
      }
      e[d2 >> 3] = 0;
      a3 = b[i >> 2] | 0;
      if ((a3 | 0) <= 1) {
        i = 0;
        T = j;
        return i | 0;
      }
      c2 = a3 + -1 | 0;
      a3 = 0;
      f2 = +e[i + 8 >> 3];
      g2 = +e[i + 16 >> 3];
      h = 0;
      do {
        a3 = a3 + 1 | 0;
        l = f2;
        f2 = +e[i + 8 + (a3 << 4) >> 3];
        m = +u(+((f2 - l) * 0.5));
        k = g2;
        g2 = +e[i + 8 + (a3 << 4) + 8 >> 3];
        k = +u(+((g2 - k) * 0.5));
        k = m * m + k * (+t(+f2) * +t(+l) * k);
        h = h + +z(+ +r(+k), + +r(+(1 - k))) * 2;
      } while ((a3 | 0) < (c2 | 0));
      e[d2 >> 3] = h;
      i = 0;
      T = j;
      return i | 0;
    }
    function Ac(a3, c2, d2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      var f2 = 0, g2 = 0, h = 0, i = 0, j = 0, k = 0, l = 0, m = 0;
      j = T;
      T = T + 176 | 0;
      i = j;
      a3 = pb(a3, c2, i) | 0;
      if (a3 | 0) {
        i = a3;
        h = +e[d2 >> 3];
        h = h * 6371.007180918475;
        e[d2 >> 3] = h;
        T = j;
        return i | 0;
      }
      e[d2 >> 3] = 0;
      a3 = b[i >> 2] | 0;
      if ((a3 | 0) <= 1) {
        i = 0;
        h = 0;
        h = h * 6371.007180918475;
        e[d2 >> 3] = h;
        T = j;
        return i | 0;
      }
      c2 = a3 + -1 | 0;
      a3 = 0;
      f2 = +e[i + 8 >> 3];
      g2 = +e[i + 16 >> 3];
      h = 0;
      do {
        a3 = a3 + 1 | 0;
        l = f2;
        f2 = +e[i + 8 + (a3 << 4) >> 3];
        m = +u(+((f2 - l) * 0.5));
        k = g2;
        g2 = +e[i + 8 + (a3 << 4) + 8 >> 3];
        k = +u(+((g2 - k) * 0.5));
        k = m * m + k * (+t(+l) * +t(+f2) * k);
        h = h + +z(+ +r(+k), + +r(+(1 - k))) * 2;
      } while ((a3 | 0) != (c2 | 0));
      e[d2 >> 3] = h;
      i = 0;
      m = h;
      m = m * 6371.007180918475;
      e[d2 >> 3] = m;
      T = j;
      return i | 0;
    }
    function Bc(a3, c2, d2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      var f2 = 0, g2 = 0, h = 0, i = 0, j = 0, k = 0, l = 0, m = 0;
      j = T;
      T = T + 176 | 0;
      i = j;
      a3 = pb(a3, c2, i) | 0;
      if (a3 | 0) {
        i = a3;
        h = +e[d2 >> 3];
        h = h * 6371.007180918475;
        h = h * 1000;
        e[d2 >> 3] = h;
        T = j;
        return i | 0;
      }
      e[d2 >> 3] = 0;
      a3 = b[i >> 2] | 0;
      if ((a3 | 0) <= 1) {
        i = 0;
        h = 0;
        h = h * 6371.007180918475;
        h = h * 1000;
        e[d2 >> 3] = h;
        T = j;
        return i | 0;
      }
      c2 = a3 + -1 | 0;
      a3 = 0;
      f2 = +e[i + 8 >> 3];
      g2 = +e[i + 16 >> 3];
      h = 0;
      do {
        a3 = a3 + 1 | 0;
        l = f2;
        f2 = +e[i + 8 + (a3 << 4) >> 3];
        m = +u(+((f2 - l) * 0.5));
        k = g2;
        g2 = +e[i + 8 + (a3 << 4) + 8 >> 3];
        k = +u(+((g2 - k) * 0.5));
        k = m * m + k * (+t(+l) * +t(+f2) * k);
        h = h + +z(+ +r(+k), + +r(+(1 - k))) * 2;
      } while ((a3 | 0) != (c2 | 0));
      e[d2 >> 3] = h;
      i = 0;
      m = h;
      m = m * 6371.007180918475;
      m = m * 1000;
      e[d2 >> 3] = m;
      T = j;
      return i | 0;
    }
    function Cc(a3) {
      a3 = a3 | 0;
      var c2 = 0, d2 = 0, e2 = 0;
      c2 = Fd(1, 12) | 0;
      if (!c2) {
        I(27280, 27235, 49, 27293);
      }
      d2 = a3 + 4 | 0;
      e2 = b[d2 >> 2] | 0;
      if (e2 | 0) {
        e2 = e2 + 8 | 0;
        b[e2 >> 2] = c2;
        b[d2 >> 2] = c2;
        return c2 | 0;
      }
      if (b[a3 >> 2] | 0) {
        I(27310, 27235, 61, 27333);
      }
      e2 = a3;
      b[e2 >> 2] = c2;
      b[d2 >> 2] = c2;
      return c2 | 0;
    }
    function Dc(a3, c2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      var d2 = 0, e2 = 0;
      e2 = Dd(24) | 0;
      if (!e2) {
        I(27347, 27235, 78, 27361);
      }
      b[e2 >> 2] = b[c2 >> 2];
      b[e2 + 4 >> 2] = b[c2 + 4 >> 2];
      b[e2 + 8 >> 2] = b[c2 + 8 >> 2];
      b[e2 + 12 >> 2] = b[c2 + 12 >> 2];
      b[e2 + 16 >> 2] = 0;
      c2 = a3 + 4 | 0;
      d2 = b[c2 >> 2] | 0;
      if (d2 | 0) {
        b[d2 + 16 >> 2] = e2;
        b[c2 >> 2] = e2;
        return e2 | 0;
      }
      if (b[a3 >> 2] | 0) {
        I(27376, 27235, 82, 27361);
      }
      b[a3 >> 2] = e2;
      b[c2 >> 2] = e2;
      return e2 | 0;
    }
    function Ec(a3) {
      a3 = a3 | 0;
      var c2 = 0, d2 = 0, e2 = 0, f2 = 0;
      if (!a3) {
        return;
      }
      e2 = 1;
      while (true) {
        c2 = b[a3 >> 2] | 0;
        if (c2 | 0) {
          do {
            d2 = b[c2 >> 2] | 0;
            if (d2 | 0) {
              do {
                f2 = d2;
                d2 = b[d2 + 16 >> 2] | 0;
                Ed(f2);
              } while ((d2 | 0) != 0);
            }
            f2 = c2;
            c2 = b[c2 + 8 >> 2] | 0;
            Ed(f2);
          } while ((c2 | 0) != 0);
        }
        c2 = a3;
        a3 = b[a3 + 8 >> 2] | 0;
        if (!e2) {
          Ed(c2);
        }
        if (!a3) {
          break;
        } else {
          e2 = 0;
        }
      }
      return;
    }
    function Fc(a3) {
      a3 = a3 | 0;
      var c2 = 0, d2 = 0, f2 = 0, g2 = 0, h = 0, i = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, p3 = 0, r2 = 0, s2 = 0, t2 = 0, u2 = 0, v2 = 0, w2 = 0, x2 = 0, y2 = 0, z2 = 0, A2 = 0, B2 = 0, C2 = 0, D2 = 0, E2 = 0, F = 0, G2 = 0, H2 = 0, J2 = 0, K2 = 0;
      g2 = a3 + 8 | 0;
      if (b[g2 >> 2] | 0) {
        K2 = 1;
        return K2 | 0;
      }
      f2 = b[a3 >> 2] | 0;
      if (!f2) {
        K2 = 0;
        return K2 | 0;
      }
      c2 = f2;
      d2 = 0;
      do {
        d2 = d2 + 1 | 0;
        c2 = b[c2 + 8 >> 2] | 0;
      } while ((c2 | 0) != 0);
      if (d2 >>> 0 < 2) {
        K2 = 0;
        return K2 | 0;
      }
      H2 = Dd(d2 << 2) | 0;
      if (!H2) {
        I(27396, 27235, 317, 27415);
      }
      G2 = Dd(d2 << 5) | 0;
      if (!G2) {
        I(27437, 27235, 321, 27415);
      }
      b[a3 >> 2] = 0;
      z2 = a3 + 4 | 0;
      b[z2 >> 2] = 0;
      b[g2 >> 2] = 0;
      d2 = 0;
      F = 0;
      y2 = 0;
      n = 0;
      a:
        while (true) {
          m = b[f2 >> 2] | 0;
          if (m) {
            h = 0;
            i = m;
            do {
              k = +e[i + 8 >> 3];
              c2 = i;
              i = b[i + 16 >> 2] | 0;
              l = (i | 0) == 0;
              g2 = l ? m : i;
              j = +e[g2 + 8 >> 3];
              if (+q(+(k - j)) > 3.141592653589793) {
                K2 = 14;
                break;
              }
              h = h + (j - k) * (+e[c2 >> 3] + +e[g2 >> 3]);
            } while (!l);
            if ((K2 | 0) == 14) {
              K2 = 0;
              h = 0;
              c2 = m;
              do {
                x2 = +e[c2 + 8 >> 3];
                E2 = c2 + 16 | 0;
                D2 = b[E2 >> 2] | 0;
                D2 = (D2 | 0) == 0 ? m : D2;
                w2 = +e[D2 + 8 >> 3];
                h = h + (+e[c2 >> 3] + +e[D2 >> 3]) * ((w2 < 0 ? w2 + 6.283185307179586 : w2) - (x2 < 0 ? x2 + 6.283185307179586 : x2));
                c2 = b[((c2 | 0) == 0 ? f2 : E2) >> 2] | 0;
              } while ((c2 | 0) != 0);
            }
            if (h > 0) {
              b[H2 + (F << 2) >> 2] = f2;
              F = F + 1 | 0;
              g2 = y2;
              c2 = n;
            } else {
              K2 = 19;
            }
          } else {
            K2 = 19;
          }
          if ((K2 | 0) == 19) {
            K2 = 0;
            do {
              if (!d2) {
                if (!n) {
                  if (!(b[a3 >> 2] | 0)) {
                    g2 = z2;
                    i = a3;
                    c2 = f2;
                    d2 = a3;
                    break;
                  } else {
                    K2 = 27;
                    break a;
                  }
                } else {
                  g2 = z2;
                  i = n + 8 | 0;
                  c2 = f2;
                  d2 = a3;
                  break;
                }
              } else {
                c2 = d2 + 8 | 0;
                if (b[c2 >> 2] | 0) {
                  K2 = 21;
                  break a;
                }
                d2 = Fd(1, 12) | 0;
                if (!d2) {
                  K2 = 23;
                  break a;
                }
                b[c2 >> 2] = d2;
                g2 = d2 + 4 | 0;
                i = d2;
                c2 = n;
              }
            } while (0);
            b[i >> 2] = f2;
            b[g2 >> 2] = f2;
            i = G2 + (y2 << 5) | 0;
            l = b[f2 >> 2] | 0;
            if (l) {
              m = G2 + (y2 << 5) + 8 | 0;
              e[m >> 3] = 179769313486231570000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000;
              n = G2 + (y2 << 5) + 24 | 0;
              e[n >> 3] = 179769313486231570000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000;
              e[i >> 3] = -179769313486231570000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000;
              o = G2 + (y2 << 5) + 16 | 0;
              e[o >> 3] = -179769313486231570000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000;
              u2 = 179769313486231570000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000;
              v2 = -179769313486231570000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000;
              g2 = 0;
              p3 = l;
              k = 179769313486231570000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000;
              s2 = 179769313486231570000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000;
              t2 = -179769313486231570000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000;
              j = -179769313486231570000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000;
              while (true) {
                h = +e[p3 >> 3];
                x2 = +e[p3 + 8 >> 3];
                p3 = b[p3 + 16 >> 2] | 0;
                r2 = (p3 | 0) == 0;
                w2 = +e[(r2 ? l : p3) + 8 >> 3];
                if (h < k) {
                  e[m >> 3] = h;
                  k = h;
                }
                if (x2 < s2) {
                  e[n >> 3] = x2;
                  s2 = x2;
                }
                if (h > t2) {
                  e[i >> 3] = h;
                } else {
                  h = t2;
                }
                if (x2 > j) {
                  e[o >> 3] = x2;
                  j = x2;
                }
                u2 = x2 > 0 & x2 < u2 ? x2 : u2;
                v2 = x2 < 0 & x2 > v2 ? x2 : v2;
                g2 = g2 | +q(+(x2 - w2)) > 3.141592653589793;
                if (r2) {
                  break;
                } else {
                  t2 = h;
                }
              }
              if (g2) {
                e[o >> 3] = v2;
                e[n >> 3] = u2;
              }
            } else {
              b[i >> 2] = 0;
              b[i + 4 >> 2] = 0;
              b[i + 8 >> 2] = 0;
              b[i + 12 >> 2] = 0;
              b[i + 16 >> 2] = 0;
              b[i + 20 >> 2] = 0;
              b[i + 24 >> 2] = 0;
              b[i + 28 >> 2] = 0;
            }
            g2 = y2 + 1 | 0;
          }
          E2 = f2 + 8 | 0;
          f2 = b[E2 >> 2] | 0;
          b[E2 >> 2] = 0;
          if (!f2) {
            K2 = 45;
            break;
          } else {
            y2 = g2;
            n = c2;
          }
        }
      if ((K2 | 0) == 21) {
        I(27213, 27235, 35, 27247);
      } else if ((K2 | 0) == 23) {
        I(27267, 27235, 37, 27247);
      } else if ((K2 | 0) == 27) {
        I(27310, 27235, 61, 27333);
      } else if ((K2 | 0) == 45) {
        b:
          do {
            if ((F | 0) > 0) {
              E2 = (g2 | 0) == 0;
              C2 = g2 << 2;
              D2 = (a3 | 0) == 0;
              B2 = 0;
              c2 = 0;
              while (true) {
                A2 = b[H2 + (B2 << 2) >> 2] | 0;
                if (!E2) {
                  y2 = Dd(C2) | 0;
                  if (!y2) {
                    K2 = 50;
                    break;
                  }
                  z2 = Dd(C2) | 0;
                  if (!z2) {
                    K2 = 52;
                    break;
                  }
                  c:
                    do {
                      if (!D2) {
                        g2 = 0;
                        d2 = 0;
                        i = a3;
                        while (true) {
                          f2 = G2 + (g2 << 5) | 0;
                          if (Gc(b[i >> 2] | 0, f2, b[A2 >> 2] | 0) | 0) {
                            b[y2 + (d2 << 2) >> 2] = i;
                            b[z2 + (d2 << 2) >> 2] = f2;
                            r2 = d2 + 1 | 0;
                          } else {
                            r2 = d2;
                          }
                          i = b[i + 8 >> 2] | 0;
                          if (!i) {
                            break;
                          } else {
                            g2 = g2 + 1 | 0;
                            d2 = r2;
                          }
                        }
                        if ((r2 | 0) > 0) {
                          f2 = b[y2 >> 2] | 0;
                          if ((r2 | 0) == 1) {
                            d2 = f2;
                          } else {
                            o = 0;
                            p3 = -1;
                            d2 = f2;
                            n = f2;
                            while (true) {
                              l = b[n >> 2] | 0;
                              f2 = 0;
                              i = 0;
                              while (true) {
                                g2 = b[b[y2 + (i << 2) >> 2] >> 2] | 0;
                                if ((g2 | 0) == (l | 0)) {
                                  m = f2;
                                } else {
                                  m = f2 + ((Gc(g2, b[z2 + (i << 2) >> 2] | 0, b[l >> 2] | 0) | 0) & 1) | 0;
                                }
                                i = i + 1 | 0;
                                if ((i | 0) == (r2 | 0)) {
                                  break;
                                } else {
                                  f2 = m;
                                }
                              }
                              g2 = (m | 0) > (p3 | 0);
                              d2 = g2 ? n : d2;
                              f2 = o + 1 | 0;
                              if ((f2 | 0) == (r2 | 0)) {
                                break c;
                              }
                              o = f2;
                              p3 = g2 ? m : p3;
                              n = b[y2 + (f2 << 2) >> 2] | 0;
                            }
                          }
                        } else {
                          d2 = 0;
                        }
                      } else {
                        d2 = 0;
                      }
                    } while (0);
                  Ed(y2);
                  Ed(z2);
                  if (d2) {
                    g2 = d2 + 4 | 0;
                    f2 = b[g2 >> 2] | 0;
                    if (!f2) {
                      if (b[d2 >> 2] | 0) {
                        K2 = 70;
                        break;
                      }
                    } else {
                      d2 = f2 + 8 | 0;
                    }
                    b[d2 >> 2] = A2;
                    b[g2 >> 2] = A2;
                  } else {
                    K2 = 73;
                  }
                } else {
                  K2 = 73;
                }
                if ((K2 | 0) == 73) {
                  K2 = 0;
                  c2 = b[A2 >> 2] | 0;
                  if (c2 | 0) {
                    do {
                      z2 = c2;
                      c2 = b[c2 + 16 >> 2] | 0;
                      Ed(z2);
                    } while ((c2 | 0) != 0);
                  }
                  Ed(A2);
                  c2 = 1;
                }
                B2 = B2 + 1 | 0;
                if ((B2 | 0) >= (F | 0)) {
                  J2 = c2;
                  break b;
                }
              }
              if ((K2 | 0) == 50) {
                I(27452, 27235, 249, 27471);
              } else if ((K2 | 0) == 52) {
                I(27490, 27235, 252, 27471);
              } else if ((K2 | 0) == 70) {
                I(27310, 27235, 61, 27333);
              }
            } else {
              J2 = 0;
            }
          } while (0);
        Ed(H2);
        Ed(G2);
        K2 = J2;
        return K2 | 0;
      }
      return 0;
    }
    function Gc(a3, c2, d2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      var f2 = 0, g2 = 0, h = 0, i = 0, j = 0, k = 0, l = 0, m = 0;
      if (!(Ca(c2, d2) | 0)) {
        a3 = 0;
        return a3 | 0;
      }
      c2 = Aa(c2) | 0;
      f2 = +e[d2 >> 3];
      g2 = +e[d2 + 8 >> 3];
      g2 = c2 & g2 < 0 ? g2 + 6.283185307179586 : g2;
      a3 = b[a3 >> 2] | 0;
      if (!a3) {
        a3 = 0;
        return a3 | 0;
      }
      if (c2) {
        c2 = 0;
        l = g2;
        d2 = a3;
        a:
          while (true) {
            while (true) {
              i = +e[d2 >> 3];
              g2 = +e[d2 + 8 >> 3];
              d2 = d2 + 16 | 0;
              m = b[d2 >> 2] | 0;
              m = (m | 0) == 0 ? a3 : m;
              h = +e[m >> 3];
              j = +e[m + 8 >> 3];
              if (i > h) {
                k = i;
                i = j;
              } else {
                k = h;
                h = i;
                i = g2;
                g2 = j;
              }
              f2 = f2 == h | f2 == k ? f2 + 0.0000000000000002220446049250313 : f2;
              if (!(f2 < h | f2 > k)) {
                break;
              }
              d2 = b[d2 >> 2] | 0;
              if (!d2) {
                d2 = 22;
                break a;
              }
            }
            j = i < 0 ? i + 6.283185307179586 : i;
            i = g2 < 0 ? g2 + 6.283185307179586 : g2;
            l = j == l | i == l ? l + -0.0000000000000002220446049250313 : l;
            k = j + (i - j) * ((f2 - h) / (k - h));
            if ((k < 0 ? k + 6.283185307179586 : k) > l) {
              c2 = c2 ^ 1;
            }
            d2 = b[d2 >> 2] | 0;
            if (!d2) {
              d2 = 22;
              break;
            }
          }
        if ((d2 | 0) == 22) {
          return c2 | 0;
        }
      } else {
        c2 = 0;
        l = g2;
        d2 = a3;
        b:
          while (true) {
            while (true) {
              i = +e[d2 >> 3];
              g2 = +e[d2 + 8 >> 3];
              d2 = d2 + 16 | 0;
              m = b[d2 >> 2] | 0;
              m = (m | 0) == 0 ? a3 : m;
              h = +e[m >> 3];
              j = +e[m + 8 >> 3];
              if (i > h) {
                k = i;
                i = j;
              } else {
                k = h;
                h = i;
                i = g2;
                g2 = j;
              }
              f2 = f2 == h | f2 == k ? f2 + 0.0000000000000002220446049250313 : f2;
              if (!(f2 < h | f2 > k)) {
                break;
              }
              d2 = b[d2 >> 2] | 0;
              if (!d2) {
                d2 = 22;
                break b;
              }
            }
            l = i == l | g2 == l ? l + -0.0000000000000002220446049250313 : l;
            if (i + (g2 - i) * ((f2 - h) / (k - h)) > l) {
              c2 = c2 ^ 1;
            }
            d2 = b[d2 >> 2] | 0;
            if (!d2) {
              d2 = 22;
              break;
            }
          }
        if ((d2 | 0) == 22) {
          return c2 | 0;
        }
      }
      return 0;
    }
    function Hc(c2, d2, e2, f2, g2) {
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      var h = 0, i = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, p3 = 0, q2 = 0, r2 = 0, s2 = 0, t2 = 0, u2 = 0;
      u2 = T;
      T = T + 32 | 0;
      t2 = u2 + 16 | 0;
      s2 = u2;
      h = Qd(c2 | 0, d2 | 0, 52) | 0;
      H() | 0;
      h = h & 15;
      p3 = Qd(e2 | 0, f2 | 0, 52) | 0;
      H() | 0;
      if ((h | 0) != (p3 & 15 | 0)) {
        t2 = 12;
        T = u2;
        return t2 | 0;
      }
      l = Qd(c2 | 0, d2 | 0, 45) | 0;
      H() | 0;
      l = l & 127;
      m = Qd(e2 | 0, f2 | 0, 45) | 0;
      H() | 0;
      m = m & 127;
      if (l >>> 0 > 121 | m >>> 0 > 121) {
        t2 = 5;
        T = u2;
        return t2 | 0;
      }
      p3 = (l | 0) != (m | 0);
      if (p3) {
        j = wa(l, m) | 0;
        if ((j | 0) == 7) {
          t2 = 1;
          T = u2;
          return t2 | 0;
        }
        k = wa(m, l) | 0;
        if ((k | 0) == 7) {
          I(27514, 27538, 161, 27548);
        } else {
          q2 = j;
          i = k;
        }
      } else {
        q2 = 0;
        i = 0;
      }
      n = oa(l) | 0;
      o = oa(m) | 0;
      b[t2 >> 2] = 0;
      b[t2 + 4 >> 2] = 0;
      b[t2 + 8 >> 2] = 0;
      b[t2 + 12 >> 2] = 0;
      do {
        if (!q2) {
          Xb(e2, f2, t2) | 0;
          if ((n | 0) != 0 & (o | 0) != 0) {
            if ((m | 0) != (l | 0)) {
              I(27621, 27538, 261, 27548);
            }
            i = Pb(c2, d2) | 0;
            h = Pb(e2, f2) | 0;
            if (!((i | 0) == 7 | (h | 0) == 7)) {
              if (!(a2[22000 + (i * 7 | 0) + h >> 0] | 0)) {
                i = b[21168 + (i * 28 | 0) + (h << 2) >> 2] | 0;
                if ((i | 0) > 0) {
                  j = t2 + 4 | 0;
                  h = 0;
                  do {
                    _a(j);
                    h = h + 1 | 0;
                  } while ((h | 0) != (i | 0));
                  r2 = 51;
                } else {
                  r2 = 51;
                }
              } else {
                h = 1;
              }
            } else {
              h = 5;
            }
          } else {
            r2 = 51;
          }
        } else {
          m = b[4272 + (l * 28 | 0) + (q2 << 2) >> 2] | 0;
          j = (m | 0) > 0;
          if (!o) {
            if (j) {
              l = 0;
              k = e2;
              j = f2;
              do {
                k = Tb(k, j) | 0;
                j = H() | 0;
                i = ab(i) | 0;
                l = l + 1 | 0;
              } while ((l | 0) != (m | 0));
              m = i;
              l = k;
              k = j;
            } else {
              m = i;
              l = e2;
              k = f2;
            }
          } else if (j) {
            l = 0;
            k = e2;
            j = f2;
            do {
              k = Sb(k, j) | 0;
              j = H() | 0;
              i = ab(i) | 0;
              if ((i | 0) == 1) {
                i = ab(1) | 0;
              }
              l = l + 1 | 0;
            } while ((l | 0) != (m | 0));
            m = i;
            l = k;
            k = j;
          } else {
            m = i;
            l = e2;
            k = f2;
          }
          Xb(l, k, t2) | 0;
          if (!p3) {
            I(27563, 27538, 191, 27548);
          }
          j = (n | 0) != 0;
          i = (o | 0) != 0;
          if (j & i) {
            I(27590, 27538, 192, 27548);
          }
          if (!j) {
            if (i) {
              i = Pb(l, k) | 0;
              if ((i | 0) == 7) {
                h = 5;
                break;
              }
              if (a2[22000 + (i * 7 | 0) + m >> 0] | 0) {
                h = 1;
                break;
              }
              l = 0;
              k = b[21168 + (m * 28 | 0) + (i << 2) >> 2] | 0;
            } else {
              l = 0;
              k = 0;
            }
          } else {
            i = Pb(c2, d2) | 0;
            if ((i | 0) == 7) {
              h = 5;
              break;
            }
            if (a2[22000 + (i * 7 | 0) + q2 >> 0] | 0) {
              h = 1;
              break;
            }
            k = b[21168 + (i * 28 | 0) + (q2 << 2) >> 2] | 0;
            l = k;
          }
          if ((l | k | 0) < 0) {
            h = 5;
          } else {
            if ((k | 0) > 0) {
              j = t2 + 4 | 0;
              i = 0;
              do {
                _a(j);
                i = i + 1 | 0;
              } while ((i | 0) != (k | 0));
            }
            b[s2 >> 2] = 0;
            b[s2 + 4 >> 2] = 0;
            b[s2 + 8 >> 2] = 0;
            Ya(s2, q2);
            if (h | 0) {
              while (true) {
                if (!(Vb(h) | 0)) {
                  Xa(s2);
                } else {
                  Wa(s2);
                }
                if ((h | 0) > 1) {
                  h = h + -1 | 0;
                } else {
                  break;
                }
              }
            }
            if ((l | 0) > 0) {
              h = 0;
              do {
                _a(s2);
                h = h + 1 | 0;
              } while ((h | 0) != (l | 0));
            }
            r2 = t2 + 4 | 0;
            Oa(r2, s2, r2);
            Ma(r2);
            r2 = 51;
          }
        }
      } while (0);
      if ((r2 | 0) == 51) {
        h = t2 + 4 | 0;
        b[g2 >> 2] = b[h >> 2];
        b[g2 + 4 >> 2] = b[h + 4 >> 2];
        b[g2 + 8 >> 2] = b[h + 8 >> 2];
        h = 0;
      }
      t2 = h;
      T = u2;
      return t2 | 0;
    }
    function Ic(a3, c2, d2, e2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      var f2 = 0, g2 = 0, h = 0, i = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, p3 = 0, q2 = 0, r2 = 0, s2 = 0, t2 = 0, u2 = 0;
      q2 = T;
      T = T + 48 | 0;
      k = q2 + 36 | 0;
      h = q2 + 24 | 0;
      i = q2 + 12 | 0;
      j = q2;
      f2 = Qd(a3 | 0, c2 | 0, 52) | 0;
      H() | 0;
      f2 = f2 & 15;
      n = Qd(a3 | 0, c2 | 0, 45) | 0;
      H() | 0;
      n = n & 127;
      if (n >>> 0 > 121) {
        e2 = 5;
        T = q2;
        return e2 | 0;
      }
      l = oa(n) | 0;
      Rd(f2 | 0, 0, 52) | 0;
      r2 = H() | 0 | 134225919;
      g2 = e2;
      b[g2 >> 2] = -1;
      b[g2 + 4 >> 2] = r2;
      if (!f2) {
        f2 = Ra(d2) | 0;
        if ((f2 | 0) == 7) {
          r2 = 1;
          T = q2;
          return r2 | 0;
        }
        f2 = va(n, f2) | 0;
        if ((f2 | 0) == 127) {
          r2 = 1;
          T = q2;
          return r2 | 0;
        }
        o = Rd(f2 | 0, 0, 45) | 0;
        p3 = H() | 0;
        n = e2;
        p3 = b[n + 4 >> 2] & -1040385 | p3;
        r2 = e2;
        b[r2 >> 2] = b[n >> 2] | o;
        b[r2 + 4 >> 2] = p3;
        r2 = 0;
        T = q2;
        return r2 | 0;
      }
      b[k >> 2] = b[d2 >> 2];
      b[k + 4 >> 2] = b[d2 + 4 >> 2];
      b[k + 8 >> 2] = b[d2 + 8 >> 2];
      d2 = f2;
      while (true) {
        g2 = d2;
        d2 = d2 + -1 | 0;
        b[h >> 2] = b[k >> 2];
        b[h + 4 >> 2] = b[k + 4 >> 2];
        b[h + 8 >> 2] = b[k + 8 >> 2];
        if (!(Vb(g2) | 0)) {
          f2 = Ta(k) | 0;
          if (f2 | 0) {
            d2 = 13;
            break;
          }
          b[i >> 2] = b[k >> 2];
          b[i + 4 >> 2] = b[k + 4 >> 2];
          b[i + 8 >> 2] = b[k + 8 >> 2];
          Xa(i);
        } else {
          f2 = Sa(k) | 0;
          if (f2 | 0) {
            d2 = 13;
            break;
          }
          b[i >> 2] = b[k >> 2];
          b[i + 4 >> 2] = b[k + 4 >> 2];
          b[i + 8 >> 2] = b[k + 8 >> 2];
          Wa(i);
        }
        Pa(h, i, j);
        Ma(j);
        f2 = e2;
        t2 = b[f2 >> 2] | 0;
        f2 = b[f2 + 4 >> 2] | 0;
        u2 = (15 - g2 | 0) * 3 | 0;
        s2 = Rd(7, 0, u2 | 0) | 0;
        f2 = f2 & ~(H() | 0);
        u2 = Rd(Ra(j) | 0, 0, u2 | 0) | 0;
        f2 = H() | 0 | f2;
        r2 = e2;
        b[r2 >> 2] = u2 | t2 & ~s2;
        b[r2 + 4 >> 2] = f2;
        if ((g2 | 0) <= 1) {
          d2 = 14;
          break;
        }
      }
      a:
        do {
          if ((d2 | 0) != 13) {
            if ((d2 | 0) == 14) {
              if (((b[k >> 2] | 0) <= 1 ? (b[k + 4 >> 2] | 0) <= 1 : 0) ? (b[k + 8 >> 2] | 0) <= 1 : 0) {
                d2 = Ra(k) | 0;
                f2 = va(n, d2) | 0;
                if ((f2 | 0) == 127) {
                  j = 0;
                } else {
                  j = oa(f2) | 0;
                }
                b:
                  do {
                    if (!d2) {
                      if ((l | 0) != 0 & (j | 0) != 0) {
                        d2 = Pb(a3, c2) | 0;
                        g2 = e2;
                        g2 = Pb(b[g2 >> 2] | 0, b[g2 + 4 >> 2] | 0) | 0;
                        if ((d2 | 0) == 7 | (g2 | 0) == 7) {
                          f2 = 5;
                          break a;
                        }
                        g2 = b[21376 + (d2 * 28 | 0) + (g2 << 2) >> 2] | 0;
                        if ((g2 | 0) < 0) {
                          f2 = 5;
                          break a;
                        }
                        if (!g2) {
                          d2 = 59;
                        } else {
                          i = e2;
                          d2 = 0;
                          h = b[i >> 2] | 0;
                          i = b[i + 4 >> 2] | 0;
                          do {
                            h = Rb(h, i) | 0;
                            i = H() | 0;
                            u2 = e2;
                            b[u2 >> 2] = h;
                            b[u2 + 4 >> 2] = i;
                            d2 = d2 + 1 | 0;
                          } while ((d2 | 0) < (g2 | 0));
                          d2 = 58;
                        }
                      } else {
                        d2 = 58;
                      }
                    } else {
                      if (l) {
                        f2 = Pb(a3, c2) | 0;
                        if ((f2 | 0) == 7) {
                          f2 = 5;
                          break a;
                        }
                        g2 = b[21376 + (f2 * 28 | 0) + (d2 << 2) >> 2] | 0;
                        if ((g2 | 0) > 0) {
                          f2 = d2;
                          d2 = 0;
                          do {
                            f2 = $a(f2) | 0;
                            d2 = d2 + 1 | 0;
                          } while ((d2 | 0) != (g2 | 0));
                        } else {
                          f2 = d2;
                        }
                        if ((f2 | 0) == 1) {
                          f2 = 9;
                          break a;
                        }
                        d2 = va(n, f2) | 0;
                        if ((d2 | 0) == 127) {
                          I(27648, 27538, 411, 27678);
                        }
                        if (!(oa(d2) | 0)) {
                          p3 = d2;
                          o = g2;
                          m = f2;
                        } else {
                          I(27693, 27538, 412, 27678);
                        }
                      } else {
                        p3 = f2;
                        o = 0;
                        m = d2;
                      }
                      i = b[4272 + (n * 28 | 0) + (m << 2) >> 2] | 0;
                      if ((i | 0) <= -1) {
                        I(27724, 27538, 419, 27678);
                      }
                      if (!j) {
                        if ((o | 0) < 0) {
                          f2 = 5;
                          break a;
                        }
                        if (o | 0) {
                          g2 = e2;
                          f2 = 0;
                          d2 = b[g2 >> 2] | 0;
                          g2 = b[g2 + 4 >> 2] | 0;
                          do {
                            d2 = Rb(d2, g2) | 0;
                            g2 = H() | 0;
                            u2 = e2;
                            b[u2 >> 2] = d2;
                            b[u2 + 4 >> 2] = g2;
                            f2 = f2 + 1 | 0;
                          } while ((f2 | 0) < (o | 0));
                        }
                        if ((i | 0) <= 0) {
                          f2 = p3;
                          d2 = 58;
                          break;
                        }
                        g2 = e2;
                        f2 = 0;
                        d2 = b[g2 >> 2] | 0;
                        g2 = b[g2 + 4 >> 2] | 0;
                        while (true) {
                          d2 = Rb(d2, g2) | 0;
                          g2 = H() | 0;
                          u2 = e2;
                          b[u2 >> 2] = d2;
                          b[u2 + 4 >> 2] = g2;
                          f2 = f2 + 1 | 0;
                          if ((f2 | 0) == (i | 0)) {
                            f2 = p3;
                            d2 = 58;
                            break b;
                          }
                        }
                      }
                      h = wa(p3, n) | 0;
                      if ((h | 0) == 7) {
                        I(27514, 27538, 428, 27678);
                      }
                      f2 = e2;
                      d2 = b[f2 >> 2] | 0;
                      f2 = b[f2 + 4 >> 2] | 0;
                      if ((i | 0) > 0) {
                        g2 = 0;
                        do {
                          d2 = Rb(d2, f2) | 0;
                          f2 = H() | 0;
                          u2 = e2;
                          b[u2 >> 2] = d2;
                          b[u2 + 4 >> 2] = f2;
                          g2 = g2 + 1 | 0;
                        } while ((g2 | 0) != (i | 0));
                      }
                      f2 = Pb(d2, f2) | 0;
                      if ((f2 | 0) == 7) {
                        I(27795, 27538, 440, 27678);
                      }
                      d2 = pa(p3) | 0;
                      d2 = b[(d2 ? 21792 : 21584) + (h * 28 | 0) + (f2 << 2) >> 2] | 0;
                      if ((d2 | 0) < 0) {
                        I(27795, 27538, 454, 27678);
                      }
                      if (!d2) {
                        f2 = p3;
                        d2 = 58;
                      } else {
                        h = e2;
                        f2 = 0;
                        g2 = b[h >> 2] | 0;
                        h = b[h + 4 >> 2] | 0;
                        do {
                          g2 = Qb(g2, h) | 0;
                          h = H() | 0;
                          u2 = e2;
                          b[u2 >> 2] = g2;
                          b[u2 + 4 >> 2] = h;
                          f2 = f2 + 1 | 0;
                        } while ((f2 | 0) < (d2 | 0));
                        f2 = p3;
                        d2 = 58;
                      }
                    }
                  } while (0);
                if ((d2 | 0) == 58) {
                  if (j) {
                    d2 = 59;
                  }
                }
                if ((d2 | 0) == 59) {
                  u2 = e2;
                  if ((Pb(b[u2 >> 2] | 0, b[u2 + 4 >> 2] | 0) | 0) == 1) {
                    f2 = 9;
                    break;
                  }
                }
                u2 = e2;
                s2 = b[u2 >> 2] | 0;
                u2 = b[u2 + 4 >> 2] & -1040385;
                t2 = Rd(f2 | 0, 0, 45) | 0;
                u2 = u2 | (H() | 0);
                f2 = e2;
                b[f2 >> 2] = s2 | t2;
                b[f2 + 4 >> 2] = u2;
                f2 = 0;
              } else {
                f2 = 1;
              }
            }
          }
        } while (0);
      u2 = f2;
      T = q2;
      return u2 | 0;
    }
    function Jc(a3, b2, c2, d2, e2, f2) {
      a3 = a3 | 0;
      b2 = b2 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      var g2 = 0, h = 0;
      h = T;
      T = T + 16 | 0;
      g2 = h;
      if (!e2) {
        a3 = Hc(a3, b2, c2, d2, g2) | 0;
        if (!a3) {
          eb(g2, f2);
          a3 = 0;
        }
      } else {
        a3 = 15;
      }
      T = h;
      return a3 | 0;
    }
    function Kc(a3, b2, c2, d2, e2) {
      a3 = a3 | 0;
      b2 = b2 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      var f2 = 0, g2 = 0;
      g2 = T;
      T = T + 16 | 0;
      f2 = g2;
      if (!d2) {
        c2 = fb(c2, f2) | 0;
        if (!c2) {
          c2 = Ic(a3, b2, f2, e2) | 0;
        }
      } else {
        c2 = 15;
      }
      T = g2;
      return c2 | 0;
    }
    function Lc(a3, c2, d2, e2, f2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      var g2 = 0, h = 0, i = 0, j = 0;
      j = T;
      T = T + 32 | 0;
      h = j + 12 | 0;
      i = j;
      g2 = Hc(a3, c2, a3, c2, h) | 0;
      if (g2 | 0) {
        i = g2;
        T = j;
        return i | 0;
      }
      a3 = Hc(a3, c2, d2, e2, i) | 0;
      if (a3 | 0) {
        i = a3;
        T = j;
        return i | 0;
      }
      h = db(h, i) | 0;
      i = f2;
      b[i >> 2] = h;
      b[i + 4 >> 2] = ((h | 0) < 0) << 31 >> 31;
      i = 0;
      T = j;
      return i | 0;
    }
    function Mc(a3, c2, d2, e2, f2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      var g2 = 0, h = 0, i = 0, j = 0;
      j = T;
      T = T + 32 | 0;
      h = j + 12 | 0;
      i = j;
      g2 = Hc(a3, c2, a3, c2, h) | 0;
      if (!g2) {
        g2 = Hc(a3, c2, d2, e2, i) | 0;
        if (!g2) {
          e2 = db(h, i) | 0;
          e2 = Gd(e2 | 0, ((e2 | 0) < 0) << 31 >> 31 | 0, 1, 0) | 0;
          h = H() | 0;
          i = f2;
          b[i >> 2] = e2;
          b[i + 4 >> 2] = h;
          i = 0;
          T = j;
          return i | 0;
        }
      }
      i = g2;
      T = j;
      return i | 0;
    }
    function Nc(a3, c2, d2, e2, f2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      var g2 = 0, h = 0, i = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, p3 = 0, r2 = 0, s2 = 0, t2 = 0, u2 = 0, v2 = 0, w2 = 0, x2 = 0, y2 = 0, z2 = 0, A2 = 0;
      z2 = T;
      T = T + 48 | 0;
      x2 = z2 + 24 | 0;
      h = z2 + 12 | 0;
      y2 = z2;
      g2 = Hc(a3, c2, a3, c2, x2) | 0;
      if (!g2) {
        g2 = Hc(a3, c2, d2, e2, h) | 0;
        if (!g2) {
          v2 = db(x2, h) | 0;
          w2 = ((v2 | 0) < 0) << 31 >> 31;
          b[x2 >> 2] = 0;
          b[x2 + 4 >> 2] = 0;
          b[x2 + 8 >> 2] = 0;
          b[h >> 2] = 0;
          b[h + 4 >> 2] = 0;
          b[h + 8 >> 2] = 0;
          if (Hc(a3, c2, a3, c2, x2) | 0) {
            I(27795, 27538, 692, 27747);
          }
          if (Hc(a3, c2, d2, e2, h) | 0) {
            I(27795, 27538, 697, 27747);
          }
          gb(x2);
          gb(h);
          l = (v2 | 0) == 0 ? 0 : 1 / +(v2 | 0);
          d2 = b[x2 >> 2] | 0;
          r2 = l * +((b[h >> 2] | 0) - d2 | 0);
          s2 = x2 + 4 | 0;
          e2 = b[s2 >> 2] | 0;
          t2 = l * +((b[h + 4 >> 2] | 0) - e2 | 0);
          u2 = x2 + 8 | 0;
          g2 = b[u2 >> 2] | 0;
          l = l * +((b[h + 8 >> 2] | 0) - g2 | 0);
          b[y2 >> 2] = d2;
          m = y2 + 4 | 0;
          b[m >> 2] = e2;
          n = y2 + 8 | 0;
          b[n >> 2] = g2;
          a:
            do {
              if ((v2 | 0) < 0) {
                g2 = 0;
              } else {
                o = 0;
                p3 = 0;
                while (true) {
                  j = +(p3 >>> 0) + 4294967296 * +(o | 0);
                  A2 = r2 * j + +(d2 | 0);
                  i = t2 * j + +(e2 | 0);
                  j = l * j + +(g2 | 0);
                  d2 = ~~+Vd(+A2);
                  h = ~~+Vd(+i);
                  g2 = ~~+Vd(+j);
                  A2 = +q(+(+(d2 | 0) - A2));
                  i = +q(+(+(h | 0) - i));
                  j = +q(+(+(g2 | 0) - j));
                  do {
                    if (!(A2 > i & A2 > j)) {
                      k = 0 - d2 | 0;
                      if (i > j) {
                        e2 = k - g2 | 0;
                        break;
                      } else {
                        e2 = h;
                        g2 = k - h | 0;
                        break;
                      }
                    } else {
                      d2 = 0 - (h + g2) | 0;
                      e2 = h;
                    }
                  } while (0);
                  b[y2 >> 2] = d2;
                  b[m >> 2] = e2;
                  b[n >> 2] = g2;
                  hb(y2);
                  g2 = Ic(a3, c2, y2, f2 + (p3 << 3) | 0) | 0;
                  if (g2 | 0) {
                    break a;
                  }
                  if (!((o | 0) < (w2 | 0) | (o | 0) == (w2 | 0) & p3 >>> 0 < v2 >>> 0)) {
                    g2 = 0;
                    break a;
                  }
                  d2 = Gd(p3 | 0, o | 0, 1, 0) | 0;
                  e2 = H() | 0;
                  o = e2;
                  p3 = d2;
                  d2 = b[x2 >> 2] | 0;
                  e2 = b[s2 >> 2] | 0;
                  g2 = b[u2 >> 2] | 0;
                }
              }
            } while (0);
          y2 = g2;
          T = z2;
          return y2 | 0;
        }
      }
      y2 = g2;
      T = z2;
      return y2 | 0;
    }
    function Oc(a3, b2, c2, d2) {
      a3 = a3 | 0;
      b2 = b2 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      var e2 = 0, f2 = 0, g2 = 0;
      if ((c2 | 0) == 0 & (d2 | 0) == 0) {
        e2 = 0;
        f2 = 1;
        G(e2 | 0);
        return f2 | 0;
      }
      f2 = a3;
      e2 = b2;
      a3 = 1;
      b2 = 0;
      do {
        g2 = (c2 & 1 | 0) == 0 & true;
        a3 = Md((g2 ? 1 : f2) | 0, (g2 ? 0 : e2) | 0, a3 | 0, b2 | 0) | 0;
        b2 = H() | 0;
        c2 = Pd(c2 | 0, d2 | 0, 1) | 0;
        d2 = H() | 0;
        f2 = Md(f2 | 0, e2 | 0, f2 | 0, e2 | 0) | 0;
        e2 = H() | 0;
      } while (!((c2 | 0) == 0 & (d2 | 0) == 0));
      G(b2 | 0);
      return a3 | 0;
    }
    function Pc(a3, c2, d2, f2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      f2 = f2 | 0;
      var g2 = 0, h = 0, i = 0, j = 0, k = 0, l = 0, m = 0;
      j = T;
      T = T + 16 | 0;
      h = j;
      i = Qd(a3 | 0, c2 | 0, 52) | 0;
      H() | 0;
      i = i & 15;
      do {
        if (!i) {
          g2 = Qd(a3 | 0, c2 | 0, 45) | 0;
          H() | 0;
          g2 = g2 & 127;
          if (g2 >>> 0 > 121) {
            i = 5;
            T = j;
            return i | 0;
          } else {
            h = 22064 + (g2 << 5) | 0;
            b[d2 >> 2] = b[h >> 2];
            b[d2 + 4 >> 2] = b[h + 4 >> 2];
            b[d2 + 8 >> 2] = b[h + 8 >> 2];
            b[d2 + 12 >> 2] = b[h + 12 >> 2];
            b[d2 + 16 >> 2] = b[h + 16 >> 2];
            b[d2 + 20 >> 2] = b[h + 20 >> 2];
            b[d2 + 24 >> 2] = b[h + 24 >> 2];
            b[d2 + 28 >> 2] = b[h + 28 >> 2];
            break;
          }
        } else {
          g2 = Zb(a3, c2, h) | 0;
          if (!g2) {
            l = +e[h >> 3];
            k = 1 / +t(+l);
            m = +e[25968 + (i << 3) >> 3];
            e[d2 >> 3] = l + m;
            e[d2 + 8 >> 3] = l - m;
            l = +e[h + 8 >> 3];
            k = m * k;
            e[d2 + 16 >> 3] = k + l;
            e[d2 + 24 >> 3] = l - k;
            break;
          }
          i = g2;
          T = j;
          return i | 0;
        }
      } while (0);
      Ja(d2, f2 ? 1.4 : 1.1);
      f2 = 26096 + (i << 3) | 0;
      if ((b[f2 >> 2] | 0) == (a3 | 0) ? (b[f2 + 4 >> 2] | 0) == (c2 | 0) : 0) {
        e[d2 >> 3] = 1.5707963267948966;
      }
      i = 26224 + (i << 3) | 0;
      if ((b[i >> 2] | 0) == (a3 | 0) ? (b[i + 4 >> 2] | 0) == (c2 | 0) : 0) {
        e[d2 + 8 >> 3] = -1.5707963267948966;
      }
      if (!(+e[d2 >> 3] == 1.5707963267948966) ? !(+e[d2 + 8 >> 3] == -1.5707963267948966) : 0) {
        i = 0;
        T = j;
        return i | 0;
      }
      e[d2 + 16 >> 3] = 3.141592653589793;
      e[d2 + 24 >> 3] = -3.141592653589793;
      i = 0;
      T = j;
      return i | 0;
    }
    function Qc(c2, d2, e2, f2) {
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      var g2 = 0, h = 0, i = 0, j = 0, k = 0, l = 0, m = 0;
      l = T;
      T = T + 48 | 0;
      i = l + 32 | 0;
      h = l + 40 | 0;
      j = l;
      Eb(i, 0, 0, 0);
      k = b[i >> 2] | 0;
      i = b[i + 4 >> 2] | 0;
      do {
        if (e2 >>> 0 <= 15) {
          g2 = Xc(f2) | 0;
          if (g2 | 0) {
            f2 = j;
            b[f2 >> 2] = 0;
            b[f2 + 4 >> 2] = 0;
            b[j + 8 >> 2] = g2;
            b[j + 12 >> 2] = -1;
            f2 = j + 16 | 0;
            k = j + 29 | 0;
            b[f2 >> 2] = 0;
            b[f2 + 4 >> 2] = 0;
            b[f2 + 8 >> 2] = 0;
            a2[f2 + 12 >> 0] = 0;
            a2[k >> 0] = a2[h >> 0] | 0;
            a2[k + 1 >> 0] = a2[h + 1 >> 0] | 0;
            a2[k + 2 >> 0] = a2[h + 2 >> 0] | 0;
            break;
          }
          g2 = Fd((b[d2 + 8 >> 2] | 0) + 1 | 0, 32) | 0;
          if (!g2) {
            f2 = j;
            b[f2 >> 2] = 0;
            b[f2 + 4 >> 2] = 0;
            b[j + 8 >> 2] = 13;
            b[j + 12 >> 2] = -1;
            f2 = j + 16 | 0;
            k = j + 29 | 0;
            b[f2 >> 2] = 0;
            b[f2 + 4 >> 2] = 0;
            b[f2 + 8 >> 2] = 0;
            a2[f2 + 12 >> 0] = 0;
            a2[k >> 0] = a2[h >> 0] | 0;
            a2[k + 1 >> 0] = a2[h + 1 >> 0] | 0;
            a2[k + 2 >> 0] = a2[h + 2 >> 0] | 0;
            break;
          } else {
            Yc(d2, g2);
            m = j;
            b[m >> 2] = k;
            b[m + 4 >> 2] = i;
            b[j + 8 >> 2] = 0;
            b[j + 12 >> 2] = e2;
            b[j + 16 >> 2] = f2;
            b[j + 20 >> 2] = d2;
            b[j + 24 >> 2] = g2;
            a2[j + 28 >> 0] = 0;
            k = j + 29 | 0;
            a2[k >> 0] = a2[h >> 0] | 0;
            a2[k + 1 >> 0] = a2[h + 1 >> 0] | 0;
            a2[k + 2 >> 0] = a2[h + 2 >> 0] | 0;
            break;
          }
        } else {
          k = j;
          b[k >> 2] = 0;
          b[k + 4 >> 2] = 0;
          b[j + 8 >> 2] = 4;
          b[j + 12 >> 2] = -1;
          k = j + 16 | 0;
          m = j + 29 | 0;
          b[k >> 2] = 0;
          b[k + 4 >> 2] = 0;
          b[k + 8 >> 2] = 0;
          a2[k + 12 >> 0] = 0;
          a2[m >> 0] = a2[h >> 0] | 0;
          a2[m + 1 >> 0] = a2[h + 1 >> 0] | 0;
          a2[m + 2 >> 0] = a2[h + 2 >> 0] | 0;
        }
      } while (0);
      Rc(j);
      b[c2 >> 2] = b[j >> 2];
      b[c2 + 4 >> 2] = b[j + 4 >> 2];
      b[c2 + 8 >> 2] = b[j + 8 >> 2];
      b[c2 + 12 >> 2] = b[j + 12 >> 2];
      b[c2 + 16 >> 2] = b[j + 16 >> 2];
      b[c2 + 20 >> 2] = b[j + 20 >> 2];
      b[c2 + 24 >> 2] = b[j + 24 >> 2];
      b[c2 + 28 >> 2] = b[j + 28 >> 2];
      T = l;
      return;
    }
    function Rc(c2) {
      c2 = c2 | 0;
      var d2 = 0, e2 = 0, f2 = 0, g2 = 0, h = 0, i = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, p3 = 0, q2 = 0, r2 = 0, s2 = 0, t2 = 0, u2 = 0, v2 = 0, w2 = 0;
      w2 = T;
      T = T + 336 | 0;
      p3 = w2 + 168 | 0;
      q2 = w2;
      f2 = c2;
      e2 = b[f2 >> 2] | 0;
      f2 = b[f2 + 4 >> 2] | 0;
      if ((e2 | 0) == 0 & (f2 | 0) == 0) {
        T = w2;
        return;
      }
      d2 = c2 + 28 | 0;
      if (!(a2[d2 >> 0] | 0)) {
        a2[d2 >> 0] = 1;
      } else {
        e2 = Sc(e2, f2) | 0;
        f2 = H() | 0;
      }
      v2 = c2 + 20 | 0;
      if (!(b[b[v2 >> 2] >> 2] | 0)) {
        d2 = c2 + 24 | 0;
        e2 = b[d2 >> 2] | 0;
        if (e2 | 0) {
          Ed(e2);
        }
        u2 = c2;
        b[u2 >> 2] = 0;
        b[u2 + 4 >> 2] = 0;
        b[c2 + 8 >> 2] = 0;
        b[v2 >> 2] = 0;
        b[c2 + 12 >> 2] = -1;
        b[c2 + 16 >> 2] = 0;
        b[d2 >> 2] = 0;
        T = w2;
        return;
      }
      u2 = c2 + 16 | 0;
      d2 = b[u2 >> 2] | 0;
      g2 = d2 & 15;
      a:
        do {
          if (!((e2 | 0) == 0 & (f2 | 0) == 0)) {
            r2 = c2 + 12 | 0;
            n = (g2 | 0) == 3;
            m = d2 & 255;
            k = (g2 | 1 | 0) == 3;
            o = c2 + 24 | 0;
            l = (g2 + -1 | 0) >>> 0 < 3;
            i = (g2 | 2 | 0) == 3;
            j = q2 + 8 | 0;
            b:
              while (true) {
                h = Qd(e2 | 0, f2 | 0, 52) | 0;
                H() | 0;
                h = h & 15;
                if ((h | 0) == (b[r2 >> 2] | 0)) {
                  switch (m & 15) {
                    case 0:
                    case 2:
                    case 3: {
                      g2 = Zb(e2, f2, p3) | 0;
                      if (g2 | 0) {
                        s2 = 15;
                        break b;
                      }
                      if (Zc(b[v2 >> 2] | 0, b[o >> 2] | 0, p3) | 0) {
                        s2 = 19;
                        break b;
                      }
                      break;
                    }
                    default:
                  }
                  if (k ? (g2 = b[(b[v2 >> 2] | 0) + 4 >> 2] | 0, b[p3 >> 2] = b[g2 >> 2], b[p3 + 4 >> 2] = b[g2 + 4 >> 2], b[p3 + 8 >> 2] = b[g2 + 8 >> 2], b[p3 + 12 >> 2] = b[g2 + 12 >> 2], Ca(26832, p3) | 0) : 0) {
                    if (Wb(b[(b[v2 >> 2] | 0) + 4 >> 2] | 0, h, q2) | 0) {
                      s2 = 25;
                      break;
                    }
                    g2 = q2;
                    if ((b[g2 >> 2] | 0) == (e2 | 0) ? (b[g2 + 4 >> 2] | 0) == (f2 | 0) : 0) {
                      s2 = 29;
                      break;
                    }
                  }
                  if (l) {
                    g2 = _b(e2, f2, p3) | 0;
                    if (g2 | 0) {
                      s2 = 32;
                      break;
                    }
                    if (Pc(e2, f2, q2, 0) | 0) {
                      s2 = 36;
                      break;
                    }
                    if (i ? _c(b[v2 >> 2] | 0, b[o >> 2] | 0, p3, q2) | 0 : 0) {
                      s2 = 42;
                      break;
                    }
                    if (k ? ad(b[v2 >> 2] | 0, b[o >> 2] | 0, p3, q2) | 0 : 0) {
                      s2 = 42;
                      break;
                    }
                  }
                  if (n) {
                    d2 = Pc(e2, f2, p3, 1) | 0;
                    g2 = b[o >> 2] | 0;
                    if (d2 | 0) {
                      s2 = 45;
                      break;
                    }
                    if (Da(g2, p3) | 0) {
                      Ga(q2, p3);
                      if (Fa(p3, b[o >> 2] | 0) | 0) {
                        s2 = 53;
                        break;
                      }
                      if (Zc(b[v2 >> 2] | 0, b[o >> 2] | 0, j) | 0) {
                        s2 = 53;
                        break;
                      }
                      if (ad(b[v2 >> 2] | 0, b[o >> 2] | 0, q2, p3) | 0) {
                        s2 = 53;
                        break;
                      }
                    }
                  }
                }
                do {
                  if ((h | 0) < (b[r2 >> 2] | 0)) {
                    d2 = Pc(e2, f2, p3, 1) | 0;
                    g2 = b[o >> 2] | 0;
                    if (d2 | 0) {
                      s2 = 58;
                      break b;
                    }
                    if (!(Da(g2, p3) | 0)) {
                      s2 = 73;
                      break;
                    }
                    if (Fa(b[o >> 2] | 0, p3) | 0 ? (Ga(q2, p3), _c(b[v2 >> 2] | 0, b[o >> 2] | 0, q2, p3) | 0) : 0) {
                      s2 = 65;
                      break b;
                    }
                    e2 = Kb(e2, f2, h + 1 | 0, q2) | 0;
                    if (e2 | 0) {
                      s2 = 67;
                      break b;
                    }
                    f2 = q2;
                    e2 = b[f2 >> 2] | 0;
                    f2 = b[f2 + 4 >> 2] | 0;
                  } else {
                    s2 = 73;
                  }
                } while (0);
                if ((s2 | 0) == 73) {
                  s2 = 0;
                  e2 = Sc(e2, f2) | 0;
                  f2 = H() | 0;
                }
                if ((e2 | 0) == 0 & (f2 | 0) == 0) {
                  t2 = o;
                  break a;
                }
              }
            switch (s2 | 0) {
              case 15: {
                d2 = b[o >> 2] | 0;
                if (d2 | 0) {
                  Ed(d2);
                }
                s2 = c2;
                b[s2 >> 2] = 0;
                b[s2 + 4 >> 2] = 0;
                b[v2 >> 2] = 0;
                b[r2 >> 2] = -1;
                b[u2 >> 2] = 0;
                b[o >> 2] = 0;
                b[c2 + 8 >> 2] = g2;
                s2 = 20;
                break;
              }
              case 19: {
                b[c2 >> 2] = e2;
                b[c2 + 4 >> 2] = f2;
                s2 = 20;
                break;
              }
              case 25: {
                I(27795, 27761, 470, 27772);
                break;
              }
              case 29: {
                b[c2 >> 2] = e2;
                b[c2 + 4 >> 2] = f2;
                T = w2;
                return;
              }
              case 32: {
                d2 = b[o >> 2] | 0;
                if (d2 | 0) {
                  Ed(d2);
                }
                t2 = c2;
                b[t2 >> 2] = 0;
                b[t2 + 4 >> 2] = 0;
                b[v2 >> 2] = 0;
                b[r2 >> 2] = -1;
                b[u2 >> 2] = 0;
                b[o >> 2] = 0;
                b[c2 + 8 >> 2] = g2;
                T = w2;
                return;
              }
              case 36: {
                I(27795, 27761, 493, 27772);
                break;
              }
              case 42: {
                b[c2 >> 2] = e2;
                b[c2 + 4 >> 2] = f2;
                T = w2;
                return;
              }
              case 45: {
                if (g2 | 0) {
                  Ed(g2);
                }
                s2 = c2;
                b[s2 >> 2] = 0;
                b[s2 + 4 >> 2] = 0;
                b[v2 >> 2] = 0;
                b[r2 >> 2] = -1;
                b[u2 >> 2] = 0;
                b[o >> 2] = 0;
                b[c2 + 8 >> 2] = d2;
                s2 = 55;
                break;
              }
              case 53: {
                b[c2 >> 2] = e2;
                b[c2 + 4 >> 2] = f2;
                s2 = 55;
                break;
              }
              case 58: {
                if (g2 | 0) {
                  Ed(g2);
                }
                s2 = c2;
                b[s2 >> 2] = 0;
                b[s2 + 4 >> 2] = 0;
                b[v2 >> 2] = 0;
                b[r2 >> 2] = -1;
                b[u2 >> 2] = 0;
                b[o >> 2] = 0;
                b[c2 + 8 >> 2] = d2;
                s2 = 71;
                break;
              }
              case 65: {
                b[c2 >> 2] = e2;
                b[c2 + 4 >> 2] = f2;
                s2 = 71;
                break;
              }
              case 67: {
                d2 = b[o >> 2] | 0;
                if (d2 | 0) {
                  Ed(d2);
                }
                t2 = c2;
                b[t2 >> 2] = 0;
                b[t2 + 4 >> 2] = 0;
                b[v2 >> 2] = 0;
                b[r2 >> 2] = -1;
                b[u2 >> 2] = 0;
                b[o >> 2] = 0;
                b[c2 + 8 >> 2] = e2;
                T = w2;
                return;
              }
            }
            if ((s2 | 0) == 20) {
              T = w2;
              return;
            } else if ((s2 | 0) == 55) {
              T = w2;
              return;
            } else if ((s2 | 0) == 71) {
              T = w2;
              return;
            }
          } else {
            t2 = c2 + 24 | 0;
          }
        } while (0);
      d2 = b[t2 >> 2] | 0;
      if (d2 | 0) {
        Ed(d2);
      }
      s2 = c2;
      b[s2 >> 2] = 0;
      b[s2 + 4 >> 2] = 0;
      b[c2 + 8 >> 2] = 0;
      b[v2 >> 2] = 0;
      b[c2 + 12 >> 2] = -1;
      b[u2 >> 2] = 0;
      b[t2 >> 2] = 0;
      T = w2;
      return;
    }
    function Sc(a3, c2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      var d2 = 0, e2 = 0, f2 = 0, g2 = 0, h = 0, i = 0, j = 0, k = 0, l = 0, m = 0;
      m = T;
      T = T + 16 | 0;
      l = m;
      e2 = Qd(a3 | 0, c2 | 0, 52) | 0;
      H() | 0;
      e2 = e2 & 15;
      d2 = Qd(a3 | 0, c2 | 0, 45) | 0;
      H() | 0;
      do {
        if (e2) {
          while (true) {
            d2 = Rd(e2 + 4095 | 0, 0, 52) | 0;
            f2 = H() | 0 | c2 & -15728641;
            g2 = (15 - e2 | 0) * 3 | 0;
            h = Rd(7, 0, g2 | 0) | 0;
            i = H() | 0;
            d2 = d2 | a3 | h;
            f2 = f2 | i;
            j = Qd(a3 | 0, c2 | 0, g2 | 0) | 0;
            H() | 0;
            j = j & 7;
            e2 = e2 + -1 | 0;
            if (j >>> 0 < 6) {
              break;
            }
            if (!e2) {
              k = 4;
              break;
            } else {
              c2 = f2;
              a3 = d2;
            }
          }
          if ((k | 0) == 4) {
            d2 = Qd(d2 | 0, f2 | 0, 45) | 0;
            H() | 0;
            break;
          }
          l = (j | 0) == 0 & (Hb(d2, f2) | 0) != 0;
          l = Rd((l ? 2 : 1) + j | 0, 0, g2 | 0) | 0;
          k = H() | 0 | c2 & ~i;
          l = l | a3 & ~h;
          G(k | 0);
          T = m;
          return l | 0;
        }
      } while (0);
      d2 = d2 & 127;
      if (d2 >>> 0 > 120) {
        k = 0;
        l = 0;
        G(k | 0);
        T = m;
        return l | 0;
      }
      Eb(l, 0, d2 + 1 | 0, 0);
      k = b[l + 4 >> 2] | 0;
      l = b[l >> 2] | 0;
      G(k | 0);
      T = m;
      return l | 0;
    }
    function Tc(a3, c2, d2, e2, f2, g2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      var h = 0, i = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, p3 = 0, q2 = 0, r2 = 0;
      r2 = T;
      T = T + 160 | 0;
      m = r2 + 80 | 0;
      i = r2 + 64 | 0;
      n = r2 + 112 | 0;
      q2 = r2;
      Qc(m, a3, c2, d2);
      k = m;
      fc(i, b[k >> 2] | 0, b[k + 4 >> 2] | 0, c2);
      k = i;
      j = b[k >> 2] | 0;
      k = b[k + 4 >> 2] | 0;
      h = b[m + 8 >> 2] | 0;
      o = n + 4 | 0;
      b[o >> 2] = b[m >> 2];
      b[o + 4 >> 2] = b[m + 4 >> 2];
      b[o + 8 >> 2] = b[m + 8 >> 2];
      b[o + 12 >> 2] = b[m + 12 >> 2];
      b[o + 16 >> 2] = b[m + 16 >> 2];
      b[o + 20 >> 2] = b[m + 20 >> 2];
      b[o + 24 >> 2] = b[m + 24 >> 2];
      b[o + 28 >> 2] = b[m + 28 >> 2];
      o = q2;
      b[o >> 2] = j;
      b[o + 4 >> 2] = k;
      o = q2 + 8 | 0;
      b[o >> 2] = h;
      a3 = q2 + 12 | 0;
      c2 = n;
      d2 = a3 + 36 | 0;
      do {
        b[a3 >> 2] = b[c2 >> 2];
        a3 = a3 + 4 | 0;
        c2 = c2 + 4 | 0;
      } while ((a3 | 0) < (d2 | 0));
      n = q2 + 48 | 0;
      b[n >> 2] = b[i >> 2];
      b[n + 4 >> 2] = b[i + 4 >> 2];
      b[n + 8 >> 2] = b[i + 8 >> 2];
      b[n + 12 >> 2] = b[i + 12 >> 2];
      if ((j | 0) == 0 & (k | 0) == 0) {
        q2 = h;
        T = r2;
        return q2 | 0;
      }
      d2 = q2 + 16 | 0;
      l = q2 + 24 | 0;
      m = q2 + 28 | 0;
      h = 0;
      i = 0;
      c2 = j;
      a3 = k;
      do {
        if (!((h | 0) < (f2 | 0) | (h | 0) == (f2 | 0) & i >>> 0 < e2 >>> 0)) {
          p3 = 4;
          break;
        }
        k = i;
        i = Gd(i | 0, h | 0, 1, 0) | 0;
        h = H() | 0;
        k = g2 + (k << 3) | 0;
        b[k >> 2] = c2;
        b[k + 4 >> 2] = a3;
        hc(n);
        a3 = n;
        c2 = b[a3 >> 2] | 0;
        a3 = b[a3 + 4 >> 2] | 0;
        if ((c2 | 0) == 0 & (a3 | 0) == 0) {
          Rc(d2);
          c2 = d2;
          a3 = b[c2 >> 2] | 0;
          c2 = b[c2 + 4 >> 2] | 0;
          if ((a3 | 0) == 0 & (c2 | 0) == 0) {
            p3 = 10;
            break;
          }
          gc(a3, c2, b[m >> 2] | 0, n);
          a3 = n;
          c2 = b[a3 >> 2] | 0;
          a3 = b[a3 + 4 >> 2] | 0;
        }
        k = q2;
        b[k >> 2] = c2;
        b[k + 4 >> 2] = a3;
      } while (!((c2 | 0) == 0 & (a3 | 0) == 0));
      if ((p3 | 0) == 4) {
        a3 = q2 + 40 | 0;
        c2 = b[a3 >> 2] | 0;
        if (c2 | 0) {
          Ed(c2);
        }
        p3 = q2 + 16 | 0;
        b[p3 >> 2] = 0;
        b[p3 + 4 >> 2] = 0;
        b[l >> 2] = 0;
        b[q2 + 36 >> 2] = 0;
        b[m >> 2] = -1;
        b[q2 + 32 >> 2] = 0;
        b[a3 >> 2] = 0;
        gc(0, 0, 0, n);
        b[q2 >> 2] = 0;
        b[q2 + 4 >> 2] = 0;
        b[o >> 2] = 0;
        q2 = 14;
        T = r2;
        return q2 | 0;
      } else if ((p3 | 0) == 10) {
        b[q2 >> 2] = 0;
        b[q2 + 4 >> 2] = 0;
        b[o >> 2] = b[l >> 2];
      }
      q2 = b[o >> 2] | 0;
      T = r2;
      return q2 | 0;
    }
    function Uc(c2, d2, f2, g2) {
      c2 = c2 | 0;
      d2 = d2 | 0;
      f2 = f2 | 0;
      g2 = g2 | 0;
      var h = 0, i = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, p3 = 0, r2 = 0;
      o = T;
      T = T + 48 | 0;
      l = o + 32 | 0;
      k = o + 40 | 0;
      m = o;
      if (!(b[c2 >> 2] | 0)) {
        n = g2;
        b[n >> 2] = 0;
        b[n + 4 >> 2] = 0;
        n = 0;
        T = o;
        return n | 0;
      }
      Eb(l, 0, 0, 0);
      j = l;
      h = b[j >> 2] | 0;
      j = b[j + 4 >> 2] | 0;
      do {
        if (d2 >>> 0 > 15) {
          n = m;
          b[n >> 2] = 0;
          b[n + 4 >> 2] = 0;
          b[m + 8 >> 2] = 4;
          b[m + 12 >> 2] = -1;
          n = m + 16 | 0;
          f2 = m + 29 | 0;
          b[n >> 2] = 0;
          b[n + 4 >> 2] = 0;
          b[n + 8 >> 2] = 0;
          a2[n + 12 >> 0] = 0;
          a2[f2 >> 0] = a2[k >> 0] | 0;
          a2[f2 + 1 >> 0] = a2[k + 1 >> 0] | 0;
          a2[f2 + 2 >> 0] = a2[k + 2 >> 0] | 0;
          f2 = 4;
          n = 9;
        } else {
          f2 = Xc(f2) | 0;
          if (f2 | 0) {
            l = m;
            b[l >> 2] = 0;
            b[l + 4 >> 2] = 0;
            b[m + 8 >> 2] = f2;
            b[m + 12 >> 2] = -1;
            l = m + 16 | 0;
            n = m + 29 | 0;
            b[l >> 2] = 0;
            b[l + 4 >> 2] = 0;
            b[l + 8 >> 2] = 0;
            a2[l + 12 >> 0] = 0;
            a2[n >> 0] = a2[k >> 0] | 0;
            a2[n + 1 >> 0] = a2[k + 1 >> 0] | 0;
            a2[n + 2 >> 0] = a2[k + 2 >> 0] | 0;
            n = 9;
            break;
          }
          f2 = Fd((b[c2 + 8 >> 2] | 0) + 1 | 0, 32) | 0;
          if (!f2) {
            n = m;
            b[n >> 2] = 0;
            b[n + 4 >> 2] = 0;
            b[m + 8 >> 2] = 13;
            b[m + 12 >> 2] = -1;
            n = m + 16 | 0;
            f2 = m + 29 | 0;
            b[n >> 2] = 0;
            b[n + 4 >> 2] = 0;
            b[n + 8 >> 2] = 0;
            a2[n + 12 >> 0] = 0;
            a2[f2 >> 0] = a2[k >> 0] | 0;
            a2[f2 + 1 >> 0] = a2[k + 1 >> 0] | 0;
            a2[f2 + 2 >> 0] = a2[k + 2 >> 0] | 0;
            f2 = 13;
            n = 9;
            break;
          }
          Yc(c2, f2);
          r2 = m;
          b[r2 >> 2] = h;
          b[r2 + 4 >> 2] = j;
          j = m + 8 | 0;
          b[j >> 2] = 0;
          b[m + 12 >> 2] = d2;
          b[m + 20 >> 2] = c2;
          b[m + 24 >> 2] = f2;
          a2[m + 28 >> 0] = 0;
          h = m + 29 | 0;
          a2[h >> 0] = a2[k >> 0] | 0;
          a2[h + 1 >> 0] = a2[k + 1 >> 0] | 0;
          a2[h + 2 >> 0] = a2[k + 2 >> 0] | 0;
          b[m + 16 >> 2] = 3;
          p3 = +Ba(f2);
          p3 = p3 * +za(f2);
          i = +q(+ +e[f2 >> 3]);
          i = p3 / +t(+ +Ud(+i, + +q(+ +e[f2 + 8 >> 3]))) * 6371.007180918475 * 6371.007180918475;
          h = m + 12 | 0;
          f2 = b[h >> 2] | 0;
          a:
            do {
              if ((f2 | 0) > 0) {
                do {
                  qc(f2 + -1 | 0, l) | 0;
                  if (!(i / +e[l >> 3] > 10)) {
                    break a;
                  }
                  r2 = b[h >> 2] | 0;
                  f2 = r2 + -1 | 0;
                  b[h >> 2] = f2;
                } while ((r2 | 0) > 1);
              }
            } while (0);
          Rc(m);
          h = g2;
          b[h >> 2] = 0;
          b[h + 4 >> 2] = 0;
          h = m;
          f2 = b[h >> 2] | 0;
          h = b[h + 4 >> 2] | 0;
          if (!((f2 | 0) == 0 & (h | 0) == 0)) {
            do {
              Gb(f2, h, d2, l) | 0;
              k = l;
              c2 = g2;
              k = Gd(b[c2 >> 2] | 0, b[c2 + 4 >> 2] | 0, b[k >> 2] | 0, b[k + 4 >> 2] | 0) | 0;
              c2 = H() | 0;
              r2 = g2;
              b[r2 >> 2] = k;
              b[r2 + 4 >> 2] = c2;
              Rc(m);
              r2 = m;
              f2 = b[r2 >> 2] | 0;
              h = b[r2 + 4 >> 2] | 0;
            } while (!((f2 | 0) == 0 & (h | 0) == 0));
          }
          f2 = b[j >> 2] | 0;
        }
      } while (0);
      r2 = f2;
      T = o;
      return r2 | 0;
    }
    function Vc(a3, c2, d2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      var f2 = 0, g2 = 0, h = 0, i = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0;
      if (!(Ca(c2, d2) | 0)) {
        o = 0;
        return o | 0;
      }
      c2 = Aa(c2) | 0;
      f2 = +e[d2 >> 3];
      g2 = +e[d2 + 8 >> 3];
      g2 = c2 & g2 < 0 ? g2 + 6.283185307179586 : g2;
      o = b[a3 >> 2] | 0;
      if ((o | 0) <= 0) {
        o = 0;
        return o | 0;
      }
      n = b[a3 + 4 >> 2] | 0;
      if (c2) {
        c2 = 0;
        m = g2;
        d2 = -1;
        a3 = 0;
        a:
          while (true) {
            l = a3;
            while (true) {
              i = +e[n + (l << 4) >> 3];
              g2 = +e[n + (l << 4) + 8 >> 3];
              a3 = (d2 + 2 | 0) % (o | 0) | 0;
              h = +e[n + (a3 << 4) >> 3];
              j = +e[n + (a3 << 4) + 8 >> 3];
              if (i > h) {
                k = i;
                i = j;
              } else {
                k = h;
                h = i;
                i = g2;
                g2 = j;
              }
              f2 = f2 == h | f2 == k ? f2 + 0.0000000000000002220446049250313 : f2;
              if (!(f2 < h | f2 > k)) {
                break;
              }
              d2 = l + 1 | 0;
              if ((d2 | 0) >= (o | 0)) {
                d2 = 22;
                break a;
              } else {
                a3 = l;
                l = d2;
                d2 = a3;
              }
            }
            j = i < 0 ? i + 6.283185307179586 : i;
            i = g2 < 0 ? g2 + 6.283185307179586 : g2;
            m = j == m | i == m ? m + -0.0000000000000002220446049250313 : m;
            k = j + (i - j) * ((f2 - h) / (k - h));
            if ((k < 0 ? k + 6.283185307179586 : k) > m) {
              c2 = c2 ^ 1;
            }
            a3 = l + 1 | 0;
            if ((a3 | 0) >= (o | 0)) {
              d2 = 22;
              break;
            } else {
              d2 = l;
            }
          }
        if ((d2 | 0) == 22) {
          return c2 | 0;
        }
      } else {
        c2 = 0;
        m = g2;
        d2 = -1;
        a3 = 0;
        b:
          while (true) {
            l = a3;
            while (true) {
              i = +e[n + (l << 4) >> 3];
              g2 = +e[n + (l << 4) + 8 >> 3];
              a3 = (d2 + 2 | 0) % (o | 0) | 0;
              h = +e[n + (a3 << 4) >> 3];
              j = +e[n + (a3 << 4) + 8 >> 3];
              if (i > h) {
                k = i;
                i = j;
              } else {
                k = h;
                h = i;
                i = g2;
                g2 = j;
              }
              f2 = f2 == h | f2 == k ? f2 + 0.0000000000000002220446049250313 : f2;
              if (!(f2 < h | f2 > k)) {
                break;
              }
              d2 = l + 1 | 0;
              if ((d2 | 0) >= (o | 0)) {
                d2 = 22;
                break b;
              } else {
                a3 = l;
                l = d2;
                d2 = a3;
              }
            }
            m = i == m | g2 == m ? m + -0.0000000000000002220446049250313 : m;
            if (i + (g2 - i) * ((f2 - h) / (k - h)) > m) {
              c2 = c2 ^ 1;
            }
            a3 = l + 1 | 0;
            if ((a3 | 0) >= (o | 0)) {
              d2 = 22;
              break;
            } else {
              d2 = l;
            }
          }
        if ((d2 | 0) == 22) {
          return c2 | 0;
        }
      }
      return 0;
    }
    function Wc(a3, c2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      var d2 = 0, f2 = 0, g2 = 0, h = 0, i = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, p3 = 0, r2 = 0, s2 = 0, t2 = 0, u2 = 0, v2 = 0;
      r2 = b[a3 >> 2] | 0;
      if (!r2) {
        b[c2 >> 2] = 0;
        b[c2 + 4 >> 2] = 0;
        b[c2 + 8 >> 2] = 0;
        b[c2 + 12 >> 2] = 0;
        b[c2 + 16 >> 2] = 0;
        b[c2 + 20 >> 2] = 0;
        b[c2 + 24 >> 2] = 0;
        b[c2 + 28 >> 2] = 0;
        return;
      }
      s2 = c2 + 8 | 0;
      e[s2 >> 3] = 179769313486231570000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000;
      t2 = c2 + 24 | 0;
      e[t2 >> 3] = 179769313486231570000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000;
      e[c2 >> 3] = -179769313486231570000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000;
      u2 = c2 + 16 | 0;
      e[u2 >> 3] = -179769313486231570000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000;
      if ((r2 | 0) <= 0) {
        return;
      }
      o = b[a3 + 4 >> 2] | 0;
      l = 179769313486231570000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000;
      m = -179769313486231570000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000;
      n = 0;
      a3 = -1;
      h = 179769313486231570000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000;
      i = 179769313486231570000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000;
      k = -179769313486231570000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000;
      f2 = -179769313486231570000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000;
      p3 = 0;
      while (true) {
        d2 = +e[o + (p3 << 4) >> 3];
        j = +e[o + (p3 << 4) + 8 >> 3];
        a3 = a3 + 2 | 0;
        g2 = +e[o + (((a3 | 0) == (r2 | 0) ? 0 : a3) << 4) + 8 >> 3];
        if (d2 < h) {
          e[s2 >> 3] = d2;
          h = d2;
        }
        if (j < i) {
          e[t2 >> 3] = j;
          i = j;
        }
        if (d2 > k) {
          e[c2 >> 3] = d2;
        } else {
          d2 = k;
        }
        if (j > f2) {
          e[u2 >> 3] = j;
          f2 = j;
        }
        l = j > 0 & j < l ? j : l;
        m = j < 0 & j > m ? j : m;
        n = n | +q(+(j - g2)) > 3.141592653589793;
        a3 = p3 + 1 | 0;
        if ((a3 | 0) == (r2 | 0)) {
          break;
        } else {
          v2 = p3;
          k = d2;
          p3 = a3;
          a3 = v2;
        }
      }
      if (!n) {
        return;
      }
      e[u2 >> 3] = m;
      e[t2 >> 3] = l;
      return;
    }
    function Xc(a3) {
      a3 = a3 | 0;
      return (a3 >>> 0 < 4 ? 0 : 15) | 0;
    }
    function Yc(a3, c2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      var d2 = 0, f2 = 0, g2 = 0, h = 0, i = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, p3 = 0, r2 = 0, s2 = 0, t2 = 0, u2 = 0, v2 = 0, w2 = 0, x2 = 0, y2 = 0, z2 = 0, A2 = 0;
      r2 = b[a3 >> 2] | 0;
      if (r2) {
        s2 = c2 + 8 | 0;
        e[s2 >> 3] = 179769313486231570000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000;
        t2 = c2 + 24 | 0;
        e[t2 >> 3] = 179769313486231570000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000;
        e[c2 >> 3] = -179769313486231570000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000;
        u2 = c2 + 16 | 0;
        e[u2 >> 3] = -179769313486231570000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000;
        if ((r2 | 0) > 0) {
          g2 = b[a3 + 4 >> 2] | 0;
          o = 179769313486231570000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000;
          p3 = -179769313486231570000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000;
          f2 = 0;
          d2 = -1;
          k = 179769313486231570000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000;
          l = 179769313486231570000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000;
          n = -179769313486231570000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000;
          i = -179769313486231570000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000;
          v2 = 0;
          while (true) {
            h = +e[g2 + (v2 << 4) >> 3];
            m = +e[g2 + (v2 << 4) + 8 >> 3];
            z2 = d2 + 2 | 0;
            j = +e[g2 + (((z2 | 0) == (r2 | 0) ? 0 : z2) << 4) + 8 >> 3];
            if (h < k) {
              e[s2 >> 3] = h;
              k = h;
            }
            if (m < l) {
              e[t2 >> 3] = m;
              l = m;
            }
            if (h > n) {
              e[c2 >> 3] = h;
            } else {
              h = n;
            }
            if (m > i) {
              e[u2 >> 3] = m;
              i = m;
            }
            o = m > 0 & m < o ? m : o;
            p3 = m < 0 & m > p3 ? m : p3;
            f2 = f2 | +q(+(m - j)) > 3.141592653589793;
            d2 = v2 + 1 | 0;
            if ((d2 | 0) == (r2 | 0)) {
              break;
            } else {
              z2 = v2;
              n = h;
              v2 = d2;
              d2 = z2;
            }
          }
          if (f2) {
            e[u2 >> 3] = p3;
            e[t2 >> 3] = o;
          }
        }
      } else {
        b[c2 >> 2] = 0;
        b[c2 + 4 >> 2] = 0;
        b[c2 + 8 >> 2] = 0;
        b[c2 + 12 >> 2] = 0;
        b[c2 + 16 >> 2] = 0;
        b[c2 + 20 >> 2] = 0;
        b[c2 + 24 >> 2] = 0;
        b[c2 + 28 >> 2] = 0;
      }
      z2 = a3 + 8 | 0;
      d2 = b[z2 >> 2] | 0;
      if ((d2 | 0) <= 0) {
        return;
      }
      y2 = a3 + 12 | 0;
      x2 = 0;
      do {
        g2 = b[y2 >> 2] | 0;
        f2 = x2;
        x2 = x2 + 1 | 0;
        t2 = c2 + (x2 << 5) | 0;
        u2 = b[g2 + (f2 << 3) >> 2] | 0;
        if (u2) {
          v2 = c2 + (x2 << 5) + 8 | 0;
          e[v2 >> 3] = 179769313486231570000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000;
          a3 = c2 + (x2 << 5) + 24 | 0;
          e[a3 >> 3] = 179769313486231570000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000;
          e[t2 >> 3] = -179769313486231570000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000;
          w2 = c2 + (x2 << 5) + 16 | 0;
          e[w2 >> 3] = -179769313486231570000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000;
          if ((u2 | 0) > 0) {
            r2 = b[g2 + (f2 << 3) + 4 >> 2] | 0;
            o = 179769313486231570000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000;
            p3 = -179769313486231570000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000;
            g2 = 0;
            f2 = -1;
            s2 = 0;
            k = 179769313486231570000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000;
            l = 179769313486231570000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000;
            m = -179769313486231570000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000;
            i = -179769313486231570000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000;
            while (true) {
              h = +e[r2 + (s2 << 4) >> 3];
              n = +e[r2 + (s2 << 4) + 8 >> 3];
              f2 = f2 + 2 | 0;
              j = +e[r2 + (((f2 | 0) == (u2 | 0) ? 0 : f2) << 4) + 8 >> 3];
              if (h < k) {
                e[v2 >> 3] = h;
                k = h;
              }
              if (n < l) {
                e[a3 >> 3] = n;
                l = n;
              }
              if (h > m) {
                e[t2 >> 3] = h;
              } else {
                h = m;
              }
              if (n > i) {
                e[w2 >> 3] = n;
                i = n;
              }
              o = n > 0 & n < o ? n : o;
              p3 = n < 0 & n > p3 ? n : p3;
              g2 = g2 | +q(+(n - j)) > 3.141592653589793;
              f2 = s2 + 1 | 0;
              if ((f2 | 0) == (u2 | 0)) {
                break;
              } else {
                A2 = s2;
                s2 = f2;
                m = h;
                f2 = A2;
              }
            }
            if (g2) {
              e[w2 >> 3] = p3;
              e[a3 >> 3] = o;
            }
          }
        } else {
          b[t2 >> 2] = 0;
          b[t2 + 4 >> 2] = 0;
          b[t2 + 8 >> 2] = 0;
          b[t2 + 12 >> 2] = 0;
          b[t2 + 16 >> 2] = 0;
          b[t2 + 20 >> 2] = 0;
          b[t2 + 24 >> 2] = 0;
          b[t2 + 28 >> 2] = 0;
          d2 = b[z2 >> 2] | 0;
        }
      } while ((x2 | 0) < (d2 | 0));
      return;
    }
    function Zc(a3, c2, d2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      var e2 = 0, f2 = 0, g2 = 0;
      if (!(Vc(a3, c2, d2) | 0)) {
        f2 = 0;
        return f2 | 0;
      }
      f2 = a3 + 8 | 0;
      if ((b[f2 >> 2] | 0) <= 0) {
        f2 = 1;
        return f2 | 0;
      }
      e2 = a3 + 12 | 0;
      a3 = 0;
      while (true) {
        g2 = a3;
        a3 = a3 + 1 | 0;
        if (Vc((b[e2 >> 2] | 0) + (g2 << 3) | 0, c2 + (a3 << 5) | 0, d2) | 0) {
          a3 = 0;
          e2 = 6;
          break;
        }
        if ((a3 | 0) >= (b[f2 >> 2] | 0)) {
          a3 = 1;
          e2 = 6;
          break;
        }
      }
      if ((e2 | 0) == 6) {
        return a3 | 0;
      }
      return 0;
    }
    function _c(a3, c2, d2, e2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      var f2 = 0, g2 = 0, h = 0, i = 0, j = 0, k = 0, l = 0;
      k = T;
      T = T + 16 | 0;
      i = k;
      h = d2 + 8 | 0;
      if (!(Vc(a3, c2, h) | 0)) {
        j = 0;
        T = k;
        return j | 0;
      }
      j = a3 + 8 | 0;
      a:
        do {
          if ((b[j >> 2] | 0) > 0) {
            g2 = a3 + 12 | 0;
            f2 = 0;
            while (true) {
              l = f2;
              f2 = f2 + 1 | 0;
              if (Vc((b[g2 >> 2] | 0) + (l << 3) | 0, c2 + (f2 << 5) | 0, h) | 0) {
                f2 = 0;
                break;
              }
              if ((f2 | 0) >= (b[j >> 2] | 0)) {
                break a;
              }
            }
            T = k;
            return f2 | 0;
          }
        } while (0);
      if ($c(a3, c2, d2, e2) | 0) {
        l = 0;
        T = k;
        return l | 0;
      }
      b[i >> 2] = b[d2 >> 2];
      b[i + 4 >> 2] = h;
      f2 = b[j >> 2] | 0;
      b:
        do {
          if ((f2 | 0) > 0) {
            a3 = a3 + 12 | 0;
            h = 0;
            g2 = f2;
            while (true) {
              f2 = b[a3 >> 2] | 0;
              if ((b[f2 + (h << 3) >> 2] | 0) > 0) {
                if (Vc(i, e2, b[f2 + (h << 3) + 4 >> 2] | 0) | 0) {
                  f2 = 0;
                  break b;
                }
                f2 = h + 1 | 0;
                if ($c((b[a3 >> 2] | 0) + (h << 3) | 0, c2 + (f2 << 5) | 0, d2, e2) | 0) {
                  f2 = 0;
                  break b;
                }
                g2 = b[j >> 2] | 0;
              } else {
                f2 = h + 1 | 0;
              }
              if ((f2 | 0) < (g2 | 0)) {
                h = f2;
              } else {
                f2 = 1;
                break;
              }
            }
          } else {
            f2 = 1;
          }
        } while (0);
      l = f2;
      T = k;
      return l | 0;
    }
    function $c(a3, c2, d2, f2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      f2 = f2 | 0;
      var g2 = 0, h = 0, i = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, p3 = 0, q2 = 0, r2 = 0, s2 = 0, t2 = 0, u2 = 0, v2 = 0, w2 = 0, x2 = 0, y2 = 0, z2 = 0, A2 = 0;
      y2 = T;
      T = T + 176 | 0;
      u2 = y2 + 172 | 0;
      g2 = y2 + 168 | 0;
      v2 = y2;
      if (!(Da(c2, f2) | 0)) {
        a3 = 0;
        T = y2;
        return a3 | 0;
      }
      Ea(c2, f2, u2, g2);
      Wd(v2 | 0, d2 | 0, 168) | 0;
      if ((b[d2 >> 2] | 0) > 0) {
        c2 = 0;
        do {
          z2 = v2 + 8 + (c2 << 4) + 8 | 0;
          t2 = +kc(+e[z2 >> 3], b[g2 >> 2] | 0);
          e[z2 >> 3] = t2;
          c2 = c2 + 1 | 0;
        } while ((c2 | 0) < (b[d2 >> 2] | 0));
      }
      r2 = +e[f2 >> 3];
      s2 = +e[f2 + 8 >> 3];
      t2 = +kc(+e[f2 + 16 >> 3], b[g2 >> 2] | 0);
      p3 = +kc(+e[f2 + 24 >> 3], b[g2 >> 2] | 0);
      a:
        do {
          if ((b[a3 >> 2] | 0) > 0) {
            f2 = a3 + 4 | 0;
            g2 = b[v2 >> 2] | 0;
            if ((g2 | 0) <= 0) {
              c2 = 0;
              while (true) {
                c2 = c2 + 1 | 0;
                if ((c2 | 0) >= (b[a3 >> 2] | 0)) {
                  c2 = 0;
                  break a;
                }
              }
            }
            d2 = 0;
            while (true) {
              c2 = b[f2 >> 2] | 0;
              o = +e[c2 + (d2 << 4) >> 3];
              q2 = +kc(+e[c2 + (d2 << 4) + 8 >> 3], b[u2 >> 2] | 0);
              c2 = b[f2 >> 2] | 0;
              d2 = d2 + 1 | 0;
              z2 = (d2 | 0) % (b[a3 >> 2] | 0) | 0;
              h = +e[c2 + (z2 << 4) >> 3];
              i = +kc(+e[c2 + (z2 << 4) + 8 >> 3], b[u2 >> 2] | 0);
              if (((!(o >= r2) | !(h >= r2) ? !(o <= s2) | !(h <= s2) : 0) ? !(q2 <= p3) | !(i <= p3) : 0) ? !(q2 >= t2) | !(i >= t2) : 0) {
                n = h - o;
                l = i - q2;
                c2 = 0;
                do {
                  A2 = c2;
                  c2 = c2 + 1 | 0;
                  z2 = (c2 | 0) == (g2 | 0) ? 0 : c2;
                  h = +e[v2 + 8 + (A2 << 4) + 8 >> 3];
                  i = +e[v2 + 8 + (z2 << 4) + 8 >> 3] - h;
                  j = +e[v2 + 8 + (A2 << 4) >> 3];
                  k = +e[v2 + 8 + (z2 << 4) >> 3] - j;
                  m = n * i - l * k;
                  if ((m != 0 ? (w2 = q2 - h, x2 = o - j, k = (w2 * k - i * x2) / m, !(k < 0 | k > 1)) : 0) ? (m = (n * w2 - l * x2) / m, m >= 0 & m <= 1) : 0) {
                    c2 = 1;
                    break a;
                  }
                } while ((c2 | 0) < (g2 | 0));
              }
              if ((d2 | 0) >= (b[a3 >> 2] | 0)) {
                c2 = 0;
                break;
              }
            }
          } else {
            c2 = 0;
          }
        } while (0);
      A2 = c2;
      T = y2;
      return A2 | 0;
    }
    function ad(a3, c2, d2, e2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      var f2 = 0, g2 = 0, h = 0;
      if ($c(a3, c2, d2, e2) | 0) {
        g2 = 1;
        return g2 | 0;
      }
      g2 = a3 + 8 | 0;
      if ((b[g2 >> 2] | 0) <= 0) {
        g2 = 0;
        return g2 | 0;
      }
      f2 = a3 + 12 | 0;
      a3 = 0;
      while (true) {
        h = a3;
        a3 = a3 + 1 | 0;
        if ($c((b[f2 >> 2] | 0) + (h << 3) | 0, c2 + (a3 << 5) | 0, d2, e2) | 0) {
          a3 = 1;
          f2 = 6;
          break;
        }
        if ((a3 | 0) >= (b[g2 >> 2] | 0)) {
          a3 = 0;
          f2 = 6;
          break;
        }
      }
      if ((f2 | 0) == 6) {
        return a3 | 0;
      }
      return 0;
    }
    function bd() {
      return 8;
    }
    function cd() {
      return 16;
    }
    function dd() {
      return 168;
    }
    function ed() {
      return 8;
    }
    function fd() {
      return 16;
    }
    function gd() {
      return 12;
    }
    function hd() {
      return 8;
    }
    function id2(a3) {
      a3 = a3 | 0;
      return +(+((b[a3 >> 2] | 0) >>> 0) + 4294967296 * +(b[a3 + 4 >> 2] | 0));
    }
    function jd(a3) {
      a3 = a3 | 0;
      var b2 = 0, c2 = 0;
      c2 = +e[a3 >> 3];
      b2 = +e[a3 + 8 >> 3];
      return + +r(+(c2 * c2 + b2 * b2));
    }
    function kd(a3, b2, c2, d2, f2) {
      a3 = a3 | 0;
      b2 = b2 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      f2 = f2 | 0;
      var g2 = 0, h = 0, i = 0, j = 0, k = 0, l = 0, m = 0, n = 0;
      k = +e[a3 >> 3];
      j = +e[b2 >> 3] - k;
      i = +e[a3 + 8 >> 3];
      h = +e[b2 + 8 >> 3] - i;
      m = +e[c2 >> 3];
      g2 = +e[d2 >> 3] - m;
      n = +e[c2 + 8 >> 3];
      l = +e[d2 + 8 >> 3] - n;
      g2 = (g2 * (i - n) - (k - m) * l) / (j * l - h * g2);
      e[f2 >> 3] = k + j * g2;
      e[f2 + 8 >> 3] = i + h * g2;
      return;
    }
    function ld(a3, b2) {
      a3 = a3 | 0;
      b2 = b2 | 0;
      if (!(+q(+(+e[a3 >> 3] - +e[b2 >> 3])) < 0.00000011920928955078125)) {
        b2 = 0;
        return b2 | 0;
      }
      b2 = +q(+(+e[a3 + 8 >> 3] - +e[b2 + 8 >> 3])) < 0.00000011920928955078125;
      return b2 | 0;
    }
    function md(a3, b2) {
      a3 = a3 | 0;
      b2 = b2 | 0;
      var c2 = 0, d2 = 0, f2 = 0;
      f2 = +e[a3 >> 3] - +e[b2 >> 3];
      d2 = +e[a3 + 8 >> 3] - +e[b2 + 8 >> 3];
      c2 = +e[a3 + 16 >> 3] - +e[b2 + 16 >> 3];
      return +(f2 * f2 + d2 * d2 + c2 * c2);
    }
    function nd(a3, b2) {
      a3 = a3 | 0;
      b2 = b2 | 0;
      var c2 = 0, d2 = 0, f2 = 0;
      c2 = +e[a3 >> 3];
      d2 = +t(+c2);
      c2 = +u(+c2);
      e[b2 + 16 >> 3] = c2;
      c2 = +e[a3 + 8 >> 3];
      f2 = d2 * +t(+c2);
      e[b2 >> 3] = f2;
      c2 = d2 * +u(+c2);
      e[b2 + 8 >> 3] = c2;
      return;
    }
    function od(a3, c2, d2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      var e2 = 0, f2 = 0, g2 = 0;
      g2 = T;
      T = T + 16 | 0;
      f2 = g2;
      e2 = Hb(a3, c2) | 0;
      if ((d2 + -1 | 0) >>> 0 > 5) {
        f2 = -1;
        T = g2;
        return f2 | 0;
      }
      e2 = (e2 | 0) != 0;
      if ((d2 | 0) == 1 & e2) {
        f2 = -1;
        T = g2;
        return f2 | 0;
      }
      do {
        if (!(pd(a3, c2, f2) | 0)) {
          if (e2) {
            e2 = ((b[26352 + (d2 << 2) >> 2] | 0) + 5 - (b[f2 >> 2] | 0) | 0) % 5 | 0;
            break;
          } else {
            e2 = ((b[26384 + (d2 << 2) >> 2] | 0) + 6 - (b[f2 >> 2] | 0) | 0) % 6 | 0;
            break;
          }
        } else {
          e2 = -1;
        }
      } while (0);
      f2 = e2;
      T = g2;
      return f2 | 0;
    }
    function pd(a3, c2, d2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      var e2 = 0, f2 = 0, g2 = 0, h = 0, i = 0, j = 0, k = 0;
      k = T;
      T = T + 32 | 0;
      h = k + 16 | 0;
      i = k;
      e2 = Yb(a3, c2, h) | 0;
      if (e2 | 0) {
        d2 = e2;
        T = k;
        return d2 | 0;
      }
      g2 = Cb(a3, c2) | 0;
      j = Pb(a3, c2) | 0;
      sa(g2, i);
      e2 = ta(g2, b[h >> 2] | 0) | 0;
      a:
        do {
          if (oa(g2) | 0) {
            do {
              switch (g2 | 0) {
                case 4: {
                  a3 = 0;
                  break;
                }
                case 14: {
                  a3 = 1;
                  break;
                }
                case 24: {
                  a3 = 2;
                  break;
                }
                case 38: {
                  a3 = 3;
                  break;
                }
                case 49: {
                  a3 = 4;
                  break;
                }
                case 58: {
                  a3 = 5;
                  break;
                }
                case 63: {
                  a3 = 6;
                  break;
                }
                case 72: {
                  a3 = 7;
                  break;
                }
                case 83: {
                  a3 = 8;
                  break;
                }
                case 97: {
                  a3 = 9;
                  break;
                }
                case 107: {
                  a3 = 10;
                  break;
                }
                case 117: {
                  a3 = 11;
                  break;
                }
                default: {
                  e2 = 1;
                  break a;
                }
              }
            } while (0);
            f2 = b[26416 + (a3 * 24 | 0) + 8 >> 2] | 0;
            c2 = b[26416 + (a3 * 24 | 0) + 16 >> 2] | 0;
            a3 = b[h >> 2] | 0;
            if ((a3 | 0) != (b[i >> 2] | 0)) {
              i = pa(g2) | 0;
              a3 = b[h >> 2] | 0;
              if (i | (a3 | 0) == (c2 | 0)) {
                e2 = (e2 + 1 | 0) % 6 | 0;
              }
            }
            if ((j | 0) == 3 & (a3 | 0) == (c2 | 0)) {
              e2 = (e2 + 5 | 0) % 6 | 0;
              f2 = 22;
              break;
            }
            if ((j | 0) == 5 & (a3 | 0) == (f2 | 0)) {
              e2 = (e2 + 1 | 0) % 6 | 0;
              f2 = 22;
            } else {
              f2 = 22;
            }
          } else {
            f2 = 22;
          }
        } while (0);
      if ((f2 | 0) == 22) {
        b[d2 >> 2] = e2;
        e2 = 0;
      }
      d2 = e2;
      T = k;
      return d2 | 0;
    }
    function qd(a3, c2, d2, e2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      var f2 = 0, g2 = 0, h = 0, i = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, p3 = 0, q2 = 0, r2 = 0, s2 = 0, t2 = 0, u2 = 0;
      u2 = T;
      T = T + 32 | 0;
      t2 = u2 + 24 | 0;
      r2 = u2 + 20 | 0;
      p3 = u2 + 8 | 0;
      o = u2 + 16 | 0;
      n = u2;
      j = (Hb(a3, c2) | 0) == 0;
      j = j ? 6 : 5;
      l = Qd(a3 | 0, c2 | 0, 52) | 0;
      H() | 0;
      l = l & 15;
      if (j >>> 0 <= d2 >>> 0) {
        e2 = 2;
        T = u2;
        return e2 | 0;
      }
      m = (l | 0) == 0;
      if (!m ? (q2 = Rd(7, 0, (l ^ 15) * 3 | 0) | 0, (q2 & a3 | 0) == 0 & ((H() | 0) & c2 | 0) == 0) : 0) {
        f2 = d2;
      } else {
        g2 = 4;
      }
      a:
        do {
          if ((g2 | 0) == 4) {
            f2 = (Hb(a3, c2) | 0) != 0;
            if (((f2 ? 4 : 5) | 0) < (d2 | 0)) {
              e2 = 1;
              T = u2;
              return e2 | 0;
            }
            if (pd(a3, c2, t2) | 0) {
              e2 = 1;
              T = u2;
              return e2 | 0;
            }
            g2 = (b[t2 >> 2] | 0) + d2 | 0;
            if (f2) {
              f2 = 26704 + (((g2 | 0) % 5 | 0) << 2) | 0;
            } else {
              f2 = 26736 + (((g2 | 0) % 6 | 0) << 2) | 0;
            }
            q2 = b[f2 >> 2] | 0;
            if ((q2 | 0) == 7) {
              e2 = 1;
              T = u2;
              return e2 | 0;
            }
            b[r2 >> 2] = 0;
            f2 = ea(a3, c2, q2, r2, p3) | 0;
            do {
              if (!f2) {
                i = p3;
                k = b[i >> 2] | 0;
                i = b[i + 4 >> 2] | 0;
                h = i >>> 0 < c2 >>> 0 | (i | 0) == (c2 | 0) & k >>> 0 < a3 >>> 0;
                g2 = h ? k : a3;
                h = h ? i : c2;
                if (!m ? (m = Rd(7, 0, (l ^ 15) * 3 | 0) | 0, (k & m | 0) == 0 & (i & (H() | 0) | 0) == 0) : 0) {
                  f2 = d2;
                } else {
                  i = (d2 + -1 + j | 0) % (j | 0) | 0;
                  f2 = Hb(a3, c2) | 0;
                  if ((i | 0) < 0) {
                    I(27795, 27797, 246, 27806);
                  }
                  j = (f2 | 0) != 0;
                  if (((j ? 4 : 5) | 0) < (i | 0)) {
                    I(27795, 27797, 246, 27806);
                  }
                  if (pd(a3, c2, t2) | 0) {
                    I(27795, 27797, 246, 27806);
                  }
                  f2 = (b[t2 >> 2] | 0) + i | 0;
                  if (j) {
                    f2 = 26704 + (((f2 | 0) % 5 | 0) << 2) | 0;
                  } else {
                    f2 = 26736 + (((f2 | 0) % 6 | 0) << 2) | 0;
                  }
                  i = b[f2 >> 2] | 0;
                  if ((i | 0) == 7) {
                    I(27795, 27797, 246, 27806);
                  }
                  b[o >> 2] = 0;
                  f2 = ea(a3, c2, i, o, n) | 0;
                  if (f2 | 0) {
                    break;
                  }
                  k = n;
                  j = b[k >> 2] | 0;
                  k = b[k + 4 >> 2] | 0;
                  do {
                    if (k >>> 0 < h >>> 0 | (k | 0) == (h | 0) & j >>> 0 < g2 >>> 0) {
                      if (!(Hb(j, k) | 0)) {
                        g2 = b[26800 + ((((b[o >> 2] | 0) + (b[26768 + (i << 2) >> 2] | 0) | 0) % 6 | 0) << 2) >> 2] | 0;
                      } else {
                        g2 = ia(j, k, a3, c2) | 0;
                      }
                      f2 = Hb(j, k) | 0;
                      if ((g2 + -1 | 0) >>> 0 > 5) {
                        f2 = -1;
                        g2 = j;
                        h = k;
                        break;
                      }
                      f2 = (f2 | 0) != 0;
                      if ((g2 | 0) == 1 & f2) {
                        f2 = -1;
                        g2 = j;
                        h = k;
                        break;
                      }
                      do {
                        if (!(pd(j, k, t2) | 0)) {
                          if (f2) {
                            f2 = ((b[26352 + (g2 << 2) >> 2] | 0) + 5 - (b[t2 >> 2] | 0) | 0) % 5 | 0;
                            break;
                          } else {
                            f2 = ((b[26384 + (g2 << 2) >> 2] | 0) + 6 - (b[t2 >> 2] | 0) | 0) % 6 | 0;
                            break;
                          }
                        } else {
                          f2 = -1;
                        }
                      } while (0);
                      g2 = j;
                      h = k;
                    } else {
                      f2 = d2;
                    }
                  } while (0);
                  i = p3;
                  k = b[i >> 2] | 0;
                  i = b[i + 4 >> 2] | 0;
                }
                if ((g2 | 0) == (k | 0) & (h | 0) == (i | 0)) {
                  j = (Hb(k, i) | 0) != 0;
                  if (j) {
                    a3 = ia(k, i, a3, c2) | 0;
                  } else {
                    a3 = b[26800 + ((((b[r2 >> 2] | 0) + (b[26768 + (q2 << 2) >> 2] | 0) | 0) % 6 | 0) << 2) >> 2] | 0;
                  }
                  f2 = Hb(k, i) | 0;
                  if ((a3 + -1 | 0) >>> 0 <= 5 ? (s2 = (f2 | 0) != 0, !((a3 | 0) == 1 & s2)) : 0) {
                    do {
                      if (!(pd(k, i, t2) | 0)) {
                        if (s2) {
                          f2 = ((b[26352 + (a3 << 2) >> 2] | 0) + 5 - (b[t2 >> 2] | 0) | 0) % 5 | 0;
                          break;
                        } else {
                          f2 = ((b[26384 + (a3 << 2) >> 2] | 0) + 6 - (b[t2 >> 2] | 0) | 0) % 6 | 0;
                          break;
                        }
                      } else {
                        f2 = -1;
                      }
                    } while (0);
                  } else {
                    f2 = -1;
                  }
                  f2 = f2 + 1 | 0;
                  f2 = (f2 | 0) == 6 | j & (f2 | 0) == 5 ? 0 : f2;
                }
                c2 = h;
                a3 = g2;
                break a;
              }
            } while (0);
            e2 = f2;
            T = u2;
            return e2 | 0;
          }
        } while (0);
      s2 = Rd(f2 | 0, 0, 56) | 0;
      t2 = H() | 0 | c2 & -2130706433 | 536870912;
      b[e2 >> 2] = s2 | a3;
      b[e2 + 4 >> 2] = t2;
      e2 = 0;
      T = u2;
      return e2 | 0;
    }
    function rd(a3, c2, d2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      var e2 = 0, f2 = 0, g2 = 0;
      g2 = (Hb(a3, c2) | 0) == 0;
      e2 = qd(a3, c2, 0, d2) | 0;
      f2 = (e2 | 0) == 0;
      if (g2) {
        if (!f2) {
          g2 = e2;
          return g2 | 0;
        }
        e2 = qd(a3, c2, 1, d2 + 8 | 0) | 0;
        if (e2 | 0) {
          g2 = e2;
          return g2 | 0;
        }
        e2 = qd(a3, c2, 2, d2 + 16 | 0) | 0;
        if (e2 | 0) {
          g2 = e2;
          return g2 | 0;
        }
        e2 = qd(a3, c2, 3, d2 + 24 | 0) | 0;
        if (e2 | 0) {
          g2 = e2;
          return g2 | 0;
        }
        e2 = qd(a3, c2, 4, d2 + 32 | 0) | 0;
        if (!e2) {
          return qd(a3, c2, 5, d2 + 40 | 0) | 0;
        } else {
          g2 = e2;
          return g2 | 0;
        }
      }
      if (!f2) {
        g2 = e2;
        return g2 | 0;
      }
      e2 = qd(a3, c2, 1, d2 + 8 | 0) | 0;
      if (e2 | 0) {
        g2 = e2;
        return g2 | 0;
      }
      e2 = qd(a3, c2, 2, d2 + 16 | 0) | 0;
      if (e2 | 0) {
        g2 = e2;
        return g2 | 0;
      }
      e2 = qd(a3, c2, 3, d2 + 24 | 0) | 0;
      if (e2 | 0) {
        g2 = e2;
        return g2 | 0;
      }
      e2 = qd(a3, c2, 4, d2 + 32 | 0) | 0;
      if (e2 | 0) {
        g2 = e2;
        return g2 | 0;
      }
      g2 = d2 + 40 | 0;
      b[g2 >> 2] = 0;
      b[g2 + 4 >> 2] = 0;
      g2 = 0;
      return g2 | 0;
    }
    function sd(a3, c2, d2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      var e2 = 0, f2 = 0, g2 = 0, h = 0, i = 0, j = 0;
      j = T;
      T = T + 192 | 0;
      f2 = j;
      g2 = j + 168 | 0;
      h = Qd(a3 | 0, c2 | 0, 56) | 0;
      H() | 0;
      h = h & 7;
      i = c2 & -2130706433 | 134217728;
      e2 = Yb(a3, i, g2) | 0;
      if (e2 | 0) {
        i = e2;
        T = j;
        return i | 0;
      }
      c2 = Qd(a3 | 0, c2 | 0, 52) | 0;
      H() | 0;
      c2 = c2 & 15;
      if (!(Hb(a3, i) | 0)) {
        zb(g2, c2, h, 1, f2);
      } else {
        vb(g2, c2, h, 1, f2);
      }
      i = f2 + 8 | 0;
      b[d2 >> 2] = b[i >> 2];
      b[d2 + 4 >> 2] = b[i + 4 >> 2];
      b[d2 + 8 >> 2] = b[i + 8 >> 2];
      b[d2 + 12 >> 2] = b[i + 12 >> 2];
      i = 0;
      T = j;
      return i | 0;
    }
    function td(a3, c2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      var d2 = 0, e2 = 0, f2 = 0, g2 = 0;
      f2 = T;
      T = T + 16 | 0;
      d2 = f2;
      if (!(true & (c2 & 2013265920 | 0) == 536870912)) {
        e2 = 0;
        T = f2;
        return e2 | 0;
      }
      e2 = c2 & -2130706433 | 134217728;
      if (!(Db(a3, e2) | 0)) {
        e2 = 0;
        T = f2;
        return e2 | 0;
      }
      g2 = Qd(a3 | 0, c2 | 0, 56) | 0;
      H() | 0;
      g2 = (qd(a3, e2, g2 & 7, d2) | 0) == 0;
      e2 = d2;
      e2 = g2 & ((b[e2 >> 2] | 0) == (a3 | 0) ? (b[e2 + 4 >> 2] | 0) == (c2 | 0) : 0) & 1;
      T = f2;
      return e2 | 0;
    }
    function ud(a3, c2, d2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      var e2 = 0;
      if ((c2 | 0) > 0) {
        e2 = Fd(c2, 4) | 0;
        b[a3 >> 2] = e2;
        if (!e2) {
          I(27819, 27842, 40, 27856);
        }
      } else {
        b[a3 >> 2] = 0;
      }
      b[a3 + 4 >> 2] = c2;
      b[a3 + 8 >> 2] = 0;
      b[a3 + 12 >> 2] = d2;
      return;
    }
    function vd(a3) {
      a3 = a3 | 0;
      var c2 = 0, d2 = 0, f2 = 0, g2 = 0, h = 0, i = 0, j = 0;
      g2 = a3 + 4 | 0;
      h = a3 + 12 | 0;
      i = a3 + 8 | 0;
      a:
        while (true) {
          d2 = b[g2 >> 2] | 0;
          c2 = 0;
          while (true) {
            if ((c2 | 0) >= (d2 | 0)) {
              break a;
            }
            f2 = b[a3 >> 2] | 0;
            j = b[f2 + (c2 << 2) >> 2] | 0;
            if (!j) {
              c2 = c2 + 1 | 0;
            } else {
              break;
            }
          }
          c2 = f2 + (~~(+q(+(+s(10, + +(15 - (b[h >> 2] | 0) | 0)) * (+e[j >> 3] + +e[j + 8 >> 3]))) % +(d2 | 0)) >>> 0 << 2) | 0;
          d2 = b[c2 >> 2] | 0;
          b:
            do {
              if (d2 | 0) {
                f2 = j + 32 | 0;
                if ((d2 | 0) == (j | 0)) {
                  b[c2 >> 2] = b[f2 >> 2];
                } else {
                  d2 = d2 + 32 | 0;
                  c2 = b[d2 >> 2] | 0;
                  if (!c2) {
                    break;
                  }
                  while (true) {
                    if ((c2 | 0) == (j | 0)) {
                      break;
                    }
                    d2 = c2 + 32 | 0;
                    c2 = b[d2 >> 2] | 0;
                    if (!c2) {
                      break b;
                    }
                  }
                  b[d2 >> 2] = b[f2 >> 2];
                }
                Ed(j);
                b[i >> 2] = (b[i >> 2] | 0) + -1;
              }
            } while (0);
        }
      Ed(b[a3 >> 2] | 0);
      return;
    }
    function wd(a3) {
      a3 = a3 | 0;
      var c2 = 0, d2 = 0, e2 = 0;
      e2 = b[a3 + 4 >> 2] | 0;
      d2 = 0;
      while (true) {
        if ((d2 | 0) >= (e2 | 0)) {
          c2 = 0;
          d2 = 4;
          break;
        }
        c2 = b[(b[a3 >> 2] | 0) + (d2 << 2) >> 2] | 0;
        if (!c2) {
          d2 = d2 + 1 | 0;
        } else {
          d2 = 4;
          break;
        }
      }
      if ((d2 | 0) == 4) {
        return c2 | 0;
      }
      return 0;
    }
    function xd(a3, c2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      var d2 = 0, f2 = 0, g2 = 0, h = 0;
      d2 = ~~(+q(+(+s(10, + +(15 - (b[a3 + 12 >> 2] | 0) | 0)) * (+e[c2 >> 3] + +e[c2 + 8 >> 3]))) % +(b[a3 + 4 >> 2] | 0)) >>> 0;
      d2 = (b[a3 >> 2] | 0) + (d2 << 2) | 0;
      f2 = b[d2 >> 2] | 0;
      if (!f2) {
        h = 1;
        return h | 0;
      }
      h = c2 + 32 | 0;
      do {
        if ((f2 | 0) != (c2 | 0)) {
          d2 = b[f2 + 32 >> 2] | 0;
          if (!d2) {
            h = 1;
            return h | 0;
          }
          g2 = d2;
          while (true) {
            if ((g2 | 0) == (c2 | 0)) {
              g2 = 8;
              break;
            }
            d2 = b[g2 + 32 >> 2] | 0;
            if (!d2) {
              d2 = 1;
              g2 = 10;
              break;
            } else {
              f2 = g2;
              g2 = d2;
            }
          }
          if ((g2 | 0) == 8) {
            b[f2 + 32 >> 2] = b[h >> 2];
            break;
          } else if ((g2 | 0) == 10) {
            return d2 | 0;
          }
        } else {
          b[d2 >> 2] = b[h >> 2];
        }
      } while (0);
      Ed(c2);
      h = a3 + 8 | 0;
      b[h >> 2] = (b[h >> 2] | 0) + -1;
      h = 0;
      return h | 0;
    }
    function yd(a3, c2, d2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      var f2 = 0, g2 = 0, h = 0, i = 0;
      h = Dd(40) | 0;
      if (!h) {
        I(27872, 27842, 98, 27885);
      }
      b[h >> 2] = b[c2 >> 2];
      b[h + 4 >> 2] = b[c2 + 4 >> 2];
      b[h + 8 >> 2] = b[c2 + 8 >> 2];
      b[h + 12 >> 2] = b[c2 + 12 >> 2];
      g2 = h + 16 | 0;
      b[g2 >> 2] = b[d2 >> 2];
      b[g2 + 4 >> 2] = b[d2 + 4 >> 2];
      b[g2 + 8 >> 2] = b[d2 + 8 >> 2];
      b[g2 + 12 >> 2] = b[d2 + 12 >> 2];
      b[h + 32 >> 2] = 0;
      g2 = ~~(+q(+(+s(10, + +(15 - (b[a3 + 12 >> 2] | 0) | 0)) * (+e[c2 >> 3] + +e[c2 + 8 >> 3]))) % +(b[a3 + 4 >> 2] | 0)) >>> 0;
      g2 = (b[a3 >> 2] | 0) + (g2 << 2) | 0;
      f2 = b[g2 >> 2] | 0;
      do {
        if (!f2) {
          b[g2 >> 2] = h;
        } else {
          while (true) {
            if (jc(f2, c2) | 0 ? jc(f2 + 16 | 0, d2) | 0 : 0) {
              break;
            }
            g2 = b[f2 + 32 >> 2] | 0;
            f2 = (g2 | 0) == 0 ? f2 : g2;
            if (!(b[f2 + 32 >> 2] | 0)) {
              i = 10;
              break;
            }
          }
          if ((i | 0) == 10) {
            b[f2 + 32 >> 2] = h;
            break;
          }
          Ed(h);
          i = f2;
          return i | 0;
        }
      } while (0);
      i = a3 + 8 | 0;
      b[i >> 2] = (b[i >> 2] | 0) + 1;
      i = h;
      return i | 0;
    }
    function zd(a3, c2, d2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      var f2 = 0, g2 = 0;
      g2 = ~~(+q(+(+s(10, + +(15 - (b[a3 + 12 >> 2] | 0) | 0)) * (+e[c2 >> 3] + +e[c2 + 8 >> 3]))) % +(b[a3 + 4 >> 2] | 0)) >>> 0;
      g2 = b[(b[a3 >> 2] | 0) + (g2 << 2) >> 2] | 0;
      if (!g2) {
        d2 = 0;
        return d2 | 0;
      }
      if (!d2) {
        a3 = g2;
        while (true) {
          if (jc(a3, c2) | 0) {
            f2 = 10;
            break;
          }
          a3 = b[a3 + 32 >> 2] | 0;
          if (!a3) {
            a3 = 0;
            f2 = 10;
            break;
          }
        }
        if ((f2 | 0) == 10) {
          return a3 | 0;
        }
      }
      a3 = g2;
      while (true) {
        if (jc(a3, c2) | 0 ? jc(a3 + 16 | 0, d2) | 0 : 0) {
          f2 = 10;
          break;
        }
        a3 = b[a3 + 32 >> 2] | 0;
        if (!a3) {
          a3 = 0;
          f2 = 10;
          break;
        }
      }
      if ((f2 | 0) == 10) {
        return a3 | 0;
      }
      return 0;
    }
    function Ad(a3, c2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      var d2 = 0;
      d2 = ~~(+q(+(+s(10, + +(15 - (b[a3 + 12 >> 2] | 0) | 0)) * (+e[c2 >> 3] + +e[c2 + 8 >> 3]))) % +(b[a3 + 4 >> 2] | 0)) >>> 0;
      a3 = b[(b[a3 >> 2] | 0) + (d2 << 2) >> 2] | 0;
      if (!a3) {
        d2 = 0;
        return d2 | 0;
      }
      while (true) {
        if (jc(a3, c2) | 0) {
          c2 = 5;
          break;
        }
        a3 = b[a3 + 32 >> 2] | 0;
        if (!a3) {
          a3 = 0;
          c2 = 5;
          break;
        }
      }
      if ((c2 | 0) == 5) {
        return a3 | 0;
      }
      return 0;
    }
    function Bd() {
      return 27904;
    }
    function Cd(a3) {
      a3 = +a3;
      return ~~+Yd(+a3) | 0;
    }
    function Dd(a3) {
      a3 = a3 | 0;
      var c2 = 0, d2 = 0, e2 = 0, f2 = 0, g2 = 0, h = 0, i = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, p3 = 0, q2 = 0, r2 = 0, s2 = 0, t2 = 0, u2 = 0, v2 = 0, w2 = 0;
      w2 = T;
      T = T + 16 | 0;
      n = w2;
      do {
        if (a3 >>> 0 < 245) {
          k = a3 >>> 0 < 11 ? 16 : a3 + 11 & -8;
          a3 = k >>> 3;
          m = b[6977] | 0;
          d2 = m >>> a3;
          if (d2 & 3 | 0) {
            c2 = (d2 & 1 ^ 1) + a3 | 0;
            a3 = 27948 + (c2 << 1 << 2) | 0;
            d2 = a3 + 8 | 0;
            e2 = b[d2 >> 2] | 0;
            f2 = e2 + 8 | 0;
            g2 = b[f2 >> 2] | 0;
            if ((g2 | 0) == (a3 | 0)) {
              b[6977] = m & ~(1 << c2);
            } else {
              b[g2 + 12 >> 2] = a3;
              b[d2 >> 2] = g2;
            }
            v2 = c2 << 3;
            b[e2 + 4 >> 2] = v2 | 3;
            v2 = e2 + v2 + 4 | 0;
            b[v2 >> 2] = b[v2 >> 2] | 1;
            v2 = f2;
            T = w2;
            return v2 | 0;
          }
          l = b[6979] | 0;
          if (k >>> 0 > l >>> 0) {
            if (d2 | 0) {
              c2 = 2 << a3;
              c2 = d2 << a3 & (c2 | 0 - c2);
              c2 = (c2 & 0 - c2) + -1 | 0;
              i = c2 >>> 12 & 16;
              c2 = c2 >>> i;
              d2 = c2 >>> 5 & 8;
              c2 = c2 >>> d2;
              g2 = c2 >>> 2 & 4;
              c2 = c2 >>> g2;
              a3 = c2 >>> 1 & 2;
              c2 = c2 >>> a3;
              e2 = c2 >>> 1 & 1;
              e2 = (d2 | i | g2 | a3 | e2) + (c2 >>> e2) | 0;
              c2 = 27948 + (e2 << 1 << 2) | 0;
              a3 = c2 + 8 | 0;
              g2 = b[a3 >> 2] | 0;
              i = g2 + 8 | 0;
              d2 = b[i >> 2] | 0;
              if ((d2 | 0) == (c2 | 0)) {
                a3 = m & ~(1 << e2);
                b[6977] = a3;
              } else {
                b[d2 + 12 >> 2] = c2;
                b[a3 >> 2] = d2;
                a3 = m;
              }
              v2 = e2 << 3;
              h = v2 - k | 0;
              b[g2 + 4 >> 2] = k | 3;
              f2 = g2 + k | 0;
              b[f2 + 4 >> 2] = h | 1;
              b[g2 + v2 >> 2] = h;
              if (l | 0) {
                e2 = b[6982] | 0;
                c2 = l >>> 3;
                d2 = 27948 + (c2 << 1 << 2) | 0;
                c2 = 1 << c2;
                if (!(a3 & c2)) {
                  b[6977] = a3 | c2;
                  c2 = d2;
                  a3 = d2 + 8 | 0;
                } else {
                  a3 = d2 + 8 | 0;
                  c2 = b[a3 >> 2] | 0;
                }
                b[a3 >> 2] = e2;
                b[c2 + 12 >> 2] = e2;
                b[e2 + 8 >> 2] = c2;
                b[e2 + 12 >> 2] = d2;
              }
              b[6979] = h;
              b[6982] = f2;
              v2 = i;
              T = w2;
              return v2 | 0;
            }
            g2 = b[6978] | 0;
            if (g2) {
              d2 = (g2 & 0 - g2) + -1 | 0;
              f2 = d2 >>> 12 & 16;
              d2 = d2 >>> f2;
              e2 = d2 >>> 5 & 8;
              d2 = d2 >>> e2;
              h = d2 >>> 2 & 4;
              d2 = d2 >>> h;
              i = d2 >>> 1 & 2;
              d2 = d2 >>> i;
              j = d2 >>> 1 & 1;
              j = b[28212 + ((e2 | f2 | h | i | j) + (d2 >>> j) << 2) >> 2] | 0;
              d2 = j;
              i = j;
              j = (b[j + 4 >> 2] & -8) - k | 0;
              while (true) {
                a3 = b[d2 + 16 >> 2] | 0;
                if (!a3) {
                  a3 = b[d2 + 20 >> 2] | 0;
                  if (!a3) {
                    break;
                  }
                }
                h = (b[a3 + 4 >> 2] & -8) - k | 0;
                f2 = h >>> 0 < j >>> 0;
                d2 = a3;
                i = f2 ? a3 : i;
                j = f2 ? h : j;
              }
              h = i + k | 0;
              if (h >>> 0 > i >>> 0) {
                f2 = b[i + 24 >> 2] | 0;
                c2 = b[i + 12 >> 2] | 0;
                do {
                  if ((c2 | 0) == (i | 0)) {
                    a3 = i + 20 | 0;
                    c2 = b[a3 >> 2] | 0;
                    if (!c2) {
                      a3 = i + 16 | 0;
                      c2 = b[a3 >> 2] | 0;
                      if (!c2) {
                        d2 = 0;
                        break;
                      }
                    }
                    while (true) {
                      e2 = c2 + 20 | 0;
                      d2 = b[e2 >> 2] | 0;
                      if (!d2) {
                        e2 = c2 + 16 | 0;
                        d2 = b[e2 >> 2] | 0;
                        if (!d2) {
                          break;
                        } else {
                          c2 = d2;
                          a3 = e2;
                        }
                      } else {
                        c2 = d2;
                        a3 = e2;
                      }
                    }
                    b[a3 >> 2] = 0;
                    d2 = c2;
                  } else {
                    d2 = b[i + 8 >> 2] | 0;
                    b[d2 + 12 >> 2] = c2;
                    b[c2 + 8 >> 2] = d2;
                    d2 = c2;
                  }
                } while (0);
                do {
                  if (f2 | 0) {
                    c2 = b[i + 28 >> 2] | 0;
                    a3 = 28212 + (c2 << 2) | 0;
                    if ((i | 0) == (b[a3 >> 2] | 0)) {
                      b[a3 >> 2] = d2;
                      if (!d2) {
                        b[6978] = g2 & ~(1 << c2);
                        break;
                      }
                    } else {
                      v2 = f2 + 16 | 0;
                      b[((b[v2 >> 2] | 0) == (i | 0) ? v2 : f2 + 20 | 0) >> 2] = d2;
                      if (!d2) {
                        break;
                      }
                    }
                    b[d2 + 24 >> 2] = f2;
                    c2 = b[i + 16 >> 2] | 0;
                    if (c2 | 0) {
                      b[d2 + 16 >> 2] = c2;
                      b[c2 + 24 >> 2] = d2;
                    }
                    c2 = b[i + 20 >> 2] | 0;
                    if (c2 | 0) {
                      b[d2 + 20 >> 2] = c2;
                      b[c2 + 24 >> 2] = d2;
                    }
                  }
                } while (0);
                if (j >>> 0 < 16) {
                  v2 = j + k | 0;
                  b[i + 4 >> 2] = v2 | 3;
                  v2 = i + v2 + 4 | 0;
                  b[v2 >> 2] = b[v2 >> 2] | 1;
                } else {
                  b[i + 4 >> 2] = k | 3;
                  b[h + 4 >> 2] = j | 1;
                  b[h + j >> 2] = j;
                  if (l | 0) {
                    e2 = b[6982] | 0;
                    c2 = l >>> 3;
                    d2 = 27948 + (c2 << 1 << 2) | 0;
                    c2 = 1 << c2;
                    if (!(c2 & m)) {
                      b[6977] = c2 | m;
                      c2 = d2;
                      a3 = d2 + 8 | 0;
                    } else {
                      a3 = d2 + 8 | 0;
                      c2 = b[a3 >> 2] | 0;
                    }
                    b[a3 >> 2] = e2;
                    b[c2 + 12 >> 2] = e2;
                    b[e2 + 8 >> 2] = c2;
                    b[e2 + 12 >> 2] = d2;
                  }
                  b[6979] = j;
                  b[6982] = h;
                }
                v2 = i + 8 | 0;
                T = w2;
                return v2 | 0;
              } else {
                m = k;
              }
            } else {
              m = k;
            }
          } else {
            m = k;
          }
        } else if (a3 >>> 0 <= 4294967231) {
          a3 = a3 + 11 | 0;
          k = a3 & -8;
          e2 = b[6978] | 0;
          if (e2) {
            f2 = 0 - k | 0;
            a3 = a3 >>> 8;
            if (a3) {
              if (k >>> 0 > 16777215) {
                j = 31;
              } else {
                m = (a3 + 1048320 | 0) >>> 16 & 8;
                q2 = a3 << m;
                i = (q2 + 520192 | 0) >>> 16 & 4;
                q2 = q2 << i;
                j = (q2 + 245760 | 0) >>> 16 & 2;
                j = 14 - (i | m | j) + (q2 << j >>> 15) | 0;
                j = k >>> (j + 7 | 0) & 1 | j << 1;
              }
            } else {
              j = 0;
            }
            d2 = b[28212 + (j << 2) >> 2] | 0;
            a:
              do {
                if (!d2) {
                  d2 = 0;
                  a3 = 0;
                  q2 = 61;
                } else {
                  a3 = 0;
                  i = k << ((j | 0) == 31 ? 0 : 25 - (j >>> 1) | 0);
                  g2 = 0;
                  while (true) {
                    h = (b[d2 + 4 >> 2] & -8) - k | 0;
                    if (h >>> 0 < f2 >>> 0) {
                      if (!h) {
                        a3 = d2;
                        f2 = 0;
                        q2 = 65;
                        break a;
                      } else {
                        a3 = d2;
                        f2 = h;
                      }
                    }
                    q2 = b[d2 + 20 >> 2] | 0;
                    d2 = b[d2 + 16 + (i >>> 31 << 2) >> 2] | 0;
                    g2 = (q2 | 0) == 0 | (q2 | 0) == (d2 | 0) ? g2 : q2;
                    if (!d2) {
                      d2 = g2;
                      q2 = 61;
                      break;
                    } else {
                      i = i << 1;
                    }
                  }
                }
              } while (0);
            if ((q2 | 0) == 61) {
              if ((d2 | 0) == 0 & (a3 | 0) == 0) {
                a3 = 2 << j;
                a3 = (a3 | 0 - a3) & e2;
                if (!a3) {
                  m = k;
                  break;
                }
                m = (a3 & 0 - a3) + -1 | 0;
                h = m >>> 12 & 16;
                m = m >>> h;
                g2 = m >>> 5 & 8;
                m = m >>> g2;
                i = m >>> 2 & 4;
                m = m >>> i;
                j = m >>> 1 & 2;
                m = m >>> j;
                d2 = m >>> 1 & 1;
                a3 = 0;
                d2 = b[28212 + ((g2 | h | i | j | d2) + (m >>> d2) << 2) >> 2] | 0;
              }
              if (!d2) {
                i = a3;
                h = f2;
              } else {
                q2 = 65;
              }
            }
            if ((q2 | 0) == 65) {
              g2 = d2;
              while (true) {
                m = (b[g2 + 4 >> 2] & -8) - k | 0;
                d2 = m >>> 0 < f2 >>> 0;
                f2 = d2 ? m : f2;
                a3 = d2 ? g2 : a3;
                d2 = b[g2 + 16 >> 2] | 0;
                if (!d2) {
                  d2 = b[g2 + 20 >> 2] | 0;
                }
                if (!d2) {
                  i = a3;
                  h = f2;
                  break;
                } else {
                  g2 = d2;
                }
              }
            }
            if (((i | 0) != 0 ? h >>> 0 < ((b[6979] | 0) - k | 0) >>> 0 : 0) ? (l = i + k | 0, l >>> 0 > i >>> 0) : 0) {
              g2 = b[i + 24 >> 2] | 0;
              c2 = b[i + 12 >> 2] | 0;
              do {
                if ((c2 | 0) == (i | 0)) {
                  a3 = i + 20 | 0;
                  c2 = b[a3 >> 2] | 0;
                  if (!c2) {
                    a3 = i + 16 | 0;
                    c2 = b[a3 >> 2] | 0;
                    if (!c2) {
                      c2 = 0;
                      break;
                    }
                  }
                  while (true) {
                    f2 = c2 + 20 | 0;
                    d2 = b[f2 >> 2] | 0;
                    if (!d2) {
                      f2 = c2 + 16 | 0;
                      d2 = b[f2 >> 2] | 0;
                      if (!d2) {
                        break;
                      } else {
                        c2 = d2;
                        a3 = f2;
                      }
                    } else {
                      c2 = d2;
                      a3 = f2;
                    }
                  }
                  b[a3 >> 2] = 0;
                } else {
                  v2 = b[i + 8 >> 2] | 0;
                  b[v2 + 12 >> 2] = c2;
                  b[c2 + 8 >> 2] = v2;
                }
              } while (0);
              do {
                if (g2) {
                  a3 = b[i + 28 >> 2] | 0;
                  d2 = 28212 + (a3 << 2) | 0;
                  if ((i | 0) == (b[d2 >> 2] | 0)) {
                    b[d2 >> 2] = c2;
                    if (!c2) {
                      e2 = e2 & ~(1 << a3);
                      b[6978] = e2;
                      break;
                    }
                  } else {
                    v2 = g2 + 16 | 0;
                    b[((b[v2 >> 2] | 0) == (i | 0) ? v2 : g2 + 20 | 0) >> 2] = c2;
                    if (!c2) {
                      break;
                    }
                  }
                  b[c2 + 24 >> 2] = g2;
                  a3 = b[i + 16 >> 2] | 0;
                  if (a3 | 0) {
                    b[c2 + 16 >> 2] = a3;
                    b[a3 + 24 >> 2] = c2;
                  }
                  a3 = b[i + 20 >> 2] | 0;
                  if (a3) {
                    b[c2 + 20 >> 2] = a3;
                    b[a3 + 24 >> 2] = c2;
                  }
                }
              } while (0);
              b:
                do {
                  if (h >>> 0 < 16) {
                    v2 = h + k | 0;
                    b[i + 4 >> 2] = v2 | 3;
                    v2 = i + v2 + 4 | 0;
                    b[v2 >> 2] = b[v2 >> 2] | 1;
                  } else {
                    b[i + 4 >> 2] = k | 3;
                    b[l + 4 >> 2] = h | 1;
                    b[l + h >> 2] = h;
                    c2 = h >>> 3;
                    if (h >>> 0 < 256) {
                      d2 = 27948 + (c2 << 1 << 2) | 0;
                      a3 = b[6977] | 0;
                      c2 = 1 << c2;
                      if (!(a3 & c2)) {
                        b[6977] = a3 | c2;
                        c2 = d2;
                        a3 = d2 + 8 | 0;
                      } else {
                        a3 = d2 + 8 | 0;
                        c2 = b[a3 >> 2] | 0;
                      }
                      b[a3 >> 2] = l;
                      b[c2 + 12 >> 2] = l;
                      b[l + 8 >> 2] = c2;
                      b[l + 12 >> 2] = d2;
                      break;
                    }
                    c2 = h >>> 8;
                    if (c2) {
                      if (h >>> 0 > 16777215) {
                        d2 = 31;
                      } else {
                        u2 = (c2 + 1048320 | 0) >>> 16 & 8;
                        v2 = c2 << u2;
                        t2 = (v2 + 520192 | 0) >>> 16 & 4;
                        v2 = v2 << t2;
                        d2 = (v2 + 245760 | 0) >>> 16 & 2;
                        d2 = 14 - (t2 | u2 | d2) + (v2 << d2 >>> 15) | 0;
                        d2 = h >>> (d2 + 7 | 0) & 1 | d2 << 1;
                      }
                    } else {
                      d2 = 0;
                    }
                    c2 = 28212 + (d2 << 2) | 0;
                    b[l + 28 >> 2] = d2;
                    a3 = l + 16 | 0;
                    b[a3 + 4 >> 2] = 0;
                    b[a3 >> 2] = 0;
                    a3 = 1 << d2;
                    if (!(e2 & a3)) {
                      b[6978] = e2 | a3;
                      b[c2 >> 2] = l;
                      b[l + 24 >> 2] = c2;
                      b[l + 12 >> 2] = l;
                      b[l + 8 >> 2] = l;
                      break;
                    }
                    c2 = b[c2 >> 2] | 0;
                    c:
                      do {
                        if ((b[c2 + 4 >> 2] & -8 | 0) != (h | 0)) {
                          e2 = h << ((d2 | 0) == 31 ? 0 : 25 - (d2 >>> 1) | 0);
                          while (true) {
                            d2 = c2 + 16 + (e2 >>> 31 << 2) | 0;
                            a3 = b[d2 >> 2] | 0;
                            if (!a3) {
                              break;
                            }
                            if ((b[a3 + 4 >> 2] & -8 | 0) == (h | 0)) {
                              c2 = a3;
                              break c;
                            } else {
                              e2 = e2 << 1;
                              c2 = a3;
                            }
                          }
                          b[d2 >> 2] = l;
                          b[l + 24 >> 2] = c2;
                          b[l + 12 >> 2] = l;
                          b[l + 8 >> 2] = l;
                          break b;
                        }
                      } while (0);
                    u2 = c2 + 8 | 0;
                    v2 = b[u2 >> 2] | 0;
                    b[v2 + 12 >> 2] = l;
                    b[u2 >> 2] = l;
                    b[l + 8 >> 2] = v2;
                    b[l + 12 >> 2] = c2;
                    b[l + 24 >> 2] = 0;
                  }
                } while (0);
              v2 = i + 8 | 0;
              T = w2;
              return v2 | 0;
            } else {
              m = k;
            }
          } else {
            m = k;
          }
        } else {
          m = -1;
        }
      } while (0);
      d2 = b[6979] | 0;
      if (d2 >>> 0 >= m >>> 0) {
        c2 = d2 - m | 0;
        a3 = b[6982] | 0;
        if (c2 >>> 0 > 15) {
          v2 = a3 + m | 0;
          b[6982] = v2;
          b[6979] = c2;
          b[v2 + 4 >> 2] = c2 | 1;
          b[a3 + d2 >> 2] = c2;
          b[a3 + 4 >> 2] = m | 3;
        } else {
          b[6979] = 0;
          b[6982] = 0;
          b[a3 + 4 >> 2] = d2 | 3;
          v2 = a3 + d2 + 4 | 0;
          b[v2 >> 2] = b[v2 >> 2] | 1;
        }
        v2 = a3 + 8 | 0;
        T = w2;
        return v2 | 0;
      }
      h = b[6980] | 0;
      if (h >>> 0 > m >>> 0) {
        t2 = h - m | 0;
        b[6980] = t2;
        v2 = b[6983] | 0;
        u2 = v2 + m | 0;
        b[6983] = u2;
        b[u2 + 4 >> 2] = t2 | 1;
        b[v2 + 4 >> 2] = m | 3;
        v2 = v2 + 8 | 0;
        T = w2;
        return v2 | 0;
      }
      if (!(b[7095] | 0)) {
        b[7097] = 4096;
        b[7096] = 4096;
        b[7098] = -1;
        b[7099] = -1;
        b[7100] = 0;
        b[7088] = 0;
        b[7095] = n & -16 ^ 1431655768;
        a3 = 4096;
      } else {
        a3 = b[7097] | 0;
      }
      i = m + 48 | 0;
      j = m + 47 | 0;
      g2 = a3 + j | 0;
      f2 = 0 - a3 | 0;
      k = g2 & f2;
      if (k >>> 0 <= m >>> 0) {
        v2 = 0;
        T = w2;
        return v2 | 0;
      }
      a3 = b[7087] | 0;
      if (a3 | 0 ? (l = b[7085] | 0, n = l + k | 0, n >>> 0 <= l >>> 0 | n >>> 0 > a3 >>> 0) : 0) {
        v2 = 0;
        T = w2;
        return v2 | 0;
      }
      d:
        do {
          if (!(b[7088] & 4)) {
            d2 = b[6983] | 0;
            e:
              do {
                if (d2) {
                  e2 = 28356;
                  while (true) {
                    n = b[e2 >> 2] | 0;
                    if (n >>> 0 <= d2 >>> 0 ? (n + (b[e2 + 4 >> 2] | 0) | 0) >>> 0 > d2 >>> 0 : 0) {
                      break;
                    }
                    a3 = b[e2 + 8 >> 2] | 0;
                    if (!a3) {
                      q2 = 128;
                      break e;
                    } else {
                      e2 = a3;
                    }
                  }
                  c2 = g2 - h & f2;
                  if (c2 >>> 0 < 2147483647) {
                    a3 = Zd(c2 | 0) | 0;
                    if ((a3 | 0) == ((b[e2 >> 2] | 0) + (b[e2 + 4 >> 2] | 0) | 0)) {
                      if ((a3 | 0) != (-1 | 0)) {
                        h = c2;
                        g2 = a3;
                        q2 = 145;
                        break d;
                      }
                    } else {
                      e2 = a3;
                      q2 = 136;
                    }
                  } else {
                    c2 = 0;
                  }
                } else {
                  q2 = 128;
                }
              } while (0);
            do {
              if ((q2 | 0) == 128) {
                d2 = Zd(0) | 0;
                if ((d2 | 0) != (-1 | 0) ? (c2 = d2, o = b[7096] | 0, p3 = o + -1 | 0, c2 = ((p3 & c2 | 0) == 0 ? 0 : (p3 + c2 & 0 - o) - c2 | 0) + k | 0, o = b[7085] | 0, p3 = c2 + o | 0, c2 >>> 0 > m >>> 0 & c2 >>> 0 < 2147483647) : 0) {
                  n = b[7087] | 0;
                  if (n | 0 ? p3 >>> 0 <= o >>> 0 | p3 >>> 0 > n >>> 0 : 0) {
                    c2 = 0;
                    break;
                  }
                  a3 = Zd(c2 | 0) | 0;
                  if ((a3 | 0) == (d2 | 0)) {
                    h = c2;
                    g2 = d2;
                    q2 = 145;
                    break d;
                  } else {
                    e2 = a3;
                    q2 = 136;
                  }
                } else {
                  c2 = 0;
                }
              }
            } while (0);
            do {
              if ((q2 | 0) == 136) {
                d2 = 0 - c2 | 0;
                if (!(i >>> 0 > c2 >>> 0 & (c2 >>> 0 < 2147483647 & (e2 | 0) != (-1 | 0)))) {
                  if ((e2 | 0) == (-1 | 0)) {
                    c2 = 0;
                    break;
                  } else {
                    h = c2;
                    g2 = e2;
                    q2 = 145;
                    break d;
                  }
                }
                a3 = b[7097] | 0;
                a3 = j - c2 + a3 & 0 - a3;
                if (a3 >>> 0 >= 2147483647) {
                  h = c2;
                  g2 = e2;
                  q2 = 145;
                  break d;
                }
                if ((Zd(a3 | 0) | 0) == (-1 | 0)) {
                  Zd(d2 | 0) | 0;
                  c2 = 0;
                  break;
                } else {
                  h = a3 + c2 | 0;
                  g2 = e2;
                  q2 = 145;
                  break d;
                }
              }
            } while (0);
            b[7088] = b[7088] | 4;
            q2 = 143;
          } else {
            c2 = 0;
            q2 = 143;
          }
        } while (0);
      if (((q2 | 0) == 143 ? k >>> 0 < 2147483647 : 0) ? (t2 = Zd(k | 0) | 0, p3 = Zd(0) | 0, r2 = p3 - t2 | 0, s2 = r2 >>> 0 > (m + 40 | 0) >>> 0, !((t2 | 0) == (-1 | 0) | s2 ^ 1 | t2 >>> 0 < p3 >>> 0 & ((t2 | 0) != (-1 | 0) & (p3 | 0) != (-1 | 0)) ^ 1)) : 0) {
        h = s2 ? r2 : c2;
        g2 = t2;
        q2 = 145;
      }
      if ((q2 | 0) == 145) {
        c2 = (b[7085] | 0) + h | 0;
        b[7085] = c2;
        if (c2 >>> 0 > (b[7086] | 0) >>> 0) {
          b[7086] = c2;
        }
        j = b[6983] | 0;
        f:
          do {
            if (j) {
              c2 = 28356;
              while (true) {
                a3 = b[c2 >> 2] | 0;
                d2 = b[c2 + 4 >> 2] | 0;
                if ((g2 | 0) == (a3 + d2 | 0)) {
                  q2 = 154;
                  break;
                }
                e2 = b[c2 + 8 >> 2] | 0;
                if (!e2) {
                  break;
                } else {
                  c2 = e2;
                }
              }
              if (((q2 | 0) == 154 ? (u2 = c2 + 4 | 0, (b[c2 + 12 >> 2] & 8 | 0) == 0) : 0) ? g2 >>> 0 > j >>> 0 & a3 >>> 0 <= j >>> 0 : 0) {
                b[u2 >> 2] = d2 + h;
                v2 = (b[6980] | 0) + h | 0;
                t2 = j + 8 | 0;
                t2 = (t2 & 7 | 0) == 0 ? 0 : 0 - t2 & 7;
                u2 = j + t2 | 0;
                t2 = v2 - t2 | 0;
                b[6983] = u2;
                b[6980] = t2;
                b[u2 + 4 >> 2] = t2 | 1;
                b[j + v2 + 4 >> 2] = 40;
                b[6984] = b[7099];
                break;
              }
              if (g2 >>> 0 < (b[6981] | 0) >>> 0) {
                b[6981] = g2;
              }
              d2 = g2 + h | 0;
              c2 = 28356;
              while (true) {
                if ((b[c2 >> 2] | 0) == (d2 | 0)) {
                  q2 = 162;
                  break;
                }
                a3 = b[c2 + 8 >> 2] | 0;
                if (!a3) {
                  break;
                } else {
                  c2 = a3;
                }
              }
              if ((q2 | 0) == 162 ? (b[c2 + 12 >> 2] & 8 | 0) == 0 : 0) {
                b[c2 >> 2] = g2;
                l = c2 + 4 | 0;
                b[l >> 2] = (b[l >> 2] | 0) + h;
                l = g2 + 8 | 0;
                l = g2 + ((l & 7 | 0) == 0 ? 0 : 0 - l & 7) | 0;
                c2 = d2 + 8 | 0;
                c2 = d2 + ((c2 & 7 | 0) == 0 ? 0 : 0 - c2 & 7) | 0;
                k = l + m | 0;
                i = c2 - l - m | 0;
                b[l + 4 >> 2] = m | 3;
                g:
                  do {
                    if ((j | 0) == (c2 | 0)) {
                      v2 = (b[6980] | 0) + i | 0;
                      b[6980] = v2;
                      b[6983] = k;
                      b[k + 4 >> 2] = v2 | 1;
                    } else {
                      if ((b[6982] | 0) == (c2 | 0)) {
                        v2 = (b[6979] | 0) + i | 0;
                        b[6979] = v2;
                        b[6982] = k;
                        b[k + 4 >> 2] = v2 | 1;
                        b[k + v2 >> 2] = v2;
                        break;
                      }
                      a3 = b[c2 + 4 >> 2] | 0;
                      if ((a3 & 3 | 0) == 1) {
                        h = a3 & -8;
                        e2 = a3 >>> 3;
                        h:
                          do {
                            if (a3 >>> 0 < 256) {
                              a3 = b[c2 + 8 >> 2] | 0;
                              d2 = b[c2 + 12 >> 2] | 0;
                              if ((d2 | 0) == (a3 | 0)) {
                                b[6977] = b[6977] & ~(1 << e2);
                                break;
                              } else {
                                b[a3 + 12 >> 2] = d2;
                                b[d2 + 8 >> 2] = a3;
                                break;
                              }
                            } else {
                              g2 = b[c2 + 24 >> 2] | 0;
                              a3 = b[c2 + 12 >> 2] | 0;
                              do {
                                if ((a3 | 0) == (c2 | 0)) {
                                  d2 = c2 + 16 | 0;
                                  e2 = d2 + 4 | 0;
                                  a3 = b[e2 >> 2] | 0;
                                  if (!a3) {
                                    a3 = b[d2 >> 2] | 0;
                                    if (!a3) {
                                      a3 = 0;
                                      break;
                                    }
                                  } else {
                                    d2 = e2;
                                  }
                                  while (true) {
                                    f2 = a3 + 20 | 0;
                                    e2 = b[f2 >> 2] | 0;
                                    if (!e2) {
                                      f2 = a3 + 16 | 0;
                                      e2 = b[f2 >> 2] | 0;
                                      if (!e2) {
                                        break;
                                      } else {
                                        a3 = e2;
                                        d2 = f2;
                                      }
                                    } else {
                                      a3 = e2;
                                      d2 = f2;
                                    }
                                  }
                                  b[d2 >> 2] = 0;
                                } else {
                                  v2 = b[c2 + 8 >> 2] | 0;
                                  b[v2 + 12 >> 2] = a3;
                                  b[a3 + 8 >> 2] = v2;
                                }
                              } while (0);
                              if (!g2) {
                                break;
                              }
                              d2 = b[c2 + 28 >> 2] | 0;
                              e2 = 28212 + (d2 << 2) | 0;
                              do {
                                if ((b[e2 >> 2] | 0) != (c2 | 0)) {
                                  v2 = g2 + 16 | 0;
                                  b[((b[v2 >> 2] | 0) == (c2 | 0) ? v2 : g2 + 20 | 0) >> 2] = a3;
                                  if (!a3) {
                                    break h;
                                  }
                                } else {
                                  b[e2 >> 2] = a3;
                                  if (a3 | 0) {
                                    break;
                                  }
                                  b[6978] = b[6978] & ~(1 << d2);
                                  break h;
                                }
                              } while (0);
                              b[a3 + 24 >> 2] = g2;
                              d2 = c2 + 16 | 0;
                              e2 = b[d2 >> 2] | 0;
                              if (e2 | 0) {
                                b[a3 + 16 >> 2] = e2;
                                b[e2 + 24 >> 2] = a3;
                              }
                              d2 = b[d2 + 4 >> 2] | 0;
                              if (!d2) {
                                break;
                              }
                              b[a3 + 20 >> 2] = d2;
                              b[d2 + 24 >> 2] = a3;
                            }
                          } while (0);
                        c2 = c2 + h | 0;
                        f2 = h + i | 0;
                      } else {
                        f2 = i;
                      }
                      c2 = c2 + 4 | 0;
                      b[c2 >> 2] = b[c2 >> 2] & -2;
                      b[k + 4 >> 2] = f2 | 1;
                      b[k + f2 >> 2] = f2;
                      c2 = f2 >>> 3;
                      if (f2 >>> 0 < 256) {
                        d2 = 27948 + (c2 << 1 << 2) | 0;
                        a3 = b[6977] | 0;
                        c2 = 1 << c2;
                        if (!(a3 & c2)) {
                          b[6977] = a3 | c2;
                          c2 = d2;
                          a3 = d2 + 8 | 0;
                        } else {
                          a3 = d2 + 8 | 0;
                          c2 = b[a3 >> 2] | 0;
                        }
                        b[a3 >> 2] = k;
                        b[c2 + 12 >> 2] = k;
                        b[k + 8 >> 2] = c2;
                        b[k + 12 >> 2] = d2;
                        break;
                      }
                      c2 = f2 >>> 8;
                      do {
                        if (!c2) {
                          e2 = 0;
                        } else {
                          if (f2 >>> 0 > 16777215) {
                            e2 = 31;
                            break;
                          }
                          u2 = (c2 + 1048320 | 0) >>> 16 & 8;
                          v2 = c2 << u2;
                          t2 = (v2 + 520192 | 0) >>> 16 & 4;
                          v2 = v2 << t2;
                          e2 = (v2 + 245760 | 0) >>> 16 & 2;
                          e2 = 14 - (t2 | u2 | e2) + (v2 << e2 >>> 15) | 0;
                          e2 = f2 >>> (e2 + 7 | 0) & 1 | e2 << 1;
                        }
                      } while (0);
                      c2 = 28212 + (e2 << 2) | 0;
                      b[k + 28 >> 2] = e2;
                      a3 = k + 16 | 0;
                      b[a3 + 4 >> 2] = 0;
                      b[a3 >> 2] = 0;
                      a3 = b[6978] | 0;
                      d2 = 1 << e2;
                      if (!(a3 & d2)) {
                        b[6978] = a3 | d2;
                        b[c2 >> 2] = k;
                        b[k + 24 >> 2] = c2;
                        b[k + 12 >> 2] = k;
                        b[k + 8 >> 2] = k;
                        break;
                      }
                      c2 = b[c2 >> 2] | 0;
                      i:
                        do {
                          if ((b[c2 + 4 >> 2] & -8 | 0) != (f2 | 0)) {
                            e2 = f2 << ((e2 | 0) == 31 ? 0 : 25 - (e2 >>> 1) | 0);
                            while (true) {
                              d2 = c2 + 16 + (e2 >>> 31 << 2) | 0;
                              a3 = b[d2 >> 2] | 0;
                              if (!a3) {
                                break;
                              }
                              if ((b[a3 + 4 >> 2] & -8 | 0) == (f2 | 0)) {
                                c2 = a3;
                                break i;
                              } else {
                                e2 = e2 << 1;
                                c2 = a3;
                              }
                            }
                            b[d2 >> 2] = k;
                            b[k + 24 >> 2] = c2;
                            b[k + 12 >> 2] = k;
                            b[k + 8 >> 2] = k;
                            break g;
                          }
                        } while (0);
                      u2 = c2 + 8 | 0;
                      v2 = b[u2 >> 2] | 0;
                      b[v2 + 12 >> 2] = k;
                      b[u2 >> 2] = k;
                      b[k + 8 >> 2] = v2;
                      b[k + 12 >> 2] = c2;
                      b[k + 24 >> 2] = 0;
                    }
                  } while (0);
                v2 = l + 8 | 0;
                T = w2;
                return v2 | 0;
              }
              c2 = 28356;
              while (true) {
                a3 = b[c2 >> 2] | 0;
                if (a3 >>> 0 <= j >>> 0 ? (v2 = a3 + (b[c2 + 4 >> 2] | 0) | 0, v2 >>> 0 > j >>> 0) : 0) {
                  break;
                }
                c2 = b[c2 + 8 >> 2] | 0;
              }
              f2 = v2 + -47 | 0;
              a3 = f2 + 8 | 0;
              a3 = f2 + ((a3 & 7 | 0) == 0 ? 0 : 0 - a3 & 7) | 0;
              f2 = j + 16 | 0;
              a3 = a3 >>> 0 < f2 >>> 0 ? j : a3;
              c2 = a3 + 8 | 0;
              d2 = h + -40 | 0;
              t2 = g2 + 8 | 0;
              t2 = (t2 & 7 | 0) == 0 ? 0 : 0 - t2 & 7;
              u2 = g2 + t2 | 0;
              t2 = d2 - t2 | 0;
              b[6983] = u2;
              b[6980] = t2;
              b[u2 + 4 >> 2] = t2 | 1;
              b[g2 + d2 + 4 >> 2] = 40;
              b[6984] = b[7099];
              d2 = a3 + 4 | 0;
              b[d2 >> 2] = 27;
              b[c2 >> 2] = b[7089];
              b[c2 + 4 >> 2] = b[7090];
              b[c2 + 8 >> 2] = b[7091];
              b[c2 + 12 >> 2] = b[7092];
              b[7089] = g2;
              b[7090] = h;
              b[7092] = 0;
              b[7091] = c2;
              c2 = a3 + 24 | 0;
              do {
                u2 = c2;
                c2 = c2 + 4 | 0;
                b[c2 >> 2] = 7;
              } while ((u2 + 8 | 0) >>> 0 < v2 >>> 0);
              if ((a3 | 0) != (j | 0)) {
                g2 = a3 - j | 0;
                b[d2 >> 2] = b[d2 >> 2] & -2;
                b[j + 4 >> 2] = g2 | 1;
                b[a3 >> 2] = g2;
                c2 = g2 >>> 3;
                if (g2 >>> 0 < 256) {
                  d2 = 27948 + (c2 << 1 << 2) | 0;
                  a3 = b[6977] | 0;
                  c2 = 1 << c2;
                  if (!(a3 & c2)) {
                    b[6977] = a3 | c2;
                    c2 = d2;
                    a3 = d2 + 8 | 0;
                  } else {
                    a3 = d2 + 8 | 0;
                    c2 = b[a3 >> 2] | 0;
                  }
                  b[a3 >> 2] = j;
                  b[c2 + 12 >> 2] = j;
                  b[j + 8 >> 2] = c2;
                  b[j + 12 >> 2] = d2;
                  break;
                }
                c2 = g2 >>> 8;
                if (c2) {
                  if (g2 >>> 0 > 16777215) {
                    e2 = 31;
                  } else {
                    u2 = (c2 + 1048320 | 0) >>> 16 & 8;
                    v2 = c2 << u2;
                    t2 = (v2 + 520192 | 0) >>> 16 & 4;
                    v2 = v2 << t2;
                    e2 = (v2 + 245760 | 0) >>> 16 & 2;
                    e2 = 14 - (t2 | u2 | e2) + (v2 << e2 >>> 15) | 0;
                    e2 = g2 >>> (e2 + 7 | 0) & 1 | e2 << 1;
                  }
                } else {
                  e2 = 0;
                }
                d2 = 28212 + (e2 << 2) | 0;
                b[j + 28 >> 2] = e2;
                b[j + 20 >> 2] = 0;
                b[f2 >> 2] = 0;
                c2 = b[6978] | 0;
                a3 = 1 << e2;
                if (!(c2 & a3)) {
                  b[6978] = c2 | a3;
                  b[d2 >> 2] = j;
                  b[j + 24 >> 2] = d2;
                  b[j + 12 >> 2] = j;
                  b[j + 8 >> 2] = j;
                  break;
                }
                c2 = b[d2 >> 2] | 0;
                j:
                  do {
                    if ((b[c2 + 4 >> 2] & -8 | 0) != (g2 | 0)) {
                      e2 = g2 << ((e2 | 0) == 31 ? 0 : 25 - (e2 >>> 1) | 0);
                      while (true) {
                        d2 = c2 + 16 + (e2 >>> 31 << 2) | 0;
                        a3 = b[d2 >> 2] | 0;
                        if (!a3) {
                          break;
                        }
                        if ((b[a3 + 4 >> 2] & -8 | 0) == (g2 | 0)) {
                          c2 = a3;
                          break j;
                        } else {
                          e2 = e2 << 1;
                          c2 = a3;
                        }
                      }
                      b[d2 >> 2] = j;
                      b[j + 24 >> 2] = c2;
                      b[j + 12 >> 2] = j;
                      b[j + 8 >> 2] = j;
                      break f;
                    }
                  } while (0);
                u2 = c2 + 8 | 0;
                v2 = b[u2 >> 2] | 0;
                b[v2 + 12 >> 2] = j;
                b[u2 >> 2] = j;
                b[j + 8 >> 2] = v2;
                b[j + 12 >> 2] = c2;
                b[j + 24 >> 2] = 0;
              }
            } else {
              v2 = b[6981] | 0;
              if ((v2 | 0) == 0 | g2 >>> 0 < v2 >>> 0) {
                b[6981] = g2;
              }
              b[7089] = g2;
              b[7090] = h;
              b[7092] = 0;
              b[6986] = b[7095];
              b[6985] = -1;
              b[6990] = 27948;
              b[6989] = 27948;
              b[6992] = 27956;
              b[6991] = 27956;
              b[6994] = 27964;
              b[6993] = 27964;
              b[6996] = 27972;
              b[6995] = 27972;
              b[6998] = 27980;
              b[6997] = 27980;
              b[7000] = 27988;
              b[6999] = 27988;
              b[7002] = 27996;
              b[7001] = 27996;
              b[7004] = 28004;
              b[7003] = 28004;
              b[7006] = 28012;
              b[7005] = 28012;
              b[7008] = 28020;
              b[7007] = 28020;
              b[7010] = 28028;
              b[7009] = 28028;
              b[7012] = 28036;
              b[7011] = 28036;
              b[7014] = 28044;
              b[7013] = 28044;
              b[7016] = 28052;
              b[7015] = 28052;
              b[7018] = 28060;
              b[7017] = 28060;
              b[7020] = 28068;
              b[7019] = 28068;
              b[7022] = 28076;
              b[7021] = 28076;
              b[7024] = 28084;
              b[7023] = 28084;
              b[7026] = 28092;
              b[7025] = 28092;
              b[7028] = 28100;
              b[7027] = 28100;
              b[7030] = 28108;
              b[7029] = 28108;
              b[7032] = 28116;
              b[7031] = 28116;
              b[7034] = 28124;
              b[7033] = 28124;
              b[7036] = 28132;
              b[7035] = 28132;
              b[7038] = 28140;
              b[7037] = 28140;
              b[7040] = 28148;
              b[7039] = 28148;
              b[7042] = 28156;
              b[7041] = 28156;
              b[7044] = 28164;
              b[7043] = 28164;
              b[7046] = 28172;
              b[7045] = 28172;
              b[7048] = 28180;
              b[7047] = 28180;
              b[7050] = 28188;
              b[7049] = 28188;
              b[7052] = 28196;
              b[7051] = 28196;
              v2 = h + -40 | 0;
              t2 = g2 + 8 | 0;
              t2 = (t2 & 7 | 0) == 0 ? 0 : 0 - t2 & 7;
              u2 = g2 + t2 | 0;
              t2 = v2 - t2 | 0;
              b[6983] = u2;
              b[6980] = t2;
              b[u2 + 4 >> 2] = t2 | 1;
              b[g2 + v2 + 4 >> 2] = 40;
              b[6984] = b[7099];
            }
          } while (0);
        c2 = b[6980] | 0;
        if (c2 >>> 0 > m >>> 0) {
          t2 = c2 - m | 0;
          b[6980] = t2;
          v2 = b[6983] | 0;
          u2 = v2 + m | 0;
          b[6983] = u2;
          b[u2 + 4 >> 2] = t2 | 1;
          b[v2 + 4 >> 2] = m | 3;
          v2 = v2 + 8 | 0;
          T = w2;
          return v2 | 0;
        }
      }
      v2 = Bd() | 0;
      b[v2 >> 2] = 12;
      v2 = 0;
      T = w2;
      return v2 | 0;
    }
    function Ed(a3) {
      a3 = a3 | 0;
      var c2 = 0, d2 = 0, e2 = 0, f2 = 0, g2 = 0, h = 0, i = 0, j = 0;
      if (!a3) {
        return;
      }
      d2 = a3 + -8 | 0;
      f2 = b[6981] | 0;
      a3 = b[a3 + -4 >> 2] | 0;
      c2 = a3 & -8;
      j = d2 + c2 | 0;
      do {
        if (!(a3 & 1)) {
          e2 = b[d2 >> 2] | 0;
          if (!(a3 & 3)) {
            return;
          }
          h = d2 + (0 - e2) | 0;
          g2 = e2 + c2 | 0;
          if (h >>> 0 < f2 >>> 0) {
            return;
          }
          if ((b[6982] | 0) == (h | 0)) {
            a3 = j + 4 | 0;
            c2 = b[a3 >> 2] | 0;
            if ((c2 & 3 | 0) != 3) {
              i = h;
              c2 = g2;
              break;
            }
            b[6979] = g2;
            b[a3 >> 2] = c2 & -2;
            b[h + 4 >> 2] = g2 | 1;
            b[h + g2 >> 2] = g2;
            return;
          }
          d2 = e2 >>> 3;
          if (e2 >>> 0 < 256) {
            a3 = b[h + 8 >> 2] | 0;
            c2 = b[h + 12 >> 2] | 0;
            if ((c2 | 0) == (a3 | 0)) {
              b[6977] = b[6977] & ~(1 << d2);
              i = h;
              c2 = g2;
              break;
            } else {
              b[a3 + 12 >> 2] = c2;
              b[c2 + 8 >> 2] = a3;
              i = h;
              c2 = g2;
              break;
            }
          }
          f2 = b[h + 24 >> 2] | 0;
          a3 = b[h + 12 >> 2] | 0;
          do {
            if ((a3 | 0) == (h | 0)) {
              c2 = h + 16 | 0;
              d2 = c2 + 4 | 0;
              a3 = b[d2 >> 2] | 0;
              if (!a3) {
                a3 = b[c2 >> 2] | 0;
                if (!a3) {
                  a3 = 0;
                  break;
                }
              } else {
                c2 = d2;
              }
              while (true) {
                e2 = a3 + 20 | 0;
                d2 = b[e2 >> 2] | 0;
                if (!d2) {
                  e2 = a3 + 16 | 0;
                  d2 = b[e2 >> 2] | 0;
                  if (!d2) {
                    break;
                  } else {
                    a3 = d2;
                    c2 = e2;
                  }
                } else {
                  a3 = d2;
                  c2 = e2;
                }
              }
              b[c2 >> 2] = 0;
            } else {
              i = b[h + 8 >> 2] | 0;
              b[i + 12 >> 2] = a3;
              b[a3 + 8 >> 2] = i;
            }
          } while (0);
          if (f2) {
            c2 = b[h + 28 >> 2] | 0;
            d2 = 28212 + (c2 << 2) | 0;
            if ((b[d2 >> 2] | 0) == (h | 0)) {
              b[d2 >> 2] = a3;
              if (!a3) {
                b[6978] = b[6978] & ~(1 << c2);
                i = h;
                c2 = g2;
                break;
              }
            } else {
              i = f2 + 16 | 0;
              b[((b[i >> 2] | 0) == (h | 0) ? i : f2 + 20 | 0) >> 2] = a3;
              if (!a3) {
                i = h;
                c2 = g2;
                break;
              }
            }
            b[a3 + 24 >> 2] = f2;
            c2 = h + 16 | 0;
            d2 = b[c2 >> 2] | 0;
            if (d2 | 0) {
              b[a3 + 16 >> 2] = d2;
              b[d2 + 24 >> 2] = a3;
            }
            c2 = b[c2 + 4 >> 2] | 0;
            if (c2) {
              b[a3 + 20 >> 2] = c2;
              b[c2 + 24 >> 2] = a3;
              i = h;
              c2 = g2;
            } else {
              i = h;
              c2 = g2;
            }
          } else {
            i = h;
            c2 = g2;
          }
        } else {
          i = d2;
          h = d2;
        }
      } while (0);
      if (h >>> 0 >= j >>> 0) {
        return;
      }
      a3 = j + 4 | 0;
      e2 = b[a3 >> 2] | 0;
      if (!(e2 & 1)) {
        return;
      }
      if (!(e2 & 2)) {
        if ((b[6983] | 0) == (j | 0)) {
          j = (b[6980] | 0) + c2 | 0;
          b[6980] = j;
          b[6983] = i;
          b[i + 4 >> 2] = j | 1;
          if ((i | 0) != (b[6982] | 0)) {
            return;
          }
          b[6982] = 0;
          b[6979] = 0;
          return;
        }
        if ((b[6982] | 0) == (j | 0)) {
          j = (b[6979] | 0) + c2 | 0;
          b[6979] = j;
          b[6982] = h;
          b[i + 4 >> 2] = j | 1;
          b[h + j >> 2] = j;
          return;
        }
        f2 = (e2 & -8) + c2 | 0;
        d2 = e2 >>> 3;
        do {
          if (e2 >>> 0 < 256) {
            c2 = b[j + 8 >> 2] | 0;
            a3 = b[j + 12 >> 2] | 0;
            if ((a3 | 0) == (c2 | 0)) {
              b[6977] = b[6977] & ~(1 << d2);
              break;
            } else {
              b[c2 + 12 >> 2] = a3;
              b[a3 + 8 >> 2] = c2;
              break;
            }
          } else {
            g2 = b[j + 24 >> 2] | 0;
            a3 = b[j + 12 >> 2] | 0;
            do {
              if ((a3 | 0) == (j | 0)) {
                c2 = j + 16 | 0;
                d2 = c2 + 4 | 0;
                a3 = b[d2 >> 2] | 0;
                if (!a3) {
                  a3 = b[c2 >> 2] | 0;
                  if (!a3) {
                    d2 = 0;
                    break;
                  }
                } else {
                  c2 = d2;
                }
                while (true) {
                  e2 = a3 + 20 | 0;
                  d2 = b[e2 >> 2] | 0;
                  if (!d2) {
                    e2 = a3 + 16 | 0;
                    d2 = b[e2 >> 2] | 0;
                    if (!d2) {
                      break;
                    } else {
                      a3 = d2;
                      c2 = e2;
                    }
                  } else {
                    a3 = d2;
                    c2 = e2;
                  }
                }
                b[c2 >> 2] = 0;
                d2 = a3;
              } else {
                d2 = b[j + 8 >> 2] | 0;
                b[d2 + 12 >> 2] = a3;
                b[a3 + 8 >> 2] = d2;
                d2 = a3;
              }
            } while (0);
            if (g2 | 0) {
              a3 = b[j + 28 >> 2] | 0;
              c2 = 28212 + (a3 << 2) | 0;
              if ((b[c2 >> 2] | 0) == (j | 0)) {
                b[c2 >> 2] = d2;
                if (!d2) {
                  b[6978] = b[6978] & ~(1 << a3);
                  break;
                }
              } else {
                e2 = g2 + 16 | 0;
                b[((b[e2 >> 2] | 0) == (j | 0) ? e2 : g2 + 20 | 0) >> 2] = d2;
                if (!d2) {
                  break;
                }
              }
              b[d2 + 24 >> 2] = g2;
              a3 = j + 16 | 0;
              c2 = b[a3 >> 2] | 0;
              if (c2 | 0) {
                b[d2 + 16 >> 2] = c2;
                b[c2 + 24 >> 2] = d2;
              }
              a3 = b[a3 + 4 >> 2] | 0;
              if (a3 | 0) {
                b[d2 + 20 >> 2] = a3;
                b[a3 + 24 >> 2] = d2;
              }
            }
          }
        } while (0);
        b[i + 4 >> 2] = f2 | 1;
        b[h + f2 >> 2] = f2;
        if ((i | 0) == (b[6982] | 0)) {
          b[6979] = f2;
          return;
        }
      } else {
        b[a3 >> 2] = e2 & -2;
        b[i + 4 >> 2] = c2 | 1;
        b[h + c2 >> 2] = c2;
        f2 = c2;
      }
      a3 = f2 >>> 3;
      if (f2 >>> 0 < 256) {
        d2 = 27948 + (a3 << 1 << 2) | 0;
        c2 = b[6977] | 0;
        a3 = 1 << a3;
        if (!(c2 & a3)) {
          b[6977] = c2 | a3;
          a3 = d2;
          c2 = d2 + 8 | 0;
        } else {
          c2 = d2 + 8 | 0;
          a3 = b[c2 >> 2] | 0;
        }
        b[c2 >> 2] = i;
        b[a3 + 12 >> 2] = i;
        b[i + 8 >> 2] = a3;
        b[i + 12 >> 2] = d2;
        return;
      }
      a3 = f2 >>> 8;
      if (a3) {
        if (f2 >>> 0 > 16777215) {
          e2 = 31;
        } else {
          h = (a3 + 1048320 | 0) >>> 16 & 8;
          j = a3 << h;
          g2 = (j + 520192 | 0) >>> 16 & 4;
          j = j << g2;
          e2 = (j + 245760 | 0) >>> 16 & 2;
          e2 = 14 - (g2 | h | e2) + (j << e2 >>> 15) | 0;
          e2 = f2 >>> (e2 + 7 | 0) & 1 | e2 << 1;
        }
      } else {
        e2 = 0;
      }
      a3 = 28212 + (e2 << 2) | 0;
      b[i + 28 >> 2] = e2;
      b[i + 20 >> 2] = 0;
      b[i + 16 >> 2] = 0;
      c2 = b[6978] | 0;
      d2 = 1 << e2;
      a:
        do {
          if (!(c2 & d2)) {
            b[6978] = c2 | d2;
            b[a3 >> 2] = i;
            b[i + 24 >> 2] = a3;
            b[i + 12 >> 2] = i;
            b[i + 8 >> 2] = i;
          } else {
            a3 = b[a3 >> 2] | 0;
            b:
              do {
                if ((b[a3 + 4 >> 2] & -8 | 0) != (f2 | 0)) {
                  e2 = f2 << ((e2 | 0) == 31 ? 0 : 25 - (e2 >>> 1) | 0);
                  while (true) {
                    d2 = a3 + 16 + (e2 >>> 31 << 2) | 0;
                    c2 = b[d2 >> 2] | 0;
                    if (!c2) {
                      break;
                    }
                    if ((b[c2 + 4 >> 2] & -8 | 0) == (f2 | 0)) {
                      a3 = c2;
                      break b;
                    } else {
                      e2 = e2 << 1;
                      a3 = c2;
                    }
                  }
                  b[d2 >> 2] = i;
                  b[i + 24 >> 2] = a3;
                  b[i + 12 >> 2] = i;
                  b[i + 8 >> 2] = i;
                  break a;
                }
              } while (0);
            h = a3 + 8 | 0;
            j = b[h >> 2] | 0;
            b[j + 12 >> 2] = i;
            b[h >> 2] = i;
            b[i + 8 >> 2] = j;
            b[i + 12 >> 2] = a3;
            b[i + 24 >> 2] = 0;
          }
        } while (0);
      j = (b[6985] | 0) + -1 | 0;
      b[6985] = j;
      if (j | 0) {
        return;
      }
      a3 = 28364;
      while (true) {
        a3 = b[a3 >> 2] | 0;
        if (!a3) {
          break;
        } else {
          a3 = a3 + 8 | 0;
        }
      }
      b[6985] = -1;
      return;
    }
    function Fd(a3, c2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      var d2 = 0;
      if (a3) {
        d2 = B(c2, a3) | 0;
        if ((c2 | a3) >>> 0 > 65535) {
          d2 = ((d2 >>> 0) / (a3 >>> 0) | 0 | 0) == (c2 | 0) ? d2 : -1;
        }
      } else {
        d2 = 0;
      }
      a3 = Dd(d2) | 0;
      if (!a3) {
        return a3 | 0;
      }
      if (!(b[a3 + -4 >> 2] & 3)) {
        return a3 | 0;
      }
      Xd(a3 | 0, 0, d2 | 0) | 0;
      return a3 | 0;
    }
    function Gd(a3, b2, c2, d2) {
      a3 = a3 | 0;
      b2 = b2 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      c2 = a3 + c2 >>> 0;
      return (G(b2 + d2 + (c2 >>> 0 < a3 >>> 0 | 0) >>> 0 | 0), c2 | 0) | 0;
    }
    function Hd(a3, b2, c2, d2) {
      a3 = a3 | 0;
      b2 = b2 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      d2 = b2 - d2 - (c2 >>> 0 > a3 >>> 0 | 0) >>> 0;
      return (G(d2 | 0), a3 - c2 >>> 0 | 0) | 0;
    }
    function Id(a3) {
      a3 = a3 | 0;
      return (a3 ? 31 - (E(a3 ^ a3 - 1) | 0) | 0 : 32) | 0;
    }
    function Jd(a3, c2, d2, e2, f2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      f2 = f2 | 0;
      var g2 = 0, h = 0, i = 0, j = 0, k = 0, l = 0, m = 0, n = 0, o = 0, p3 = 0;
      l = a3;
      j = c2;
      k = j;
      h = d2;
      n = e2;
      i = n;
      if (!k) {
        g2 = (f2 | 0) != 0;
        if (!i) {
          if (g2) {
            b[f2 >> 2] = (l >>> 0) % (h >>> 0);
            b[f2 + 4 >> 2] = 0;
          }
          n = 0;
          f2 = (l >>> 0) / (h >>> 0) >>> 0;
          return (G(n | 0), f2) | 0;
        } else {
          if (!g2) {
            n = 0;
            f2 = 0;
            return (G(n | 0), f2) | 0;
          }
          b[f2 >> 2] = a3 | 0;
          b[f2 + 4 >> 2] = c2 & 0;
          n = 0;
          f2 = 0;
          return (G(n | 0), f2) | 0;
        }
      }
      g2 = (i | 0) == 0;
      do {
        if (h) {
          if (!g2) {
            g2 = (E(i | 0) | 0) - (E(k | 0) | 0) | 0;
            if (g2 >>> 0 <= 31) {
              m = g2 + 1 | 0;
              i = 31 - g2 | 0;
              c2 = g2 - 31 >> 31;
              h = m;
              a3 = l >>> (m >>> 0) & c2 | k << i;
              c2 = k >>> (m >>> 0) & c2;
              g2 = 0;
              i = l << i;
              break;
            }
            if (!f2) {
              n = 0;
              f2 = 0;
              return (G(n | 0), f2) | 0;
            }
            b[f2 >> 2] = a3 | 0;
            b[f2 + 4 >> 2] = j | c2 & 0;
            n = 0;
            f2 = 0;
            return (G(n | 0), f2) | 0;
          }
          g2 = h - 1 | 0;
          if (g2 & h | 0) {
            i = (E(h | 0) | 0) + 33 - (E(k | 0) | 0) | 0;
            p3 = 64 - i | 0;
            m = 32 - i | 0;
            j = m >> 31;
            o = i - 32 | 0;
            c2 = o >> 31;
            h = i;
            a3 = m - 1 >> 31 & k >>> (o >>> 0) | (k << m | l >>> (i >>> 0)) & c2;
            c2 = c2 & k >>> (i >>> 0);
            g2 = l << p3 & j;
            i = (k << p3 | l >>> (o >>> 0)) & j | l << m & i - 33 >> 31;
            break;
          }
          if (f2 | 0) {
            b[f2 >> 2] = g2 & l;
            b[f2 + 4 >> 2] = 0;
          }
          if ((h | 0) == 1) {
            o = j | c2 & 0;
            p3 = a3 | 0 | 0;
            return (G(o | 0), p3) | 0;
          } else {
            p3 = Id(h | 0) | 0;
            o = k >>> (p3 >>> 0) | 0;
            p3 = k << 32 - p3 | l >>> (p3 >>> 0) | 0;
            return (G(o | 0), p3) | 0;
          }
        } else {
          if (g2) {
            if (f2 | 0) {
              b[f2 >> 2] = (k >>> 0) % (h >>> 0);
              b[f2 + 4 >> 2] = 0;
            }
            o = 0;
            p3 = (k >>> 0) / (h >>> 0) >>> 0;
            return (G(o | 0), p3) | 0;
          }
          if (!l) {
            if (f2 | 0) {
              b[f2 >> 2] = 0;
              b[f2 + 4 >> 2] = (k >>> 0) % (i >>> 0);
            }
            o = 0;
            p3 = (k >>> 0) / (i >>> 0) >>> 0;
            return (G(o | 0), p3) | 0;
          }
          g2 = i - 1 | 0;
          if (!(g2 & i)) {
            if (f2 | 0) {
              b[f2 >> 2] = a3 | 0;
              b[f2 + 4 >> 2] = g2 & k | c2 & 0;
            }
            o = 0;
            p3 = k >>> ((Id(i | 0) | 0) >>> 0);
            return (G(o | 0), p3) | 0;
          }
          g2 = (E(i | 0) | 0) - (E(k | 0) | 0) | 0;
          if (g2 >>> 0 <= 30) {
            c2 = g2 + 1 | 0;
            i = 31 - g2 | 0;
            h = c2;
            a3 = k << i | l >>> (c2 >>> 0);
            c2 = k >>> (c2 >>> 0);
            g2 = 0;
            i = l << i;
            break;
          }
          if (!f2) {
            o = 0;
            p3 = 0;
            return (G(o | 0), p3) | 0;
          }
          b[f2 >> 2] = a3 | 0;
          b[f2 + 4 >> 2] = j | c2 & 0;
          o = 0;
          p3 = 0;
          return (G(o | 0), p3) | 0;
        }
      } while (0);
      if (!h) {
        k = i;
        j = 0;
        i = 0;
      } else {
        m = d2 | 0 | 0;
        l = n | e2 & 0;
        k = Gd(m | 0, l | 0, -1, -1) | 0;
        d2 = H() | 0;
        j = i;
        i = 0;
        do {
          e2 = j;
          j = g2 >>> 31 | j << 1;
          g2 = i | g2 << 1;
          e2 = a3 << 1 | e2 >>> 31 | 0;
          n = a3 >>> 31 | c2 << 1 | 0;
          Hd(k | 0, d2 | 0, e2 | 0, n | 0) | 0;
          p3 = H() | 0;
          o = p3 >> 31 | ((p3 | 0) < 0 ? -1 : 0) << 1;
          i = o & 1;
          a3 = Hd(e2 | 0, n | 0, o & m | 0, (((p3 | 0) < 0 ? -1 : 0) >> 31 | ((p3 | 0) < 0 ? -1 : 0) << 1) & l | 0) | 0;
          c2 = H() | 0;
          h = h - 1 | 0;
        } while ((h | 0) != 0);
        k = j;
        j = 0;
      }
      h = 0;
      if (f2 | 0) {
        b[f2 >> 2] = a3;
        b[f2 + 4 >> 2] = c2;
      }
      o = (g2 | 0) >>> 31 | (k | h) << 1 | (h << 1 | g2 >>> 31) & 0 | j;
      p3 = (g2 << 1 | 0 >>> 31) & -2 | i;
      return (G(o | 0), p3) | 0;
    }
    function Kd(a3, b2, c2, d2) {
      a3 = a3 | 0;
      b2 = b2 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      var e2 = 0, f2 = 0, g2 = 0, h = 0, i = 0, j = 0;
      j = b2 >> 31 | ((b2 | 0) < 0 ? -1 : 0) << 1;
      i = ((b2 | 0) < 0 ? -1 : 0) >> 31 | ((b2 | 0) < 0 ? -1 : 0) << 1;
      f2 = d2 >> 31 | ((d2 | 0) < 0 ? -1 : 0) << 1;
      e2 = ((d2 | 0) < 0 ? -1 : 0) >> 31 | ((d2 | 0) < 0 ? -1 : 0) << 1;
      h = Hd(j ^ a3 | 0, i ^ b2 | 0, j | 0, i | 0) | 0;
      g2 = H() | 0;
      a3 = f2 ^ j;
      b2 = e2 ^ i;
      return Hd((Jd(h, g2, Hd(f2 ^ c2 | 0, e2 ^ d2 | 0, f2 | 0, e2 | 0) | 0, H() | 0, 0) | 0) ^ a3 | 0, (H() | 0) ^ b2 | 0, a3 | 0, b2 | 0) | 0;
    }
    function Ld(a3, b2) {
      a3 = a3 | 0;
      b2 = b2 | 0;
      var c2 = 0, d2 = 0, e2 = 0, f2 = 0;
      f2 = a3 & 65535;
      e2 = b2 & 65535;
      c2 = B(e2, f2) | 0;
      d2 = a3 >>> 16;
      a3 = (c2 >>> 16) + (B(e2, d2) | 0) | 0;
      e2 = b2 >>> 16;
      b2 = B(e2, f2) | 0;
      return (G((a3 >>> 16) + (B(e2, d2) | 0) + (((a3 & 65535) + b2 | 0) >>> 16) | 0), a3 + b2 << 16 | c2 & 65535 | 0) | 0;
    }
    function Md(a3, b2, c2, d2) {
      a3 = a3 | 0;
      b2 = b2 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      var e2 = 0, f2 = 0;
      e2 = a3;
      f2 = c2;
      c2 = Ld(e2, f2) | 0;
      a3 = H() | 0;
      return (G((B(b2, f2) | 0) + (B(d2, e2) | 0) + a3 | a3 & 0 | 0), c2 | 0 | 0) | 0;
    }
    function Nd(a3, c2, d2, e2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      var f2 = 0, g2 = 0, h = 0, i = 0, j = 0, k = 0;
      f2 = T;
      T = T + 16 | 0;
      i = f2 | 0;
      h = c2 >> 31 | ((c2 | 0) < 0 ? -1 : 0) << 1;
      g2 = ((c2 | 0) < 0 ? -1 : 0) >> 31 | ((c2 | 0) < 0 ? -1 : 0) << 1;
      k = e2 >> 31 | ((e2 | 0) < 0 ? -1 : 0) << 1;
      j = ((e2 | 0) < 0 ? -1 : 0) >> 31 | ((e2 | 0) < 0 ? -1 : 0) << 1;
      a3 = Hd(h ^ a3 | 0, g2 ^ c2 | 0, h | 0, g2 | 0) | 0;
      c2 = H() | 0;
      Jd(a3, c2, Hd(k ^ d2 | 0, j ^ e2 | 0, k | 0, j | 0) | 0, H() | 0, i) | 0;
      e2 = Hd(b[i >> 2] ^ h | 0, b[i + 4 >> 2] ^ g2 | 0, h | 0, g2 | 0) | 0;
      d2 = H() | 0;
      T = f2;
      return (G(d2 | 0), e2) | 0;
    }
    function Od(a3, c2, d2, e2) {
      a3 = a3 | 0;
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      var f2 = 0, g2 = 0;
      g2 = T;
      T = T + 16 | 0;
      f2 = g2 | 0;
      Jd(a3, c2, d2, e2, f2) | 0;
      T = g2;
      return (G(b[f2 + 4 >> 2] | 0), b[f2 >> 2] | 0) | 0;
    }
    function Pd(a3, b2, c2) {
      a3 = a3 | 0;
      b2 = b2 | 0;
      c2 = c2 | 0;
      if ((c2 | 0) < 32) {
        G(b2 >> c2 | 0);
        return a3 >>> c2 | (b2 & (1 << c2) - 1) << 32 - c2;
      }
      G(((b2 | 0) < 0 ? -1 : 0) | 0);
      return b2 >> c2 - 32 | 0;
    }
    function Qd(a3, b2, c2) {
      a3 = a3 | 0;
      b2 = b2 | 0;
      c2 = c2 | 0;
      if ((c2 | 0) < 32) {
        G(b2 >>> c2 | 0);
        return a3 >>> c2 | (b2 & (1 << c2) - 1) << 32 - c2;
      }
      G(0);
      return b2 >>> c2 - 32 | 0;
    }
    function Rd(a3, b2, c2) {
      a3 = a3 | 0;
      b2 = b2 | 0;
      c2 = c2 | 0;
      if ((c2 | 0) < 32) {
        G(b2 << c2 | (a3 & (1 << c2) - 1 << 32 - c2) >>> 32 - c2 | 0);
        return a3 << c2;
      }
      G(a3 << c2 - 32 | 0);
      return 0;
    }
    function Sd(a3, b2, c2) {
      a3 = a3 | 0;
      b2 = b2 | 0;
      c2 = c2 | 0;
      b2 = E(b2) | 0;
      if ((b2 | 0) == 32) {
        b2 = b2 + (E(a3) | 0) | 0;
      }
      G(0);
      return b2 | 0;
    }
    function Td(a3, b2) {
      a3 = +a3;
      b2 = +b2;
      if (a3 != a3) {
        return +b2;
      }
      if (b2 != b2) {
        return +a3;
      }
      return +D(+a3, +b2);
    }
    function Ud(a3, b2) {
      a3 = +a3;
      b2 = +b2;
      if (a3 != a3) {
        return +b2;
      }
      if (b2 != b2) {
        return +a3;
      }
      return +C(+a3, +b2);
    }
    function Vd(a3) {
      a3 = +a3;
      return a3 >= 0 ? +p2(a3 + 0.5) : +A(a3 - 0.5);
    }
    function Wd(c2, d2, e2) {
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      var f2 = 0, g2 = 0, h = 0;
      if ((e2 | 0) >= 8192) {
        L(c2 | 0, d2 | 0, e2 | 0) | 0;
        return c2 | 0;
      }
      h = c2 | 0;
      g2 = c2 + e2 | 0;
      if ((c2 & 3) == (d2 & 3)) {
        while (c2 & 3) {
          if (!e2) {
            return h | 0;
          }
          a2[c2 >> 0] = a2[d2 >> 0] | 0;
          c2 = c2 + 1 | 0;
          d2 = d2 + 1 | 0;
          e2 = e2 - 1 | 0;
        }
        e2 = g2 & -4 | 0;
        f2 = e2 - 64 | 0;
        while ((c2 | 0) <= (f2 | 0)) {
          b[c2 >> 2] = b[d2 >> 2];
          b[c2 + 4 >> 2] = b[d2 + 4 >> 2];
          b[c2 + 8 >> 2] = b[d2 + 8 >> 2];
          b[c2 + 12 >> 2] = b[d2 + 12 >> 2];
          b[c2 + 16 >> 2] = b[d2 + 16 >> 2];
          b[c2 + 20 >> 2] = b[d2 + 20 >> 2];
          b[c2 + 24 >> 2] = b[d2 + 24 >> 2];
          b[c2 + 28 >> 2] = b[d2 + 28 >> 2];
          b[c2 + 32 >> 2] = b[d2 + 32 >> 2];
          b[c2 + 36 >> 2] = b[d2 + 36 >> 2];
          b[c2 + 40 >> 2] = b[d2 + 40 >> 2];
          b[c2 + 44 >> 2] = b[d2 + 44 >> 2];
          b[c2 + 48 >> 2] = b[d2 + 48 >> 2];
          b[c2 + 52 >> 2] = b[d2 + 52 >> 2];
          b[c2 + 56 >> 2] = b[d2 + 56 >> 2];
          b[c2 + 60 >> 2] = b[d2 + 60 >> 2];
          c2 = c2 + 64 | 0;
          d2 = d2 + 64 | 0;
        }
        while ((c2 | 0) < (e2 | 0)) {
          b[c2 >> 2] = b[d2 >> 2];
          c2 = c2 + 4 | 0;
          d2 = d2 + 4 | 0;
        }
      } else {
        e2 = g2 - 4 | 0;
        while ((c2 | 0) < (e2 | 0)) {
          a2[c2 >> 0] = a2[d2 >> 0] | 0;
          a2[c2 + 1 >> 0] = a2[d2 + 1 >> 0] | 0;
          a2[c2 + 2 >> 0] = a2[d2 + 2 >> 0] | 0;
          a2[c2 + 3 >> 0] = a2[d2 + 3 >> 0] | 0;
          c2 = c2 + 4 | 0;
          d2 = d2 + 4 | 0;
        }
      }
      while ((c2 | 0) < (g2 | 0)) {
        a2[c2 >> 0] = a2[d2 >> 0] | 0;
        c2 = c2 + 1 | 0;
        d2 = d2 + 1 | 0;
      }
      return h | 0;
    }
    function Xd(c2, d2, e2) {
      c2 = c2 | 0;
      d2 = d2 | 0;
      e2 = e2 | 0;
      var f2 = 0, g2 = 0, h = 0, i = 0;
      h = c2 + e2 | 0;
      d2 = d2 & 255;
      if ((e2 | 0) >= 67) {
        while (c2 & 3) {
          a2[c2 >> 0] = d2;
          c2 = c2 + 1 | 0;
        }
        f2 = h & -4 | 0;
        i = d2 | d2 << 8 | d2 << 16 | d2 << 24;
        g2 = f2 - 64 | 0;
        while ((c2 | 0) <= (g2 | 0)) {
          b[c2 >> 2] = i;
          b[c2 + 4 >> 2] = i;
          b[c2 + 8 >> 2] = i;
          b[c2 + 12 >> 2] = i;
          b[c2 + 16 >> 2] = i;
          b[c2 + 20 >> 2] = i;
          b[c2 + 24 >> 2] = i;
          b[c2 + 28 >> 2] = i;
          b[c2 + 32 >> 2] = i;
          b[c2 + 36 >> 2] = i;
          b[c2 + 40 >> 2] = i;
          b[c2 + 44 >> 2] = i;
          b[c2 + 48 >> 2] = i;
          b[c2 + 52 >> 2] = i;
          b[c2 + 56 >> 2] = i;
          b[c2 + 60 >> 2] = i;
          c2 = c2 + 64 | 0;
        }
        while ((c2 | 0) < (f2 | 0)) {
          b[c2 >> 2] = i;
          c2 = c2 + 4 | 0;
        }
      }
      while ((c2 | 0) < (h | 0)) {
        a2[c2 >> 0] = d2;
        c2 = c2 + 1 | 0;
      }
      return h - e2 | 0;
    }
    function Yd(a3) {
      a3 = +a3;
      return a3 >= 0 ? +p2(a3 + 0.5) : +A(a3 - 0.5);
    }
    function Zd(a3) {
      a3 = a3 | 0;
      var c2 = 0, d2 = 0, e2 = 0;
      e2 = K() | 0;
      d2 = b[g >> 2] | 0;
      c2 = d2 + a3 | 0;
      if ((a3 | 0) > 0 & (c2 | 0) < (d2 | 0) | (c2 | 0) < 0) {
        N(c2 | 0) | 0;
        J(12);
        return -1;
      }
      if ((c2 | 0) > (e2 | 0)) {
        if (!(M(c2 | 0) | 0)) {
          J(12);
          return -1;
        }
      }
      b[g >> 2] = c2;
      return d2 | 0;
    }
    return {
      ___divdi3: Kd,
      ___muldi3: Md,
      ___remdi3: Nd,
      ___uremdi3: Od,
      _areNeighborCells: ib,
      _bitshift64Ashr: Pd,
      _bitshift64Lshr: Qd,
      _bitshift64Shl: Rd,
      _calloc: Fd,
      _cellAreaKm2: xc,
      _cellAreaM2: yc,
      _cellAreaRads2: wc,
      _cellToBoundary: _b,
      _cellToCenterChild: Kb,
      _cellToChildPos: dc,
      _cellToChildren: Ib,
      _cellToChildrenSize: Gb,
      _cellToLatLng: Zb,
      _cellToLocalIj: Jc,
      _cellToParent: Fb,
      _cellToVertex: qd,
      _cellToVertexes: rd,
      _cellsToDirectedEdge: jb,
      _cellsToLinkedMultiPolygon: na,
      _childPosToCell: ec,
      _compactCells: Lb,
      _destroyLinkedMultiPolygon: Ec,
      _directedEdgeToBoundary: pb,
      _directedEdgeToCells: nb,
      _edgeLengthKm: Ac,
      _edgeLengthM: Bc,
      _edgeLengthRads: zc,
      _emscripten_replace_memory: W,
      _free: Ed,
      _getBaseCellNumber: Cb,
      _getDirectedEdgeDestination: lb,
      _getDirectedEdgeOrigin: kb,
      _getHexagonAreaAvgKm2: qc,
      _getHexagonAreaAvgM2: rc,
      _getHexagonEdgeLengthAvgKm: sc,
      _getHexagonEdgeLengthAvgM: tc,
      _getIcosahedronFaces: ac,
      _getNumCells: uc,
      _getPentagons: cc,
      _getRes0Cells: ya,
      _getResolution: Bb,
      _greatCircleDistanceKm: mc,
      _greatCircleDistanceM: nc,
      _greatCircleDistanceRads: lc,
      _gridDisk: aa,
      _gridDiskDistances: ba,
      _gridDistance: Lc,
      _gridPathCells: Nc,
      _gridPathCellsSize: Mc,
      _gridRing: fa,
      _gridRingUnsafe: ga,
      _i64Add: Gd,
      _i64Subtract: Hd,
      _isPentagon: Hb,
      _isResClassIII: Ob,
      _isValidCell: Db,
      _isValidDirectedEdge: mb,
      _isValidVertex: td,
      _latLngToCell: Wb,
      _llvm_ctlz_i64: Sd,
      _llvm_maxnum_f64: Td,
      _llvm_minnum_f64: Ud,
      _llvm_round_f64: Vd,
      _localIjToCell: Kc,
      _malloc: Dd,
      _maxFaceCount: $b,
      _maxGridDiskSize: $,
      _maxPolygonToCellsSize: ja,
      _maxPolygonToCellsSizeExperimental: Uc,
      _memcpy: Wd,
      _memset: Xd,
      _originToDirectedEdges: ob,
      _pentagonCount: bc,
      _polygonToCells: la,
      _polygonToCellsExperimental: Tc,
      _readInt64AsDoubleFromPointer: id2,
      _res0CellCount: xa,
      _round: Yd,
      _sbrk: Zd,
      _sizeOfCellBoundary: dd,
      _sizeOfCoordIJ: hd,
      _sizeOfGeoLoop: ed,
      _sizeOfGeoPolygon: fd,
      _sizeOfH3Index: bd,
      _sizeOfLatLng: cd,
      _sizeOfLinkedGeoPolygon: gd,
      _uncompactCells: Mb,
      _uncompactCellsSize: Nb,
      _vertexToLatLng: sd,
      establishStackSpace: _,
      stackAlloc: X,
      stackRestore: Z,
      stackSave: Y
    };
  }(asmGlobalArg, asmLibraryArg, buffer);
  var ___divdi3 = Module["___divdi3"] = asm["___divdi3"];
  var ___muldi3 = Module["___muldi3"] = asm["___muldi3"];
  var ___remdi3 = Module["___remdi3"] = asm["___remdi3"];
  var ___uremdi3 = Module["___uremdi3"] = asm["___uremdi3"];
  var _areNeighborCells = Module["_areNeighborCells"] = asm["_areNeighborCells"];
  var _bitshift64Ashr = Module["_bitshift64Ashr"] = asm["_bitshift64Ashr"];
  var _bitshift64Lshr = Module["_bitshift64Lshr"] = asm["_bitshift64Lshr"];
  var _bitshift64Shl = Module["_bitshift64Shl"] = asm["_bitshift64Shl"];
  var _calloc = Module["_calloc"] = asm["_calloc"];
  var _cellAreaKm2 = Module["_cellAreaKm2"] = asm["_cellAreaKm2"];
  var _cellAreaM2 = Module["_cellAreaM2"] = asm["_cellAreaM2"];
  var _cellAreaRads2 = Module["_cellAreaRads2"] = asm["_cellAreaRads2"];
  var _cellToBoundary = Module["_cellToBoundary"] = asm["_cellToBoundary"];
  var _cellToCenterChild = Module["_cellToCenterChild"] = asm["_cellToCenterChild"];
  var _cellToChildPos = Module["_cellToChildPos"] = asm["_cellToChildPos"];
  var _cellToChildren = Module["_cellToChildren"] = asm["_cellToChildren"];
  var _cellToChildrenSize = Module["_cellToChildrenSize"] = asm["_cellToChildrenSize"];
  var _cellToLatLng = Module["_cellToLatLng"] = asm["_cellToLatLng"];
  var _cellToLocalIj = Module["_cellToLocalIj"] = asm["_cellToLocalIj"];
  var _cellToParent = Module["_cellToParent"] = asm["_cellToParent"];
  var _cellToVertex = Module["_cellToVertex"] = asm["_cellToVertex"];
  var _cellToVertexes = Module["_cellToVertexes"] = asm["_cellToVertexes"];
  var _cellsToDirectedEdge = Module["_cellsToDirectedEdge"] = asm["_cellsToDirectedEdge"];
  var _cellsToLinkedMultiPolygon = Module["_cellsToLinkedMultiPolygon"] = asm["_cellsToLinkedMultiPolygon"];
  var _childPosToCell = Module["_childPosToCell"] = asm["_childPosToCell"];
  var _compactCells = Module["_compactCells"] = asm["_compactCells"];
  var _destroyLinkedMultiPolygon = Module["_destroyLinkedMultiPolygon"] = asm["_destroyLinkedMultiPolygon"];
  var _directedEdgeToBoundary = Module["_directedEdgeToBoundary"] = asm["_directedEdgeToBoundary"];
  var _directedEdgeToCells = Module["_directedEdgeToCells"] = asm["_directedEdgeToCells"];
  var _edgeLengthKm = Module["_edgeLengthKm"] = asm["_edgeLengthKm"];
  var _edgeLengthM = Module["_edgeLengthM"] = asm["_edgeLengthM"];
  var _edgeLengthRads = Module["_edgeLengthRads"] = asm["_edgeLengthRads"];
  var _emscripten_replace_memory = Module["_emscripten_replace_memory"] = asm["_emscripten_replace_memory"];
  var _free = Module["_free"] = asm["_free"];
  var _getBaseCellNumber = Module["_getBaseCellNumber"] = asm["_getBaseCellNumber"];
  var _getDirectedEdgeDestination = Module["_getDirectedEdgeDestination"] = asm["_getDirectedEdgeDestination"];
  var _getDirectedEdgeOrigin = Module["_getDirectedEdgeOrigin"] = asm["_getDirectedEdgeOrigin"];
  var _getHexagonAreaAvgKm2 = Module["_getHexagonAreaAvgKm2"] = asm["_getHexagonAreaAvgKm2"];
  var _getHexagonAreaAvgM2 = Module["_getHexagonAreaAvgM2"] = asm["_getHexagonAreaAvgM2"];
  var _getHexagonEdgeLengthAvgKm = Module["_getHexagonEdgeLengthAvgKm"] = asm["_getHexagonEdgeLengthAvgKm"];
  var _getHexagonEdgeLengthAvgM = Module["_getHexagonEdgeLengthAvgM"] = asm["_getHexagonEdgeLengthAvgM"];
  var _getIcosahedronFaces = Module["_getIcosahedronFaces"] = asm["_getIcosahedronFaces"];
  var _getNumCells = Module["_getNumCells"] = asm["_getNumCells"];
  var _getPentagons = Module["_getPentagons"] = asm["_getPentagons"];
  var _getRes0Cells = Module["_getRes0Cells"] = asm["_getRes0Cells"];
  var _getResolution = Module["_getResolution"] = asm["_getResolution"];
  var _greatCircleDistanceKm = Module["_greatCircleDistanceKm"] = asm["_greatCircleDistanceKm"];
  var _greatCircleDistanceM = Module["_greatCircleDistanceM"] = asm["_greatCircleDistanceM"];
  var _greatCircleDistanceRads = Module["_greatCircleDistanceRads"] = asm["_greatCircleDistanceRads"];
  var _gridDisk = Module["_gridDisk"] = asm["_gridDisk"];
  var _gridDiskDistances = Module["_gridDiskDistances"] = asm["_gridDiskDistances"];
  var _gridDistance = Module["_gridDistance"] = asm["_gridDistance"];
  var _gridPathCells = Module["_gridPathCells"] = asm["_gridPathCells"];
  var _gridPathCellsSize = Module["_gridPathCellsSize"] = asm["_gridPathCellsSize"];
  var _gridRing = Module["_gridRing"] = asm["_gridRing"];
  var _gridRingUnsafe = Module["_gridRingUnsafe"] = asm["_gridRingUnsafe"];
  var _i64Add = Module["_i64Add"] = asm["_i64Add"];
  var _i64Subtract = Module["_i64Subtract"] = asm["_i64Subtract"];
  var _isPentagon = Module["_isPentagon"] = asm["_isPentagon"];
  var _isResClassIII = Module["_isResClassIII"] = asm["_isResClassIII"];
  var _isValidCell = Module["_isValidCell"] = asm["_isValidCell"];
  var _isValidDirectedEdge = Module["_isValidDirectedEdge"] = asm["_isValidDirectedEdge"];
  var _isValidVertex = Module["_isValidVertex"] = asm["_isValidVertex"];
  var _latLngToCell = Module["_latLngToCell"] = asm["_latLngToCell"];
  var _llvm_ctlz_i64 = Module["_llvm_ctlz_i64"] = asm["_llvm_ctlz_i64"];
  var _llvm_maxnum_f64 = Module["_llvm_maxnum_f64"] = asm["_llvm_maxnum_f64"];
  var _llvm_minnum_f64 = Module["_llvm_minnum_f64"] = asm["_llvm_minnum_f64"];
  var _llvm_round_f64 = Module["_llvm_round_f64"] = asm["_llvm_round_f64"];
  var _localIjToCell = Module["_localIjToCell"] = asm["_localIjToCell"];
  var _malloc = Module["_malloc"] = asm["_malloc"];
  var _maxFaceCount = Module["_maxFaceCount"] = asm["_maxFaceCount"];
  var _maxGridDiskSize = Module["_maxGridDiskSize"] = asm["_maxGridDiskSize"];
  var _maxPolygonToCellsSize = Module["_maxPolygonToCellsSize"] = asm["_maxPolygonToCellsSize"];
  var _maxPolygonToCellsSizeExperimental = Module["_maxPolygonToCellsSizeExperimental"] = asm["_maxPolygonToCellsSizeExperimental"];
  var _memcpy = Module["_memcpy"] = asm["_memcpy"];
  var _memset = Module["_memset"] = asm["_memset"];
  var _originToDirectedEdges = Module["_originToDirectedEdges"] = asm["_originToDirectedEdges"];
  var _pentagonCount = Module["_pentagonCount"] = asm["_pentagonCount"];
  var _polygonToCells = Module["_polygonToCells"] = asm["_polygonToCells"];
  var _polygonToCellsExperimental = Module["_polygonToCellsExperimental"] = asm["_polygonToCellsExperimental"];
  var _readInt64AsDoubleFromPointer = Module["_readInt64AsDoubleFromPointer"] = asm["_readInt64AsDoubleFromPointer"];
  var _res0CellCount = Module["_res0CellCount"] = asm["_res0CellCount"];
  var _round = Module["_round"] = asm["_round"];
  var _sbrk = Module["_sbrk"] = asm["_sbrk"];
  var _sizeOfCellBoundary = Module["_sizeOfCellBoundary"] = asm["_sizeOfCellBoundary"];
  var _sizeOfCoordIJ = Module["_sizeOfCoordIJ"] = asm["_sizeOfCoordIJ"];
  var _sizeOfGeoLoop = Module["_sizeOfGeoLoop"] = asm["_sizeOfGeoLoop"];
  var _sizeOfGeoPolygon = Module["_sizeOfGeoPolygon"] = asm["_sizeOfGeoPolygon"];
  var _sizeOfH3Index = Module["_sizeOfH3Index"] = asm["_sizeOfH3Index"];
  var _sizeOfLatLng = Module["_sizeOfLatLng"] = asm["_sizeOfLatLng"];
  var _sizeOfLinkedGeoPolygon = Module["_sizeOfLinkedGeoPolygon"] = asm["_sizeOfLinkedGeoPolygon"];
  var _uncompactCells = Module["_uncompactCells"] = asm["_uncompactCells"];
  var _uncompactCellsSize = Module["_uncompactCellsSize"] = asm["_uncompactCellsSize"];
  var _vertexToLatLng = Module["_vertexToLatLng"] = asm["_vertexToLatLng"];
  var establishStackSpace = Module["establishStackSpace"] = asm["establishStackSpace"];
  var stackAlloc = Module["stackAlloc"] = asm["stackAlloc"];
  var stackRestore = Module["stackRestore"] = asm["stackRestore"];
  var stackSave = Module["stackSave"] = asm["stackSave"];
  Module["asm"] = asm;
  Module["cwrap"] = cwrap;
  Module["setValue"] = setValue2;
  Module["getValue"] = getValue;
  if (memoryInitializer) {
    if (!isDataURI(memoryInitializer)) {
      memoryInitializer = locateFile(memoryInitializer);
    }
    {
      addRunDependency("memory initializer");
      var applyMemoryInitializer = function(data) {
        if (data.byteLength) {
          data = new Uint8Array(data);
        }
        HEAPU8.set(data, GLOBAL_BASE);
        if (Module["memoryInitializerRequest"]) {
          delete Module["memoryInitializerRequest"].response;
        }
        removeRunDependency("memory initializer");
      };
      var doBrowserLoad = function() {
        readAsync(memoryInitializer, applyMemoryInitializer, function() {
          throw "could not load memory initializer " + memoryInitializer;
        });
      };
      var memoryInitializerBytes = tryParseAsDataURI(memoryInitializer);
      if (memoryInitializerBytes) {
        applyMemoryInitializer(memoryInitializerBytes.buffer);
      } else if (Module["memoryInitializerRequest"]) {
        var useRequest = function() {
          var request = Module["memoryInitializerRequest"];
          var response = request.response;
          if (request.status !== 200 && request.status !== 0) {
            var data = tryParseAsDataURI(Module["memoryInitializerRequestURL"]);
            if (data) {
              response = data.buffer;
            } else {
              console.warn("a problem seems to have happened with Module.memoryInitializerRequest, status: " + request.status + ", retrying " + memoryInitializer);
              doBrowserLoad();
              return;
            }
          }
          applyMemoryInitializer(response);
        };
        if (Module["memoryInitializerRequest"].response) {
          setTimeout(useRequest, 0);
        } else {
          Module["memoryInitializerRequest"].addEventListener("load", useRequest);
        }
      } else {
        doBrowserLoad();
      }
    }
  }
  var calledRun;
  dependenciesFulfilled = function runCaller() {
    if (!calledRun) {
      run2();
    }
    if (!calledRun) {
      dependenciesFulfilled = runCaller;
    }
  };
  function run2(args) {
    args = args || arguments_;
    if (runDependencies > 0) {
      return;
    }
    preRun();
    if (runDependencies > 0) {
      return;
    }
    function doRun() {
      if (calledRun) {
        return;
      }
      calledRun = true;
      if (ABORT) {
        return;
      }
      initRuntime();
      preMain();
      if (Module["onRuntimeInitialized"]) {
        Module["onRuntimeInitialized"]();
      }
      postRun();
    }
    if (Module["setStatus"]) {
      Module["setStatus"]("Running...");
      setTimeout(function() {
        setTimeout(function() {
          Module["setStatus"]("");
        }, 1);
        doRun();
      }, 1);
    } else {
      doRun();
    }
  }
  Module["run"] = run2;
  function abort(what) {
    if (Module["onAbort"]) {
      Module["onAbort"](what);
    }
    what += "";
    out(what);
    err(what);
    ABORT = true;
    throw "abort(" + what + "). Build with -s ASSERTIONS=1 for more info.";
  }
  Module["abort"] = abort;
  if (Module["preInit"]) {
    if (typeof Module["preInit"] == "function") {
      Module["preInit"] = [Module["preInit"]];
    }
    while (Module["preInit"].length > 0) {
      Module["preInit"].pop()();
    }
  }
  run2();
  return libh32;
}(typeof libh3 === "object" ? libh3 : {});
var NUMBER = "number";
var H3_ERROR = NUMBER;
var BOOLEAN = NUMBER;
var H3_LOWER = NUMBER;
var H3_UPPER = NUMBER;
var RESOLUTION = NUMBER;
var POINTER = NUMBER;
var BINDINGS = [
  ["sizeOfH3Index", NUMBER],
  ["sizeOfLatLng", NUMBER],
  ["sizeOfCellBoundary", NUMBER],
  ["sizeOfGeoLoop", NUMBER],
  ["sizeOfGeoPolygon", NUMBER],
  ["sizeOfLinkedGeoPolygon", NUMBER],
  ["sizeOfCoordIJ", NUMBER],
  ["readInt64AsDoubleFromPointer", NUMBER],
  ["isValidCell", BOOLEAN, [H3_LOWER, H3_UPPER]],
  ["latLngToCell", H3_ERROR, [NUMBER, NUMBER, RESOLUTION, POINTER]],
  ["cellToLatLng", H3_ERROR, [H3_LOWER, H3_UPPER, POINTER]],
  ["cellToBoundary", H3_ERROR, [H3_LOWER, H3_UPPER, POINTER]],
  ["maxGridDiskSize", H3_ERROR, [NUMBER, POINTER]],
  ["gridDisk", H3_ERROR, [H3_LOWER, H3_UPPER, NUMBER, POINTER]],
  ["gridDiskDistances", H3_ERROR, [H3_LOWER, H3_UPPER, NUMBER, POINTER, POINTER]],
  ["gridRing", H3_ERROR, [H3_LOWER, H3_UPPER, NUMBER, POINTER]],
  ["gridRingUnsafe", H3_ERROR, [H3_LOWER, H3_UPPER, NUMBER, POINTER]],
  ["maxPolygonToCellsSize", H3_ERROR, [POINTER, RESOLUTION, NUMBER, POINTER]],
  ["polygonToCells", H3_ERROR, [POINTER, RESOLUTION, NUMBER, POINTER]],
  ["maxPolygonToCellsSizeExperimental", H3_ERROR, [POINTER, RESOLUTION, NUMBER, POINTER]],
  ["polygonToCellsExperimental", H3_ERROR, [POINTER, RESOLUTION, NUMBER, NUMBER, NUMBER, POINTER]],
  ["cellsToLinkedMultiPolygon", H3_ERROR, [POINTER, NUMBER, POINTER]],
  ["destroyLinkedMultiPolygon", null, [POINTER]],
  ["compactCells", H3_ERROR, [POINTER, POINTER, NUMBER, NUMBER]],
  ["uncompactCells", H3_ERROR, [POINTER, NUMBER, NUMBER, POINTER, NUMBER, RESOLUTION]],
  ["uncompactCellsSize", H3_ERROR, [POINTER, NUMBER, NUMBER, RESOLUTION, POINTER]],
  ["isPentagon", BOOLEAN, [H3_LOWER, H3_UPPER]],
  ["isResClassIII", BOOLEAN, [H3_LOWER, H3_UPPER]],
  ["getBaseCellNumber", NUMBER, [H3_LOWER, H3_UPPER]],
  ["getResolution", NUMBER, [H3_LOWER, H3_UPPER]],
  ["maxFaceCount", H3_ERROR, [H3_LOWER, H3_UPPER, POINTER]],
  ["getIcosahedronFaces", H3_ERROR, [H3_LOWER, H3_UPPER, POINTER]],
  ["cellToParent", H3_ERROR, [H3_LOWER, H3_UPPER, RESOLUTION, POINTER]],
  ["cellToChildren", H3_ERROR, [H3_LOWER, H3_UPPER, RESOLUTION, POINTER]],
  ["cellToCenterChild", H3_ERROR, [H3_LOWER, H3_UPPER, RESOLUTION, POINTER]],
  ["cellToChildrenSize", H3_ERROR, [H3_LOWER, H3_UPPER, RESOLUTION, POINTER]],
  ["cellToChildPos", H3_ERROR, [H3_LOWER, H3_UPPER, RESOLUTION, POINTER]],
  ["childPosToCell", H3_ERROR, [NUMBER, NUMBER, H3_LOWER, H3_UPPER, RESOLUTION, POINTER]],
  ["areNeighborCells", H3_ERROR, [H3_LOWER, H3_UPPER, H3_LOWER, H3_UPPER, POINTER]],
  ["cellsToDirectedEdge", H3_ERROR, [H3_LOWER, H3_UPPER, H3_LOWER, H3_UPPER, POINTER]],
  ["getDirectedEdgeOrigin", H3_ERROR, [H3_LOWER, H3_UPPER, POINTER]],
  ["getDirectedEdgeDestination", H3_ERROR, [H3_LOWER, H3_UPPER, POINTER]],
  ["isValidDirectedEdge", BOOLEAN, [H3_LOWER, H3_UPPER]],
  ["directedEdgeToCells", H3_ERROR, [H3_LOWER, H3_UPPER, POINTER]],
  ["originToDirectedEdges", H3_ERROR, [H3_LOWER, H3_UPPER, POINTER]],
  ["directedEdgeToBoundary", H3_ERROR, [H3_LOWER, H3_UPPER, POINTER]],
  ["gridDistance", H3_ERROR, [H3_LOWER, H3_UPPER, H3_LOWER, H3_UPPER, POINTER]],
  ["gridPathCells", H3_ERROR, [H3_LOWER, H3_UPPER, H3_LOWER, H3_UPPER, POINTER]],
  ["gridPathCellsSize", H3_ERROR, [H3_LOWER, H3_UPPER, H3_LOWER, H3_UPPER, POINTER]],
  ["cellToLocalIj", H3_ERROR, [H3_LOWER, H3_UPPER, H3_LOWER, H3_UPPER, NUMBER, POINTER]],
  ["localIjToCell", H3_ERROR, [H3_LOWER, H3_UPPER, POINTER, NUMBER, POINTER]],
  ["getHexagonAreaAvgM2", H3_ERROR, [RESOLUTION, POINTER]],
  ["getHexagonAreaAvgKm2", H3_ERROR, [RESOLUTION, POINTER]],
  ["getHexagonEdgeLengthAvgM", H3_ERROR, [RESOLUTION, POINTER]],
  ["getHexagonEdgeLengthAvgKm", H3_ERROR, [RESOLUTION, POINTER]],
  ["greatCircleDistanceM", NUMBER, [POINTER, POINTER]],
  ["greatCircleDistanceKm", NUMBER, [POINTER, POINTER]],
  ["greatCircleDistanceRads", NUMBER, [POINTER, POINTER]],
  ["cellAreaM2", H3_ERROR, [H3_LOWER, H3_UPPER, POINTER]],
  ["cellAreaKm2", H3_ERROR, [H3_LOWER, H3_UPPER, POINTER]],
  ["cellAreaRads2", H3_ERROR, [H3_LOWER, H3_UPPER, POINTER]],
  ["edgeLengthM", H3_ERROR, [H3_LOWER, H3_UPPER, POINTER]],
  ["edgeLengthKm", H3_ERROR, [H3_LOWER, H3_UPPER, POINTER]],
  ["edgeLengthRads", H3_ERROR, [H3_LOWER, H3_UPPER, POINTER]],
  ["getNumCells", H3_ERROR, [RESOLUTION, POINTER]],
  ["getRes0Cells", H3_ERROR, [POINTER]],
  ["res0CellCount", NUMBER],
  ["getPentagons", H3_ERROR, [NUMBER, POINTER]],
  ["pentagonCount", NUMBER],
  ["cellToVertex", H3_ERROR, [H3_LOWER, H3_UPPER, NUMBER, POINTER]],
  ["cellToVertexes", H3_ERROR, [H3_LOWER, H3_UPPER, POINTER]],
  ["vertexToLatLng", H3_ERROR, [H3_LOWER, H3_UPPER, POINTER]],
  ["isValidVertex", BOOLEAN, [H3_LOWER, H3_UPPER]]
];
var E_SUCCESS = 0;
var E_FAILED = 1;
var E_DOMAIN = 2;
var E_LATLNG_DOMAIN = 3;
var E_RES_DOMAIN = 4;
var E_CELL_INVALID = 5;
var E_DIR_EDGE_INVALID = 6;
var E_UNDIR_EDGE_INVALID = 7;
var E_VERTEX_INVALID = 8;
var E_PENTAGON = 9;
var E_DUPLICATE_INPUT = 10;
var E_NOT_NEIGHBORS = 11;
var E_RES_MISMATCH = 12;
var E_MEMORY_ALLOC = 13;
var E_MEMORY_BOUNDS = 14;
var E_OPTION_INVALID = 15;
var H3_ERROR_MSGS = {};
H3_ERROR_MSGS[E_SUCCESS] = "Success";
H3_ERROR_MSGS[E_FAILED] = "The operation failed but a more specific error is not available";
H3_ERROR_MSGS[E_DOMAIN] = "Argument was outside of acceptable range";
H3_ERROR_MSGS[E_LATLNG_DOMAIN] = "Latitude or longitude arguments were outside of acceptable range";
H3_ERROR_MSGS[E_RES_DOMAIN] = "Resolution argument was outside of acceptable range";
H3_ERROR_MSGS[E_CELL_INVALID] = "Cell argument was not valid";
H3_ERROR_MSGS[E_DIR_EDGE_INVALID] = "Directed edge argument was not valid";
H3_ERROR_MSGS[E_UNDIR_EDGE_INVALID] = "Undirected edge argument was not valid";
H3_ERROR_MSGS[E_VERTEX_INVALID] = "Vertex argument was not valid";
H3_ERROR_MSGS[E_PENTAGON] = "Pentagon distortion was encountered";
H3_ERROR_MSGS[E_DUPLICATE_INPUT] = "Duplicate input";
H3_ERROR_MSGS[E_NOT_NEIGHBORS] = "Cell arguments were not neighbors";
H3_ERROR_MSGS[E_RES_MISMATCH] = "Cell arguments had incompatible resolutions";
H3_ERROR_MSGS[E_MEMORY_ALLOC] = "Memory allocation failed";
H3_ERROR_MSGS[E_MEMORY_BOUNDS] = "Bounds of provided memory were insufficient";
H3_ERROR_MSGS[E_OPTION_INVALID] = "Mode or flags argument was not valid";
var E_UNKNOWN_UNIT = 1000;
var E_ARRAY_LENGTH = 1001;
var E_NULL_INDEX = 1002;
var JS_ERROR_MESSAGES = {};
JS_ERROR_MESSAGES[E_UNKNOWN_UNIT] = "Unknown unit";
JS_ERROR_MESSAGES[E_ARRAY_LENGTH] = "Array length out of bounds";
JS_ERROR_MESSAGES[E_NULL_INDEX] = "Got unexpected null value for H3 index";
var UNKNOWN_ERROR_MSG = "Unknown error";
function createError(messages, errCode, meta2) {
  var hasValue = meta2 && "value" in meta2;
  var err = new Error((messages[errCode] || UNKNOWN_ERROR_MSG) + " (code: " + errCode + (hasValue ? ", value: " + meta2.value : "") + ")");
  err.code = errCode;
  return err;
}
function H3LibraryError(errCode, value3) {
  var meta2 = arguments.length === 2 ? {
    value: value3
  } : {};
  return createError(H3_ERROR_MSGS, errCode, meta2);
}
function JSBindingError(errCode, value3) {
  var meta2 = arguments.length === 2 ? {
    value: value3
  } : {};
  return createError(JS_ERROR_MESSAGES, errCode, meta2);
}
function throwIfError(errCode) {
  if (errCode !== 0) {
    throw H3LibraryError(errCode);
  }
}
var H3 = {};
BINDINGS.forEach(function bind(def) {
  H3[def[0]] = libh3.cwrap.apply(libh3, def);
});
var BASE_16 = 16;
var SZ_INT = 4;
var SZ_DBL = 8;
var SZ_H3INDEX = H3.sizeOfH3Index();
var SZ_LATLNG = H3.sizeOfLatLng();
var SZ_CELLBOUNDARY = H3.sizeOfCellBoundary();
var SZ_GEOPOLYGON = H3.sizeOfGeoPolygon();
var SZ_GEOLOOP = H3.sizeOfGeoLoop();
var SZ_LINKED_GEOPOLYGON = H3.sizeOfLinkedGeoPolygon();
var SZ_COORDIJ = H3.sizeOfCoordIJ();
function validateH3Index(h3Index) {
  if (!h3Index) {
    throw JSBindingError(E_NULL_INDEX);
  }
  return h3Index;
}
var MAX_JS_ARRAY_LENGTH = Math.pow(2, 32) - 1;
function hexFrom32Bit(num) {
  if (num >= 0) {
    return num.toString(BASE_16);
  }
  num = num & 2147483647;
  var tempStr = zeroPad(8, num.toString(BASE_16));
  var topNum = (parseInt(tempStr[0], BASE_16) + 8).toString(BASE_16);
  tempStr = topNum + tempStr.substring(1);
  return tempStr;
}
function splitLongToH3Index(lower, upper) {
  return hexFrom32Bit(upper) + zeroPad(8, hexFrom32Bit(lower));
}
function zeroPad(fullLen, numStr) {
  var numZeroes = fullLen - numStr.length;
  var outStr = "";
  for (var i = 0;i < numZeroes; i++) {
    outStr += "0";
  }
  outStr = outStr + numStr;
  return outStr;
}
var UPPER_BIT_DIVISOR = Math.pow(2, 32);
function readH3IndexFromPointer(cAddress, offset) {
  if (offset === undefined)
    offset = 0;
  var lower = libh3.getValue(cAddress + SZ_H3INDEX * offset, "i32");
  var upper = libh3.getValue(cAddress + SZ_H3INDEX * offset + SZ_INT, "i32");
  return upper ? splitLongToH3Index(lower, upper) : null;
}
function latLngToCell(lat, lng, res) {
  var latLng = libh3._malloc(SZ_LATLNG);
  libh3.HEAPF64.set([lat, lng].map(degsToRads), latLng / SZ_DBL);
  var h3Index = libh3._malloc(SZ_H3INDEX);
  try {
    throwIfError(H3.latLngToCell(latLng, res, h3Index));
    return validateH3Index(readH3IndexFromPointer(h3Index));
  } finally {
    libh3._free(h3Index);
    libh3._free(latLng);
  }
}
function degsToRads(deg) {
  return deg * Math.PI / 180;
}

// build/dev/javascript/client/client_ffi.mjs
function toList2(array3) {
  let list4 = new Empty;
  for (let i = array3.length - 1;i >= 0; i--) {
    list4 = new NonEmpty(array3[i], list4);
  }
  return list4;
}
function fetchUrl(url) {
  return fetch(url).then((response) => {
    return response.text().then((text4) => {
      return new Ok([response.status, text4]);
    });
  }).catch((error) => {
    return new Error2(error.message || "Network error");
  });
}
function postJson(url, jsonString) {
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: jsonString
  }).then((response) => {
    return response.text().then((text4) => {
      return new Ok([response.status, text4]);
    });
  }).catch((error) => {
    return new Error2(error.message || "Network error");
  });
}
function searchLocations(query) {
  if (!query || query.trim().length < 2) {
    return Promise.resolve(new Ok(toList2([])));
  }
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "json");
  url.searchParams.set("q", query.trim());
  url.searchParams.set("limit", "5");
  url.searchParams.set("addressdetails", "1");
  return fetch(url.toString(), {
    headers: {
      "User-Agent": "lustre-fullstack-app/1.0"
    }
  }).then((response) => {
    if (!response.ok) {
      throw new Error2(`Nominatim API error: ${response.statusText}`);
    }
    return response.json();
  }).then((results) => {
    return new Ok(toList2(results));
  }).catch((error) => {
    console.error("Error fetching locations from Nominatim:", error);
    return new Error2(error.message || "Failed to fetch locations");
  });
}
function latLonToH3(lat, lon, resolution = 5) {
  return latLngToCell(lat, lon, resolution);
}
async function processFileFromInputId(inputId) {
  console.log("processFileFromInputId called for:", inputId);
  const inputElement = document.getElementById(inputId);
  if (!inputElement) {
    console.error("Input element not found:", inputId);
    return new Error2("Input element not found");
  }
  const file = inputElement.files?.[0];
  if (!file) {
    console.log("No file selected");
    return new Error2("No file selected");
  }
  if (!file.type.startsWith("image/")) {
    console.log("File is not an image:", file.type);
    return new Error2("File is not an image");
  }
  try {
    const previewUrl = URL.createObjectURL(file);
    console.log("Created preview URL:", previewUrl);
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const binary = Array.from(bytes).map((b) => String.fromCharCode(b)).join("");
    const base64Data = btoa(binary);
    console.log("Converted to base64, length:", base64Data.length);
    return new Ok({
      preview_url: previewUrl,
      base64_data: base64Data,
      mime_type: file.type
    });
  } catch (error) {
    console.error("Failed to process file:", error);
    return new Error2(error.message || "Failed to process file");
  }
}

// build/dev/javascript/client/pages/home.mjs
function view2() {
  return div(toList([class$("space-y-8")]), toList([
    div(toList([]), toList([
      h2(toList([class$("text-2xl font-bold text-white mb-4")]), toList([text3("Welcome to Atmosphere Conf")]))
    ]))
  ]));
}

// build/dev/javascript/client/ui/button.mjs
class Default extends CustomType {
}
class Primary extends CustomType {
}
class Link extends CustomType {
}
class Sm extends CustomType {
}
class Md extends CustomType {
}
function button2(attributes, variant, size2, children) {
  let _block;
  if (size2 instanceof Sm) {
    _block = "px-3 py-1.5 text-xs";
  } else if (size2 instanceof Md) {
    _block = "px-4 py-2 text-sm";
  } else {
    _block = "px-6 py-3 text-base";
  }
  let size_classes = _block;
  let _block$1;
  if (variant instanceof Default) {
    _block$1 = "text-zinc-400 border border-zinc-800 hover:border-zinc-700 hover:text-zinc-300 rounded";
  } else if (variant instanceof Primary) {
    _block$1 = "text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded";
  } else if (variant instanceof Link) {
    _block$1 = "text-zinc-500 hover:text-zinc-300 px-2 py-1";
  } else {
    _block$1 = "bg-red-900 text-red-100 border border-red-800 hover:bg-red-800 hover:border-red-700 rounded";
  }
  let variant_classes = _block$1;
  let base_classes = size_classes + " " + variant_classes + " transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";
  return button(prepend(class$(base_classes), attributes), children);
}

// build/dev/javascript/client/ui/input.mjs
function input2(attributes) {
  let classes = "w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded text-sm text-zinc-300 focus:outline-none focus:border-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed";
  return input(prepend(class$(classes), attributes));
}

// build/dev/javascript/client/pages/login.mjs
function view3() {
  return div(toList([class$("flex items-center justify-center min-h-[60vh]")]), toList([
    div(toList([class$("w-full max-w-[300px] space-y-4")]), toList([
      form(toList([
        method("POST"),
        action("/oauth/authorize"),
        class$("space-y-4")
      ]), toList([
        div(toList([]), toList([
          label(toList([
            for$("loginHint"),
            class$("block text-sm font-medium text-zinc-400 mb-2")
          ]), toList([text3("Handle or PDS Host")])),
          input2(toList([
            id("loginHint"),
            name("loginHint"),
            type_("text"),
            placeholder("user.bsky.social"),
            attribute2("required", "true")
          ]))
        ])),
        button2(toList([
          type_("submit"),
          class$("w-full justify-center")
        ]), new Primary, new Md, toList([text3("Sign In")]))
      ])),
      div(toList([class$("text-xs text-zinc-500")]), toList([
        p(toList([]), toList([
          text3("Examples: user.bsky.social, pds.example.com")
        ])),
        p(toList([class$("mt-2")]), toList([
          text3("Don't have an account? "),
          a(toList([
            href("https://bsky.app"),
            target("_blank"),
            attribute2("rel", "noopener noreferrer"),
            class$("text-zinc-400 hover:text-zinc-300 underline")
          ]), toList([text3("Create one on Bluesky")]))
        ]))
      ]))
    ]))
  ]));
}

// build/dev/javascript/client/ui/avatar.mjs
class Sm2 extends CustomType {
}
class Md2 extends CustomType {
}
class Lg extends CustomType {
}
class Xl extends CustomType {
}
function avatar(src2, alt2, size2) {
  let _block;
  if (size2 instanceof Sm2) {
    _block = "w-8 h-8";
  } else if (size2 instanceof Md2) {
    _block = "w-12 h-12";
  } else if (size2 instanceof Lg) {
    _block = "w-16 h-16";
  } else {
    _block = "w-24 h-24";
  }
  let size_classes = _block;
  let base_classes = size_classes + " rounded-full border-2 border-zinc-700 bg-zinc-800";
  if (src2 instanceof Some) {
    let url = src2[0];
    return img(toList([
      src(url),
      alt(alt2),
      class$(base_classes + " object-cover")
    ]));
  } else {
    let _block$1;
    let _pipe = alt2;
    let _pipe$1 = split2(_pipe, " ");
    let _pipe$2 = filter_map(_pipe$1, (word) => {
      let $ = first(word);
      if ($ instanceof Ok) {
        let char = $[0];
        return new Ok(uppercase(char));
      } else {
        return new Error2(undefined);
      }
    });
    let _pipe$3 = take(_pipe$2, 2);
    _block$1 = join(_pipe$3, "");
    let initials = _block$1;
    let _block$2;
    if (initials === "") {
      _block$2 = "?";
    } else {
      _block$2 = initials;
    }
    let display_text = _block$2;
    return div(toList([
      class$(base_classes + " flex items-center justify-center text-zinc-400 font-semibold")
    ]), toList([text3(display_text)]));
  }
}

// build/dev/javascript/client/pages/profile.mjs
function view4(p2, current_user_handle) {
  return div(toList([class$("space-y-8")]), toList([
    div(toList([class$("flex items-start gap-6")]), toList([
      avatar(p2.avatar_url, unwrap(p2.display_name, p2.did), new Xl),
      div(toList([class$("flex-1 space-y-2")]), toList([
        h2(toList([class$("text-3xl font-bold text-white")]), toList([text3(unwrap(p2.display_name, p2.did))])),
        (() => {
          let $ = p2.handle;
          if ($ instanceof Some) {
            let handle2 = $[0];
            return p(toList([class$("text-zinc-300 text-base")]), toList([text3("@" + handle2)]));
          } else {
            return div(toList([]), toList([]));
          }
        })(),
        p(toList([class$("text-zinc-500 text-sm font-mono")]), toList([text3(p2.did)])),
        (() => {
          let $ = p2.home_town;
          if ($ instanceof Some) {
            let town = $[0];
            return p(toList([class$("text-zinc-400 text-sm")]), toList([text3("\uD83D\uDCCD " + town.name)]));
          } else {
            return div(toList([]), toList([]));
          }
        })()
      ])),
      (() => {
        let $ = p2.handle;
        if ($ instanceof Some && current_user_handle instanceof Some) {
          let profile_handle = $[0];
          let user_handle = current_user_handle[0];
          if (profile_handle === user_handle) {
            return a(toList([
              href("/profile/" + profile_handle + "/edit"),
              class$("px-4 py-2 text-sm text-zinc-400 border border-zinc-800 hover:border-zinc-700 hover:text-zinc-300 rounded transition-colors cursor-pointer")
            ]), toList([text3("Edit Profile")]));
          } else {
            return none2();
          }
        } else {
          return none2();
        }
      })()
    ])),
    div(toList([class$("space-y-6 pt-6 border-t border-zinc-800")]), toList([
      (() => {
        let $ = p2.description;
        if ($ instanceof Some) {
          let desc = $[0];
          return div(toList([class$("space-y-3")]), toList([
            h3(toList([
              class$("text-lg font-semibold text-white")
            ]), toList([text3("About")])),
            p(toList([class$("text-zinc-400")]), toList([text3(desc)]))
          ]));
        } else {
          return div(toList([]), toList([]));
        }
      })(),
      (() => {
        let $ = p2.interests;
        if ($ instanceof Some) {
          let interests = $[0];
          if (interests instanceof Empty) {
            return div(toList([]), toList([]));
          } else {
            return div(toList([class$("space-y-3")]), toList([
              h3(toList([
                class$("text-lg font-semibold text-white")
              ]), toList([text3("Interests")])),
              div(toList([class$("flex flex-wrap gap-2")]), map(interests, (interest) => {
                return span(toList([
                  class$("px-3 py-1 bg-zinc-800 text-zinc-300 rounded-full text-sm")
                ]), toList([text3(interest)]));
              }))
            ]));
          }
        } else {
          return div(toList([]), toList([]));
        }
      })()
    ]))
  ]));
}

// build/dev/javascript/lustre/lustre/event.mjs
function is_immediate_event(name2) {
  if (name2 === "input") {
    return true;
  } else if (name2 === "change") {
    return true;
  } else if (name2 === "focus") {
    return true;
  } else if (name2 === "focusin") {
    return true;
  } else if (name2 === "focusout") {
    return true;
  } else if (name2 === "blur") {
    return true;
  } else if (name2 === "select") {
    return true;
  } else {
    return false;
  }
}
function on(name2, handler) {
  return event(name2, map2(handler, (msg) => {
    return new Handler(false, false, msg);
  }), empty_list, never, never, is_immediate_event(name2), 0, 0);
}
function prevent_default(event4) {
  if (event4 instanceof Event2) {
    return new Event2(event4.kind, event4.name, event4.handler, event4.include, always, event4.stop_propagation, event4.immediate, event4.debounce, event4.throttle);
  } else {
    return event4;
  }
}
function debounce(event4, delay) {
  if (event4 instanceof Event2) {
    return new Event2(event4.kind, event4.name, event4.handler, event4.include, event4.prevent_default, event4.stop_propagation, event4.immediate, max(0, delay), event4.throttle);
  } else {
    return event4;
  }
}
function on_click(msg) {
  return on("click", success(msg));
}
function on_input(msg) {
  return on("input", subfield(toList(["target", "value"]), string2, (value3) => {
    return success(msg(value3));
  }));
}
function formdata_decoder() {
  let string_value_decoder = field(0, string2, (key2) => {
    return field(1, one_of(map2(string2, (var0) => {
      return new Ok(var0);
    }), toList([success(new Error2(undefined))])), (value3) => {
      let _pipe2 = value3;
      let _pipe$12 = map4(_pipe2, (_capture) => {
        return new$7(key2, _capture);
      });
      return success(_pipe$12);
    });
  });
  let _pipe = string_value_decoder;
  let _pipe$1 = list2(_pipe);
  return map2(_pipe$1, values2);
}
function on_submit(msg) {
  let _pipe = on("submit", subfield(toList(["detail", "formData"]), formdata_decoder(), (formdata) => {
    let _pipe2 = formdata;
    let _pipe$1 = msg(_pipe2);
    return success(_pipe$1);
  }));
  return prevent_default(_pipe);
}
function on_focus(msg) {
  return on("focus", success(msg));
}
function on_blur(msg) {
  return on("blur", success(msg));
}

// build/dev/javascript/client/utils/location.mjs
class NominatimResult extends CustomType {
  constructor(display_name, lat, lon, place_id, address) {
    super();
    this.display_name = display_name;
    this.lat = lat;
    this.lon = lon;
    this.place_id = place_id;
    this.address = address;
  }
}
class NominatimAddress extends CustomType {
  constructor(city, state, country) {
    super();
    this.city = city;
    this.state = state;
    this.country = country;
  }
}
class LocationData extends CustomType {
  constructor(name2, lat, lon, h3_index) {
    super();
    this.name = name2;
    this.lat = lat;
    this.lon = lon;
    this.h3_index = h3_index;
  }
}
function nominatim_address_decoder() {
  return field("city", optional(string2), (city) => {
    return field("state", optional(string2), (state) => {
      return field("country", optional(string2), (country) => {
        return success(new NominatimAddress(unwrap(city, ""), unwrap(state, ""), unwrap(country, "")));
      });
    });
  });
}
function nominatim_result_decoder() {
  return field("display_name", string2, (display_name) => {
    return field("lat", string2, (lat) => {
      return field("lon", string2, (lon) => {
        return field("place_id", int2, (place_id) => {
          return field("address", nominatim_address_decoder(), (address) => {
            return success(new NominatimResult(display_name, lat, lon, place_id, address));
          });
        });
      });
    });
  });
}

// build/dev/javascript/client/ui/location_input.mjs
class Model extends CustomType {
  constructor(input_value, selected_location, suggestions, is_loading, show_dropdown) {
    super();
    this.input_value = input_value;
    this.selected_location = selected_location;
    this.suggestions = suggestions;
    this.is_loading = is_loading;
    this.show_dropdown = show_dropdown;
  }
}
class UserTypedQuery extends CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}
class UserClickedSuggestion extends CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}
class UserFocusedInput extends CustomType {
}
class UserBlurredInput extends CustomType {
}
class GotSearchResults extends CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}
function init2(initial_value) {
  return new Model((() => {
    if (initial_value instanceof Some) {
      let loc = initial_value[0];
      return loc.name;
    } else {
      return "";
    }
  })(), initial_value, toList([]), false, false);
}
function search_effect(query) {
  return from((dispatch) => {
    let _pipe = searchLocations(query);
    let _pipe$1 = map_promise(_pipe, (result) => {
      if (result instanceof Ok) {
        let dynamic_list = result[0];
        let decoded_results = filter_map(dynamic_list, (dyn) => {
          return run(dyn, nominatim_result_decoder());
        });
        return dispatch(new GotSearchResults(new Ok(decoded_results)));
      } else {
        let err = result[0];
        return dispatch(new GotSearchResults(new Error2(err)));
      }
    });
    then_await(_pipe$1, (_) => {
      return resolve(undefined);
    });
    return;
  });
}
function format_location_name(result) {
  let parts = toList([]);
  let _block;
  let $ = result.address.city;
  if ($ === "") {
    _block = parts;
  } else {
    let city = $;
    _block = append(parts, toList([city]));
  }
  let parts$1 = _block;
  let _block$1;
  let $1 = result.address.state;
  if ($1 === "") {
    _block$1 = parts$1;
  } else {
    let state = $1;
    _block$1 = append(parts$1, toList([state]));
  }
  let parts$2 = _block$1;
  let _block$2;
  let $2 = result.address.country;
  if ($2 === "") {
    _block$2 = parts$2;
  } else {
    let country = $2;
    _block$2 = append(parts$2, toList([country]));
  }
  let parts$3 = _block$2;
  if (parts$3 instanceof Empty) {
    return result.display_name;
  } else {
    return join(parts$3, ", ");
  }
}
function update2(model, msg) {
  if (msg instanceof UserTypedQuery) {
    let query = msg[0];
    let model$1 = new Model(query, model.selected_location, model.suggestions, model.is_loading, model.show_dropdown);
    let $ = string_length(query) >= 2;
    if ($) {
      let model$2 = new Model(model$1.input_value, model$1.selected_location, model$1.suggestions, true, true);
      return [model$2, search_effect(query)];
    } else {
      return [
        new Model(model$1.input_value, new None, toList([]), model$1.is_loading, false),
        none()
      ];
    }
  } else if (msg instanceof UserClickedSuggestion) {
    let result = msg[0];
    let _block;
    let $ = parse_float(result.lat);
    if ($ instanceof Ok) {
      let v = $[0];
      _block = v;
    } else {
      _block = 0;
    }
    let lat = _block;
    let _block$1;
    let $1 = parse_float(result.lon);
    if ($1 instanceof Ok) {
      let v = $1[0];
      _block$1 = v;
    } else {
      _block$1 = 0;
    }
    let lon = _block$1;
    let h3_index = latLonToH3(lat, lon);
    let formatted_name = format_location_name(result);
    let location_data = new LocationData(formatted_name, lat, lon, h3_index);
    return [
      new Model(formatted_name, new Some(location_data), toList([]), model.is_loading, false),
      none()
    ];
  } else if (msg instanceof UserFocusedInput) {
    let $ = string_length(model.input_value) >= 2;
    if ($) {
      let model$1 = new Model(model.input_value, model.selected_location, model.suggestions, true, true);
      return [model$1, search_effect(model$1.input_value)];
    } else {
      return [model, none()];
    }
  } else if (msg instanceof UserBlurredInput) {
    return [
      new Model(model.input_value, model.selected_location, model.suggestions, model.is_loading, false),
      none()
    ];
  } else {
    let result = msg[0];
    if (result instanceof Ok) {
      let results = result[0];
      return [
        new Model(model.input_value, model.selected_location, results, false, !isEqual(results, toList([]))),
        none()
      ];
    } else {
      return [
        new Model(model.input_value, model.selected_location, toList([]), false, model.show_dropdown),
        none()
      ];
    }
  }
}
function input_element(value3, placeholder2, _) {
  return input(toList([
    type_("text"),
    value(value3),
    placeholder(placeholder2),
    class$("w-full px-3 py-2 pr-10 bg-zinc-900 border border-zinc-800 rounded text-sm text-zinc-300 focus:outline-none focus:border-zinc-700"),
    (() => {
      let _pipe = on_input((var0) => {
        return new UserTypedQuery(var0);
      });
      return debounce(_pipe, 300);
    })(),
    on_focus(new UserFocusedInput),
    on_blur(new UserBlurredInput)
  ]));
}
function icon_element() {
  return div(toList([
    class$("absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500")
  ]), toList([text3("\uD83D\uDCCD")]));
}
function suggestion_item(result) {
  return button(toList([
    type_("button"),
    class$("w-full px-4 py-3 text-left hover:bg-zinc-800 transition-colors border-b border-zinc-800 last:border-b-0"),
    on_click(new UserClickedSuggestion(result))
  ]), toList([
    div(toList([class$("flex items-center gap-2")]), toList([
      div(toList([class$("text-zinc-500 flex-shrink-0")]), toList([text3("\uD83D\uDCCD")])),
      div(toList([class$("text-sm text-zinc-300")]), toList([text3(format_location_name(result))]))
    ]))
  ]));
}
function dropdown_element(show, suggestions) {
  let $ = show && !isEqual(suggestions, toList([]));
  if ($) {
    return div(toList([
      class$("absolute z-50 w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-lg shadow-lg max-h-60 overflow-y-auto"),
      attribute2("onmousedown", "event.preventDefault()")
    ]), map(suggestions, suggestion_item));
  } else {
    return none2();
  }
}
function view5(model, placeholder2) {
  return div(toList([class$("relative")]), toList([
    div(toList([class$("relative")]), toList([
      input_element(model.input_value, placeholder2, model.is_loading),
      icon_element()
    ])),
    dropdown_element(model.show_dropdown, model.suggestions)
  ]));
}

// build/dev/javascript/client/ui/textarea.mjs
function textarea2(attributes, value3) {
  let classes = "w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded text-sm text-zinc-300 focus:outline-none focus:border-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed resize-y min-h-[100px]";
  return textarea(prepend(class$(classes), attributes), value3);
}

// build/dev/javascript/client/pages/profile_edit.mjs
class DisplayNameUpdated extends CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}
class DescriptionUpdated extends CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}
class InterestsUpdated extends CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}
class AvatarFileChanged extends CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}
class AvatarFileProcessed extends CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}
class LocationInputMsg extends CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}
class FormSubmitted extends CustomType {
}
class SaveCompleted extends CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}
class CancelClicked extends CustomType {
}
class FormData2 extends CustomType {
  constructor(display_name, description, location_input, interests, avatar_preview_url, avatar_file_data, success_message, error_message, is_saving) {
    super();
    this.display_name = display_name;
    this.description = description;
    this.location_input = location_input;
    this.interests = interests;
    this.avatar_preview_url = avatar_preview_url;
    this.avatar_file_data = avatar_file_data;
    this.success_message = success_message;
    this.error_message = error_message;
    this.is_saving = is_saving;
  }
}
function init_form_data(profile) {
  if (profile instanceof Some) {
    let p2 = profile[0];
    let _block;
    let $ = p2.interests;
    if ($ instanceof Some) {
      let list4 = $[0];
      _block = join(list4, ", ");
    } else {
      _block = "";
    }
    let interests_str = _block;
    let _block$1;
    let $1 = p2.home_town;
    if ($1 instanceof Some) {
      let town = $1[0];
      _block$1 = new Some(new LocationData(town.name, 0, 0, town.h3_index));
    } else {
      _block$1 = $1;
    }
    let location_data = _block$1;
    return new FormData2(unwrap(p2.display_name, ""), unwrap(p2.description, ""), init2(location_data), interests_str, p2.avatar_url, new None, new None, new None, false);
  } else {
    return new FormData2("", "", init2(new None), "", new None, new None, new None, new None, false);
  }
}
function view6(profile, form_data, handle2, on_msg) {
  return div(toList([class$("space-y-8")]), toList([
    div(toList([class$("border-b border-zinc-800 pb-6")]), toList([
      button(toList([
        class$("inline-flex items-center gap-2 text-zinc-400 hover:text-zinc-200 transition-colors mb-4"),
        on_click(on_msg(new CancelClicked))
      ]), toList([text3("← Back to Profile")])),
      h2(toList([class$("text-3xl font-bold text-white mb-2")]), toList([text3("Profile Settings")])),
      p(toList([class$("text-zinc-500 text-sm")]), toList([text3("@" + handle2)]))
    ])),
    (() => {
      let $ = form_data.success_message;
      if ($ instanceof Some) {
        let msg = $[0];
        return div(toList([
          class$("p-4 bg-green-900/20 border border-green-800 rounded-lg text-green-300 text-sm")
        ]), toList([text3(msg)]));
      } else {
        return none2();
      }
    })(),
    (() => {
      let $ = form_data.error_message;
      if ($ instanceof Some) {
        let msg = $[0];
        return div(toList([
          class$("p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-300 text-sm")
        ]), toList([text3(msg)]));
      } else {
        return none2();
      }
    })(),
    form(toList([
      class$("space-y-6"),
      on_submit((_) => {
        return on_msg(new FormSubmitted);
      })
    ]), toList([
      div(toList([
        class$("bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-6")
      ]), toList([
        div(toList([class$("space-y-2")]), toList([
          label(toList([class$("text-sm font-medium text-white")]), toList([text3("Avatar")])),
          div(toList([class$("flex items-center gap-4")]), toList([
            avatar(form_data.avatar_preview_url, unwrap((() => {
              let _pipe = profile;
              return then$(_pipe, (p2) => {
                return p2.display_name;
              });
            })(), handle2), new Lg),
            label(toList([
              attribute2("for", "avatar-upload"),
              class$("cursor-pointer px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-sm transition-colors")
            ]), toList([text3("Change Avatar")])),
            input(toList([
              type_("file"),
              id("avatar-upload"),
              accept(toList(["image/*"])),
              class$("hidden"),
              on("change", map2(dynamic, (_) => {
                return on_msg(new AvatarFileChanged(toList([])));
              }))
            ]))
          ]))
        ])),
        div(toList([class$("space-y-2")]), toList([
          label(toList([class$("text-sm font-medium text-white")]), toList([text3("Display Name")])),
          input2(toList([
            type_("text"),
            placeholder("Your display name"),
            value(form_data.display_name),
            on_input((value3) => {
              return on_msg(new DisplayNameUpdated(value3));
            })
          ]))
        ])),
        div(toList([class$("space-y-2")]), toList([
          label(toList([class$("text-sm font-medium text-white")]), toList([text3("Description")])),
          textarea2(toList([
            placeholder("Tell us about yourself..."),
            on_input((value3) => {
              return on_msg(new DescriptionUpdated(value3));
            })
          ]), form_data.description)
        ])),
        div(toList([class$("space-y-2")]), toList([
          label(toList([class$("text-sm font-medium text-white")]), toList([text3("Home Town")])),
          (() => {
            let _pipe = view5(form_data.location_input, "Search for your hometown...");
            return map6(_pipe, (msg) => {
              return on_msg(new LocationInputMsg(msg));
            });
          })()
        ])),
        div(toList([class$("space-y-2")]), toList([
          label(toList([class$("text-sm font-medium text-white")]), toList([text3("Interests")])),
          p(toList([class$("text-xs text-zinc-400")]), toList([
            text3("Enter your interests, separated by commas")
          ])),
          input2(toList([
            type_("text"),
            placeholder("e.g., web development, photography, hiking"),
            value(form_data.interests),
            on_input((value3) => {
              return on_msg(new InterestsUpdated(value3));
            })
          ]))
        ]))
      ])),
      div(toList([class$("flex justify-end gap-3")]), toList([
        button2(toList([
          type_("button"),
          on_click(on_msg(new CancelClicked))
        ]), new Default, new Md, toList([text3("Cancel")])),
        button2(toList([
          type_("submit"),
          disabled(form_data.is_saving)
        ]), new Primary, new Md, toList([
          text3((() => {
            let $ = form_data.is_saving;
            if ($) {
              return "Saving...";
            } else {
              return "Save Changes";
            }
          })())
        ]))
      ]))
    ]))
  ]));
}

// build/dev/javascript/client/ui/layout.mjs
class User extends CustomType {
  constructor(name2, handle2) {
    super();
    this.name = name2;
    this.handle = handle2;
  }
}
function view_nav(user) {
  if (user instanceof Some) {
    let u = user[0];
    let _block;
    let $ = u.name;
    if ($ instanceof Some) {
      let name2 = $[0];
      _block = name2;
    } else {
      _block = "@" + u.handle;
    }
    let display_name = _block;
    return div(toList([class$("flex gap-4 items-center")]), toList([
      a(toList([
        href("/profile/" + u.handle),
        class$("px-2 py-1 text-zinc-400 hover:text-zinc-200 transition-colors")
      ]), toList([text3(display_name)])),
      form(toList([
        action("/logout"),
        method("post"),
        class$("inline")
      ]), toList([
        button(toList([
          type_("submit"),
          class$("px-2 py-1 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer")
        ]), toList([text3("Sign Out")]))
      ]))
    ]));
  } else {
    return a(toList([
      href("/login"),
      class$("px-2 py-1 text-zinc-500 hover:text-zinc-300 transition-colors")
    ]), toList([text3("Sign In")]));
  }
}
function layout(user, children) {
  return div(toList([
    class$("min-h-screen bg-zinc-950 text-zinc-300 font-mono")
  ]), toList([
    div(toList([class$("max-w-4xl mx-auto px-6 py-12")]), toList([
      div(toList([class$("border-b border-zinc-800 pb-4")]), toList([
        div(toList([class$("flex items-end justify-between")]), toList([
          a(toList([
            href("/"),
            class$("flex items-center gap-3 hover:opacity-80 transition-opacity")
          ]), toList([
            div(toList([]), toList([
              h1(toList([
                class$("text-2xl font-bold text-white")
              ]), toList([text3("atmosphere conf")]))
            ]))
          ])),
          div(toList([
            class$("flex gap-4 text-xs items-center")
          ]), toList([view_nav(user)]))
        ]))
      ])),
      div(toList([class$("mb-8")]), toList([])),
      div(toList([]), children)
    ]))
  ]));
}

// build/dev/javascript/client/client.mjs
var FILEPATH = "src/client.gleam";

class Home extends CustomType {
}
class Login extends CustomType {
}
class Profile2 extends CustomType {
  constructor(handle2) {
    super();
    this.handle = handle2;
  }
}
class ProfileEdit extends CustomType {
  constructor(handle2) {
    super();
    this.handle = handle2;
  }
}
class NotFound extends CustomType {
  constructor(uri) {
    super();
    this.uri = uri;
  }
}
class NotAsked extends CustomType {
}
class Loading extends CustomType {
}
class Loaded extends CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}
class Failed extends CustomType {
  constructor(error) {
    super();
    this.error = error;
  }
}
class Model2 extends CustomType {
  constructor(route, profile_state, edit_form_data, current_user) {
    super();
    this.route = route;
    this.profile_state = profile_state;
    this.edit_form_data = edit_form_data;
    this.current_user = current_user;
  }
}

class UserNavigatedTo extends CustomType {
  constructor(route) {
    super();
    this.route = route;
  }
}

class ProfileFetched extends CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}

class ProfileEditMsg extends CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}

class CurrentUserFetched extends CustomType {
  constructor($0) {
    super();
    this[0] = $0;
  }
}
function read_embedded_profile_data() {
  let _pipe = querySelector("#model");
  let _pipe$1 = map4(_pipe, innerText);
  let _pipe$2 = try$(_pipe$1, (json_string) => {
    let _pipe$22 = parse(json_string, at(toList(["profile"]), profile_decoder()));
    return replace_error(_pipe$22, undefined);
  });
  return from_result(_pipe$2);
}
function read_embedded_user_data() {
  let _pipe = querySelector("#model");
  let _pipe$1 = map4(_pipe, innerText);
  let _pipe$2 = try$(_pipe$1, (json_string) => {
    let _pipe$22 = parse(json_string, at(toList(["user"]), field("handle", string2, (handle2) => {
      return success(new User(new None, handle2));
    })));
    return replace_error(_pipe$22, undefined);
  });
  return from_result(_pipe$2);
}
function parse_route(uri) {
  let $ = path_segments(uri.path);
  if ($ instanceof Empty) {
    return new Home;
  } else {
    let $1 = $.tail;
    if ($1 instanceof Empty) {
      let $2 = $.head;
      if ($2 === "") {
        return new Home;
      } else if ($2 === "login") {
        return new Login;
      } else {
        return new NotFound(uri);
      }
    } else {
      let $2 = $1.tail;
      if ($2 instanceof Empty) {
        let $3 = $.head;
        if ($3 === "profile") {
          let handle2 = $1.head;
          return new Profile2(handle2);
        } else {
          return new NotFound(uri);
        }
      } else {
        let $3 = $2.tail;
        if ($3 instanceof Empty) {
          let $4 = $.head;
          if ($4 === "profile") {
            let $5 = $2.head;
            if ($5 === "edit") {
              let handle2 = $1.head;
              return new ProfileEdit(handle2);
            } else {
              return new NotFound(uri);
            }
          } else {
            return new NotFound(uri);
          }
        } else {
          return new NotFound(uri);
        }
      }
    }
  }
}
function on_url_change(uri) {
  let _pipe = uri;
  let _pipe$1 = parse_route(_pipe);
  return new UserNavigatedTo(_pipe$1);
}
function fetch_current_user() {
  return from((dispatch) => {
    let url = "/api/user/current";
    let _pipe = fetchUrl(url);
    let _pipe$1 = map_promise(_pipe, (body_result) => {
      if (body_result instanceof Ok) {
        let $ = body_result[0][0];
        if ($ === 200) {
          let text4 = body_result[0][1];
          let _pipe$12 = parse(text4, field("handle", string2, (handle2) => {
            return success(new User(new None, handle2));
          }));
          return map_error(_pipe$12, (_) => {
            return "Failed to parse user JSON";
          });
        } else if ($ === 401) {
          return new Error2("Not authenticated");
        } else {
          let status = $;
          return new Error2("API request failed with status: " + to_string(status));
        }
      } else {
        return body_result;
      }
    });
    tap(_pipe$1, (result) => {
      return dispatch(new CurrentUserFetched(result));
    });
    return;
  });
}
function init3(_) {
  let _block;
  let $ = do_initial_uri();
  if ($ instanceof Ok) {
    let uri = $[0];
    _block = parse_route(uri);
  } else {
    _block = new Home;
  }
  let route = _block;
  let prerendered_profile = read_embedded_profile_data();
  let prerendered_user = read_embedded_user_data();
  let _block$1;
  if (route instanceof Profile2) {
    if (prerendered_profile instanceof Some) {
      let profile_data = prerendered_profile[0];
      let model2 = new Model2(route, new Loaded(profile_data), init_form_data(new None), prerendered_user);
      _block$1 = [model2, none()];
    } else {
      let model2 = new Model2(route, new Failed("Profile not found"), init_form_data(new None), prerendered_user);
      _block$1 = [model2, none()];
    }
  } else if (route instanceof ProfileEdit) {
    if (prerendered_profile instanceof Some) {
      let profile_data = prerendered_profile[0];
      let model2 = new Model2(route, new Loaded(profile_data), init_form_data(new Some(profile_data)), prerendered_user);
      _block$1 = [model2, none()];
    } else {
      let model2 = new Model2(route, new Failed("Profile not found"), init_form_data(new None), prerendered_user);
      _block$1 = [model2, none()];
    }
  } else {
    let model2 = new Model2(route, new NotAsked, init_form_data(new None), prerendered_user);
    _block$1 = [model2, none()];
  }
  let $1 = _block$1;
  let model;
  let initial_effect;
  model = $1[0];
  initial_effect = $1[1];
  let modem_effect = init(on_url_change);
  let _block$2;
  if (prerendered_user instanceof Some) {
    _block$2 = none();
  } else {
    _block$2 = fetch_current_user();
  }
  let fetch_user_effect = _block$2;
  let combined_effect = batch(toList([modem_effect, initial_effect, fetch_user_effect]));
  return [model, combined_effect];
}
function fetch_profile(handle2) {
  return from((dispatch) => {
    let url = "/api/profile/" + handle2;
    console_log("Fetching profile from: " + url);
    let _pipe = fetchUrl(url);
    let _pipe$1 = map_promise(_pipe, (body_result) => {
      console_log("Body result: " + inspect2(body_result));
      if (body_result instanceof Ok) {
        let $ = body_result[0][0];
        if ($ === 200) {
          let text4 = body_result[0][1];
          console_log("Got 200 response, parsing JSON...");
          let _pipe$12 = parse(text4, profile_decoder());
          let _pipe$2 = map4(_pipe$12, (var0) => {
            return new Some(var0);
          });
          return map_error(_pipe$2, (err) => {
            console_log("JSON parse error: " + inspect2(err));
            return "Failed to parse profile JSON";
          });
        } else if ($ === 404) {
          console_log("Got 404 response");
          return new Ok(new None);
        } else {
          let status = $;
          console_log("Got status: " + inspect2(status));
          return new Error2("API request failed");
        }
      } else {
        let err = body_result[0];
        console_log("Fetch error: " + err);
        return new Error2(err);
      }
    });
    tap(_pipe$1, (result) => {
      return dispatch(new ProfileFetched(result));
    });
    return;
  });
}
function process_file_from_input_effect(input_id) {
  return from((dispatch) => {
    let _pipe = processFileFromInputId(input_id);
    let _pipe$1 = map_promise(_pipe, (result) => {
      if (result instanceof Ok) {
        let file_data = result[0];
        console_log("File processed successfully");
        return dispatch(new ProfileEditMsg(new AvatarFileProcessed(file_data)));
      } else {
        let err = result[0];
        return console_log("Failed to process file: " + err);
      }
    });
    then_await(_pipe$1, (_) => {
      return resolve(undefined);
    });
    return;
  });
}
function save_profile_effect(handle2, form_data) {
  return from((dispatch) => {
    let url = "/api/profile/" + handle2 + "/update";
    let json_fields = toList([]);
    let _block;
    let $ = form_data.display_name;
    if ($ === "") {
      _block = json_fields;
    } else {
      let name2 = $;
      _block = prepend(["display_name", string3(name2)], json_fields);
    }
    let json_fields$1 = _block;
    let _block$1;
    let $1 = form_data.description;
    if ($1 === "") {
      _block$1 = json_fields$1;
    } else {
      let desc = $1;
      _block$1 = prepend(["description", string3(desc)], json_fields$1);
    }
    let json_fields$2 = _block$1;
    let _block$2;
    let $2 = form_data.location_input.selected_location;
    if ($2 instanceof Some) {
      let loc = $2[0];
      let location_json = object2(toList([
        ["name", string3(loc.name)],
        ["value", string3(loc.h3_index)]
      ]));
      _block$2 = prepend(["home_town", location_json], json_fields$2);
    } else {
      _block$2 = json_fields$2;
    }
    let json_fields$3 = _block$2;
    let _block$3;
    let $3 = form_data.interests;
    if ($3 === "") {
      _block$3 = json_fields$3;
    } else {
      let interests_str = $3;
      let _block$42;
      let _pipe2 = split2(interests_str, ",");
      let _pipe$12 = map(_pipe2, trim);
      _block$42 = filter(_pipe$12, (s) => {
        return s !== "";
      });
      let interests_list = _block$42;
      _block$3 = prepend(["interests", array2(interests_list, string3)], json_fields$3);
    }
    let json_fields$4 = _block$3;
    let _block$4;
    let $4 = form_data.avatar_file_data;
    if ($4 instanceof Some) {
      let file_data = $4[0];
      let $5 = file_data.base64_data;
      if ($5 === "") {
        _block$4 = json_fields$4;
      } else {
        _block$4 = prepend(["avatar_base64", string3(file_data.base64_data)], prepend(["avatar_mime_type", string3(file_data.mime_type)], json_fields$4));
      }
    } else {
      _block$4 = json_fields$4;
    }
    let json_fields$5 = _block$4;
    let _block$5;
    let _pipe = object2(json_fields$5);
    _block$5 = to_string2(_pipe);
    let json_body = _block$5;
    console_log("Sending profile update: " + json_body);
    let _pipe$1 = postJson(url, json_body);
    let _pipe$2 = map_promise(_pipe$1, (result) => {
      if (result instanceof Ok) {
        let $5 = result[0][0];
        if ($5 === 200) {
          let text4 = result[0][1];
          console_log("Profile saved successfully, parsing response...");
          let $6 = parse(text4, profile_decoder());
          if ($6 instanceof Ok) {
            let updated_profile = $6[0];
            console_log("Profile parsed successfully");
            return dispatch(new ProfileEditMsg(new SaveCompleted(new Ok(updated_profile))));
          } else {
            console_log("Failed to parse profile response");
            return dispatch(new ProfileEditMsg(new SaveCompleted(new Error2("Failed to parse updated profile"))));
          }
        } else {
          let status = $5;
          let text4 = result[0][1];
          console_log("Save failed with status " + to_string(status) + ": " + text4);
          return dispatch(new ProfileEditMsg(new SaveCompleted(new Error2("Failed to save profile (status " + to_string(status) + ")"))));
        }
      } else {
        let err = result[0];
        console_log("Save request failed: " + err);
        return dispatch(new ProfileEditMsg(new SaveCompleted(new Error2(err))));
      }
    });
    then_await(_pipe$2, (_) => {
      return resolve(undefined);
    });
    return;
  });
}
function update3(model, msg) {
  if (msg instanceof UserNavigatedTo) {
    let route = msg.route;
    let model$1 = new Model2(route, model.profile_state, model.edit_form_data, model.current_user);
    if (route instanceof Profile2) {
      let handle2 = route.handle;
      console_log("Navigating to profile: " + handle2);
      let $ = model$1.profile_state;
      if ($ instanceof Loaded) {
        let p2 = $[0];
        let $1 = p2.handle;
        if ($1 instanceof Some) {
          let loaded_handle = $1[0];
          if (loaded_handle === handle2) {
            return [model$1, none()];
          } else {
            let model$2 = new Model2(model$1.route, new Loading, model$1.edit_form_data, model$1.current_user);
            return [model$2, fetch_profile(handle2)];
          }
        } else {
          let model$2 = new Model2(model$1.route, new Loading, model$1.edit_form_data, model$1.current_user);
          return [model$2, fetch_profile(handle2)];
        }
      } else {
        let model$2 = new Model2(model$1.route, new Loading, model$1.edit_form_data, model$1.current_user);
        return [model$2, fetch_profile(handle2)];
      }
    } else if (route instanceof ProfileEdit) {
      let handle2 = route.handle;
      console_log("Navigating to profile edit: " + handle2);
      let _block;
      let $ = model$1.current_user;
      if ($ instanceof Some) {
        let user = $[0];
        if (user.handle === handle2) {
          _block = true;
        } else {
          _block = false;
        }
      } else {
        _block = false;
      }
      let is_authorized = _block;
      if (is_authorized) {
        let $1 = model$1.profile_state;
        if ($1 instanceof Loaded) {
          let p2 = $1[0];
          let $2 = p2.handle;
          if ($2 instanceof Some) {
            let loaded_handle = $2[0];
            if (loaded_handle === handle2) {
              let form_data = init_form_data(new Some(p2));
              return [
                new Model2(model$1.route, model$1.profile_state, form_data, model$1.current_user),
                none()
              ];
            } else {
              let model$2 = new Model2(model$1.route, new Loading, model$1.edit_form_data, model$1.current_user);
              return [model$2, fetch_profile(handle2)];
            }
          } else {
            let model$2 = new Model2(model$1.route, new Loading, model$1.edit_form_data, model$1.current_user);
            return [model$2, fetch_profile(handle2)];
          }
        } else {
          let model$2 = new Model2(model$1.route, new Loading, model$1.edit_form_data, model$1.current_user);
          return [model$2, fetch_profile(handle2)];
        }
      } else {
        console_log("Unauthorized edit attempt, redirecting to profile view");
        return [
          model$1,
          push("/profile/" + handle2, new None, new None)
        ];
      }
    } else {
      return [model$1, none()];
    }
  } else if (msg instanceof ProfileFetched) {
    let result = msg[0];
    console_log("Profile fetched result: " + inspect2(result));
    let _block;
    if (result instanceof Ok) {
      let $2 = result[0];
      if ($2 instanceof Some) {
        let profile_data = $2[0];
        _block = new Loaded(profile_data);
      } else {
        _block = new Failed("Profile not found");
      }
    } else {
      let error = result[0];
      _block = new Failed(error);
    }
    let profile_state = _block;
    let _block$1;
    let $ = model.route;
    if (profile_state instanceof Loaded && $ instanceof ProfileEdit) {
      let profile_data = profile_state[0];
      _block$1 = init_form_data(new Some(profile_data));
    } else {
      _block$1 = model.edit_form_data;
    }
    let edit_form_data = _block$1;
    return [
      new Model2(model.route, profile_state, edit_form_data, model.current_user),
      none()
    ];
  } else if (msg instanceof ProfileEditMsg) {
    let edit_msg = msg[0];
    if (edit_msg instanceof DisplayNameUpdated) {
      let value3 = edit_msg[0];
      let _block;
      let _record = model.edit_form_data;
      _block = new FormData2(value3, _record.description, _record.location_input, _record.interests, _record.avatar_preview_url, _record.avatar_file_data, _record.success_message, _record.error_message, _record.is_saving);
      let form_data = _block;
      return [
        new Model2(model.route, model.profile_state, form_data, model.current_user),
        none()
      ];
    } else if (edit_msg instanceof DescriptionUpdated) {
      let value3 = edit_msg[0];
      let _block;
      let _record = model.edit_form_data;
      _block = new FormData2(_record.display_name, value3, _record.location_input, _record.interests, _record.avatar_preview_url, _record.avatar_file_data, _record.success_message, _record.error_message, _record.is_saving);
      let form_data = _block;
      return [
        new Model2(model.route, model.profile_state, form_data, model.current_user),
        none()
      ];
    } else if (edit_msg instanceof InterestsUpdated) {
      let value3 = edit_msg[0];
      let _block;
      let _record = model.edit_form_data;
      _block = new FormData2(_record.display_name, _record.description, _record.location_input, value3, _record.avatar_preview_url, _record.avatar_file_data, _record.success_message, _record.error_message, _record.is_saving);
      let form_data = _block;
      return [
        new Model2(model.route, model.profile_state, form_data, model.current_user),
        none()
      ];
    } else if (edit_msg instanceof AvatarFileChanged) {
      return [model, process_file_from_input_effect("avatar-upload")];
    } else if (edit_msg instanceof AvatarFileProcessed) {
      let file_data = edit_msg[0];
      let _block;
      let _record = model.edit_form_data;
      _block = new FormData2(_record.display_name, _record.description, _record.location_input, _record.interests, new Some(file_data.preview_url), new Some(file_data), _record.success_message, _record.error_message, _record.is_saving);
      let form_data = _block;
      return [
        new Model2(model.route, model.profile_state, form_data, model.current_user),
        none()
      ];
    } else if (edit_msg instanceof LocationInputMsg) {
      let location_msg = edit_msg[0];
      let $ = update2(model.edit_form_data.location_input, location_msg);
      let location_model;
      let location_effect;
      location_model = $[0];
      location_effect = $[1];
      let _block;
      let _record = model.edit_form_data;
      _block = new FormData2(_record.display_name, _record.description, location_model, _record.interests, _record.avatar_preview_url, _record.avatar_file_data, _record.success_message, _record.error_message, _record.is_saving);
      let form_data = _block;
      return [
        new Model2(model.route, model.profile_state, form_data, model.current_user),
        (() => {
          let _pipe = location_effect;
          return map5(_pipe, (msg2) => {
            return new ProfileEditMsg(new LocationInputMsg(msg2));
          });
        })()
      ];
    } else if (edit_msg instanceof FormSubmitted) {
      let _block;
      let _record = model.edit_form_data;
      _block = new FormData2(_record.display_name, _record.description, _record.location_input, _record.interests, _record.avatar_preview_url, _record.avatar_file_data, new None, new None, true);
      let form_data = _block;
      let model$1 = new Model2(model.route, model.profile_state, form_data, model.current_user);
      let $ = model$1.route;
      if ($ instanceof ProfileEdit) {
        let handle2 = $.handle;
        return [model$1, save_profile_effect(handle2, model$1.edit_form_data)];
      } else {
        return [model$1, none()];
      }
    } else if (edit_msg instanceof SaveCompleted) {
      let result = edit_msg[0];
      if (result instanceof Ok) {
        let updated_profile = result[0];
        let _block;
        let _record = model.edit_form_data;
        _block = new FormData2(_record.display_name, _record.description, _record.location_input, _record.interests, _record.avatar_preview_url, _record.avatar_file_data, new Some("Profile updated successfully!"), new None, false);
        let form_data = _block;
        return [
          new Model2(model.route, new Loaded(updated_profile), form_data, model.current_user),
          none()
        ];
      } else {
        let err = result[0];
        let _block;
        let _record = model.edit_form_data;
        _block = new FormData2(_record.display_name, _record.description, _record.location_input, _record.interests, _record.avatar_preview_url, _record.avatar_file_data, new None, new Some(err), false);
        let form_data = _block;
        return [
          new Model2(model.route, model.profile_state, form_data, model.current_user),
          none()
        ];
      }
    } else {
      let $ = model.route;
      if ($ instanceof ProfileEdit) {
        let handle2 = $.handle;
        return [
          model,
          push("/profile/" + handle2, new None, new None)
        ];
      } else {
        return [model, none()];
      }
    }
  } else {
    let result = msg[0];
    let _block;
    if (result instanceof Ok) {
      let user = result[0];
      _block = new Some(user);
    } else {
      _block = new None;
    }
    let current_user = _block;
    return [
      new Model2(model.route, model.profile_state, model.edit_form_data, current_user),
      none()
    ];
  }
}
function view_not_found() {
  return div(toList([class$("text-center py-12")]), toList([
    h2(toList([class$("text-2xl font-bold text-white mb-4")]), toList([text3("404 - Page Not Found")])),
    p(toList([class$("text-zinc-400")]), toList([text3("The page you're looking for doesn't exist.")]))
  ]));
}
function view7(model) {
  return layout(model.current_user, toList([
    (() => {
      let $ = model.route;
      if ($ instanceof Home) {
        return view2();
      } else if ($ instanceof Login) {
        return view3();
      } else if ($ instanceof Profile2) {
        let $1 = model.profile_state;
        if ($1 instanceof NotAsked) {
          return div(toList([class$("text-center py-12")]), toList([
            p(toList([class$("text-zinc-400")]), toList([text3("Loading profile...")]))
          ]));
        } else if ($1 instanceof Loading) {
          return div(toList([class$("text-center py-12")]), toList([
            p(toList([class$("text-zinc-400")]), toList([text3("Loading profile...")]))
          ]));
        } else if ($1 instanceof Loaded) {
          let p2 = $1[0];
          let _block;
          let $2 = model.current_user;
          if ($2 instanceof Some) {
            let user = $2[0];
            _block = new Some(user.handle);
          } else {
            _block = $2;
          }
          let current_user_handle = _block;
          return view4(p2, current_user_handle);
        } else {
          let error = $1.error;
          return div(toList([class$("text-center py-12")]), toList([
            h2(toList([
              class$("text-2xl font-bold text-white mb-4")
            ]), toList([text3("Error")])),
            p(toList([class$("text-zinc-400")]), toList([text3(error)]))
          ]));
        }
      } else if ($ instanceof ProfileEdit) {
        let handle2 = $.handle;
        let $1 = model.profile_state;
        if ($1 instanceof NotAsked) {
          return div(toList([class$("text-center py-12")]), toList([
            p(toList([class$("text-zinc-400")]), toList([text3("Loading profile...")]))
          ]));
        } else if ($1 instanceof Loading) {
          return div(toList([class$("text-center py-12")]), toList([
            p(toList([class$("text-zinc-400")]), toList([text3("Loading profile...")]))
          ]));
        } else if ($1 instanceof Loaded) {
          let p2 = $1[0];
          return view6(new Some(p2), model.edit_form_data, handle2, (var0) => {
            return new ProfileEditMsg(var0);
          });
        } else {
          let error = $1.error;
          return div(toList([class$("text-center py-12")]), toList([
            h2(toList([
              class$("text-2xl font-bold text-white mb-4")
            ]), toList([text3("Error")])),
            p(toList([class$("text-zinc-400")]), toList([text3(error)]))
          ]));
        }
      } else {
        return view_not_found();
      }
    })()
  ]));
}
function main() {
  let app = application(init3, update3, view7);
  let $ = start3(app, "#app", undefined);
  if (!($ instanceof Ok)) {
    throw makeError("let_assert", FILEPATH, "client", 29, "main", "Pattern match failed, no pattern matched the value.", { value: $, start: 708, end: 757, pattern_start: 719, pattern_end: 724 });
  }
  return;
}

// .lustre/build/client.mjs
main();
