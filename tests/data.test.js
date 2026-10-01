import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = file => readFileSync(new URL(`../public/data/${file}`, import.meta.url), 'utf8');
const lines = text => text.split('\n').map(line => line.trim()).filter(Boolean);

const words = read('words.txt').trim().split(' ');
const accepted = new Set(words);
const original = lines(read('original-answers.txt'));
const common = lines(read('common.txt'));

test('words.txt is the 14,855 accepted guesses', () => {
    assert.equal(words.length, 14855);
    assert.equal(accepted.size, 14855);
    assert.ok(words.every(word => /^[a-z]{5}$/.test(word)));
});

test('original-answers.txt is the original answer list minus the six words NYT removed', () => {
    assert.equal(original.length, 2309);
    assert.equal(new Set(original).size, 2309);
    assert.ok(original.every(word => accepted.has(word)));
    for (const removed of ['agora', 'fibre', 'lynch', 'pupal', 'slave', 'wench']) {
        assert.ok(!original.includes(removed), removed);
    }
    for (const answer of ['cigar', 'awake', 'crane', 'trace']) {
        assert.ok(original.includes(answer), answer);
    }
});

test('common.txt is common accepted words outside the original answers', () => {
    const originalSet = new Set(original);
    assert.equal(new Set(common).size, common.length);
    assert.ok(common.every(word => accepted.has(word)));
    assert.ok(common.every(word => !originalSet.has(word)));
    assert.ok(common.length > 1000 && common.length < 6000, `unexpected size ${common.length}`);
    // Recent answers from outside the original list should mostly be here
    for (const answer of ['nifty', 'beige', 'remix', 'emoji', 'kazoo']) {
        assert.ok(common.includes(answer), answer);
    }
    // Plurals and past tenses of common words are left out
    for (const inflected of ['aches', 'acted', 'cares']) {
        assert.ok(!common.includes(inflected), inflected);
    }
});

test('opening.json holds a precomputed opening guess', () => {
    const opening = JSON.parse(read('opening.json'));
    assert.ok(accepted.has(opening.word), opening.word);
    assert.equal(opening.goForWin, false);
    // Counts every accepted word, obscure ones included, so it's in the hundreds
    assert.ok(opening.expectedRemaining > 0 && opening.expectedRemaining < 3000);
});
