// tests/effects-golden.test.mjs
// 763 条人工核对结论的回归护栏（用例见 fixtures/effects-golden.mjs）。
// 运行：node --test tests/effects-golden.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { CASES } from './fixtures/effects-golden.mjs'

const ops = JSON.parse(readFileSync(new URL('../public/data/v5/operators.json', import.meta.url), 'utf8'))

// 同一 buffId 可能被多名干员共用，取其一份即可（生成时已保证一致）
const byBuffId = new Map()
for (const c of Object.values(ops.characters)) {
  for (const s of c.skills || []) {
    if (!byBuffId.has(s.buffId)) byBuffId.set(s.buffId, s)
  }
}

const getPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj)

const isPlainObject = (v) => v != null && typeof v === 'object' && !Array.isArray(v)

function assertField(actual, path, expected, label) {
  const got = getPath(actual, path)
  if (Array.isArray(expected)) {
    assert.ok(Array.isArray(got), `${label}: ${path} 应为数组，实为 ${JSON.stringify(got)}`)
    assert.deepEqual([...got].sort(), [...expected].sort(), `${label}: ${path} 不匹配`)
    return
  }
  if (expected === undefined || expected === null) {
    assert.ok(got === undefined || got === null, `${label}: ${path} 应为空，实为 ${JSON.stringify(got)}`)
    return
  }
  // 只校验指定子字段，忽略 text/numbers 之类的补充信息
  if (isPlainObject(expected)) {
    assert.ok(isPlainObject(got), `${label}: ${path} 应为对象，实为 ${JSON.stringify(got)}`)
    for (const [k, v] of Object.entries(expected)) assertField(got, k, v, `${label}.${path}`)
    return
  }
  assert.deepEqual(got, expected, `${label}: ${path} 期望 ${JSON.stringify(expected)}，实为 ${JSON.stringify(got)}`)
}

for (const c of CASES) {
  test(`${c.buffId} — ${c.note}`, () => {
    const skill = byBuffId.get(c.buffId)
    assert.ok(skill, `缺少 buffId ${c.buffId}`)
    const effects = skill.effects || []

    if (c.expectLength != null) {
      assert.equal(effects.length, c.expectLength, `${c.buffId}: effects 条数不符`)
    }
    for (let i = 0; i < c.expect.length; i += 1) {
      const spec = c.expect[i]
      if (spec._any) {
        // 不关心顺序：命中任意一条即可
        const { _any, ...wanted } = spec
        const hit = effects.some((e) => {
          try {
            for (const [path, expected] of Object.entries(wanted)) assertField(e, path, expected, '')
            return true
          } catch {
            return false
          }
        })
        assert.ok(hit, `${c.buffId}: 找不到满足 ${JSON.stringify(wanted)} 的 effect`)
        continue
      }
      assert.ok(effects[i], `${c.buffId}: 缺少第 ${i} 条 effect`)
      for (const [path, expected] of Object.entries(spec)) {
        assertField(effects[i], path, expected, `${c.buffId}[${i}]`)
      }
    }
  })
}

test('用例表本身没有重复 buffId', () => {
  const seen = new Set()
  for (const c of CASES) {
    assert.ok(!seen.has(c.buffId), '重复用例: ' + c.buffId)
    seen.add(c.buffId)
  }
})
