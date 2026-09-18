import test from 'node:test'
import assert from 'node:assert/strict'
import { planAlertBanners } from './alertBanners.js'
const notice = { id: 'stock:shoes', revision: 'low', read: false }

test('aviso emerge sin abrir campana y no se repite al refrescar o cerrar', () => {
  const first = planAlertBanners([notice])
  assert.deepEqual(first.fresh, [notice])
  assert.deepEqual(planAlertBanners([notice], first.presented).fresh, [])
  assert.equal(notice.read, false)
  assert.deepEqual(planAlertBanners([{ ...notice, revision: 'empty' }], first.presented).fresh, [{ ...notice, revision: 'empty' }])
})
test('lecturas no emergen y una alerta resuelta puede volver a emerger', () => {
  assert.deepEqual(planAlertBanners([{ ...notice, read: true }]).fresh, [])
  const presented = planAlertBanners([], planAlertBanners([notice]).presented).presented
  assert.deepEqual(planAlertBanners([notice], presented).fresh, [notice])
})
