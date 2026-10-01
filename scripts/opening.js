// Precomputes the best opening guesses (no rows entered) and writes public/data/opening.json.
// Rerun after changing the word data or tier weights: npm run opening
import { writeFileSync } from 'node:fs';
import { topGuesses } from '../public/js/rank.js';
import { loadLexicon } from './load-lexicon.js';

// Far more than the live budget: this runs once, offline, over all 14,855 words
const OPENING_BUDGET = 60_000_000;

const lexicon = loadLexicon();
const started = performance.now();
const guesses = topGuesses(lexicon.words, lexicon, { scoringBudget: OPENING_BUDGET });
writeFileSync(new URL('../public/data/opening.json', import.meta.url), JSON.stringify({ guesses }) + '\n');
console.log(`Openers: ${guesses.map(g => `${g.word.toUpperCase()} ~${Math.round(g.expectedRemaining)}`).join(', ')} (${((performance.now() - started) / 1000).toFixed(1)}s)`);
