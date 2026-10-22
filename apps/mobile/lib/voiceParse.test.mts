import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseVoiceTranscript } from './voiceParse.ts';

test('parses spent amount and groceries category', () => {
  const d = parseVoiceTranscript('spent 45 dollars on groceries');
  assert.ok(d);
  assert.equal(d.confidence, 'full');
  assert.equal(d.type, 'expense');
  assert.equal(d.amount, '45.00');
  assert.equal(d.category, 'Groceries');
});

test('parses income salary', () => {
  const d = parseVoiceTranscript('income 2000 salary');
  assert.ok(d);
  assert.equal(d.type, 'income');
  assert.equal(d.amount, '2000.00');
  assert.equal(d.category, 'Salary');
});

test('uses eating out alias for lunch', () => {
  const d = parseVoiceTranscript('bought lunch for 18.50');
  assert.ok(d);
  assert.equal(d.amount, '18.50');
  assert.equal(d.category, 'Eating out');
  assert.equal(d.type, 'expense');
});

test('dollar-sign amount', () => {
  const d = parseVoiceTranscript('$32.99 for gas');
  assert.ok(d);
  assert.equal(d.amount, '32.99');
  assert.equal(d.category, 'Transport');
});

test('partial when no amount — keeps transcript as note', () => {
  const d = parseVoiceTranscript('something about groceries');
  assert.ok(d);
  assert.equal(d.confidence, 'partial');
  assert.equal(d.amount, '');
  assert.equal(d.category, 'Groceries');
  assert.match(d.note, /something|groceries/i);
});

test('empty transcript returns null', () => {
  assert.equal(parseVoiceTranscript('   '), null);
});

test('freelance income alias', () => {
  const d = parseVoiceTranscript('got paid 1500 for freelance work');
  assert.ok(d);
  assert.equal(d.type, 'income');
  assert.equal(d.amount, '1500.00');
  assert.equal(d.category, 'Freelance');
});
