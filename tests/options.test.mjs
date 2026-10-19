import test from 'node:test'
import assert from 'node:assert/strict'
import { store, updateOptions } from '../src/stores/session.js'

test('changing one weight keeps the others (no NaN / 10000%)', () => {
  store.options = {
    ...store.options,
    weights: { lmd: 40, exp: 30, orundum: 20, trust: 10 },
  }
  updateOptions({ weights: { lmd: 50 } })
  assert.deepEqual(store.options.weights, { lmd: 50, exp: 30, orundum: 20, trust: 10 })
})

test('weights stay finite when an old saved state is partial', () => {
  store.options = { ...store.options, weights: { lmd: 100 } }
  updateOptions({ weights: { orundum: 25 } })
  const w = store.options.weights
  for (const key of ['lmd', 'exp', 'orundum', 'trust']) {
    assert.ok(Number.isFinite(Number(w[key])), key + ' should be finite')
  }
})
