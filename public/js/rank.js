import { ALL_GREEN, scorePattern, filterCandidates, findContradiction } from './wordle.js';

// Relative likelihood that NYT picks a word, by tier (tuned with `npm run benchmark`)
export const TIER_WEIGHTS = { original: 1, common: 0.1, other: 0.001 };

// Most scorePattern calls one best-guess search may make, which keeps it under ~300 ms on phones
export const SCORING_BUDGET = 1_500_000;

// Fewest guesses to consider however many candidates remain, and how many of the likeliest
// candidates are always considered
const MIN_POOL = 200;

// Go for the win when this few candidates remain, or the likeliest is at least this likely
const WIN_CANDIDATES = 2;
const WIN_PROBABILITY = 0.5;

// How many next guesses to suggest
export const TOP_GUESSES = 10;

const EPSILON = 1e-9;

// Weights each word by tier and orders all words by likelihood: original answers, then common
// words (each file is sorted most frequent first), then everything else in dictionary order
export function buildLexicon(words, originalAnswers, commonWords, tierWeights = TIER_WEIGHTS) {
    const original = new Set(originalAnswers);
    const common = new Set(commonWords);
    const weight = new Map();
    const rank = new Map();

    for (const word of [...originalAnswers, ...commonWords, ...words]) {
        if (!rank.has(word)) {
            rank.set(word, rank.size);
        }
    }
    for (const word of words) {
        weight.set(word, original.has(word) ? tierWeights.original : common.has(word) ? tierWeights.common : tierWeights.other);
    }
    return { words, weight, rank };
}

export function rankAnswers(candidates, lexicon) {
    const totalWeight = candidates.reduce((sum, word) => sum + lexicon.weight.get(word), 0);
    return candidates
        .map(word => ({ word, probability: lexicon.weight.get(word) / totalWeight }))
        .sort((a, b) => b.probability - a.probability || lexicon.rank.get(a.word) - lexicon.rank.get(b.word));
}

// Scratch buffers for evaluateGuess, one slot per possible pattern
const patternWeight = new Float64Array(243);
const patternCount = new Uint32Array(243);

// How a guess splits the candidates: the entropy (in bits) of the pattern distribution, and the
// expected number of candidates left afterward (zero if it turns out to be the answer)
function evaluateGuess(guess, candidates, weights, totalWeight) {
    patternWeight.fill(0);
    patternCount.fill(0);
    for (let i = 0; i < candidates.length; i++) {
        const pattern = scorePattern(guess, candidates[i]);
        patternWeight[pattern] += weights[i];
        patternCount[pattern]++;
    }

    let entropy = 0;
    let expectedRemaining = 0;
    for (let pattern = 0; pattern < 243; pattern++) {
        if (patternCount[pattern] === 0) {
            continue;
        }
        const probability = patternWeight[pattern] / totalWeight;
        entropy -= probability * Math.log2(probability);
        if (pattern !== ALL_GREEN) {
            expectedRemaining += probability * patternCount[pattern];
        }
    }
    return { entropy, expectedRemaining };
}

// The guesses worth scoring, from `allowed` (sorted likeliest first): as many as the budget allows,
// chosen by how evenly their letters split the candidates, plus the likeliest
function guessPool(allowed, candidates, weights, totalWeight, scoringBudget) {
    const size = Math.max(MIN_POOL, Math.floor(scoringBudget / candidates.length));
    if (allowed.length <= size) {
        return allowed;
    }

    const letterWeight = new Float64Array(26);
    candidates.forEach((word, i) => {
        for (const letter of new Set(word)) {
            letterWeight[letter.charCodeAt(0) - 97] += weights[i];
        }
    });
    const usefulness = word => [...new Set(word)].reduce((sum, letter) => {
        const weight = letterWeight[letter.charCodeAt(0) - 97];
        return sum + Math.min(weight, totalWeight - weight);
    }, 0);

    const top = allowed
        .map(word => ({ word, score: usefulness(word) }))
        .sort((a, b) => b.score - a.score || (a.word < b.word ? -1 : 1))
        .slice(0, size)
        .map(({ word }) => word);
    return [...new Set([...top, ...allowed.slice(0, MIN_POOL)])];
}

// Best first: more information, then likelier words
function compareGuesses(a, b, lexicon) {
    if (Math.abs(a.entropy - b.entropy) > EPSILON) {
        return b.entropy - a.entropy;
    }
    return lexicon.rank.get(a.word) - lexicon.rank.get(b.word);
}

// The strongest next guesses, best first. Every suggestion could still be the answer, and comes from
// the likeliest tier still in play: while any original answers remain, only they are suggested.
export function topGuesses(candidates, lexicon, { scoringBudget = SCORING_BUDGET, count = TOP_GUESSES } = {}) {
    if (candidates.length === 0) {
        return [];
    }

    const ranked = rankAnswers(candidates, lexicon);
    const weights = candidates.map(word => lexicon.weight.get(word));
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

    if (ranked.length <= WIN_CANDIDATES || ranked[0].probability >= WIN_PROBABILITY) {
        return ranked.slice(0, count).map(({ word }) => ({
            word,
            expectedRemaining: evaluateGuess(word, candidates, weights, totalWeight).expectedRemaining,
            goForWin: true,
        }));
    }

    const topWeight = lexicon.weight.get(ranked[0].word);
    const allowed = ranked.map(({ word }) => word).filter(word => lexicon.weight.get(word) === topWeight);
    return guessPool(allowed, candidates, weights, totalWeight, scoringBudget)
        .map(word => ({ word, ...evaluateGuess(word, candidates, weights, totalWeight) }))
        .sort((a, b) => compareGuesses(a, b, lexicon))
        .slice(0, count)
        .map(({ word, expectedRemaining }) => ({ word, expectedRemaining, goForWin: false }));
}

export function bestGuess(candidates, lexicon, options = {}) {
    return topGuesses(candidates, lexicon, { ...options, count: 1 })[0] ?? null;
}

// rows: [{ word, pattern }]. Everything the results panel shows. With no rows, the precomputed
// opening guesses stand in for a search over all 14,855 words. When no word fits every row,
// `contradiction` names the first row that doesn't fit and the rest describes the rows before it,
// so the panel still has suggestions while the player fixes the colors.
export function solve(lexicon, rows, { opening = [] } = {}) {
    if (rows.length === 0) {
        return { count: lexicon.words.length, likely: [], best: opening[0] ?? null, guesses: opening, contradiction: -1 };
    }

    const candidates = filterCandidates(lexicon.words, rows);
    if (candidates.length === 0) {
        const contradiction = findContradiction(lexicon.words, rows);
        return { ...solve(lexicon, rows.slice(0, contradiction), { opening }), contradiction };
    }

    const guesses = topGuesses(candidates, lexicon);
    return { count: candidates.length, likely: rankAnswers(candidates, lexicon), best: guesses[0], guesses, contradiction: -1 };
}
