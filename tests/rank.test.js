import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeColors, satisfiesHardMode } from '../public/js/wordle.js';
import { buildLexicon, rankAnswers, bestGuess, solve, TIER_WEIGHTS } from '../public/js/rank.js';
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

test('bestGuess obeys hard mode', () => {
    const rows = [row('crane', 'g...y')];
    const candidates = solve(lexicon, rows).likely.map(entry => entry.word);
    const best = bestGuess(candidates, lexicon, { rows, hardMode: true });
    assert.ok(satisfiesHardMode(best.word, rows), best.word);
});

test('solve with no rows returns the opening guess', () => {
    const opening = { word: 'slate', expectedRemaining: 100, goForWin: false };
    assert.deepEqual(solve(lexicon, [], { opening }), { count: 14855, likely: [], best: opening, contradiction: -1 });
});

test('solve reports a contradiction when nothing fits', () => {
    const result = solve(lexicon, [row('crane', 'ggggg'), row('slate', 'ggggg')]);
    assert.deepEqual(result, { count: 0, likely: [], best: null, contradiction: 1 });
    assert.equal(solve(lexicon, [row('speed', '...y.')]).contradiction, 0);
});

test('solve returns every candidate ranked, with a best guess', () => {
    const result = solve(lexicon, [row('crane', '.y...')]);
    assert.equal(result.contradiction, -1);
    assert.equal(result.likely.length, result.count);
    assert.ok(result.count > 10);
    assert.ok(result.best.word);
});
