import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

test('el portal comercial conserva API y sirve los recursos de marca directamente', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'))
  assert.ok(config.functions['api/push-dispatch.js'])
  assert.match(config.rewrites[0].source, /brand\//)
  assert.doesNotMatch(config.rewrites[0].source, /assets\//)
})

test('el portal administrativo no publica funciones y separa sus recursos estáticos', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.admin.json', import.meta.url), 'utf8'))
  assert.equal(config.functions, undefined)
  assert.match(config.rewrites[0].source, /assets\//)
  assert.match(config.rewrites[0].source, /icons\//)
  assert.match(config.rewrites[0].source, /brand\//)
})
