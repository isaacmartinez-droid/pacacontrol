import assert from 'node:assert/strict'
import test from 'node:test'
import { buildAccountAlerts, deriveAccountHealth, summarizeAccounts } from './adminAccounts.js'

const now = Date.parse('2026-09-18T12:00:00Z')
const base = {
  userId: 'account-1',
  accessStatus: 'active',
  servicePlan: 'paid_monthly',
  termsAcceptedAt: '2026-09-01T00:00:00Z',
  privacyAcceptedAt: '2026-09-01T00:00:00Z',
  createdAt: '2026-08-01T00:00:00Z',
  salesCount: 2,
  lastSaleAt: '2026-09-17T00:00:00Z',
}

test('clasifica como crítica una cuenta con pago vencido', () => {
  const account = { ...base, nextPaymentDueAt: '2026-09-17T00:00:00Z' }
  assert.equal(deriveAccountHealth(account, now).id, 'critical')
  assert.equal(buildAccountAlerts(account, now)[0].title, 'Pago vencido')
})

test('separa cumplimiento pendiente de la actividad comercial', () => {
  const account = { ...base, termsAcceptedAt: null }
  const result = deriveAccountHealth(account, now)
  assert.equal(result.id, 'attention')
  assert.match(result.detail, /Cumplimiento pendiente/)
})

test('considera nueva una cuenta reciente sin ventas', () => {
  const account = { ...base, salesCount: 0, createdAt: '2026-09-16T00:00:00Z' }
  assert.equal(deriveAccountHealth(account, now).id, 'new')
})

test('resume estados de salud sin contar administradores previamente filtrados', () => {
  const accounts = [
    base,
    { ...base, userId: 'account-2', accessStatus: 'suspended' },
    { ...base, userId: 'account-3', termsAcceptedAt: null },
  ]
  assert.deepEqual(summarizeAccounts(accounts, now), {
    total: 3,
    active: 2,
    paid: 3,
    healthy: 1,
    attention: 1,
    critical: 1,
    new: 0,
    closed: 0,
  })
})
