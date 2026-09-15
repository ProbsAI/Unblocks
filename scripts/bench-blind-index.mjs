/**
 * Measures what the blind index derivations actually cost.
 *
 * This exists because the cost was asserted in a comment ("about a quarter of a
 * millisecond") and was wrong by roughly 7x. blindIndex runs once per
 * authenticated request and once per API call, synchronously, so its cost is an
 * event-loop stall and a throughput ceiling — not something to estimate.
 *
 * Run: npm run bench:blind-index
 *
 * Deliberately dependency-free (node:crypto only) so it runs without an install
 * and mirrors core/security/blindIndex.ts rather than importing it.
 */
import { createHmac, pbkdf2Sync } from 'node:crypto'

const key = Buffer.alloc(32, 0xab)
const salt = createHmac('sha256', key).update('domain').digest()

// 32 bytes rendered as hex — the shape of every token reaching blindIndex.
const token = 'a'.repeat(64)

function time(label, fn, samples) {
  fn() // warm up the JIT and any lazy crypto init
  const start = process.hrtime.bigint()
  for (let i = 0; i < samples; i++) fn()
  const elapsed = process.hrtime.bigint() - start
  const perCall = Number(elapsed) / 1e6 / samples
  console.log(`${label.padEnd(34)} ${perCall.toFixed(4)} ms`)
  return perCall
}

const hmac = time(
  'HMAC-SHA256 (pre-PBKDF2 baseline)',
  () => createHmac('sha256', key).update(token).digest('hex'),
  20_000
)

const fast = time(
  'PBKDF2 1000 (blindIndex)',
  () => pbkdf2Sync(token, salt, 1000, 32, 'sha256'),
  2_000
)

const slow = time(
  'PBKDF2 600000 (slowBlindIndex)',
  () => pbkdf2Sync(token, salt, 600_000, 32, 'sha256'),
  5
)

console.log('')
console.log(`blindIndex costs ${(fast / hmac).toFixed(0)}x a bare HMAC`)
console.log(
  `sync throughput ceiling, 1 core: ~${Math.round(1000 / fast)} req/s`
)
console.log(`slowBlindIndex is ${(slow / fast).toFixed(0)}x blindIndex`)
console.log('')
console.log(
  'If the ceiling is too low for your deployment, the dial is FAST_ITERATIONS'
)
console.log(
  'in core/security/blindIndex.ts. Lowering it costs no security — read the'
)
console.log('note there before raising it.')
