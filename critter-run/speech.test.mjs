// Read-aloud turns math symbols into words. Run from the repo root: node --test critter-run/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { speakable } from './js/audio.js';

test('math is read as words', () => {
  assert.equal(speakable('15 ÷ 2 = ?'), '15 divided by 2 equals what');
  // A written question's show and q are joined with '. ' before reading.
  assert.equal(speakable('0 ÷ 5 = ?. What is the answer?'), '0 divided by 5 equals what. What is the answer?');
  assert.equal(speakable('27 __ 3 = 9'), '27 blank 3 equals 9');
  assert.equal(speakable('7 R1'), '7 remainder 1');
  assert.equal(speakable('105 − 75 = 30'), '105 minus 75 equals 30');
  assert.equal(speakable('Which one is not even?'), 'Which one is not even?');
});
