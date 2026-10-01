// Downloads every past NYT Wordle answer, up to two days ago so it never includes a live puzzle,
// into bench/past-answers.json. Dev-only: the site never loads this file.
// Usage: node bench/fetch-past-answers.js
import { writeFileSync } from 'node:fs';

const FIRST_PUZZLE = Date.UTC(2021, 5, 19);
const DAY = 24 * 60 * 60 * 1000;
const PARALLEL = 8;

const dates = [];
for (let time = FIRST_PUZZLE; time <= Date.now() - 2 * DAY; time += DAY) {
    dates.push(new Date(time).toISOString().slice(0, 10));
}

async function fetchAnswer(date, attempt = 1) {
    const response = await fetch(`https://www.nytimes.com/svc/wordle/v2/${date}.json`);
    if (!response.ok) {
        if (attempt < 4) {
            return fetchAnswer(date, attempt + 1);
        }
        throw new Error(`${date}: HTTP ${response.status}`);
    }
    return { date, solution: (await response.json()).solution };
}

const answers = [];
for (let i = 0; i < dates.length; i += PARALLEL) {
    answers.push(...await Promise.all(dates.slice(i, i + PARALLEL).map(date => fetchAnswer(date))));
}
writeFileSync(new URL('./past-answers.json', import.meta.url), JSON.stringify(answers) + '\n');
console.log(`Saved ${answers.length} answers, ${dates[0]} to ${dates.at(-1)}`);
