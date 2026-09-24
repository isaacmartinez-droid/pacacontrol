import test from 'node:test'
import assert from 'node:assert/strict'
import {
  activationCorsHeaders,
  isValidInvitationToken,
  normalizeInvitationToken,
  sha256Hex,
  validateActivationPassword,
} from '../supabase/functions/_shared/accountActivation.js'

test('normaliza y valida únicamente tokens completos de invitación', async () => {
  const token = 'A'.repeat(64)
  assert.equal(normalizeInvitationToken(`  ${token}  `), 'a'.repeat(64))
  assert.equal(isValidInvitationToken(token), true)
  assert.equal(isValidInvitationToken('a'.repeat(63)), false)
  assert.equal(isValidInvitationToken('g'.repeat(64)), false)
  assert.equal(await sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
})

test('exige contraseña larga y limita exactamente los orígenes configurados', () => {
  assert.equal(validateActivationPassword('123456789'), false)
  assert.equal(validateActivationPassword('1234567890'), true)
  assert.equal(validateActivationPassword('x'.repeat(129)), false)

  const allowed = 'https://pruebas.example, http://127.0.0.1:5174'
  assert.equal(activationCorsHeaders('https://pruebas.example', allowed)['access-control-allow-origin'], 'https://pruebas.example')
  assert.equal(activationCorsHeaders('https://otro.example', allowed), null)
  assert.equal(activationCorsHeaders(null, allowed)['access-control-allow-origin'], 'https://pruebas.example')
})
