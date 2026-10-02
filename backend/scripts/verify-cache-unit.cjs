/**
 * Automated Unit Test for Cache Utility
 * Runs in CI without external network or database dependencies.
 */
const assert = require('assert');
const cache = require('../src/utils/cache');

console.log('🧪 Starting Cache Utility Unit Tests...');

// 1. Initial State
const s1 = cache.stats();
console.log('1. Initial stats:', s1);
assert.strictEqual(typeof s1.hits, 'number');
assert.strictEqual(typeof s1.misses, 'number');
assert.strictEqual(typeof s1.redisEnabled, 'boolean');

// 2. Set & Get
cache.set('test:user:1', { id: 1, name: 'Alice' }, 5000);
const u1 = cache.get('test:user:1');
assert.deepStrictEqual(u1, { id: 1, name: 'Alice' });
console.log('✅ Set & Get verified');

// 3. Delete
cache.del('test:user:1');
const u1AfterDel = cache.get('test:user:1');
assert.strictEqual(u1AfterDel, null);
console.log('✅ Delete verified');

// 4. Pattern Invalidation
cache.set('test:order:100', { id: 100 }, 5000);
cache.set('test:order:101', { id: 101 }, 5000);
cache.set('other:item:1', { id: 1 }, 5000);

assert.notStrictEqual(cache.get('test:order:100'), null);
assert.notStrictEqual(cache.get('test:order:101'), null);
assert.notStrictEqual(cache.get('other:item:1'), null);

cache.delPattern('test:order:');
assert.strictEqual(cache.get('test:order:100'), null);
assert.strictEqual(cache.get('test:order:101'), null);
assert.notStrictEqual(cache.get('other:item:1'), null);
console.log('✅ delPattern verified');

// 5. delKeys
cache.set('k:1', 1, 5000);
cache.set('k:2', 2, 5000);
cache.delKeys('k:1', 'k:2');
assert.strictEqual(cache.get('k:1'), null);
assert.strictEqual(cache.get('k:2'), null);
console.log('✅ delKeys verified');

// 6. Expiry check
cache.set('expiring:key', 'short-lived', 50); // 50ms TTL
setTimeout(async () => {
  const expiredVal = cache.get('expiring:key');
  assert.strictEqual(expiredVal, null);
  console.log('✅ Expiration verified');

  // 7. Async get
  cache.set('async:test', { success: true }, 5000);
  const asyncVal = await cache.getAsync('async:test');
  assert.deepStrictEqual(asyncVal, { success: true });
  console.log('✅ getAsync verified');

  // 8. Stats summary
  const finalStats = cache.stats();
  console.log('Final Cache Stats:', finalStats);
  assert(finalStats.hits > 0);

  console.log('🎉 All Cache Utility Unit Tests PASSED (100%)!');
  process.exit(0);
}, 80);
