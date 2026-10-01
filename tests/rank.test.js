import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeColors, filterCandidates } from '../public/js/wordle.js';
import { buildLexicon, rankAnswers, bestGuess, topGuesses, solve, TIER_WEIGHTS, TOP_GUESSES } from '../public/js/rank.js';
import { loadLexicon } from '../scripts/load-lexicon.js';

const lexicon = loadLexicon();
const COLOR_CODES = { g: 'green', y: 'yellow', '.': 'gray' };
const row = (word, code) => ({ word, pattern: encodeColors([...code].map(c => COLOR_CODES[c])) });

test('buildLexicon weights words by tier and orders them by likelihood', () => {
    const small = buildLexicon(['apple', 'crane', 'zesty', 'aalii'], ['crane'], ['zesty']);
    assert.equal(small.weight.get('crane'), TIER_WEIGHTS.original);
    assert.equal(small.weight.get('zesty'), TIER_WEIGHTS.common);
    assert.equal(small.weight.get('aalii'), TIER_WEIGHTS.other);
    assert.deepEqual([...small.rank.keys()], ['crane', 'zesty', 'apple', 'aalii']);
});

test('rankAnswers sorts likeliest first and probabilities sum to 1', () => {
    const ranked = rankAnswers(['aalii', 'zesty', 'crane'], buildLexicon(['crane', 'zesty', 'aalii'], ['crane'], ['zesty']));
    assert.deepEqual(ranked.map(entry => entry.word), ['crane', 'zesty', 'aalii']);
    const total = ranked.reduce((sum, entry) => sum + entry.probability, 0);
    assert.ok(Math.abs(total - 1) < 1e-9);
});

test('bestGuess returns null when nothing fits', () => {
    assert.equal(bestGuess([], lexicon), null);
});

test('bestGuess goes for the win with two or fewer candidates', () => {
    const best = bestGuess(['under', 'udder'], lexicon);
    assert.equal(best.goForWin, true);
    assert.ok(['under', 'udder'].includes(best.word));
    assert.equal(best.word, rankAnswers(['under', 'udder'], lexicon)[0].word);
});

test('bestGuess goes for the win when one candidate is at least 50% likely', () => {
    const small = buildLexicon(['apple', 'apply', 'ample'], ['apple'], []);
    const best = bestGuess(['apple', 'apply', 'ample'], small);
    assert.deepEqual(best, { word: 'apple', expectedRemaining: best.expectedRemaining, goForWin: true });
});

test('bestGuess picks an accepted word that narrows things down, deterministically', () => {
    const rows = [row('crane', '.....')];
    const candidates = solve(lexicon, rows).likely.map(entry => entry.word);
    const best = bestGuess(candidates, lexicon, { rows });
    assert.equal(best.goForWin, false);
    assert.ok(lexicon.weight.has(best.word));
    assert.ok(best.expectedRemaining < candidates.length / 5, `expected remaining ${best.expectedRemaining}`);
    assert.deepEqual(bestGuess(candidates, lexicon, { rows }), best);
});

test('suggestions are always words that could be the answer', () => {
    // E is green in the last spot, so FOUND tests new letters but can't be the answer
    const rows = [row('tarse', '....g'), row('while', '....g')];
    const candidates = filterCandidates(lexicon.words, rows);
    const guesses = topGuesses(candidates, lexicon);
    assert.ok(guesses.length > 0);
    assert.ok(guesses.every(g => candidates.includes(g.word)), guesses.map(g => g.word).join());
    assert.ok(!guesses.some(g => g.word === 'found'));
});

test('suggestions come from the original answers while any remain', () => {
    // Without this, proper nouns and rare words like ALLAN, MOANA and LIANA were suggested here
    const rows = [row('tarse', '.y...')];
    const guesses = topGuesses(filterCandidates(lexicon.words, rows), lexicon);
    assert.ok(guesses.every(g => lexicon.weight.get(g.word) === TIER_WEIGHTS.original), guesses.map(g => g.word).join());
});

test('topGuesses returns the ten strongest distinct guesses, best first', () => {
    const rows = [row('crane', '.....')];
    const candidates = solve(lexicon, rows).likely.map(entry => entry.word);
    const guesses = topGuesses(candidates, lexicon, { rows });
    assert.equal(guesses.length, TOP_GUESSES);
    assert.equal(new Set(guesses.map(g => g.word)).size, TOP_GUESSES);
    assert.deepEqual(guesses[0], bestGuess(candidates, lexicon, { rows }));
    assert.ok(guesses.every(g => lexicon.weight.has(g.word)));
});

test('topGuesses lists the likeliest answers when going for the win', () => {
    const guesses = topGuesses(['under', 'udder'], lexicon);
    assert.equal(guesses.length, 2);
    assert.ok(guesses.every(g => g.goForWin));
});

test('solve with no rows returns the opening guesses', () => {
    const opening = [{ word: 'slate', expectedRemaining: 100, goForWin: false }, { word: 'crane', expectedRemaining: 110, goForWin: false }];
    assert.deepEqual(solve(lexicon, [], { opening }), { count: 14855, likely: [], best: opening[0], guesses: opening, contradiction: -1 });
});

test('solve reports a contradiction and keeps the suggestions from the rows before it', () => {
    const before = solve(lexicon, [row('crane', '.y...')]);
    const result = solve(lexicon, [row('crane', '.y...'), row('slate', 'ggggg'), row('pious', 'ggggg')]);
    assert.equal(result.contradiction, 1);
    assert.deepEqual({ ...result, contradiction: -1 }, before);

    const opening = [{ word: 'raise', expectedRemaining: 342, goForWin: false }];
    assert.deepEqual(solve(lexicon, [row('speed', '...y.')], { opening }), { ...solve(lexicon, [], { opening }), contradiction: 0 });
});

test('solve returns every candidate ranked, with a best guess', () => {
    const result = solve(lexicon, [row('crane', '.y...')]);
    assert.equal(result.contradiction, -1);
    assert.equal(result.likely.length, result.count);
    assert.ok(result.count > 10);
    assert.ok(result.best.word);
    assert.equal(result.guesses[0], result.best);
});
