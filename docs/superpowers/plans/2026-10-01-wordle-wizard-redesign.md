# Wordle Wizard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild Wordle Wizard as a fast, wizard-branded, accessible static site. It recommends one best next guess, using an exact Wordle filter and an information-based search, and ranks the likeliest answers.

**Architecture:**
- **Stack:** plain HTML, CSS and ES modules served from `public/` by Netlify. No framework and no build step.
- **Pure logic:** `wordle.js` (scoring and filtering), `rank.js` (likelihood and best guess) and `board.js` (board rules). None of them touch the DOM, and all are unit tested with `node:test`.
- **Workers:** `worker.js` runs the solver off the main thread. `app.js` is the only file that touches the DOM.
- **Data:** static word lists in `public/data/`, generated once by scripts.

**Tech Stack:**
- Vanilla JS (ES2022 modules, module Web Worker), CSS with `light-dark()`
- Node 22+ `node:test`
- Python 3 with `wordfreq`, for the one-time data script only
- Netlify, plus Playwright and Lighthouse for verification only

**Spec:** `docs/superpowers/specs/2026-10-01-wordle-wizard-redesign-design.md`

## Global Constraints

### Dependencies and runtime

- No npm dependencies of any kind. `package.json` has scripts only.
- Netlify builds with `npm test`, publishes `public/`, and uses `NODE_VERSION = "22"`.
- Browser target: current evergreen browsers. That means module workers and `light-dark()`, so Safari 17.5 or later.

### Data and analytics

- `public/data/words.txt` content is unchanged: 14,855 lowercase words on one line, separated by single spaces.
- The Google Analytics tag `G-ZL1VPX5V4V` stays. No cookie-consent banner. GA events carry counts and positions only, never words.

### Colors (white letters)

- **Tiles:** green `#538d4e`, yellow `#a68f2c`, gray `#787c7e`.
- **High-contrast mode:** green becomes `#e2652a` (orange) and yellow becomes `#3d7fc4` (blue).

### Copy

- **Page title:** `Wordle Wizard: Wordle Solver & Best Next Guess`
- **Footer:** contains `Not affiliated with The New York Times.`
- **Board errors:** `Not enough letters` and `Not in word list`
- **Contradiction messages:**
  - `No words fit row 1. Check its colors.` when the contradiction is in row 1.
  - Otherwise, `No words fit. Row N contradicts the earlier rows. Check its colors.`
- **Color cycle order:** gray → yellow → green → gray

### Layout

- Two columns at ≥ 860 px.
- No horizontal scrolling at 320 px.
- On-screen keys are 52 px tall.

### Budgets

- The site's own assets total ≤ 150 KB transferred on first load, excluding GA.
- Lighthouse (mobile): Performance ≥ 90, Accessibility ≥ 95, SEO ≥ 95.
- Best-guess search: at most about 1,500,000 `scorePattern` calls, which is under 300 ms on a mid-range phone.

### Solver quality

- Benchmark target (normal mode, all past answers): at least 99% solved within 6, and an average of 3.7 or less.

### Process

- Saved boards reset at the player's **local** midnight.
- Work happens on branch `redesign`. Nothing is pushed until the owner approves a local review (Task 9).

## Review Focus

1. **Rapid edits:** after quickly tapping tile colors, the results panel must end up showing results for the final board, never a stale earlier one. Task 6, Step 9 checks this in the browser.
2. **Corrupt or old saved data:** malformed JSON, the wrong shape, or a previous day's board must load as a fresh board with no errors. Task 5 covers it with `restoreBoard` unit tests, and Task 6, Step 9 reloads the page with garbage in storage.
3. **Impossible colors within one row:** for example, SPEED with the first E gray and the second E yellow. Wordle can never show this, so the message must name row 1. Task 2 tests `findContradiction` and Task 3 tests `solve`.
4. **Keyboard edge cases:** Cmd/Ctrl/Alt key combinations and typing while a dialog is open must not change the board. Enter while a tile has focus must submit, not recolor. Task 6, Step 9 checks these.
5. **Word data fails to load** (offline, or blocked): show a visible error instead of a stuck "Loading…". Task 6, Step 9 blocks the word list in the browser to check this.

---

## File Map

| Path | Status | Responsibility |
|---|---|---|
| `public/data/words.txt` | moved from `public/words.txt` | 14,855 accepted guesses |
| `public/data/original-answers.txt` | new, generated | Tier A: 2,309 words, most frequent first |
| `public/data/common.txt` | new, generated | Tier B: common words outside Tier A, most frequent first |
| `public/data/opening.json` | new, generated | precomputed opening best guess |
| `scripts/build-word-data.py` | new | generates `original-answers.txt` and `common.txt` |
| `scripts/load-lexicon.js` | new | Node helper that loads the data files into a lexicon |
| `scripts/opening.js` | new | writes `opening.json` |
| `scripts/og-image.html` | new | template for the link-preview image |
| `bench/fetch-past-answers.js` | new | downloads past NYT answers (dev-only) |
| `bench/past-answers.json` | new, generated | benchmark fixture (dev-only) |
| `bench/benchmark.js` | new | plays every past answer |
| `public/js/wordle.js` | new | scoring, filtering, contradictions, hard mode |
| `public/js/rank.js` | new | lexicon, ranking, best guess, `solve` |
| `public/js/board.js` | new | board state and rules, persistence |
| `public/js/worker.js` | new | Web Worker adapter |
| `public/js/app.js` | rewritten | DOM, events, rendering, settings, GA events |
| `public/index.html` | rewritten | app markup, then the FAQ, meta tags and structured data |
| `public/css/site.css` | rewritten | all styles |
| `public/privacy/index.html` | rewritten | accurate privacy policy |
| `public/404.html`, `public/robots.txt`, `public/sitemap.xml` | new | site files |
| `public/favicon.ico` | regenerated | from the hat icon |
| `public/img/logo.webp`, `public/img/apple-touch-icon.png`, `public/img/og-image.png` | new | images |
| `public/fonts/cinzel-700-subset.woff2`, `public/fonts/OFL.txt` | new | display font and its license |
| `assets/wizard.png`, `assets/icons-wizard.png` | moved from `public/` | source art; not served |
| `tests/*.test.js` | new | unit tests |
| `public/js/solver.js`, `public/js/overlay.js`, `public/lib/`, `tests/solver.test.js` | deleted | replaced |
| `netlify.toml`, `package.json`, `README.md` | modified | config and docs |

---

### Task 1: Word data

**Files:**
- Move: `public/words.txt` → `public/data/words.txt`
- Create: `scripts/build-word-data.py`, `public/data/original-answers.txt`, `public/data/common.txt`, `tests/data.test.js`
- Modify: `tests/solver.test.js` (data path), `public/js/app.js` (fetch path). These are the old files, kept working until Task 6 replaces them.

**Interfaces:**
- Produces:
  - `public/data/original-answers.txt` and `public/data/common.txt`: one lowercase word per line, most frequent first, with a trailing newline.
  - `public/data/words.txt`: unchanged.

- [ ] **Step 1: Write the failing data test**

Create `tests/data.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = file => readFileSync(new URL(`../public/data/${file}`, import.meta.url), 'utf8');
const lines = text => text.split('\n').map(line => line.trim()).filter(Boolean);

const words = read('words.txt').trim().split(' ');
const accepted = new Set(words);
const original = lines(read('original-answers.txt'));
const common = lines(read('common.txt'));

test('words.txt is the 14,855 accepted guesses', () => {
    assert.equal(words.length, 14855);
    assert.equal(accepted.size, 14855);
    assert.ok(words.every(word => /^[a-z]{5}$/.test(word)));
});

test('original-answers.txt is the original answer list minus the six words NYT removed', () => {
    assert.equal(original.length, 2309);
    assert.equal(new Set(original).size, 2309);
    assert.ok(original.every(word => accepted.has(word)));
    for (const removed of ['agora', 'fibre', 'lynch', 'pupal', 'slave', 'wench']) {
        assert.ok(!original.includes(removed), removed);
    }
    for (const answer of ['cigar', 'awake', 'crane', 'trace']) {
        assert.ok(original.includes(answer), answer);
    }
});

test('common.txt is common accepted words outside the original answers', () => {
    const originalSet = new Set(original);
    assert.equal(new Set(common).size, common.length);
    assert.ok(common.every(word => accepted.has(word)));
    assert.ok(common.every(word => !originalSet.has(word)));
    assert.ok(common.length > 1000 && common.length < 6000, `unexpected size ${common.length}`);
    // Recent answers from outside the original list should mostly be here
    for (const answer of ['nifty', 'beige', 'remix', 'emoji', 'kazoo']) {
        assert.ok(common.includes(answer), answer);
    }
    // Plurals and past tenses of common words are left out
    for (const inflected of ['aches', 'acted', 'cares']) {
        assert.ok(!common.includes(inflected), inflected);
    }
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test tests/data.test.js`
Expected: FAIL with `ENOENT` (no `public/data/words.txt`).

- [ ] **Step 3: Move the word list and fix the old paths**

```bash
mkdir -p public/data
git mv public/words.txt public/data/words.txt
sed -i '' "s#'../public/words.txt'#'../public/data/words.txt'#" tests/solver.test.js
sed -i '' "s#fetch('/words.txt')#fetch('/data/words.txt')#" public/js/app.js
grep -n "data/words.txt" tests/solver.test.js public/js/app.js
```

Expected: one match in each file.

- [ ] **Step 4: Write the data generator**

Create `scripts/build-word-data.py`:

```python
"""Generates public/data/original-answers.txt and public/data/common.txt.

original-answers.txt: the 2,315-word answer list from the original 2021 Wordle, minus the six words
NYT removed in 2022. That leaves the 2,309 words NYT's game still ships as its answer list.
common.txt: other accepted words that are common in English (wordfreq Zipf frequency at or above
--threshold) and aren't a plural or past tense of a common shorter word.
Both files are sorted most frequent first, which is how the site breaks ties between equally
likely words.

wordfreq data is CC BY-SA 4.0 (https://github.com/rspeer/wordfreq); the site credits it.

Usage:
    python3 -m venv /tmp/wfvenv && /tmp/wfvenv/bin/pip install wordfreq
    /tmp/wfvenv/bin/python scripts/build-word-data.py [--threshold 2.0]
"""
import argparse
import urllib.request
from pathlib import Path

from wordfreq import zipf_frequency

ORIGINAL_ANSWERS_URL = (
    'https://gist.githubusercontent.com/cfreshman/a03ef2cba789d8cf00c08f767e0fad7b'
    '/raw/wordle-answers-alphabetical.txt'
)
REMOVED_BY_NYT = {'agora', 'fibre', 'lynch', 'pupal', 'slave', 'wench'}
DATA = Path(__file__).resolve().parent.parent / 'public' / 'data'
STEM_THRESHOLD = 3.0


def zipf(word):
    return zipf_frequency(word, 'en')


def is_inflection(word):
    """True for plurals and past tenses of common shorter words, e.g. aches, acted, rated."""
    if word.endswith('s') and not word.endswith(('ss', 'us', 'is')) and zipf(word[:-1]) >= STEM_THRESHOLD:
        return True
    if word.endswith('es') and zipf(word[:-2]) >= STEM_THRESHOLD:
        return True
    if word.endswith('ed') and (zipf(word[:-2]) >= STEM_THRESHOLD or zipf(word[:-1]) >= STEM_THRESHOLD):
        return True
    return False


def by_frequency(words):
    return sorted(words, key=lambda word: (-zipf(word), word))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--threshold', type=float, default=2.0)
    args = parser.parse_args()

    accepted = (DATA / 'words.txt').read_text().split()
    with urllib.request.urlopen(ORIGINAL_ANSWERS_URL) as response:
        downloaded = response.read().decode().split()
    original = [word for word in downloaded if word not in REMOVED_BY_NYT]
    assert len(original) == 2309, f'expected 2,309 original answers, got {len(original)}'
    assert set(original) <= set(accepted), 'original answers must all be accepted guesses'

    original_set = set(original)
    common = [
        word for word in accepted
        if word not in original_set and zipf(word) >= args.threshold and not is_inflection(word)
    ]

    (DATA / 'original-answers.txt').write_text('\n'.join(by_frequency(original)) + '\n')
    (DATA / 'common.txt').write_text('\n'.join(by_frequency(common)) + '\n')
    print(f'original-answers.txt: {len(original)} words; common.txt: {len(common)} words (threshold {args.threshold})')


if __name__ == '__main__':
    main()
```

- [ ] **Step 5: Generate the data**

```bash
python3 -m venv /tmp/wfvenv && /tmp/wfvenv/bin/pip install -q wordfreq
/tmp/wfvenv/bin/python scripts/build-word-data.py
```

Expected: `original-answers.txt: 2309 words; common.txt: 2222 words (threshold 2.0)`.

- [ ] **Step 6: Run all tests to verify they pass**

