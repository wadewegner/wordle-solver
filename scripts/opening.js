// Precomputes the best opening guess (no rows entered) and writes public/data/opening.json.
// Rerun after changing the word data or tier weights: npm run opening
import { writeFileSync } from 'node:fs';
import { bestGuess } from '../public/js/rank.js';
import { loadLexicon } from './load-lexicon.js';

// Far more than the live budget: this runs once, offline, over all 14,855 words
const OPENING_BUDGET = 60_000_000;

const lexicon = loadLexicon();
const started = performance.now();
const opening = bestGuess(lexicon.words, lexicon, { scoringBudget: OPENING_BUDGET });
writeFileSync(new URL('../public/data/opening.json', import.meta.url), JSON.stringify(opening) + '\n');
console.log(`Opening: ${opening.word.toUpperCase()}, ~${opening.expectedRemaining.toFixed(1)} left (${((performance.now() - started) / 1000).toFixed(1)}s)`);
