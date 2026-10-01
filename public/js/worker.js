// Runs the solver off the main thread. Loads the word data once, then answers solve requests.
// Only the latest pending request is computed, so rapid edits don't queue up stale searches.
import { encodeColors } from './wordle.js';
import { buildLexicon, solve } from './rank.js';

const fetchText = file => fetch(new URL(`../data/${file}`, import.meta.url)).then(response => {
    if (!response.ok) {
        throw new Error(`${file}: HTTP ${response.status}`);
    }
    return response.text();
});
const lines = text => text.split('\n').map(line => line.trim()).filter(Boolean);

const ready = Promise.all(['words.txt', 'original-answers.txt', 'common.txt', 'opening.json'].map(fetchText))
    .then(([words, original, common, opening]) => ({
        lexicon: buildLexicon(words.trim().split(' '), lines(original), lines(common)),
        opening: JSON.parse(opening).guesses,
    }));

ready.then(
    ({ lexicon }) => self.postMessage({ type: 'ready', words: lexicon.words }),
    error => self.postMessage({ type: 'error', message: String(error) }),
);

let pending = null;

self.addEventListener('message', ({ data }) => {
    if (data.type !== 'solve') {
        return;
    }
    const scheduled = pending !== null;
    pending = data;
    if (!scheduled) {
        setTimeout(solvePending, 0);
    }
});

async function solvePending() {
    const request = pending;
    pending = null;
    try {
        const { lexicon, opening } = await ready;
        const rows = request.guesses.map(({ word, colors }) => ({ word, pattern: encodeColors(colors) }));
        const results = solve(lexicon, rows, { opening });
        self.postMessage({ type: 'results', id: request.id, results });
    } catch (error) {
        self.postMessage({ type: 'error', message: String(error) });
    }
}
