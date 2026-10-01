// Loads the site's word data in Node, for tests, the benchmark and scripts
import { readFileSync } from 'node:fs';
import { buildLexicon } from '../public/js/rank.js';

const read = file => readFileSync(new URL(`../public/data/${file}`, import.meta.url), 'utf8');
const lines = text => text.split('\n').map(line => line.trim()).filter(Boolean);

export function loadLexicon(tierWeights) {
    return buildLexicon(
        read('words.txt').trim().split(' '),
        lines(read('original-answers.txt')),
        lines(read('common.txt')),
        tierWeights,
    );
}

export function loadOpening() {
    return JSON.parse(read('opening.json'));
}