Run: `npm test`
Expected: PASS for both `tests/data.test.js` (3 tests) and the old `tests/solver.test.js`.

- [ ] **Step 7: Commit**

```bash
git add public/data scripts/build-word-data.py tests/data.test.js tests/solver.test.js public/js/app.js
git commit -m "Add answer-likelihood word data and move word list to public/data"
```

---

### Task 2: Wordle scoring and filtering (`wordle.js`)

**Files:**
- Create: `public/js/wordle.js`, `tests/wordle.test.js`

**Interfaces:**
- Consumes: `public/data/words.txt` (tests only).
- Produces:
  - `COLORS`: `['gray', 'yellow', 'green']`.
  - `ALL_GREEN`: `242`.
  - `scorePattern(guess: string, answer: string) → number` (0–242). The first letter is the most significant base-3 digit: gray 0, yellow 1, green 2.
  - `encodeColors(colors: string[5]) → number`.
  - `decodePattern(pattern: number) → string[5]`.
  - `filterCandidates(words: string[], rows: {word, pattern}[]) → string[]`.
  - `findContradiction(words: string[], rows: {word, pattern}[]) → number`: the index of the first row after which nothing fits, or `-1`.
  - `satisfiesHardMode(guess: string, rows: {word, pattern}[]) → boolean`.

- [ ] **Step 1: Write the failing tests**

Create `tests/wordle.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
    ALL_GREEN, scorePattern, encodeColors, decodePattern, filterCandidates, findContradiction, satisfiesHardMode,
} from '../public/js/wordle.js';

const words = readFileSync(new URL('../public/data/words.txt', import.meta.url), 'utf8').trim().split(' ');

// Pattern codes for readable tests: g = green, y = yellow, . = gray
const COLOR_CODES = { g: 'green', y: 'yellow', '.': 'gray' };
const pattern = code => encodeColors([...code].map(c => COLOR_CODES[c]));
const row = (word, code) => ({ word, pattern: pattern(code) });

// Seeded random numbers so failures are reproducible
function random(seed) {
    let state = seed;
    return max => {
        state = (state * 1103515245 + 12345) % 2147483648;
        return state % max;
    };
}

// Straightforward reference implementation of Wordle's coloring
function referenceColors(guess, answer) {
    const colors = Array(5).fill('gray');
    const unmatched = [];
    for (let i = 0; i < 5; i++) {
        if (guess[i] === answer[i]) {
            colors[i] = 'green';
        } else {
            unmatched.push(answer[i]);
        }
    }
    for (let i = 0; i < 5; i++) {
        const at = unmatched.indexOf(guess[i]);
        if (colors[i] === 'gray' && at !== -1) {
            colors[i] = 'yellow';
            unmatched.splice(at, 1);
        }
    }
    return colors;
}

test('encodeColors and decodePattern round-trip', () => {
    assert.equal(encodeColors(['green', 'gray', 'gray', 'yellow', 'gray']), 165);
    assert.deepEqual(decodePattern(165), ['green', 'gray', 'gray', 'yellow', 'gray']);
    assert.equal(encodeColors(Array(5).fill('green')), ALL_GREEN);
    assert.equal(encodeColors(Array(5).fill('gray')), 0);
});

test('scorePattern matches Wordle, including repeated letters', () => {
    const cases = [
        ['crane', 'crane', 'ggggg'],
        ['crane', 'mulch', '.....'],
        ['speed', 'abide', '..y.y'],
        ['eerie', 'there', 'y.y.g'],
        ['geese', 'sheep', '.ygy.'],
        ['level', 'lever', 'gggg.'],
        ['sassy', 'essay', 'yyg.g'],
        ['robot', 'motor', 'yg.gy'],
        ['allee', 'label', 'yyyg.'],
    ];
    for (const [guess, answer, code] of cases) {
        assert.equal(scorePattern(guess, answer), pattern(code), `${guess} vs ${answer}`);
    }
});

test('scorePattern agrees with the reference implementation on random pairs', () => {
    const next = random(1);
    for (let i = 0; i < 20000; i++) {
        const guess = words[next(words.length)];
        const answer = words[next(words.length)];
        assert.deepEqual(decodePattern(scorePattern(guess, answer)), referenceColors(guess, answer), `${guess} vs ${answer}`);
    }
});

test('filterCandidates never drops the real answer', () => {
    const next = random(2);
    for (let game = 0; game < 500; game++) {
        const answer = words[next(words.length)];
        const rows = Array.from({ length: 1 + next(4) }, () => {
            const guess = words[next(words.length)];
            return { word: guess, pattern: scorePattern(guess, answer) };
        });
        assert.ok(filterCandidates(words, rows).includes(answer), `answer ${answer} dropped`);
    }
});

test('filterCandidates keeps exactly the words consistent with every row', () => {
    const next = random(3);
    for (let state = 0; state < 30; state++) {
        const answer = words[next(words.length)];
        const rows = [words[next(words.length)], words[next(words.length)]]
            .map(guess => ({ word: guess, pattern: scorePattern(guess, answer) }));
        const expected = words.filter(word =>
            rows.every(r => referenceColors(r.word, word).join() === decodePattern(r.pattern).join()));
        assert.deepEqual(filterCandidates(words, rows), expected);
    }
});

test('filterCandidates enforces repeated-letter counts', () => {
    // Two S's shown (one green, one yellow), so the answer has at least two S's
    const candidates = filterCandidates(words, [row('wases', '.gy.g')]);
    assert.ok(candidates.length > 0);
    assert.ok(candidates.every(word => [...word].filter(c => c === 's').length >= 2));
});

// Ported from the original C# SuggestionEngine tests. Exact Wordle rules correctly drop OOBIT,
// RUDER, CEDER and HEDER, which the old filter kept.
test('original regression cases', () => {
    const one = filterCandidates(words, [row('dealt', '....g'), row('stott', '..y.g'), row('torot', '.g..g')]);
    assert.deepEqual(new Set(one), new Set(['noint', 'point', 'poupt', 'joint', 'mount', 'poynt', 'count', 'fount', 'pokit', 'compt', 'vomit']));

    const two = filterCandidates(words, [row('soare', '...yy'), row('dreer', 'y..gg'), row('eider', '..ggg')]);
    assert.deepEqual(new Set(two), new Set(['udder', 'nuder', 'under', 'cyder']));

    const three = filterCandidates(words, [row('irate', '...yy'), row('shown', '...y.'), row('lucky', 'y....')]);
    assert.deepEqual(new Set(three), new Set(['tewel', 'tweel', 'dwelt']));
});

test('findContradiction names the first row after which nothing fits', () => {
    assert.equal(findContradiction(words, [row('crane', '.....')]), -1);
    assert.equal(findContradiction(words, [row('crane', 'ggggg'), row('slate', 'ggggg')]), 1);
    assert.equal(findContradiction(words, [row('crane', 'ggggg'), row('slate', 'ggggg'), row('pious', '.....')]), 1);
});

test('findContradiction catches a pattern Wordle can never show', () => {
    // The first E would be marked yellow before the second, so this row is impossible
    assert.equal(findContradiction(words, [row('speed', '...y.')]), 0);
});

test('satisfiesHardMode requires greens in place and every revealed letter', () => {
    const crane = [row('crane', 'g...y')];
    assert.ok(satisfiesHardMode('chess', crane));
    assert.ok(satisfiesHardMode('cello', crane));
    assert.ok(!satisfiesHardMode('shelf', crane), 'C must stay first');
    assert.ok(!satisfiesHardMode('climb', crane), 'E must be used');

    // Two E's and an R revealed, with an E green in the last spot
    const eerie = [row('eerie', 'y.y.g')];
    assert.ok(satisfiesHardMode('there', eerie));
    assert.ok(satisfiesHardMode('three', eerie));
    assert.ok(satisfiesHardMode('eerie', eerie), 'repeating a guess is allowed');
    assert.ok(!satisfiesHardMode('outre', eerie), 'needs two E\'s');
    assert.ok(satisfiesHardMode('crane', []), 'no rows, no constraints');
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `node --test tests/wordle.test.js`
Expected: FAIL with `Cannot find module '.../public/js/wordle.js'`.

- [ ] **Step 3: Implement `wordle.js`**

Create `public/js/wordle.js`:

```js
// Wordle feedback is encoded as a base-3 number with one digit per letter, first letter most
// significant: 0 = gray (not in the answer), 1 = yellow (elsewhere), 2 = green (right spot).
export const COLORS = ['gray', 'yellow', 'green'];
export const ALL_GREEN = 242;

const GRAY = 0;
const YELLOW = 1;
const GREEN = 2;

// Scratch buffers reused across calls, since a best-guess search scores millions of pairs
const unmatched = new Uint8Array(26);
const digits = new Uint8Array(5);

// The colors Wordle shows for `guess` when the answer is `answer`. Greens are assigned first, then
// yellows left to right, limited by how many of each letter the answer has left unmatched.
export function scorePattern(guess, answer) {
    unmatched.fill(0);
    for (let i = 0; i < 5; i++) {
        if (guess.charCodeAt(i) === answer.charCodeAt(i)) {
            digits[i] = GREEN;
        } else {
            digits[i] = GRAY;
            unmatched[answer.charCodeAt(i) - 97]++;
        }
    }

    let pattern = 0;
    for (let i = 0; i < 5; i++) {
        if (digits[i] === GRAY) {
            const letter = guess.charCodeAt(i) - 97;
            if (unmatched[letter] > 0) {
                digits[i] = YELLOW;
                unmatched[letter]--;
            }
        }
        pattern = pattern * 3 + digits[i];
    }
    return pattern;
}

export function encodeColors(colors) {
    return colors.reduce((pattern, color) => pattern * 3 + COLORS.indexOf(color), 0);
}

export function decodePattern(pattern) {
    const colors = [];
    for (let i = 0; i < 5; i++) {
        colors.unshift(COLORS[pattern % 3]);
        pattern = Math.floor(pattern / 3);
    }
    return colors;
}

// rows: [{ word, pattern }]. A word is still possible if each row's guess, scored against it,
// gives exactly the pattern the player saw.
export function filterCandidates(words, rows) {
    return words.filter(word => rows.every(row => scorePattern(row.word, word) === row.pattern));
}

// Index of the first row after which no word fits, or -1 if some word fits every row
export function findContradiction(words, rows) {
    let candidates = words;
    for (let i = 0; i < rows.length; i++) {
        candidates = filterCandidates(candidates, [rows[i]]);
        if (candidates.length === 0) {
            return i;
        }
    }
    return -1;
}

// NYT hard mode: green letters stay in place, and every revealed letter (green or yellow) is used
// at least as many times as it was revealed
export function satisfiesHardMode(guess, rows) {
    return rows.every(({ word, pattern }) => {
        const colors = decodePattern(pattern);
        const revealed = {};
        for (let i = 0; i < 5; i++) {
            if (colors[i] === 'green' && guess[i] !== word[i]) {
                return false;
            }
            if (colors[i] !== 'gray') {
                revealed[word[i]] = (revealed[word[i]] ?? 0) + 1;
            }
        }
        return Object.entries(revealed).every(([letter, count]) => countLetter(guess, letter) >= count);
    });
}

