import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
    ALL_GREEN, scorePattern, encodeColors, decodePattern, filterCandidates, findContradiction,
} from '../public/js/wordle.js';

const words = readFileSync(new URL('../public/data/words.txt', import.meta.url), 'utf8').trim().split(' ');

// Pattern codes for readable tests: g = green, y = yellow, . = gray
const COLOR_CODES = { g: 'green', y: 'yellow', '.': 'gray' };
const pattern = code => encodeColors([...code].map(c => COLOR_CODES[c]));
const row = (word, code) => ({ word, pattern: pattern(code) });

// Seeded random numbers so failures are reproducible
function random(seed) {
    let state = seed;
    return max => {
        state = (state * 1103515245 + 12345) % 2147483648;
        return state % max;
    };
}

// Straightforward reference implementation of Wordle's coloring
function referenceColors(guess, answer) {
    const colors = Array(5).fill('gray');
    const unmatched = [];
    for (let i = 0; i < 5; i++) {
        if (guess[i] === answer[i]) {
            colors[i] = 'green';
        } else {
            unmatched.push(answer[i]);
        }
    }
    for (let i = 0; i < 5; i++) {
        const at = unmatched.indexOf(guess[i]);
        if (colors[i] === 'gray' && at !== -1) {
            colors[i] = 'yellow';
            unmatched.splice(at, 1);
        }
    }
    return colors;
}

test('encodeColors and decodePattern round-trip', () => {
    assert.equal(encodeColors(['green', 'gray', 'gray', 'yellow', 'gray']), 165);
    assert.deepEqual(decodePattern(165), ['green', 'gray', 'gray', 'yellow', 'gray']);
    assert.equal(encodeColors(Array(5).fill('green')), ALL_GREEN);
    assert.equal(encodeColors(Array(5).fill('gray')), 0);
});

test('scorePattern matches Wordle, including repeated letters', () => {
    const cases = [
        ['crane', 'crane', 'ggggg'],
        ['crane', 'pious', '.....'],
        ['speed', 'abide', '..y.y'],
        ['eerie', 'there', 'y.y.g'],
        ['geese', 'sheep', '.ygy.'],
        ['level', 'lever', 'gggg.'],
        ['sassy', 'essay', 'yyg.g'],
        ['robot', 'motor', 'yg.gy'],
        ['allee', 'label', 'yyyg.'],
    ];
    for (const [guess, answer, code] of cases) {
        assert.equal(scorePattern(guess, answer), pattern(code), `${guess} vs ${answer}`);
    }
});

test('scorePattern agrees with the reference implementation on random pairs', () => {
    const next = random(1);
    for (let i = 0; i < 20000; i++) {
        const guess = words[next(words.length)];
        const answer = words[next(words.length)];
        assert.deepEqual(decodePattern(scorePattern(guess, answer)), referenceColors(guess, answer), `${guess} vs ${answer}`);
    }
});

test('filterCandidates never drops the real answer', () => {
    const next = random(2);
    for (let game = 0; game < 500; game++) {
        const answer = words[next(words.length)];
        const rows = Array.from({ length: 1 + next(4) }, () => {
            const guess = words[next(words.length)];
            return { word: guess, pattern: scorePattern(guess, answer) };
        });
        assert.ok(filterCandidates(words, rows).includes(answer), `answer ${answer} dropped`);
    }
});

test('filterCandidates keeps exactly the words consistent with every row', () => {
    const next = random(3);
    for (let state = 0; state < 30; state++) {
        const answer = words[next(words.length)];
        const rows = [words[next(words.length)], words[next(words.length)]]
            .map(guess => ({ word: guess, pattern: scorePattern(guess, answer) }));
        const expected = words.filter(word =>
            rows.every(r => referenceColors(r.word, word).join() === decodePattern(r.pattern).join()));
        assert.deepEqual(filterCandidates(words, rows), expected);
    }
});

test('filterCandidates enforces repeated-letter counts', () => {
    // Two S's shown (one green, one yellow), so the answer has at least two S's
    const candidates = filterCandidates(words, [row('wases', '.gy.g')]);
    assert.ok(candidates.length > 0);
    assert.ok(candidates.every(word => [...word].filter(c => c === 's').length >= 2));
});

// Ported from the original C# SuggestionEngine tests. Exact Wordle rules correctly drop OOBIT,
// RUDER, CEDER and HEDER, which the old filter kept.
test('original regression cases', () => {
    const one = filterCandidates(words, [row('dealt', '....g'), row('stott', '..y.g'), row('torot', '.g..g')]);
    assert.deepEqual(new Set(one), new Set(['noint', 'point', 'poupt', 'joint', 'mount', 'poynt', 'count', 'fount', 'pokit', 'compt', 'vomit']));

    const two = filterCandidates(words, [row('soare', '...yy'), row('dreer', 'y..gg'), row('eider', '..ggg')]);
    assert.deepEqual(new Set(two), new Set(['udder', 'nuder', 'under', 'cyder']));

    const three = filterCandidates(words, [row('irate', '...yy'), row('shown', '...y.'), row('lucky', 'y....')]);
    assert.deepEqual(new Set(three), new Set(['tewel', 'tweel', 'dwelt']));
});

test('findContradiction names the first row after which nothing fits', () => {
    assert.equal(findContradiction(words, [row('crane', '.....')]), -1);
    assert.equal(findContradiction(words, [row('crane', 'ggggg'), row('slate', 'ggggg')]), 1);
    assert.equal(findContradiction(words, [row('crane', 'ggggg'), row('slate', 'ggggg'), row('pious', '.....')]), 1);
});

test('findContradiction catches a pattern Wordle can never show', () => {
    // The first E would be marked yellow before the second, so this row is impossible
    assert.equal(findContradiction(words, [row('speed', '...y.')]), 0);
});
