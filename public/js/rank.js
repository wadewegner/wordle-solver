import { ALL_GREEN, scorePattern, filterCandidates, findContradiction, satisfiesHardMode } from './wordle.js';

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

// The guesses worth scoring: as many as the budget allows, chosen by how evenly their letters
// split the candidates, plus the likeliest candidates so the search can pick a possible winner
function guessPool(allowed, ranked, candidates, weights, totalWeight, scoringBudget) {
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
    return [...new Set([...top, ...ranked.slice(0, MIN_POOL).map(({ word }) => word)])];
}

function isBetterGuess(a, b, lexicon) {
    if (Math.abs(a.entropy - b.entropy) > EPSILON) {
        return a.entropy > b.entropy;
    }
    if (a.isCandidate !== b.isCandidate) {
        return a.isCandidate;
    }
    return lexicon.rank.get(a.word) < lexicon.rank.get(b.word);
}

export function bestGuess(candidates, lexicon, { rows = [], hardMode = false, scoringBudget = SCORING_BUDGET } = {}) {
    if (candidates.length === 0) {
        return null;
    }

    const ranked = rankAnswers(candidates, lexicon);
    const weights = candidates.map(word => lexicon.weight.get(word));
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

    if (ranked.length <= WIN_CANDIDATES || ranked[0].probability >= WIN_PROBABILITY) {
        const word = ranked[0].word;
        const { expectedRemaining } = evaluateGuess(word, candidates, weights, totalWeight);
        return { word, expectedRemaining, goForWin: true };
    }

    // Every candidate fits every row, so it always satisfies hard mode too
    const allowed = hardMode ? lexicon.words.filter(word => satisfiesHardMode(word, rows)) : lexicon.words;
    const isCandidate = new Set(candidates);
    let best = null;
    for (const word of guessPool(allowed, ranked, candidates, weights, totalWeight, scoringBudget)) {
        const guess = { word, isCandidate: isCandidate.has(word), ...evaluateGuess(word, candidates, weights, totalWeight) };
        if (!best || isBetterGuess(guess, best, lexicon)) {
            best = guess;
        }
    }
    return { word: best.word, expectedRemaining: best.expectedRemaining, goForWin: false };
}

// rows: [{ word, pattern }]. Everything the results panel shows. With no rows, the precomputed
// opening guess stands in for a search over all 14,855 words.
export function solve(lexicon, rows, { hardMode = false, opening = null } = {}) {
    if (rows.length === 0) {
        return { count: lexicon.words.length, likely: [], best: opening, contradiction: -1 };
    }

    const candidates = filterCandidates(lexicon.words, rows);
    if (candidates.length === 0) {
        return { count: 0, likely: [], best: null, contradiction: findContradiction(lexicon.words, rows) };
    }

    return {
        count: candidates.length,
        likely: rankAnswers(candidates, lexicon),
        best: bestGuess(candidates, lexicon, { rows, hardMode }),
        contradiction: -1,
    };
}
