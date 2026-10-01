import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseWordList, getMostLikelyWords } from '../public/js/solver.js';

const wordList = parseWordList(readFileSync(new URL('../public/words.txt', import.meta.url), 'utf8'));

const colorMap = { d: 'darkgrey', g: 'green', y: 'yellow' };

// Builds guesses from [word, colorCodes] pairs, e.g. ['dealt', 'ddddg']
function constructGuesses(wordDetails) {
    return wordDetails.map(([word, colorCodes]) =>
        [...word].map((character, i) => ({ character, color: colorMap[colorCodes[i]] })));
}

function assertContainsAll(result, expected) {
    for (const word of expected) {
        assert.ok(result.includes(word), `expected result to contain "${word}"`);
    }
}

test('word list has the correct number of words', () => {
    assert.equal(wordList.length, 14855);
});

test('collection 1', () => {
    const result = getMostLikelyWords(wordList, constructGuesses([
        ['dealt', 'ddddg'],
        ['stott', 'ddydg'],
        ['torot', 'dgddg'],
    ]));

    assert.ok(!result.includes('torot'));
    assertContainsAll(result, ['noint', 'oobit', 'point', 'poupt', 'joint', 'mount', 'poynt', 'count', 'fount', 'pokit', 'compt', 'vomit']);
});

test('collection 2', () => {
    const result = getMostLikelyWords(wordList, constructGuesses([
        ['soare', 'dddyy'],
        ['dreer', 'yddgg'],
        ['eider', 'ddggg'],
    ]));

    assert.ok(!result.includes('torot'));
    assertContainsAll(result, ['ruder', 'udder', 'ceder', 'heder', 'nuder', 'under', 'cyder']);
});

test('collection 3', () => {
    const result = getMostLikelyWords(wordList, constructGuesses([
        ['irate', 'dddyy'],
        ['shown', 'dddyd'],
        ['lucky', 'ydddd'],
    ]));

    for (const word of ['jewel', 'dwell', 'wedel']) {
        assert.ok(!result.includes(word), `expected result not to contain "${word}"`);
    }
    assertContainsAll(result, ['tewel', 'tweel', 'dwelt']);
});

test('no guesses returns every word', () => {
    assert.equal(getMostLikelyWords(wordList, []).length, wordList.length);
});
