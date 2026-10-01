// Plays every past NYT Wordle answer using Wordle Wizard's best guess and reports how it did.
// Dev-only. Usage: npm run benchmark [-- --limit N]
import { readFileSync } from 'node:fs';
import { ALL_GREEN, scorePattern } from '../public/js/wordle.js';
import { solve } from '../public/js/rank.js';
import { loadLexicon, loadOpening } from '../scripts/load-lexicon.js';

const MAX_TURNS = 12;

const args = process.argv.slice(2);
const limit = args.includes('--limit') ? Number(args[args.indexOf('--limit') + 1]) : Infinity;

const lexicon = loadLexicon();
const opening = loadOpening().guesses;
const answers = JSON.parse(readFileSync(new URL('./past-answers.json', import.meta.url), 'utf8'))
    .map(({ solution }) => solution)
    .slice(0, limit);

const distribution = {};
const unsolved = [];
let totalTurns = 0;
let searchTime = 0;
let searches = 0;
let slowest = 0;

for (const answer of answers) {
    const rows = [];
    let turns = MAX_TURNS + 1;
    for (let turn = 1; turn <= MAX_TURNS; turn++) {
        const started = performance.now();
        const { best } = solve(lexicon, rows, { opening });
        if (rows.length > 0) {
            const elapsed = performance.now() - started;
            searchTime += elapsed;
            searches++;
            slowest = Math.max(slowest, elapsed);
        }
        const pattern = scorePattern(best.word, answer);
        if (pattern === ALL_GREEN) {
            turns = turn;
            break;
        }
        rows.push({ word: best.word, pattern });
    }
    distribution[turns] = (distribution[turns] ?? 0) + 1;
    totalTurns += turns;
    if (turns > 6) {
        unsolved.push(answer);
    }
}

const solved = answers.length - unsolved.length;
console.log(`${answers.length} past answers, opening ${opening[0].word.toUpperCase()}`);
console.log(`  solved within 6: ${solved}/${answers.length} (${(100 * solved / answers.length).toFixed(2)}%)`);
console.log(`  average guesses: ${(totalTurns / answers.length).toFixed(3)}`);
console.log(`  distribution:    ${Object.entries(distribution).map(([turns, count]) => `${turns}:${count}`).join('  ')}`);
console.log(`  search time:     average ${(searchTime / searches).toFixed(1)} ms, slowest ${slowest.toFixed(0)} ms`);
if (unsolved.length > 0) {
    console.log(`  not solved within 6: ${unsolved.join(', ')}`);
}