function countLetter(word, letter) {
    let count = 0;
    for (const character of word) {
        if (character === letter) {
            count++;
        }
    }
    return count;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/wordle.test.js`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add public/js/wordle.js tests/wordle.test.js
git commit -m "Add exact Wordle scoring, filtering, and hard-mode rules"
```

---

### Task 3: Likelihood, ranking and best guess (`rank.js`)

**Files:**
- Create: `public/js/rank.js`, `scripts/load-lexicon.js`, `tests/rank.test.js`

**Interfaces:**
- Consumes:
  - From Task 2: `scorePattern`, `filterCandidates`, `findContradiction`, `satisfiesHardMode`, `ALL_GREEN`, `encodeColors`.
  - From Task 1: the data files.
- Produces:
  - `TIER_WEIGHTS`: `{ original, common, other }`.
  - `SCORING_BUDGET`: `1_500_000`.
  - `buildLexicon(words, originalAnswers, commonWords, tierWeights?) → { words: string[], weight: Map<string, number>, rank: Map<string, number> }`.
  - `rankAnswers(candidates, lexicon) → { word, probability }[]`, sorted likeliest first.
  - `bestGuess(candidates, lexicon, { rows?, hardMode?, scoringBudget? }) → { word, expectedRemaining, goForWin } | null`.
  - `solve(lexicon, rows, { hardMode?, opening? }) → { count, likely, best, contradiction }`.
  - `scripts/load-lexicon.js`: `loadLexicon(tierWeights?)` and `loadOpening()` (Node only).

- [ ] **Step 1: Write the Node data loader**

Create `scripts/load-lexicon.js`:

```js
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
```

- [ ] **Step 2: Write the failing tests**

Create `tests/rank.test.js`:

```js
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
```

- [ ] **Step 3: Run them to verify they fail**

Run: `node --test tests/rank.test.js`
Expected: FAIL with `Cannot find module '.../public/js/rank.js'`.

- [ ] **Step 4: Implement `rank.js`**

Create `public/js/rank.js`:

```js
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
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test tests/rank.test.js`
Expected: PASS, 10 tests.

- [ ] **Step 6: Run the whole suite**

Run: `npm test`
Expected: PASS (data, wordle, rank, and the old solver tests).

- [ ] **Step 7: Commit**

```bash
git add public/js/rank.js scripts/load-lexicon.js tests/rank.test.js
git commit -m "Add answer likelihood ranking and best-guess search"
```

---

### Task 4: Opening guess, benchmark and tuning

**Files:**
- Create: `scripts/opening.js`, `public/data/opening.json`, `bench/fetch-past-answers.js`, `bench/past-answers.json`, `bench/benchmark.js`
- Modify: `package.json` (scripts), `tests/data.test.js` (opening test), and possibly `public/js/rank.js` (`TIER_WEIGHTS`) and `public/data/common.txt` (threshold) if tuning changes them

**Interfaces:**
- Consumes: `bestGuess`, `solve` and `SCORING_BUDGET` from Task 3; `loadLexicon` and `loadOpening`.
- Produces:
  - `public/data/opening.json`: `{ "word": string, "expectedRemaining": number, "goForWin": false }`.
  - The `npm run benchmark` and `npm run opening` scripts.

- [ ] **Step 1: Write the failing opening test**

Append to `tests/data.test.js`:

```js
test('opening.json holds a precomputed opening guess', () => {
    const opening = JSON.parse(read('opening.json'));
    assert.ok(accepted.has(opening.word), opening.word);
    assert.equal(opening.goForWin, false);
    // Counts every accepted word, obscure ones included, so it's in the hundreds
    assert.ok(opening.expectedRemaining > 0 && opening.expectedRemaining < 3000);
});
```

Run: `node --test tests/data.test.js`
Expected: FAIL with `ENOENT` for `opening.json`.

- [ ] **Step 2: Write the opening script**

Create `scripts/opening.js`:

```js
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
```

Add scripts to `package.json` so the `scripts` block reads:

```json
  "scripts": {
    "start": "npx serve public",
    "test": "node --test tests/*.test.js",
    "benchmark": "node bench/benchmark.js",
    "opening": "node scripts/opening.js"
  }
```

- [ ] **Step 3: Generate the opening and verify the test passes**

Run: `npm run opening && node --test tests/data.test.js`
Expected: prints `Opening: <WORD>, ~<n> left (<s>s)`, then PASS, 4 tests. Note the word and the time in the commit message.

- [ ] **Step 4: Write the past-answers fetcher and fetch the fixture**

Create `bench/fetch-past-answers.js`:

```js
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
```

Run: `node bench/fetch-past-answers.js`
Expected: `Saved 1929 answers, 2021-06-19 to 2026-09-29` (the count grows by one each day).

- [ ] **Step 5: Write the benchmark**

Create `bench/benchmark.js`:

```js
// Plays every past NYT Wordle answer using Wordle Wizard's best guess and reports how it did.
// Dev-only. Usage: npm run benchmark [-- --hard] [-- --limit N]
import { readFileSync } from 'node:fs';
import { ALL_GREEN, scorePattern } from '../public/js/wordle.js';
import { solve } from '../public/js/rank.js';
import { loadLexicon, loadOpening } from '../scripts/load-lexicon.js';

const MAX_TURNS = 12;

const args = process.argv.slice(2);
const hardMode = args.includes('--hard');
const limit = args.includes('--limit') ? Number(args[args.indexOf('--limit') + 1]) : Infinity;

const lexicon = loadLexicon();
const opening = loadOpening();
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
        const { best } = solve(lexicon, rows, { hardMode, opening });
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
console.log(`${hardMode ? 'Hard' : 'Normal'} mode, ${answers.length} past answers, opening ${opening.word.toUpperCase()}`);
console.log(`  solved within 6: ${solved}/${answers.length} (${(100 * solved / answers.length).toFixed(2)}%)`);
console.log(`  average guesses: ${(totalTurns / answers.length).toFixed(3)}`);
console.log(`  distribution:    ${Object.entries(distribution).map(([turns, count]) => `${turns}:${count}`).join('  ')}`);
console.log(`  search time:     average ${(searchTime / searches).toFixed(1)} ms, slowest ${slowest.toFixed(0)} ms`);
if (unsolved.length > 0) {
    console.log(`  not solved within 6: ${unsolved.join(', ')}`);
}
```

- [ ] **Step 6: Run a quick benchmark, then the full one**

Run: `npm run benchmark -- --limit 300`, then `npm run benchmark`
Expected: the full run prints solved % ≥ 99.00 and average ≤ 3.700. Desktop search times should average well under 100 ms, with the slowest under about 300 ms.

- [ ] **Step 7: Tune only if the target is missed**

If solved < 99% or the average is > 3.7, try these one at a time. Use `--limit 500` while comparing, then confirm the winner with a full run.

1. Change `TIER_WEIGHTS.common` in `public/js/rank.js` to `0.05`, then to `0.2`. Run `npm run opening` after each change, then benchmark.
2. Regenerate the common words with a lower threshold: `/tmp/wfvenv/bin/python scripts/build-word-data.py --threshold 1.5`. Then `npm run opening`, then benchmark. If this wins, update the threshold default in `build-word-data.py` and the size bounds in `tests/data.test.js` to match.

Keep the best configuration and rerun `npm test`. If nothing reaches the target, stop and report the best numbers to the owner rather than lowering the target.

- [ ] **Step 8: Run hard mode for the record**

Run: `npm run benchmark -- --hard`
Expected: prints results. There's no fixed target; record them in the commit message.

- [ ] **Step 9: Commit**

```bash
git add scripts/opening.js public/data bench package.json tests/data.test.js public/js/rank.js scripts/build-word-data.py
git commit -m "Add opening guess, past-answer benchmark, and tuned weights

Benchmark (normal): <solved %>, average <n> guesses. Hard: <solved %>, average <n>.
Opening: <WORD>."
```

Replace the bracketed values in the message with the actual printed numbers.

---

### Task 5: Board rules and persistence (`board.js`)

**Files:**
- Create: `public/js/board.js`, `tests/board.test.js`

**Interfaces:**
- Produces:
  - `ROWS` (6) and `LENGTH` (5).
  - A board is an array of 6 rows: `{ letters: string(0–5, a–z), colors: ('gray'|'yellow'|'green')[5], submitted: boolean }`.
  - `createBoard()`.
  - `activeRow(board) → number`, or `-1` when the board is full.
  - `typeLetter(board, letter)`.
  - `deleteLetter(board)`.
  - `submitRow(board, isWord: (word) => boolean) → { board, error: string | null }`.
  - `cycleColor(board, rowIndex, position)`.
  - `removeRow(board, rowIndex)`.
  - `fillWord(board, word)`.
  - `submittedGuesses(board) → { word, colors }[]`.
  - `isSolved(board) → boolean`.
  - `keyboardColors(board) → { [letter]: color }`.
  - `localDate(date?) → 'YYYY-MM-DD'`.
  - `serializeBoard(board, date) → string`.
  - `restoreBoard(saved: string | null, date) → board`.
  - Every operation returns a new board, or the same board object when nothing changes, and never mutates its input.

- [ ] **Step 1: Write the failing tests**

Create `tests/board.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    ROWS, createBoard, activeRow, typeLetter, deleteLetter, submitRow, cycleColor, removeRow, fillWord,
    submittedGuesses, isSolved, keyboardColors, localDate, serializeBoard, restoreBoard,
} from '../public/js/board.js';

const ACCEPTED = new Set(['crane', 'slate', 'pious', 'udder', 'under']);
const isWord = word => ACCEPTED.has(word);

function typeWord(board, word) {
    return [...word].reduce(typeLetter, board);
}

function submitWord(board, word) {
    return submitRow(typeWord(board, word), isWord).board;
}

test('a new board has six empty rows and starts typing in row 0', () => {
    const board = createBoard();
    assert.equal(board.length, ROWS);
    assert.ok(board.every(row => row.letters === '' && !row.submitted && row.colors.every(c => c === 'gray')));
    assert.equal(activeRow(board), 0);
});

test('typing fills the active row up to five letters', () => {
    const board = typeWord(createBoard(), 'cranes');
    assert.equal(board[0].letters, 'crane');
    assert.equal(typeLetter(board, 'A'), board, 'only lowercase a-z is accepted');
});

test('deleteLetter removes the last letter and resets its color', () => {
    let board = typeWord(createBoard(), 'cra');
    board = cycleColor(board, 0, 2);
    board = deleteLetter(board);
    assert.equal(board[0].letters, 'cr');
    assert.equal(board[0].colors[2], 'gray');
    assert.equal(deleteLetter(createBoard()).length, ROWS, 'deleting from an empty row is harmless');
});

test('submitRow validates length and the word list', () => {
    const short = submitRow(typeWord(createBoard(), 'cra'), isWord);
    assert.equal(short.error, 'Not enough letters');
    const unknown = submitRow(typeWord(createBoard(), 'zzzzz'), isWord);
    assert.equal(unknown.error, 'Not in word list');
    const ok = submitRow(typeWord(createBoard(), 'crane'), isWord);
    assert.equal(ok.error, null);
    assert.equal(ok.board[0].submitted, true);
    assert.equal(activeRow(ok.board), 1);
});

test('cycleColor goes gray, yellow, green, gray and ignores empty tiles', () => {
    let board = typeWord(createBoard(), 'crane');
    const seen = [];
    for (let i = 0; i < 4; i++) {
        board = cycleColor(board, 0, 0);
        seen.push(board[0].colors[0]);
    }
    assert.deepEqual(seen, ['yellow', 'green', 'gray', 'yellow']);
    const empty = createBoard();
    assert.equal(cycleColor(empty, 0, 0), empty);
});

test('colors can be changed after a row is submitted', () => {
    const board = cycleColor(submitWord(createBoard(), 'crane'), 0, 4);
    assert.equal(board[0].colors[4], 'yellow');
});

test('removeRow removes a submitted row and shifts later rows up', () => {
    let board = submitWord(createBoard(), 'crane');
    board = submitWord(board, 'slate');
    board = typeWord(board, 'pi');
    board = removeRow(board, 0);
    assert.equal(board[0].letters, 'slate');
    assert.equal(board[1].letters, 'pi');
    assert.equal(board.length, ROWS);
    assert.equal(board[ROWS - 1].letters, '');
    assert.equal(removeRow(board, 1), board, 'an unsubmitted row is not removed');
});

test('fillWord replaces the active row with a suggestion', () => {
    let board = typeWord(submitWord(createBoard(), 'crane'), 'sl');
    board = fillWord(board, 'pious');
    assert.equal(board[1].letters, 'pious');
    assert.equal(board[1].submitted, false);
    assert.ok(board[1].colors.every(c => c === 'gray'));
});

test('fillWord does nothing when all six rows are submitted', () => {
    let board = createBoard();
    for (let i = 0; i < ROWS; i++) {
        board = submitWord(board, 'crane');
    }
    assert.equal(activeRow(board), -1);
    assert.equal(fillWord(board, 'slate'), board);
    assert.equal(typeLetter(board, 'a'), board);
});

test('submittedGuesses and isSolved', () => {
    let board = submitWord(createBoard(), 'crane');
    assert.deepEqual(submittedGuesses(board), [{ word: 'crane', colors: ['gray', 'gray', 'gray', 'gray', 'gray'] }]);
    assert.equal(isSolved(board), false);
    for (let i = 0; i < 5; i++) {
        board = cycleColor(cycleColor(board, 0, i), 0, i);
    }
    assert.equal(isSolved(board), true);
});

test('keyboardColors keeps the best color per letter', () => {
    let board = submitWord(createBoard(), 'crane');   // c gray, r yellow
    board = cycleColor(board, 0, 1);
    board = submitWord(board, 'udder');               // r green in the last spot
    board = cycleColor(cycleColor(board, 1, 4), 1, 4);
    const colors = keyboardColors(board);
    assert.equal(colors.c, 'gray');
    assert.equal(colors.r, 'green');
});

test('operations never modify the board they are given', () => {
    const board = typeWord(createBoard(), 'crane');
    const copy = structuredClone(board);
    cycleColor(board, 0, 0);
    deleteLetter(board);
    submitRow(board, isWord);
    fillWord(board, 'slate');
    assert.deepEqual(board, copy);
});

test('localDate uses the local calendar date', () => {
    assert.equal(localDate(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
    assert.equal(localDate(new Date(2026, 11, 31, 0, 1)), '2026-12-31');
});

test('restoreBoard returns the saved board only for the same day', () => {
    const board = submitWord(createBoard(), 'crane');
    const saved = serializeBoard(board, '2026-10-01');
    assert.deepEqual(restoreBoard(saved, '2026-10-01'), board);
    assert.deepEqual(restoreBoard(saved, '2026-10-02'), createBoard());
    assert.deepEqual(restoreBoard(null, '2026-10-01'), createBoard());
});

test('restoreBoard ignores corrupt or malformed saved data', () => {
    const fresh = createBoard();
    const bad = [
        'not json',
        '{"date":"2026-10-01"}',
        JSON.stringify({ date: '2026-10-01', board: createBoard().slice(0, 5) }),
        JSON.stringify({ date: '2026-10-01', board: [{ letters: 'CRANE', colors: Array(5).fill('gray'), submitted: true }, ...createBoard().slice(1)] }),
        JSON.stringify({ date: '2026-10-01', board: [{ letters: 'cra', colors: Array(5).fill('gray'), submitted: true }, ...createBoard().slice(1)] }),
        JSON.stringify({ date: '2026-10-01', board: [{ letters: 'crane', colors: Array(5).fill('purple'), submitted: false }, ...createBoard().slice(1)] }),
        JSON.stringify({ date: '2026-10-01', board: [createBoard()[0], { letters: 'crane', colors: Array(5).fill('gray'), submitted: true }, ...createBoard().slice(2)] }),
    ];
    for (const saved of bad) {
        assert.deepEqual(restoreBoard(saved, '2026-10-01'), fresh, saved);
    }
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `node --test tests/board.test.js`
Expected: FAIL with `Cannot find module '.../public/js/board.js'`.

- [ ] **Step 3: Implement `board.js`**

Create `public/js/board.js`:

```js
// The board: six rows of up to five letters, each gray, yellow or green. Rows are typed, then
// submitted with Enter; only submitted rows count toward suggestions. Every function returns a
// new board (or the same one when nothing changes) and never modifies the board it is given.

export const ROWS = 6;
export const LENGTH = 5;

const NEXT_COLOR = { gray: 'yellow', yellow: 'green', green: 'gray' };
const COLOR_STRENGTH = { gray: 1, yellow: 2, green: 3 };

function emptyRow() {
    return { letters: '', colors: Array(LENGTH).fill('gray'), submitted: false };
}

function replaceRow(board, index, row) {
    return board.map((existing, i) => (i === index ? row : existing));
}

export function createBoard() {
    return Array.from({ length: ROWS }, emptyRow);
}

// The row being typed, or -1 once all six rows are submitted
export function activeRow(board) {
    return board.findIndex(row => !row.submitted);
}

export function typeLetter(board, letter) {
    const index = activeRow(board);
    if (index === -1 || board[index].letters.length === LENGTH || !/^[a-z]$/.test(letter)) {
        return board;
    }
    const row = board[index];
    return replaceRow(board, index, { ...row, letters: row.letters + letter });
}

export function deleteLetter(board) {
    const index = activeRow(board);
    if (index === -1 || board[index].letters.length === 0) {
        return board;
    }
    const row = board[index];
    const colors = [...row.colors];
    colors[row.letters.length - 1] = 'gray';
    return replaceRow(board, index, { ...row, letters: row.letters.slice(0, -1), colors });
}

// Returns { board, error }, where error is null on success or the message to show the player
export function submitRow(board, isWord) {
    const index = activeRow(board);
    if (index === -1) {
        return { board, error: null };
    }
    const row = board[index];
    if (row.letters.length < LENGTH) {
        return { board, error: 'Not enough letters' };
    }
    if (!isWord(row.letters)) {
        return { board, error: 'Not in word list' };
    }
    return { board: replaceRow(board, index, { ...row, submitted: true }), error: null };
}

export function cycleColor(board, rowIndex, position) {
    const row = board[rowIndex];
    if (!row || position >= row.letters.length) {
        return board;
    }
    const colors = [...row.colors];
    colors[position] = NEXT_COLOR[colors[position]];
    return replaceRow(board, rowIndex, { ...row, colors });
}

// Removes a submitted row; later rows move up and an empty row is added at the bottom
export function removeRow(board, rowIndex) {
    if (!board[rowIndex]?.submitted) {
        return board;
    }
    return [...board.slice(0, rowIndex), ...board.slice(rowIndex + 1), emptyRow()];
}

// Puts a suggested word in the row being typed, replacing any letters there, all gray
export function fillWord(board, word) {
    const index = activeRow(board);
    if (index === -1) {
        return board;
    }
    return replaceRow(board, index, { ...emptyRow(), letters: word });
}

export function submittedGuesses(board) {
    return board.filter(row => row.submitted).map(row => ({ word: row.letters, colors: [...row.colors] }));
}

export function isSolved(board) {
    const guesses = submittedGuesses(board);
    return guesses.length > 0 && guesses.at(-1).colors.every(color => color === 'green');
}

// The best color known for each letter from submitted rows: green beats yellow beats gray
export function keyboardColors(board) {
    const known = {};
    for (const { word, colors } of submittedGuesses(board)) {
        colors.forEach((color, i) => {
            const letter = word[i];
            if (!known[letter] || COLOR_STRENGTH[color] > COLOR_STRENGTH[known[letter]]) {
                known[letter] = color;
            }
        });
    }
    return known;
}

// Saved boards belong to the player's local date, since each day is a new puzzle
export function localDate(date = new Date()) {
    const pad = number => String(number).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function serializeBoard(board, date) {
    return JSON.stringify({ date, board });
}

// The saved board if it is from `date` and well formed; otherwise a fresh board
export function restoreBoard(saved, date) {
    try {
        const data = JSON.parse(saved);
        if (data?.date === date && isValidBoard(data.board)) {
            return data.board;
        }
    } catch {
        // Unreadable saved data falls through to a fresh board
    }
    return createBoard();
}

function isValidBoard(board) {
    return Array.isArray(board) && board.length === ROWS && board.every((row, i) =>
        typeof row?.letters === 'string' && /^[a-z]{0,5}$/.test(row.letters) &&
        Array.isArray(row.colors) && row.colors.length === LENGTH && row.colors.every(color => color in NEXT_COLOR) &&
        typeof row.submitted === 'boolean' &&
        (!row.submitted || (row.letters.length === LENGTH && (i === 0 || board[i - 1].submitted))));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/board.test.js`
Expected: PASS, 15 tests.

- [ ] **Step 5: Commit**

```bash
git add public/js/board.js tests/board.test.js
git commit -m "Add board rules and daily persistence"
```

---

### Task 6: App UI (worker, markup, styles, interaction, settings, analytics)

**Files:**
- Create: `public/js/worker.js`, `public/img/logo.webp`, `public/fonts/cinzel-700-subset.woff2`, `public/fonts/OFL.txt`
- Rewrite: `public/js/app.js`, `public/index.html`, `public/css/site.css`
- Move: `public/wizard.png` → `assets/wizard.png`, `public/icons-wizard.png` → `assets/icons-wizard.png`
- Delete: `public/js/solver.js`, `public/js/overlay.js`, `public/lib/`, `tests/solver.test.js`

**Interfaces:**
- Consumes:
  - Task 5: everything in `board.js`.
  - Task 3: `buildLexicon` and `solve`.
  - Task 2: `encodeColors`.
  - Task 4: `public/data/opening.json`.
- Produces:
  - **Worker protocol.**
    - App → worker: `{ type: 'solve', id, guesses: { word, colors }[], hardMode }`.
    - Worker → app: `{ type: 'ready', words: string[] }` once the data loads, `{ type: 'results', id, results }`, or `{ type: 'error', message }`.
  - **DOM ids Task 7 relies on:** `main.app`, `footer.site-footer`, and `<head>` containing `<title>`.
  - **CSS custom properties:** `--bg`, `--surface`, `--surface-2`, `--ink`, `--muted`, `--border`, `--brand`, `--brand-strong`, `--display`, `--ui`, `--radius`, `--shadow`.

- [ ] **Step 1: Move the source art, make the logo, and fetch the font**

```bash
mkdir -p assets public/img public/fonts
git mv public/wizard.png assets/wizard.png
git mv public/icons-wizard.png assets/icons-wizard.png
magick assets/wizard.png -resize x104 -quality 82 public/img/logo.webp
curl -s -A "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/120 Safari/537.36" \
  "https://fonts.googleapis.com/css2?family=Cinzel:wght@700&text=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz%20" \
  | grep -oE "https://fonts.gstatic.com[^)]+" | head -1 | xargs curl -sfL -o public/fonts/cinzel-700-subset.woff2
curl -sfL https://raw.githubusercontent.com/google/fonts/main/ofl/cinzel/OFL.txt -o public/fonts/OFL.txt
file public/fonts/cinzel-700-subset.woff2; ls -l public/img/logo.webp public/fonts
```

Expected:
- the font file is reported as `Web Open Font Format (Version 2)`;
- `logo.webp` is under 15 KB;
- `OFL.txt` begins with `Copyright 2020 The Cinzel Project Authors`.

- [ ] **Step 2: Remove the old UI files**

```bash
git rm -rq public/lib public/js/solver.js public/js/overlay.js tests/solver.test.js
```

- [ ] **Step 3: Write the worker**

Create `public/js/worker.js`:

```js
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
        opening: JSON.parse(opening),
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
        const results = solve(lexicon, rows, { hardMode: request.hardMode, opening });
        self.postMessage({ type: 'results', id: request.id, results });
    } catch (error) {
        self.postMessage({ type: 'error', message: String(error) });
    }
}
```

- [ ] **Step 4: Write the page markup**

Replace `public/index.html` with:

```html
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Wordle Wizard: Wordle Solver &amp; Best Next Guess</title>

    <!-- Apply saved theme settings before the first paint to avoid a flash -->
    <script>
        try {
            const settings = JSON.parse(localStorage.getItem('wordle-wizard-settings')) || {};
            if (settings.theme === 'light' || settings.theme === 'dark') {
                document.documentElement.dataset.theme = settings.theme;
            }
            if (settings.highContrast === true) {
                document.documentElement.classList.add('high-contrast');
            }
        } catch {
            // Storage unavailable; use the defaults
        }
    </script>

    <!-- Google tag (gtag.js) -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-ZL1VPX5V4V"></script>
    <script>
        window.dataLayer = window.dataLayer || [];
        function gtag() { dataLayer.push(arguments); }
        gtag('js', new Date());

        gtag('config', 'G-ZL1VPX5V4V');
    </script>

    <link rel="icon" href="/favicon.ico" sizes="32x32">
    <link rel="preload" href="/fonts/cinzel-700-subset.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="stylesheet" href="/css/site.css">
    <script type="module" src="/js/app.js"></script>
</head>

<body>
    <header class="site-header">
        <a class="brand" href="/">
            <img src="/img/logo.webp" alt="" width="40" height="52">
            <span class="wordmark">Wordle Wizard</span>
        </a>
        <div class="header-actions">
            <button type="button" class="icon-button" id="help-button" aria-label="How it works">
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9.5 9.2a2.6 2.6 0 0 1 5 .8c0 1.8-2.5 2.2-2.5 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="17.3" r="1.2" fill="currentColor"/></svg>
            </button>
            <button type="button" class="icon-button" id="settings-button" aria-label="Settings">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="16" cy="7" r="2.2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="10" cy="17" r="2.2" fill="none" stroke="currentColor" stroke-width="2"/></svg>
            </button>
        </div>
    </header>

    <main class="app">
        <noscript><p class="noscript">Wordle Wizard needs JavaScript to suggest guesses.</p></noscript>

        <section class="board-area" aria-label="Your guesses">
            <div id="board" class="board"></div>
            <p id="board-message" class="board-message" role="status"></p>
            <button type="button" id="new-game" class="text-button">New game</button>
        </section>

        <section class="card best" aria-labelledby="best-heading">
            <h2 id="best-heading">Best next guess</h2>
            <p id="best-word" class="best-word">&nbsp;</p>
            <p id="best-detail" class="best-detail">Loading the word list…</p>
            <button type="button" id="use-best" class="primary-button" disabled>Use this word</button>
        </section>

        <div id="keyboard" class="keyboard" role="group" aria-label="Keyboard"></div>

        <section class="card likely" aria-labelledby="likely-heading">
            <h2 id="likely-heading">Likely answers <span id="likely-count"></span></h2>
            <p id="likely-message" class="likely-message"></p>
            <ol id="likely-list" class="likely-list"></ol>
            <button type="button" id="show-all" class="text-button" hidden></button>
        </section>
    </main>

    <p id="live-summary" class="visually-hidden" aria-live="polite"></p>

    <footer class="site-footer">
        <p>&copy; 2026 Wordle Wizard &middot; Not affiliated with The New York Times. &middot; <a href="/privacy/">Privacy</a></p>
    </footer>

    <dialog id="help-dialog" aria-labelledby="help-title">
        <form method="dialog">
            <button class="icon-button dialog-close" aria-label="Close">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>
            </button>
        </form>
        <h2 id="help-title">How it works</h2>
        <ol class="help-steps">
            <li><strong>Type the word you played in Wordle</strong> and press Enter.</li>
            <li><strong>Tap each letter until it matches Wordle's colors:</strong>
                <span class="mini-tile" data-color="gray">A</span> not in the word,
                <span class="mini-tile" data-color="yellow">B</span> in the word but in the wrong spot,
                <span class="mini-tile" data-color="green">C</span> in the right spot.</li>
            <li><strong>Check the suggestions.</strong> The best next guess narrows down the possible answers fastest. Likely answers are ranked by how likely each one is to be today's word.</li>
        </ol>
        <p>Tap any suggestion to add it to the board. If you play Wordle on hard mode, turn it on in settings.</p>
    </dialog>

    <dialog id="settings-dialog" aria-labelledby="settings-title">
        <form method="dialog">
            <button class="icon-button dialog-close" aria-label="Close">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>
            </button>
        </form>
        <h2 id="settings-title">Settings</h2>
        <label class="setting">
            <span><strong>Hard mode</strong><small>Best guesses reuse every green and yellow letter, as Wordle's hard mode requires.</small></span>
            <input type="checkbox" id="hard-mode">
        </label>
        <label class="setting">
            <span><strong>Theme</strong></span>
            <select id="theme">
                <option value="system">Match device</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
            </select>
        </label>
        <label class="setting">
            <span><strong>High contrast colors</strong><small>Orange and blue instead of green and yellow.</small></span>
            <input type="checkbox" id="high-contrast">
        </label>
    </dialog>
</body>

</html>
```

- [ ] **Step 5: Write the styles**

Replace `public/css/site.css` with:

```css
/* Wordle Wizard */

@font-face {
    font-family: 'Cinzel';
    src: url('/fonts/cinzel-700-subset.woff2') format('woff2');
    font-weight: 700;
    font-display: swap;
}

:root {
    color-scheme: light dark;
    --bg: light-dark(#f6f3ff, #120d27);
    --surface: light-dark(#ffffff, #1d1640);
    --surface-2: light-dark(#ece6ff, #2a2152);
    --ink: light-dark(#1d1640, #f1ecff);
    --muted: light-dark(#5b5480, #b0a7d6);
    --border: light-dark(#d9d1f5, #3a2f6b);
    --brand: light-dark(#5a2fc2, #9f7bff);
    --brand-strong: light-dark(#3d1f8f, #c3abff);
    --brand-ink: light-dark(#ffffff, #120d27);
    --focus: #ff9e2c;
    --tile-empty: light-dark(#ffffff, #1d1640);
    --tile-border: light-dark(#cfc6ee, #4a3e80);
    --key: light-dark(#e4ddfa, #3a2f6b);
    --key-ink: light-dark(#1d1640, #f1ecff);
    --gray: #787c7e;
    --yellow: #a68f2c;
    --green: #538d4e;
    --shadow: 0 8px 30px light-dark(rgb(45 20 120 / 0.12), rgb(0 0 0 / 0.35));
    --radius: 14px;
    --display: 'Cinzel', 'Trajan Pro', Georgia, serif;
    --ui: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
}

:root[data-theme='light'] { color-scheme: light; }
:root[data-theme='dark'] { color-scheme: dark; }

:root.high-contrast {
    --green: #e2652a;
    --yellow: #3d7fc4;
}

*, *::before, *::after { box-sizing: border-box; }

body {
    margin: 0;
    background: var(--bg);
    color: var(--ink);
    font-family: var(--ui);
    line-height: 1.5;
    -webkit-text-size-adjust: 100%;
}

a { color: var(--brand); }

:focus-visible {
    outline: 3px solid var(--focus);
    outline-offset: 2px;
}

.visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
}

/* Header */

.site-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    max-width: 1080px;
    margin: 0 auto;
    padding: 0.75rem;
}

.brand {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    color: inherit;
    text-decoration: none;
}

.brand img { width: 40px; height: 52px; }

.wordmark {
    font-family: var(--display);
    font-size: 1.35rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: var(--brand-strong);
}

.header-actions { display: flex; gap: 0.25rem; }

.icon-button {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: var(--ink);
    cursor: pointer;
}

.icon-button:hover { background: var(--surface-2); }
.icon-button svg { width: 24px; height: 24px; }

/* Layout: one column on phones, board and keyboard beside the suggestions on desktop */

.app {
    display: grid;
    grid-template-areas: 'board' 'best' 'keyboard' 'likely';
    gap: 1rem;
    max-width: 1080px;
    margin: 0 auto;
    padding: 0 0.75rem 2rem;
}

.board-area { grid-area: board; }
.best { grid-area: best; }
.keyboard { grid-area: keyboard; }
.likely { grid-area: likely; }

@media (min-width: 860px) {
    .app {
        grid-template-columns: minmax(0, 1fr) 360px;
        grid-template-rows: auto auto 1fr;
        grid-template-areas:
            'board best'
            'board likely'
            'keyboard likely';
        column-gap: 2.5rem;
        align-items: start;
    }
}

.noscript { grid-column: 1 / -1; text-align: center; font-weight: 600; }

/* Board */

.board-area {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
}

.board {
    /* 5 tiles, 5 gaps and the 32px remove button fit within the screen's padding */
    --tile: min(62px, calc((100vw - 86px) / 5));
    display: grid;
    gap: 6px;
}

.board-row {
    display: grid;
    grid-template-columns: repeat(5, var(--tile)) 32px;
    align-items: center;
    gap: 6px;
}

.tile {
    display: grid;
    place-items: center;
    width: var(--tile);
    height: var(--tile);
    padding: 0;
    border: 2px solid var(--tile-border);
    border-radius: 8px;
    background: var(--tile-empty);
    color: var(--ink);
    font: 700 calc(var(--tile) * 0.5) / 1 var(--ui);
    text-transform: uppercase;
    cursor: pointer;
    transition: background-color 0.15s, border-color 0.15s;
}

.tile:disabled { cursor: default; }

.tile[data-color='gray'],
.tile[data-color='yellow'],
.tile[data-color='green'] {
    border-color: transparent;
    color: #ffffff;
}

.tile[data-color='gray'] { background: var(--gray); }
.tile[data-color='yellow'] { background: var(--yellow); }
.tile[data-color='green'] { background: var(--green); }

/* The row being typed is outlined so it's clear it hasn't been submitted yet */
.board-row.active .tile { border-color: var(--brand); }

.remove-row {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
}

.remove-row:hover { background: var(--surface-2); color: var(--ink); }
.remove-row svg { width: 20px; height: 20px; }

.board-row.shake { animation: shake 0.4s; }

@keyframes shake {
    10%, 90% { transform: translateX(-2px); }
    20%, 80% { transform: translateX(4px); }
    30%, 50%, 70% { transform: translateX(-6px); }
    40%, 60% { transform: translateX(6px); }
}

.board-message {
    min-height: 1.5rem;
    margin: 0.25rem 0 0;
    font-weight: 600;
    color: var(--brand-strong);
    text-align: center;
    opacity: 0;
    transition: opacity 0.2s;
}

.board-message.visible { opacity: 1; }

.text-button {
    min-height: 44px;
    padding: 0.5rem 0.75rem;
    border: 0;
    background: none;
    color: var(--brand);
    font: 600 1rem var(--ui);
    cursor: pointer;
}

.text-button:hover { text-decoration: underline; }

/* Keyboard */

.keyboard {
    display: grid;
    gap: 6px;
    width: 100%;
    max-width: 500px;
    justify-self: center;
}

.keyboard-row {
    display: flex;
    justify-content: center;
    gap: 5px;
}

.key {
    display: grid;
    flex: 1 1 0;
    place-items: center;
    min-width: 0;
    max-width: 44px;
    height: 52px;
    padding: 0;
    border: 0;
    border-radius: 6px;
    background: var(--key);
    color: var(--key-ink);
    font: 700 1.25rem / 1 var(--ui);
    text-transform: uppercase;
    cursor: pointer;
}

.key.wide {
    flex-grow: 1.6;
    max-width: 72px;
    font-size: 0.8rem;
}

.key svg { width: 24px; height: 24px; }

.key[data-color='gray'],
.key[data-color='yellow'],
.key[data-color='green'] { color: #ffffff; }

.key[data-color='gray'] { background: var(--gray); }
.key[data-color='yellow'] { background: var(--yellow); }
.key[data-color='green'] { background: var(--green); }

/* Suggestion cards */

.card {
    padding: 1.1rem 1.25rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    box-shadow: var(--shadow);
    transition: opacity 0.2s;
}

.card h2 {
    margin: 0 0 0.5rem;
    color: var(--muted);
    font-size: 0.8rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
}

.computing .card { opacity: 0.55; }

.best { background: linear-gradient(135deg, var(--surface), var(--surface-2)); }

.best-word {
    margin: 0;
    color: var(--brand-strong);
    font: 700 2.4rem / 1.1 var(--display);
    letter-spacing: 0.08em;
    text-transform: uppercase;
}

.best-detail {
    margin: 0.25rem 0 0.9rem;
    color: var(--muted);
}

.primary-button {
    min-height: 44px;
    padding: 0.65rem 1.2rem;
    border: 0;
    border-radius: 999px;
    background: var(--brand);
    color: var(--brand-ink);
    font: 600 1rem var(--ui);
    cursor: pointer;
}

.primary-button:disabled { opacity: 0.5; cursor: default; }

.likely-message { margin: 0 0 0.5rem; color: var(--muted); }
.likely-message:empty { display: none; }

.likely-list {
    display: grid;
    gap: 4px;
    max-height: 60vh;
    margin: 0;
    padding: 0;
    overflow-y: auto;
    list-style: none;
}

.likely-word {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    width: 100%;
    min-height: 40px;
    padding: 0.4rem 0.75rem;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--ink);
    font: 600 1rem var(--ui);
    letter-spacing: 0.08em;
    text-align: left;
    cursor: pointer;
    isolation: isolate;
}

/* A bar behind each word shows how likely it is */
.likely-word::before {
    content: '';
    position: absolute;
    inset: 0 auto 0 0;
    z-index: -1;
    width: var(--probability);
    border-radius: 8px;
    background: var(--surface-2);
}

.likely-word:hover { outline: 2px solid var(--border); }

.likely-percent {
    color: var(--muted);
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0;
}

/* Dialogs */

dialog {
    max-width: min(92vw, 480px);
    padding: 1.5rem;
    border: 0;
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--ink);
    box-shadow: var(--shadow);
}

dialog::backdrop { background: rgb(18 13 39 / 0.55); }

dialog h2 {
    margin: 0 2.5rem 1rem 0;
    color: var(--brand-strong);
    font-family: var(--display);
}

.dialog-close {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
}

.help-steps { padding-left: 1.25rem; }
.help-steps li { margin-bottom: 0.75rem; }

.mini-tile {
    display: inline-grid;
    place-items: center;
    width: 1.6rem;
    height: 1.6rem;
    border-radius: 4px;
    color: #ffffff;
    font-weight: 700;
}

.mini-tile[data-color='gray'] { background: var(--gray); }
.mini-tile[data-color='yellow'] { background: var(--yellow); }
.mini-tile[data-color='green'] { background: var(--green); }

.setting {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.75rem 0;
    border-bottom: 1px solid var(--border);
}

.setting small {
    display: block;
    color: var(--muted);
}

.setting input[type='checkbox'] {
    width: 1.4rem;
    height: 1.4rem;
    accent-color: var(--brand);
}

.setting select {
    min-height: 44px;
    padding: 0 0.5rem;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface);
    color: var(--ink);
    font: inherit;
}

/* Footer */

.site-footer {
    padding: 2rem 1rem;
    color: var(--muted);
    font-size: 0.875rem;
    text-align: center;
}

.site-footer a { color: inherit; }

@media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
        animation: none !important;
        transition: none !important;
    }
}
```

- [ ] **Step 6: Write the app**

Replace `public/js/app.js` with:

```js
import {
    ROWS, LENGTH, createBoard, activeRow, typeLetter, deleteLetter, submitRow, cycleColor, removeRow, fillWord,
    submittedGuesses, isSolved, keyboardColors, localDate, serializeBoard, restoreBoard,
} from './board.js';

const BOARD_KEY = 'wordle-wizard-board';
const SETTINGS_KEY = 'wordle-wizard-settings';
const LIKELY_PREVIEW = 10;
const SHOW_ALL_BATCH = 500;
const SLOW_MS = 150;
const MESSAGE_MS = 1500;
const KEY_ROWS = ['qwertyuiop', 'asdfghjkl', '>zxcvbnm<'];   // > is Enter, < is Backspace

const ICONS = {
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    backspace: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5h11a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-6-7z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 9l6 6M18 9l-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
};

const $ = id => document.getElementById(id);
const elements = {
    board: $('board'),
    message: $('board-message'),
    keyboard: $('keyboard'),
    bestWord: $('best-word'),
    bestDetail: $('best-detail'),
    useBest: $('use-best'),
    likelyCount: $('likely-count'),
    likelyMessage: $('likely-message'),
    likelyList: $('likely-list'),
    showAll: $('show-all'),
    liveSummary: $('live-summary'),
    hardMode: $('hard-mode'),
    theme: $('theme'),
    highContrast: $('high-contrast'),
};

// localStorage can be unavailable (private browsing, blocked storage); progress just won't persist
function load(key) {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

function save(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch {
        // Ignore: see load()
    }
}

function readSettings() {
    try {
        const saved = JSON.parse(load(SETTINGS_KEY)) ?? {};
        return {
            hardMode: saved.hardMode === true,
            theme: ['system', 'light', 'dark'].includes(saved.theme) ? saved.theme : 'system',
            highContrast: saved.highContrast === true,
        };
    } catch {
        return { hardMode: false, theme: 'system', highContrast: false };
    }
}

function track(event, params) {
    window.gtag?.('event', event, params);
}

let board = restoreBoard(load(BOARD_KEY), localDate());
let settings = readSettings();
let words = null;        // accepted words, sent by the worker once the data loads
let results = null;      // the latest solve() results
let requestId = 0;
let listVersion = 0;
let slowTimer = null;
let messageTimer = null;

const tiles = [];
const removeButtons = [];
const letterKeys = {};

// Board

function buildBoard() {
    for (let r = 0; r < ROWS; r++) {
        const row = document.createElement('div');
        row.className = 'board-row';
        tiles[r] = [];
        for (let p = 0; p < LENGTH; p++) {
            const tile = document.createElement('button');
            tile.type = 'button';
            tile.className = 'tile';
            tile.addEventListener('click', () => update(cycleColor(board, r, p)));
            row.append(tile);
            tiles[r].push(tile);
        }
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'remove-row';
        remove.setAttribute('aria-label', `Remove guess ${r + 1}`);
        remove.innerHTML = ICONS.close;
        remove.addEventListener('click', () => update(removeRow(board, r)));
        row.append(remove);
        removeButtons.push(remove);
        elements.board.append(row);
    }
}

function renderBoard() {
    const active = activeRow(board);
    board.forEach((row, r) => {
        tiles[r].forEach((tile, p) => {
            const letter = row.letters[p] ?? '';
            tile.textContent = letter;
            tile.dataset.color = letter ? row.colors[p] : 'empty';
            tile.disabled = !letter;
            tile.setAttribute('aria-label', letter
                ? `Row ${r + 1}, letter ${p + 1}, ${letter.toUpperCase()}, ${row.colors[p]}`
                : `Row ${r + 1}, letter ${p + 1}, empty`);
        });
        tiles[r][0].parentElement.classList.toggle('active', r === active);
        removeButtons[r].style.visibility = row.submitted ? 'visible' : 'hidden';
    });
    renderKeyboard();
    elements.useBest.disabled = active === -1 || !results?.best || isSolved(board);
}

// Applies a new board: saves it, redraws it, and asks for new results if the guesses changed
function update(next) {
    if (next === board) {
        return;
    }
    const before = JSON.stringify(submittedGuesses(board));
    board = next;
    save(BOARD_KEY, serializeBoard(board, localDate()));
    renderBoard();
    if (JSON.stringify(submittedGuesses(board)) !== before) {
        requestResults();
    }
}

function showMessage(text) {
    elements.message.textContent = text;
    elements.message.classList.add('visible');
    clearTimeout(messageTimer);
    messageTimer = setTimeout(() => elements.message.classList.remove('visible'), MESSAGE_MS);
}

function shakeRow(index) {
    const row = tiles[index]?.[0].parentElement;
    if (!row) {
        return;
    }
    row.classList.remove('shake');
    void row.offsetWidth;   // restart the animation
    row.classList.add('shake');
    row.addEventListener('animationend', () => row.classList.remove('shake'), { once: true });
}

// Actions

function type(letter) {
    update(typeLetter(board, letter));
}

function erase() {
    update(deleteLetter(board));
}

function submit() {
    if (!words) {
        return;
    }
    const index = activeRow(board);
    const { board: next, error } = submitRow(board, word => words.has(word));
    if (error) {
        showMessage(error);
        shakeRow(index);
        return;
    }
    if (next !== board) {
        update(next);
        track('guess_entered', { guess_number: index + 1 });
    }
}

// Keyboard

function buildKeyboard() {
    for (const keys of KEY_ROWS) {
        const row = document.createElement('div');
        row.className = 'keyboard-row';
        for (const key of keys) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'key';
            if (key === '>') {
                button.textContent = 'Enter';
                button.classList.add('wide');
                button.addEventListener('click', submit);
            } else if (key === '<') {
                button.innerHTML = ICONS.backspace;
                button.setAttribute('aria-label', 'Backspace');
                button.classList.add('wide');
                button.addEventListener('click', erase);
            } else {
                button.textContent = key;
                button.addEventListener('click', () => type(key));
                letterKeys[key] = button;
            }
            // Keep focus off on-screen keys so a physical Enter never presses one again
            button.addEventListener('click', () => button.blur());
            row.append(button);
        }
        elements.keyboard.append(row);
    }
}

function renderKeyboard() {
    const known = keyboardColors(board);
    for (const [letter, button] of Object.entries(letterKeys)) {
        button.dataset.color = known[letter] ?? 'unknown';
        button.setAttribute('aria-label', known[letter] ? `${letter.toUpperCase()}, ${known[letter]}` : letter.toUpperCase());
    }
}

document.addEventListener('keydown', event => {
    if (event.metaKey || event.ctrlKey || event.altKey || document.querySelector('dialog[open]')) {
        return;
    }
    if (event.key === 'Enter') {
        // Enter submits the guess, even from a focused tile, but still activates other buttons and links
        const target = event.target instanceof Element ? event.target : null;
        if (target?.closest('button, a, input, select') && !target.closest('.tile, .key')) {
            return;
        }
        event.preventDefault();
        submit();
    } else if (event.key === 'Backspace') {
        event.preventDefault();
        erase();
    } else if (/^[a-z]$/i.test(event.key)) {
        type(event.key.toLowerCase());
    }
});

// Results

const worker = new Worker('/js/worker.js', { type: 'module' });

worker.addEventListener('message', ({ data }) => {
    if (data.type === 'ready') {
        words = new Set(data.words);
        requestResults();
    } else if (data.type === 'results' && data.id === requestId) {
        clearTimeout(slowTimer);
        document.body.classList.remove('computing');
        results = data.results;
        renderResults();
    } else if (data.type === 'error') {
        showLoadError();
    }
});

worker.addEventListener('error', showLoadError);

function requestResults() {
    if (!words) {
        return;
    }
    requestId++;
    worker.postMessage({ type: 'solve', id: requestId, guesses: submittedGuesses(board), hardMode: settings.hardMode });
    clearTimeout(slowTimer);
    slowTimer = setTimeout(() => document.body.classList.add('computing'), SLOW_MS);
}

function showLoadError() {
    clearTimeout(slowTimer);
    document.body.classList.remove('computing');
    elements.bestWord.innerHTML = '&nbsp;';
    elements.bestDetail.textContent = "Couldn't load the word list. Check your connection and reload the page.";
    elements.useBest.disabled = true;
}

function formatPercent(probability) {
    return probability < 0.01 ? '<1%' : `${Math.round(probability * 100)}%`;
}

function formatRemaining(remaining) {
    return remaining < 10 ? remaining.toFixed(1) : Math.round(remaining).toLocaleString();
}

function renderBest() {
    const { count, likely, best } = results;
    const guesses = submittedGuesses(board);

    if (isSolved(board)) {
        elements.bestWord.textContent = guesses.at(-1).word;
        elements.bestDetail.textContent = `Solved in ${guesses.length}!`;
    } else if (!best) {
        elements.bestWord.innerHTML = '&nbsp;';
        elements.bestDetail.textContent = 'Fix the colors to get a suggestion.';
    } else {
        elements.bestWord.textContent = best.word;
        if (guesses.length === 0) {
            elements.bestDetail.textContent = `A strong opening: narrows ${count.toLocaleString()} words to ~${formatRemaining(best.expectedRemaining)}.`;
        } else if (count === 1) {
            elements.bestDetail.textContent = 'This is the only word left.';
        } else if (best.goForWin) {
            elements.bestDetail.textContent = `Go for the win: ${formatPercent(likely[0].probability)} chance it's the answer.`;
        } else {
            elements.bestDetail.textContent = `${count.toLocaleString()} words → ~${formatRemaining(best.expectedRemaining)} left`;
        }
    }
    elements.useBest.disabled = activeRow(board) === -1 || !best || isSolved(board);
}

function likelyItem({ word, probability }, position) {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'likely-word';
    button.style.setProperty('--probability', `${Math.max(probability * 100, 1)}%`);
    button.innerHTML = `<span>${word.toUpperCase()}</span><span class="likely-percent">${formatPercent(probability)}</span>`;
    button.setAttribute('aria-label', `${word.toUpperCase()}, ${formatPercent(probability)} likely. Add to board.`);
    button.addEventListener('click', () => {
        update(fillWord(board, word));
        track('suggestion_clicked', { position: position + 1 });
    });
    item.append(button);
    return item;
}

function renderLikely() {
    const { count, likely, contradiction } = results;
    const guesses = submittedGuesses(board);
    listVersion++;
    elements.likelyList.replaceChildren();
    elements.showAll.hidden = true;

    if (guesses.length === 0) {
        elements.likelyCount.textContent = '';
        elements.likelyMessage.textContent = 'Enter your first guess to see likely answers.';
        return;
    }
    if (count === 0) {
        elements.likelyCount.textContent = '(0)';
        elements.likelyMessage.textContent = contradiction === 0
            ? 'No words fit row 1. Check its colors.'
            : `No words fit. Row ${contradiction + 1} contradicts the earlier rows. Check its colors.`;
        return;
    }

    elements.likelyCount.textContent = `(${count.toLocaleString()})`;
    elements.likelyMessage.textContent = '';
    elements.likelyList.append(...likely.slice(0, LIKELY_PREVIEW).map(likelyItem));
    if (count > LIKELY_PREVIEW) {
        elements.showAll.textContent = `Show all ${count.toLocaleString()}`;
        elements.showAll.hidden = false;
    }
}

function showAll() {
    elements.showAll.hidden = true;
    const version = listVersion;
    let start = LIKELY_PREVIEW;
    const appendBatch = () => {
        if (version !== listVersion) {
            return;   // newer results replaced the list
        }
        const batch = results.likely.slice(start, start + SHOW_ALL_BATCH);
        elements.likelyList.append(...batch.map((entry, i) => likelyItem(entry, start + i)));
        start += SHOW_ALL_BATCH;
        if (start < results.likely.length) {
            requestAnimationFrame(appendBatch);
        }
    };
    appendBatch();
}

function renderResults() {
    renderBest();
    renderLikely();
    const guesses = submittedGuesses(board);
    if (guesses.length > 0) {
        elements.liveSummary.textContent = results.count === 0
            ? elements.likelyMessage.textContent
            : `${results.count.toLocaleString()} words left. Best guess: ${results.best.word.toUpperCase()}.`;
    }
}

// Settings and dialogs

function applySettings() {
    const root = document.documentElement;
    if (settings.theme === 'system') {
        delete root.dataset.theme;
    } else {
        root.dataset.theme = settings.theme;
    }
    root.classList.toggle('high-contrast', settings.highContrast);
    elements.hardMode.checked = settings.hardMode;
    elements.theme.value = settings.theme;
    elements.highContrast.checked = settings.highContrast;
}

function changeSettings(changes) {
    settings = { ...settings, ...changes };
    save(SETTINGS_KEY, JSON.stringify(settings));
    applySettings();
}

elements.hardMode.addEventListener('change', () => {
    changeSettings({ hardMode: elements.hardMode.checked });
    requestResults();
});
elements.theme.addEventListener('change', () => changeSettings({ theme: elements.theme.value }));
elements.highContrast.addEventListener('change', () => changeSettings({ highContrast: elements.highContrast.checked }));

$('help-button').addEventListener('click', () => $('help-dialog').showModal());
$('settings-button').addEventListener('click', () => $('settings-dialog').showModal());

$('new-game').addEventListener('click', () => update(createBoard()));
elements.useBest.addEventListener('click', () => {
    if (!results?.best) {
        return;
    }
    const guessNumber = activeRow(board) + 1;
    update(fillWord(board, results.best.word));
    track('best_guess_used', { guess_number: guessNumber });
});
elements.showAll.addEventListener('click', showAll);

buildBoard();
buildKeyboard();
applySettings();
renderBoard();
```

- [ ] **Step 7: Run the unit tests**

Run: `npm test`
Expected: PASS (data, wordle, rank, board). `solver.test.js` is gone.

- [ ] **Step 8: Serve the site and do a first visual check**

Run in the background: `python3 -m http.server 8765 -d public`

In Playwright, open `http://localhost:8765/` at 1280×900, then 375×812 and 320×640. Take a screenshot at each size and check:
- the layout matches the spec: two columns at 1280, stacked below 860;
- nothing is clipped;
- the browser console has no errors.

Fix anything off in `site.css` before continuing.

- [ ] **Step 9: Browser checks for the Review Focus items**

Run this in Playwright (`browser_run_code`) against `http://localhost:8765/`. Every value in the returned object must match the expectation noted next to it.

```js
async (page) => {
    const out = {};
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('http://localhost:8765/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForFunction(() => !document.getElementById('use-best').disabled);

    // Fits a phone with no horizontal scroll (expect true at 375 and 320)
    out.fits375 = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    await page.setViewportSize({ width: 320, height: 640 });
    out.fits320 = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    await page.setViewportSize({ width: 375, height: 812 });

    // Typing, Backspace and validation
    for (const ch of 'cranx') await page.keyboard.press(ch);
    await page.keyboard.press('Backspace');
    await page.keyboard.press('e');
    out.typed = await page.evaluate(() => [...document.querySelectorAll('.board-row')][0].textContent);   // expect "crane"
    for (const ch of 'zzzzz') await page.keyboard.press(ch);   // ignored: row 1 is full
    await page.keyboard.press('Enter');
    out.submittedRows = await page.evaluate(() => document.querySelectorAll('.remove-row[style*="visible"]').length);   // expect 1

    // Enter while a tile is focused submits rather than recoloring
    for (const ch of 'xxxxx') await page.keyboard.press(ch);
    await page.locator('.tile').nth(5).focus();
    await page.keyboard.press('Enter');
    out.notInList = await page.locator('#board-message').textContent();   // expect "Not in word list"
    out.tile5Color = await page.locator('.tile').nth(5).getAttribute('data-color');   // expect "gray"
    for (let i = 0; i < 5; i++) await page.keyboard.press('Backspace');

    // Modifier shortcuts and open dialogs don't type
    await page.keyboard.press('Meta+a');
    await page.keyboard.press('Alt+q');
    await page.click('#settings-button');
    await page.keyboard.press('q');
    await page.keyboard.press('Escape');
    out.row2AfterShortcuts = await page.evaluate(() => [...document.querySelectorAll('.board-row')][1].textContent);   // expect ""

    // Rapid color taps: the final results must match the final board
    const row1 = page.locator('.board-row').first().locator('.tile');
    for (let i = 0; i < 12; i++) await row1.nth(i % 5).click();
    await page.waitForTimeout(1500);
    out.shownCount = await page.locator('#likely-count').textContent();
    out.expectedCount = await page.evaluate(async () => {
        const { buildLexicon, solve } = await import('/js/rank.js');
        const { encodeColors } = await import('/js/wordle.js');
        const text = f => fetch(`/data/${f}`).then(r => r.text());
        const lines = t => t.split('\n').filter(Boolean);
        const lexicon = buildLexicon((await text('words.txt')).trim().split(' '), lines(await text('original-answers.txt')), lines(await text('common.txt')));
        const saved = JSON.parse(localStorage.getItem('wordle-wizard-board')).board;
        const rows = saved.filter(r => r.submitted).map(r => ({ word: r.letters, pattern: encodeColors(r.colors) }));
        const { count } = solve(lexicon, rows);
        return count === 0 ? '(0)' : `(${count.toLocaleString()})`;
    });   // expect shownCount === expectedCount

    // An impossible row names row 1: SPEED with only the second E yellow
    await page.click('#new-game');
    for (const ch of 'speed') await page.keyboard.press(ch);
    await page.keyboard.press('Enter');
    await page.locator('.tile').nth(3).click();
    await page.waitForTimeout(800);
    out.contradiction = await page.locator('#likely-message').textContent();   // expect "No words fit row 1. Check its colors."

    // Corrupt saved data loads a fresh board without errors
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.evaluate(() => {
        localStorage.setItem('wordle-wizard-board', '{not json');
        localStorage.setItem('wordle-wizard-settings', '"oops"');
    });
    await page.reload();
    await page.waitForTimeout(800);
    out.freshAfterCorrupt = await page.evaluate(() => [...document.querySelectorAll('.tile')].every(t => t.textContent === ''));   // expect true
    out.pageErrors = errors;   // expect []

    // Word list blocked: a visible error, not a stuck "Loading…" (context routes also cover the worker's requests)
    await page.context().route('**/data/words.txt', route => route.abort());
    await page.reload();
    await page.waitForTimeout(1500);
    out.loadError = await page.locator('#best-detail').textContent();   // expect "Couldn't load the word list…"
    await page.context().unroute('**/data/words.txt');
    return out;
}
```

If any value differs from its expectation, fix `app.js`, `worker.js` or the styles, then run the script again.

- [ ] **Step 10: Check the themes**

In Playwright, take screenshots in each of these states:
- light theme;
- dark theme (`page.emulateMedia({ colorScheme: 'dark' })`);
- high-contrast colors, turned on in settings.

In each one, the tiles, keys and cards should be legible.

- [ ] **Step 11: Commit**

```bash
git add -A public assets tests
git commit -m "Rebuild the app UI: side-panel layout, best-guess card, worker-based solver

Removes Bootstrap, Font Awesome, jQuery remnants, the splash screen, and the old solver."
```

---

### Task 7: Content, search, privacy and site files

**Files:**
- Modify: `public/index.html` (head meta, FAQ section), `public/css/site.css` (FAQ and prose styles), `netlify.toml`, `README.md`
- Rewrite: `public/privacy/index.html`, `public/favicon.ico`
- Create: `public/404.html`, `public/robots.txt`, `public/sitemap.xml`, `public/img/apple-touch-icon.png`, `public/img/og-image.png`, `scripts/og-image.html`

**Interfaces:**
- Consumes: the markup, CSS variables and classes from Task 6. Task 6's `site-header` and `site-footer` markup is reused on the privacy and 404 pages.
- Produces: final site content.

- [ ] **Step 1: Add search and social meta to the home page**

In `public/index.html`, replace:

```html
    <link rel="icon" href="/favicon.ico" sizes="32x32">
```

with:

```html
    <meta name="description" content="Wordle Wizard suggests the best next guess for today's Wordle and ranks the likeliest answers. Enter your guesses and colors to solve faster.">
    <link rel="canonical" href="https://www.wordlewizard.com/">
    <meta name="theme-color" content="#5a2fc2">
    <meta property="og:type" content="website">
    <meta property="og:url" content="https://www.wordlewizard.com/">
    <meta property="og:title" content="Wordle Wizard: Wordle Solver &amp; Best Next Guess">
    <meta property="og:description" content="Enter your Wordle guesses and colors. Get the best next guess and the likeliest answers.">
    <meta property="og:image" content="https://www.wordlewizard.com/img/og-image.png">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="Wordle Wizard: the best next guess for today's Wordle">
    <meta name="twitter:card" content="summary_large_image">
    <script type="application/ld+json">
        {
            "@context": "https://schema.org",
            "@type": "WebApplication",
            "name": "Wordle Wizard",
            "url": "https://www.wordlewizard.com/",
            "description": "Suggests the best next guess for Wordle and ranks the likeliest answers.",
            "applicationCategory": "GameApplication",
            "operatingSystem": "Any",
            "browserRequirements": "Requires JavaScript",
            "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" }
        }
    </script>
    <link rel="icon" href="/favicon.ico" sizes="32x32">
    <link rel="apple-touch-icon" href="/img/apple-touch-icon.png">
```

- [ ] **Step 2: Add the FAQ**

In `public/index.html`, insert this between `<p id="live-summary" …></p>` and `<footer class="site-footer">`:

```html
    <section class="faq" aria-labelledby="faq-title">
        <h2 id="faq-title">How Wordle Wizard works</h2>
        <details open>
            <summary>How do I use it?</summary>
            <p>Play your guess in Wordle, then type the same word here and press Enter. Tap each letter until it shows the color Wordle gave it: gray for letters not in the word, yellow for letters in the word but in the wrong spot, and green for letters in the right spot. Wordle Wizard updates its suggestions as soon as the colors change.</p>
        </details>
        <details>
            <summary>What does the best next guess mean?</summary>
            <p>It's the word expected to rule out the most possible answers, whatever colors Wordle shows you. Wordle Wizard tries thousands of guesses against every answer that's still possible and picks the one that splits them most evenly, then shows how many answers you can expect to have left. When one answer is very likely, it suggests going for the win instead.</p>
        </details>
        <details>
            <summary>How are likely answers ranked?</summary>
            <p>Wordle accepts 14,855 words as guesses, but most answers come from a much smaller list of common words. Words from Wordle's original answer list rank highest, other common English words come next, and obscure words come last. The percentages show how likely each remaining word is to be the answer.</p>
        </details>
        <details>
            <summary>Does it work with hard mode?</summary>
            <p>Yes. Turn on hard mode in settings and every suggested guess will keep your green letters in place and use every yellow letter, as Wordle's hard mode requires.</p>
        </details>
        <details>
            <summary>Where do the words come from?</summary>
            <p>The 14,855 accepted words match the list in The New York Times' Wordle game. Word frequencies come from <a href="https://github.com/rspeer/wordfreq">wordfreq</a> by Robyn Speer, used under the <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a> license.</p>
        </details>
        <details>
            <summary>Is this the official Wordle?</summary>
            <p>No. Wordle Wizard is an independent helper and isn't affiliated with The New York Times. Wordle is a trademark of The New York Times Company.</p>
        </details>
    </section>
```

Append to `public/css/site.css`:

```css
/* FAQ and text pages */

.faq,
.page {
    max-width: 760px;
    margin: 1rem auto 0;
    padding: 0 1rem;
}

.faq h2,
.page h1 {
    color: var(--brand-strong);
    font-family: var(--display);
}

.faq details {
    padding: 0.75rem 0;
    border-bottom: 1px solid var(--border);
}

.faq summary {
    font-weight: 600;
    cursor: pointer;
}

.faq details p { margin: 0.5rem 0 0; }

.page h2 { margin-top: 2rem; }
```

- [ ] **Step 3: Rewrite the privacy policy**

Replace `public/privacy/index.html` with:

```html
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Privacy Policy · Wordle Wizard</title>
    <meta name="description" content="How Wordle Wizard handles your data: Google Analytics for usage statistics, and your board saved only in your browser.">
    <link rel="canonical" href="https://www.wordlewizard.com/privacy/">
    <script>
        try {
            const settings = JSON.parse(localStorage.getItem('wordle-wizard-settings')) || {};
            if (settings.theme === 'light' || settings.theme === 'dark') {
                document.documentElement.dataset.theme = settings.theme;
            }
        } catch {
            // Storage unavailable; use the defaults
        }
    </script>

    <!-- Google tag (gtag.js) -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-ZL1VPX5V4V"></script>
    <script>
        window.dataLayer = window.dataLayer || [];
        function gtag() { dataLayer.push(arguments); }
        gtag('js', new Date());

        gtag('config', 'G-ZL1VPX5V4V');
    </script>

    <link rel="icon" href="/favicon.ico" sizes="32x32">
    <link rel="apple-touch-icon" href="/img/apple-touch-icon.png">
    <link rel="stylesheet" href="/css/site.css">
</head>

<body>
    <header class="site-header">
        <a class="brand" href="/">
            <img src="/img/logo.webp" alt="" width="40" height="52">
            <span class="wordmark">Wordle Wizard</span>
        </a>
    </header>

    <main class="page">
        <h1>Privacy Policy</h1>
        <p>Last updated: October 1, 2026</p>

        <p>Wordle Wizard doesn't ask for, collect, or store personal information. It uses Google Analytics to understand how many people use the site and how they use it.</p>

        <h2>Google Analytics</h2>
        <p>When you visit, Google Analytics collects usage data such as the pages you view, how long you stay, the site that referred you, your device and browser type, and your approximate location based on your IP address. It also records a few anonymous actions, such as entering a guess or using a suggestion. These record only counts and positions, never the words you enter.</p>
        <p>Google Analytics sets cookies named <code>_ga</code> and <code>_ga_ZL1VPX5V4V</code> that last up to two years and let it recognize returning visitors. Google processes this data under its own policies: see <a href="https://policies.google.com/privacy">Google's Privacy Policy</a> and <a href="https://policies.google.com/technologies/partner-sites">how Google uses information from sites that use its services</a>.</p>
        <p>You can opt out with the <a href="https://tools.google.com/dlpage/gaoptout">Google Analytics opt-out browser add-on</a>, by blocking cookies in your browser, or with a content blocker.</p>

        <h2>Saved in your browser</h2>
        <p>Your current board and your settings (hard mode, theme, and high contrast) are saved in your browser's local storage so they survive a reload. They never leave your device. The board resets each day, and "New game" or clearing your browser's site data removes it.</p>

        <h2>Sharing</h2>
        <p>Wordle Wizard has no accounts and doesn't sell or share data. The only third party involved is Google, through Google Analytics as described above.</p>

        <h2>Changes</h2>
        <p>If this policy changes, the new version will be posted on this page with a new "Last updated" date.</p>

        <h2>Contact</h2>
        <p>Questions? <a href="https://github.com/wadewegner/wordle-solver/issues">Open an issue on GitHub</a>.</p>
    </main>

    <footer class="site-footer">
        <p>&copy; 2026 Wordle Wizard &middot; Not affiliated with The New York Times. &middot; <a href="/">Home</a></p>
    </footer>
</body>

</html>
```

- [ ] **Step 4: Add the 404 page, robots.txt and sitemap**

Create `public/404.html`:

```html
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Page not found · Wordle Wizard</title>
    <meta name="robots" content="noindex">
    <link rel="icon" href="/favicon.ico" sizes="32x32">
    <link rel="stylesheet" href="/css/site.css">
</head>

<body>
    <header class="site-header">
        <a class="brand" href="/">
            <img src="/img/logo.webp" alt="" width="40" height="52">
            <span class="wordmark">Wordle Wizard</span>
        </a>
    </header>
    <main class="page">
        <h1>This page vanished in a puff of smoke</h1>
        <p>The page you're looking for doesn't exist. <a href="/">Back to Wordle Wizard</a>.</p>
    </main>
</body>

</html>
```

Create `public/robots.txt`:

```
User-agent: *
Allow: /

Sitemap: https://www.wordlewizard.com/sitemap.xml
```

Create `public/sitemap.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url><loc>https://www.wordlewizard.com/</loc></url>
    <url><loc>https://www.wordlewizard.com/privacy/</loc></url>
</urlset>
```

- [ ] **Step 5: Make the icons and the link-preview image**

Create `scripts/og-image.html`:

```html
<!DOCTYPE html>
<html lang="en">
<!-- Template for public/img/og-image.png (1200x630). See README for the screenshot command. -->
<head>
    <meta charset="utf-8">
    <style>
        @font-face { font-family: 'Cinzel'; src: url('../public/fonts/cinzel-700-subset.woff2') format('woff2'); font-weight: 700; }
        body {
            margin: 0; width: 1200px; height: 630px; box-sizing: border-box;
            display: flex; align-items: center; gap: 56px; padding: 0 80px;
            background: radial-gradient(circle at 80% 15%, #7b4fe0 0, #3d1f8f 45%, #160f33 100%);
            color: #ffffff; font-family: system-ui, sans-serif;
        }
        img { height: 480px; }
        h1 { margin: 0 0 16px; font: 700 88px/1 'Cinzel', serif; letter-spacing: 0.02em; }
        p { margin: 0 0 40px; color: #e6dcff; font-size: 36px; }
        .tiles { display: flex; gap: 12px; }
        .tiles span { display: grid; place-items: center; width: 84px; height: 84px; border-radius: 10px; font: 700 48px system-ui, sans-serif; }
    </style>
</head>
<body>
    <img src="../assets/wizard.png" alt="">
    <div>
        <h1>Wordle Wizard</h1>
        <p>The best next guess for today's Wordle</p>
        <div class="tiles">
            <span style="background:#538d4e">M</span><span style="background:#787c7e">A</span><span style="background:#a68f2c">G</span><span style="background:#538d4e">I</span><span style="background:#538d4e">C</span>
        </div>
    </div>
</body>
</html>
```

Then run:

```bash
magick assets/icons-wizard.png -background none -define icon:auto-resize=32,16 public/favicon.ico
magick -size 180x180 xc:'#5a2fc2' \( assets/wizard.png -resize 150x150 \) -gravity center -composite public/img/apple-touch-icon.png
npx -y playwright screenshot --viewport-size=1200,630 "file://$PWD/scripts/og-image.html" public/img/og-image.png
```

If Chromium is missing, `npx playwright screenshot` reports it. In that case, run `npx -y playwright install chromium` and retry, or open the file in the Playwright browser tool at 1200×630 and save a screenshot to the same path.

Check: read `public/img/og-image.png` and `public/img/apple-touch-icon.png` and look at them; both should be on-brand and uncropped.

- [ ] **Step 6: Add the security headers and pin the Node version**

Replace `netlify.toml` with:

```toml
[build]
  publish = "public"
  command = "npm test"

[build.environment]
  NODE_VERSION = "22"

# The old ASP.NET app served the privacy page at /Privacy
[[redirects]]
  from = "/Privacy"
  to = "/privacy/"
  status = 301

[[headers]]
  for = "/*"
  [headers.values]
    X-Content-Type-Options = "nosniff"
    X-Frame-Options = "DENY"
    Referrer-Policy = "strict-origin-when-cross-origin"
```

- [ ] **Step 7: Update the README**

Replace everything in `README.md` from the line `## Features` up to (but not including) `## Contributing` with:

````markdown
## Features

- Enter each Wordle guess and tap its letters to match Wordle's colors (gray, yellow, green).
- **Best next guess:** the word expected to rule out the most possible answers, with how many you can expect to have left.
- **Likely answers:** every remaining word, ranked by how likely NYT is to pick it.
- Hard mode, light and dark themes, a high-contrast option, and a board that's saved until the next puzzle.

## How it works

The solver lives in `public/js/` and runs in a Web Worker:

- `wordle.js` scores guesses exactly like Wordle and filters the 14,855 accepted words to the ones that fit every row.
- `rank.js` weights each word by how likely it is to be an answer and searches for the guess that splits the remaining answers most evenly.
- `board.js` holds the board's rules; `app.js` is the page.

## Development

```bash
npm test            # unit tests (also the Netlify build command)
npm start           # serve the site at http://localhost:3000
npm run benchmark   # play every past NYT answer (-- --hard for hard mode, -- --limit N)
```

Regenerating data:

```bash
python3 -m venv /tmp/wfvenv && /tmp/wfvenv/bin/pip install wordfreq
/tmp/wfvenv/bin/python scripts/build-word-data.py   # original-answers.txt and common.txt
npm run opening                                     # opening.json
node bench/fetch-past-answers.js                    # refresh the benchmark fixture
npx playwright screenshot --viewport-size=1200,630 "file://$PWD/scripts/og-image.html" public/img/og-image.png
```

## Data and credits

- **Accepted words** (`public/data/words.txt`): the 14,855 words NYT Wordle accepts as guesses.
- **Original answers** (`public/data/original-answers.txt`): the 2,315-word answer list from the original 2021 game, minus six words NYT removed.
- **Word frequencies:** [wordfreq](https://github.com/rspeer/wordfreq) by Robyn Speer, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
- **Display font:** [Cinzel](https://github.com/NDISCOVER/Cinzel), SIL Open Font License (`public/fonts/OFL.txt`).
- Wordle Wizard isn't affiliated with The New York Times. Wordle is a trademark of The New York Times Company.

## Deployment

The site is hosted on [Netlify](https://www.netlify.com/), which serves the `public` directory (see `netlify.toml`). Every push to `main` deploys to production. There's no build step; `npm test` runs as the build command, so a failing test blocks the deploy.

````

Also replace the README's opening paragraph and the screenshot table, everything from `# Wordle Wizard` down to `## Features`, with:

```markdown
# Wordle Wizard

Wordle Wizard helps you solve the daily NYT Wordle. Enter the guesses you've played and the colors Wordle showed, and it suggests the best next guess and the likeliest answers.

[Try it at wordlewizard.com](https://www.wordlewizard.com/)

```

Then delete the old screenshots: `git rm -q screenshot1.jpg screenshot2.jpg`. They show the old design.

- [ ] **Step 8: Verify**

1. Run `npm test`. Expected: PASS.
2. With the local server from Task 6 still running, check `http://localhost:8765/privacy/` and `http://localhost:8765/nope` in Playwright. Python's server doesn't serve `404.html`, so open `/404.html` directly to check the 404 page.
3. Confirm there are no console errors and the FAQ renders.
4. Validate the JSON-LD: `document.querySelector('script[type="application/ld+json"]').textContent` must parse with `JSON.parse`.

- [ ] **Step 9: Commit**

```bash
git add -A public scripts netlify.toml README.md
git commit -m "Add FAQ, search and social meta, accurate privacy policy, icons, and site files"
```

---

### Task 8: Full verification

**Files:** none are created. Fix issues in the files that cause them, then commit.

- [ ] **Step 1: Unit tests and benchmark**

Run: `npm test && npm run benchmark`
Expected:
- all tests PASS;
- the benchmark still meets ≥ 99.00% solved and an average of ≤ 3.700.

- [ ] **Step 2: Size budget**

```bash
cd public && total=0; for f in index.html css/site.css js/app.js js/board.js js/worker.js js/wordle.js js/rank.js data/words.txt data/original-answers.txt data/common.txt data/opening.json; do s=$(gzip -9c "$f" | wc -c); total=$((total + s)); printf "%7d  %s (gzip)\n" "$s" "$f"; done; for f in img/logo.webp fonts/cinzel-700-subset.woff2 favicon.ico; do s=$(wc -c < "$f"); total=$((total + s)); printf "%7d  %s\n" "$s" "$f"; done; echo "total: $total bytes"; cd ..
```

Expected: a total of 153,600 bytes (150 KB) or less. Netlify serves Brotli, which is smaller than gzip, so this is a conservative check.

- [ ] **Step 3: Lighthouse (mobile)**

With the local server running:

```bash
npx -y lighthouse http://localhost:8765/ --only-categories=performance,accessibility,seo --form-factor=mobile --quiet --chrome-flags="--headless=new" --output=json --output-path=/tmp/lh.json
node -e "const r=require('/tmp/lh.json'); for (const [k,v] of Object.entries(r.categories)) console.log(k, Math.round(v.score*100)); for (const a of Object.values(r.audits)) if (a.score !== null && a.score < 0.9 && a.details) console.log('  -', a.id, a.title)"
```

Expected: performance ≥ 90, accessibility ≥ 95, seo ≥ 95. The local server doesn't compress, so if performance falls just short, recheck it on the Netlify deploy preview (Task 9) before changing code. Fix any accessibility or SEO audits it lists.

- [ ] **Step 4: Phone CPU check for search speed**

In Playwright at 375×812, slow the CPU down 4× through a CDP session (`Emulation.setCPUThrottlingRate` with `rate: 4`), as a stand-in for a mid-range phone. Then:
1. Enter CRANE with the second letter yellow and the rest gray, and press Enter.
2. Measure the time from Enter to the `#likely-count` update.

Expected: under 300 ms for typical states. If it's slower, lower `SCORING_BUDGET` in `rank.js`, rerun the benchmark to confirm the target still holds, and commit.

- [ ] **Step 5: Analytics events**

In Playwright, play one row, click a likely answer, and click "Use this word". Then:

```js
() => window.dataLayer.filter(e => e[0] === 'event').map(e => [e[1], e[2]])
```

Expected: `guess_entered`, `suggestion_clicked` and `best_guess_used` appear, each with numeric parameters only.

- [ ] **Step 6: Accessibility spot check**

In Playwright, take a `browser_snapshot` (the accessibility tree) of the home page after one submitted row. Check:
- tiles read "Row 1, letter 1, C, gray" style labels;
- keys have names;
- remove buttons read "Remove guess 1";
- dialogs have titles.

Then use Tab to reach a tile, press Space, and confirm its color changes.

- [ ] **Step 7: Commit any fixes**

```bash
git add -A && git commit -m "Fix issues found in final verification"
```

Skip the commit if nothing changed.

---

### Task 9: Local review and rollout (gated by the owner)

- [ ] **Step 1: Hand off for local review. STOP until the owner approves.**

Stop the Python server. Tell the owner to run `npm start` and open http://localhost:3000. Summarize what to try:
- typing and colors;
- the best guess and likely answers;
- hard mode;
- dark mode;
- a phone-sized window.

Include the benchmark numbers, the size total and the Lighthouse scores. Make any requested changes, rerun `npm test`, commit, and ask again. Don't push until the owner approves.

- [ ] **Step 2: Push the branch and open a PR**

```bash
git push -u origin redesign
gh pr create --base main --head redesign --title "Redesign Wordle Wizard: best next guess, exact solver, new UI" --body "<summary of the spec, benchmark numbers, size and Lighthouse results>

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01CtkTBemN8W2gnmmztGQUpX"
```

Get the deploy preview URL from the Netlify check on the PR (`gh pr checks`). Rerun Lighthouse against the preview, and send the owner the URL for phone testing.

- [ ] **Step 3: Merge after the owner approves the preview**

```bash
gh pr merge --merge --delete-branch
```

Then confirm that the production deploy for the merge commit is `ready` (`npx netlify-cli api listSiteDeploys`). Also check that https://www.wordlewizard.com serves the new site: there's no Bootstrap, and `/data/opening.json` returns 200. Finally, ask the owner to look at the GA real-time view.

- [ ] **Step 4: Optional: Search Console**

Offer to walk the owner through adding `https://www.wordlewizard.com/sitemap.xml` in Google Search Console.
