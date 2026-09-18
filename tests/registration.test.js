const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeUsername, isValidUsername, getUsernames } = require('../src/config/usernames');

test('normaliza el nombre sin espacios extra', () => {
  assert.equal(normalizeUsername('  Ana   '), 'Ana');
  assert.equal(normalizeUsername('Lucía'), 'Lucía');
});

test('acepta nombres personalizados válidos y rechaza vacíos o demasiado largos', () => {
  assert.equal(isValidUsername('Ana'), true);
  assert.equal(isValidUsername(''), false);
  assert.equal(isValidUsername('   '), false);
  assert.equal(isValidUsername('A'.repeat(31)), false);
});

test('el catálogo ya no impone una lista fija de nombres', () => {
  assert.deepEqual(getUsernames(), []);
});
