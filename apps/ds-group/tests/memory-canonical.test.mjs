import test from 'node:test';
import assert from 'node:assert/strict';
import { canonical } from '../memory/store.mjs';

// What canonical has always produced: every stored row, source ID and memory ID is made from this text.
const reference = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);

const same = value => {
  let expected, failure;
  try { expected = reference(value); } catch (error) { failure = error; }
  if (failure) assert.throws(() => canonical(value), { name: failure.name });
  else assert.equal(canonical(value), expected);
};

test('canonical text is unchanged for the values a store writes', () => {
  for (const value of [
    undefined, null, true, false, 0, -0, 1.5, 1e21, 1e-7, NaN, Infinity, 'text', '', '引号 " 反斜线 \\ 换行 \n   \ud800', () => 1, Symbol('s'),
    [], {}, [undefined, () => 1, Symbol('s'), null, NaN], { b: 1, a: undefined, c: () => 1, d: Symbol('s'), e: null },
    { z: { y: [{ b: 2, a: 1 }, [3, { d: 4, c: 5 }]], x: '中文' }, a: [] },
    { 10: 'ten', 9: 'nine', a: 'letter', '01': 'text key', '-1': 'negative' }, { nested: { 2: 'b', 1: 'a', key: [{ 3: 'c', 0: 'z' }] } },
    { ['__proto__']: 1, constructor: 2, toString: 3 }, JSON.parse('{"__proto__":{"b":1,"a":2},"a":1}'),
    { when: new Date(0), nested: [new Date(1e12)] }, new Date(5), { toJSON: () => ({ b: 1, a: 2 }) }, [{ toJSON: () => 'x' }],
    new Map([[1, 2]]), new Set([1]), { map: new Map(), list: new Set([1]) }, Object.create(null), Object.assign(Object.create(null), { b: 1, a: 2 }),
    Object.assign(Object.create({ inherited: 1 }), { own: 2 }), new (class Row { constructor() { this.b = 1; this.a = 2; } })(),
    Object.freeze({ b: Object.freeze([Object.freeze({ d: 1, c: 2 })]), a: 1 }), Object.assign([], { 1: 1, 3: 2 }), Object.assign([1, 2], { extra: 3 }),
    new String('boxed'), new Number(3), new Boolean(false), { boxed: new String('b'), n: new Number(1) },
    { ä: 1, z: 2, Z: 3, 'a b': 4, '': 5, '\u{1F600}': 6, '￿': 7 }, 10n, { big: 10n }, new Uint8Array([1, 2]), { bytes: new Uint8Array(2) },
  ]) same(value);
  const loop = { name: 'loop' }; loop.self = loop; same(loop);
});

test('canonical text is unchanged for generated rows', () => {
  let seed = 7;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const keys = ['id', 'revision', 'body', 'authorId', 'roomId', 'sourceRefs', 'originRefs', 'timestamp', 'withdrawn', '名字', 'a-b', 'Z', '_x', '7', '12', 'toJSON2'];
  const leaves = [null, true, false, 0, 1, -3.25, 1e30, 'x', '林青', '$event:hs.example', '', undefined, NaN, '"quoted"', '\n\t'];
  const build = depth => {
    const roll = random();
    if (depth > 3 || roll < 0.4) return leaves[Math.floor(random() * leaves.length)];
    if (roll < 0.6) return Array.from({ length: Math.floor(random() * 5) }, () => build(depth + 1));
    return Object.fromEntries(Array.from({ length: Math.floor(random() * 7) }, () => [keys[Math.floor(random() * keys.length)], build(depth + 1)]));
  };
  for (let index = 0; index < 3000; index++) same(build(0));
});
