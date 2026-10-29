import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseVoiceTranscript } from './voiceParse.ts';

test('parses spent amount and groceries category', () => {
  const d = parseVoiceTranscript('spent 45 dollars on groceries');
  assert.ok(d);
  assert.equal(d.amount, '45.00');
  assert.equal(d.type, 'expense');
  assert.equal(d.category, 'Groceries');
});

test('parses income salary', () => {
  const d = parseVoiceTranscript('income 2000 salary');
  assert.ok(d);
  assert.equal(d.amount, '2000.00');
  assert.equal(d.type, 'income');
  assert.equal(d.category, 'Salary');
});

test('parses lunch alias to Eating out', () => {
  const d = parseVoiceTranscript('bought lunch for 18.50');
  assert.ok(d);
  assert.equal(d.amount, '18.50');
  assert.equal(d.category, 'Eating out');
});

test('parses gas alias to Transport', () => {
  const d = parseVoiceTranscript('$32.99 for gas');
  assert.ok(d);
  assert.equal(d.amount, '32.99');
  assert.equal(d.category, 'Transport');
});

test('partial when no amount', () => {
  const d = parseVoiceTranscript('something about groceries');
  assert.ok(d);
  assert.equal(d.confidence, 'partial');
  assert.equal(d.category, 'Groceries');
});

test('empty transcript returns null', () => {
  assert.equal(parseVoiceTranscript('   '), null);
});

test('parses freelance income', () => {
  const d = parseVoiceTranscript('got paid 1500 for freelance work');
  assert.ok(d);
  assert.equal(d.amount, '1500.00');
  assert.equal(d.type, 'income');
  assert.equal(d.category, 'Freelance');
});

test('parses spoken thirty dollars for groceries', () => {
  const d = parseVoiceTranscript('Thirty dollars for groceries');
  assert.ok(d);
  assert.equal(d.amount, '30.00');
  assert.equal(d.type, 'expense');
  assert.equal(d.category, 'Groceries');
  assert.equal(d.confidence, 'full');
});

test('parses hyphenated spoken dollars', () => {
  const d = parseVoiceTranscript('twenty-five dollars on gas');
  assert.ok(d);
  assert.equal(d.amount, '25.00');
  assert.equal(d.category, 'Transport');
});

test('parses spoken hundreds and cents', () => {
  const hundreds = parseVoiceTranscript('one hundred and twenty dollars for rent');
  assert.ok(hundreds);
  assert.equal(hundreds.amount, '120.00');
  assert.equal(hundreds.category, 'Rent and Bills');

  const cents = parseVoiceTranscript('thirty dollars and fifty cents for groceries');
  assert.ok(cents);
  assert.equal(cents.amount, '30.50');
  assert.equal(cents.category, 'Groceries');
});

test('parses spoken amount without the word dollars', () => {
  const d = parseVoiceTranscript('spent forty five on lunch');
  assert.ok(d);
  assert.equal(d.amount, '45.00');
  assert.equal(d.category, 'Eating out');
});

test('matches custom category names when provided', () => {
  const d = parseVoiceTranscript('spent 20 on bubble tea', {
    expense: ['Bubble tea'],
  });
  assert.ok(d);
  assert.equal(d.amount, '20.00');
  assert.equal(d.category, 'Bubble tea');
});
