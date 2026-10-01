# Wordle Wizard redesign: design

Date: 2026-10-01
Status: approved in conversation, pending written-spec review

## Purpose

Wordle Wizard (https://www.wordlewizard.com) helps people solving the daily NYT Wordle. They enter the guesses they made and the colors Wordle showed, and the site suggests what to play next. It's a public site and the goal is to grow it, so it has to give genuinely good suggestions, work well on phones, load fast, be found by search engines, look good when shared, and measure usage.

The site is now static on Netlify (migrated from Heroku). The solver is a direct port of the original C# code.

## What the review found

| Area | Finding | Evidence |
|---|---|---|
| Ranking | Weak. With no guesses entered, the top suggestions are ESSES, EASES and SEASE. | Always taking the top suggestion solves 63% of 500 simulated games, averaging 5.17 guesses. |
| Obscure words | Words like NOINT, OOBIT and POUPT rank alongside common words. | Everything in the 14,855-word list is treated equally. |
| Repeated letters | The filter ignores letter counts. | 0 of 3,000 random games wrongly drop the answer, but repeated-letter cases keep up to 10× too many words (229 vs 20). |
| Result list | Every match is shown: up to 14,855 list items, no count, no message when nothing matches. | |
| Input | Backspace doesn't work, the Enter key doesn't submit, and tiles cycle in gray → green → yellow order. | |
| Mobile | The keyboard overflows a 375 px screen and the keys are 34 px tall. | |
| Weight | 1.1 MB per page. | Splash image 480 KB, Bootstrap 236 KB, Font Awesome 137 KB, GA 172 KB. |
| Privacy | The policy says no cookies, but GA sets `_ga` cookies. | |
| Accessibility and search | No labels on tiles or buttons, no meta description, no link-preview tags. | |

## Dictionary audit

- `public/words.txt` is identical to NYT's current accepted-guess list: 14,855 words, unchanged since 2022-09-06. It's taken from the live bundle at `nytimes.com/games-assets/v2/2499.*.js`. No change is needed.
- The same bundle contains a 2,309-word list: the original 2021 answer list of 2,315 words minus the six NYT removed (agora, fibre, lynch, pupal, slave, wench).
- All 1,931 NYT answers from 2021-06-19 through 2026-10-01 are in `words.txt`.
- 1,869 of the 1,931 answers are in the 2,309-word list. Since 2026-02-02, NYT also repeats past answers (25 so far) and increasingly picks common words from outside the list (33 so far in 2026).

## Decisions

| Topic | Decision |
|---|---|
| Audience | Public; grow it |
| Suggestions | One best next guess with its expected effect, plus ranked likely answers with a count |
| Past answers | Not tracked or used at runtime. No daily data updates. |
| Analytics | Keep Google Analytics (G-ZL1VPX5V4V). No cookie consent banner. The privacy policy must accurately describe GA. |
| Look | Wizard-branded identity |
| Layout | Side panel on desktop, stacked on phones |
| Approach | Rebuild in plain HTML/CSS/ES modules with no framework and no build step. The solver runs in a Web Worker. |
| Rollout | `redesign` branch. The owner runs it locally first, then a PR gives a Netlify deploy preview, then merging to `main` publishes. |

## Not in scope

- Tracking past answers, scheduled data jobs, or excluding or weighting past answers.
- Cookie consent banner.
- Frameworks, bundlers or new runtime dependencies.
- Offline/PWA support, accounts, sharing results, or multiple languages.

## Architecture

```
public/
  index.html            tool + "How it works / FAQ" (static, crawlable)
  privacy/index.html    rewritten policy
  404.html              branded not-found page
  robots.txt, sitemap.xml, favicon.ico
  css/site.css          rewritten; no Bootstrap
  fonts/                one self-hosted, subset display typeface (OFL), woff2
  img/                  logo (≤15 KB), og-image.png (1200×630), apple-touch-icon.png
  data/
    words.txt           moved from public/words.txt, unchanged (14,855 accepted guesses)
    original-answers.txt  2,309 words (Tier A)
    common.txt          common words outside Tier A (Tier B), generated
  js/
    wordle.js           pure: pattern scoring, filtering, contradiction finding, hard-mode check
    rank.js             pure: likelihood weights, ranked answers, best guess
    worker.js           Web Worker: loads data and answers {guesses, hardMode} requests
    board.js            pure: board state and rules (no DOM)
    app.js              DOM: rendering, events, worker messaging, settings, GA events
scripts/
  build-common-words.py  one-time generator for data/common.txt (wordfreq)
  opening.js             precomputes the opening best guess
bench/
  benchmark.js          dev-only simulation over past NYT answers
  past-answers.json     fixture (dev-only; never loaded by the site)
tests/                  node:test unit tests (run as the Netlify build command)
```

Removed: `public/lib/bootstrap/`, `public/js/solver.js`, `public/js/overlay.js`, the 480 KB `wizard.png` and `icons-wizard.png` (replaced by the optimized logo and icons), and the Font Awesome CDN link.

Each module has one job. `wordle.js`, `rank.js` and `board.js` have no DOM access, so they can be tested in Node. `app.js` is the only file that touches the DOM. `worker.js` is a thin adapter around `wordle.js` and `rank.js`.

## Solver

### Scoring

`scorePattern(guess, answer)` reproduces Wordle exactly. Greens are assigned first. Then yellows are assigned left to right, limited by how many of each letter remain unmatched in the answer. The result is encoded as a base-3 integer from 0 to 242, which makes comparison and grouping fast.

### Filtering

A word is a candidate if, for every submitted row, `scorePattern(rowWord, candidate)` equals the row's entered colors. This handles repeated letters exactly.

If the candidates drop to zero, `findContradiction` reports the first row after which nothing matches. The UI then says, for example, "No words fit. Row 3 contradicts the earlier rows. Check its colors."

### Likelihood

Every one of the 14,855 words can be an answer, but each has a static weight:

| Tier | Contents | Starting weight |
|---|---|---|
| A | `original-answers.txt` (2,309) | 1.0 |
| B | `common.txt`: other words with wordfreq Zipf frequency ≥ 2.0 that aren't a plural or past tense of a common shorter word | 0.1 |
| C | everything else | 0.001 |

The Tier B threshold and the tier weights are tuned with the benchmark before launch.

`common.txt` is generated once by `scripts/build-common-words.py` with the `wordfreq` package. wordfreq's data is CC BY-SA 4.0, so it's credited in the FAQ and the README.

### Likely answers

Candidates are sorted by weight. Each one's probability is its weight divided by the total weight of all candidates. The top 10 are shown with percentages, then "Show all N".

### Best next guess

The best guess maximizes expected information. For a guess *g*, group the candidates by `scorePattern(g, c)`. Each pattern's probability is the summed weight of its candidates divided by the total weight. The guess's score is the entropy of that distribution. Ties go to the guess that is itself a candidate, then to the higher-weighted one.

**Going for the win.** If two or fewer candidates remain, or the top candidate's probability is at least 0.5, the best guess is the most likely candidate.

**Guess pool.** The pool is sized to a budget of about 1.5 million pattern computations: up to 1,500,000 ÷ candidates words, but never fewer than 200. The pool is the top words by a quick heuristic (for each distinct letter, how evenly it splits the candidates' weight), plus the 200 likeliest candidates. With few candidates this covers the whole dictionary.

**Expected effect.** This is the probability-weighted average of the candidate count in each pattern group. It's shown as "578 → ~19 left".

**Opening guess.** The best guess with no rows entered is precomputed by `scripts/opening.js` and stored as a constant. It's the same in hard mode.

**Hard mode.** NYT's rule applies: green letters must stay in their positions and yellow letters must appear somewhere. With hard mode on, the pool is limited to words that obey that rule for every submitted row. This is looser than full consistency: a yellow letter may stay in the same spot and gray letters may be reused, as NYT allows. The setting is saved.

**Performance.** All of this runs in `worker.js`. The target is a best guess in under 300 ms on a mid-range phone for typical states after the first guess.

## Interface

### Layout

At ≥ 860 px wide there are two columns: the board and keyboard on the left, the results panel on the right. On narrower screens it's one column: the board, then the best-guess card, the keyboard, and likely answers in a collapsible section.

The header has the logo, the "Wordle Wizard" wordmark, a help button and a settings button. The footer has © 2026 Wordle Wizard, "Not affiliated with The New York Times.", and a link to Privacy.

### Entering guesses (`board.js` rules)

- **Rows.** There are 6 rows. Each is empty, being typed, or submitted. Typing (physical keyboard or on-screen) fills the first row that isn't submitted. Backspace removes its last letter.
- **Enter** submits the row only if it has 5 letters and the word is in `words.txt`. Otherwise the row shakes and shows "Not in word list" or "Not enough letters".
- **Colors.** Tapping a tile with a letter, in a typing or submitted row, cycles gray → yellow → green → gray.
- **What counts.** Only submitted rows count toward suggestions. Changing a color in a submitted row recomputes immediately.
- **Removing rows.** Each submitted row has a × button that removes it, and later rows shift up. "New game" clears everything.
- **Suggestions.** Clicking a likely answer, or "Use this word" on the best-guess card, puts the word in the row being typed, replacing any partial letters, or else in the next empty row. That row is left in the typing state, all gray.
- **Saving progress.** The board and settings are saved to `localStorage` with the local date. On load, a different date means a fresh board, because the new puzzle starts at local midnight.

### On-screen keyboard

Each key shows the best state known for its letter (green beats yellow beats gray). It fits 320 px wide with no horizontal scrolling, and keys are about 50 px tall. It includes Enter and Backspace.

### Results panel

- **Best-guess card:** the word in the display face, "578 → ~19 left", and a "Use this word" button. Before any rows are submitted, it shows the precomputed opening guess.
- **Likely answers:** the count, the top 10 with probability bars, and "Show all N", which renders the rest in batches.
- **Messages:** the contradiction message, and a computing state if a calculation takes more than 150 ms.

### Visual identity

- **Palette:** deep indigo and purple, with light and dark themes. The theme follows `prefers-color-scheme` and can be changed manually.
- **Tiles:** Wordle hues with white letters, darkened just enough to meet WCAG AA for large text: green `#538d4e`, yellow `#a68f2c`, gray `#787c7e`. Wordle's exact light-mode yellow `#c9b458` fails AA with white letters.
- **High-contrast setting:** orange `#e2652a` and blue `#3d7fc4`. These are Wordle's high-contrast hues, adjusted for AA.
- **Type:** one display typeface for the wordmark and the best-guess word. System UI fonts everywhere else.
- **Logo:** the wizard image, optimized to a small logo. There's no splash screen.

### Accessibility

- Tiles are `<button>`s with labels such as "Row 1, letter 3, A, yellow".
- Results summaries are announced through an `aria-live="polite"` region, e.g. "578 words left. Best guess: SLOTH."
- Everything is operable from the keyboard, with visible focus outlines.
- Dialogs use `<dialog>`.
- Colors meet WCAG AA contrast.

### Help

A "How it works" dialog covers entering guesses, setting colors, what the best guess means, and hard mode.

## Site-wide

### Performance

- **Size budget:** the site's own assets total ≤ 150 KB transferred on first load, excluding GA.
- **Icons:** inline SVG.
- **Font:** one subset woff2 file.
- **Lighthouse (mobile):** Performance ≥ 90, Accessibility ≥ 95, SEO ≥ 95.

### Search and sharing

- **Title:** "Wordle Wizard: Wordle Solver & Best Next Guess"
- **Meta:** a description, a canonical URL (`https://www.wordlewizard.com/`), Open Graph and Twitter card tags with `img/og-image.png`, and JSON-LD `WebApplication` data.
- **FAQ:** a "How it works / FAQ" section in static HTML below the tool.
- **Files:** `robots.txt` and `sitemap.xml`.
- **Preview image:** the og-image is designed as an HTML page and captured with a browser screenshot.

### Privacy and analytics

- **GA4 tag:** kept and loaded asynchronously.
- **Events:**
  - `guess_entered`: a row is submitted
  - `suggestion_clicked`: a likely answer is clicked
  - `best_guess_used`: "Use this word" is clicked
- **Privacy policy:** rewritten to say that the site uses Google Analytics, which sets cookies (`_ga`, `_ga_*`) and collects usage data such as pages viewed, approximate location and device type. It links to Google's policy and explains how to opt out. The saved board and settings stay in the browser's local storage and are never sent anywhere. The site itself collects no personal information. "Last updated" is set to the launch date.

### Netlify configuration

- Keep the `/Privacy` → `/privacy/` redirect.
- Add these headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`.
- `npm test` stays the build command.

## Testing

### Unit tests

These use `node:test` with no dependencies and run on every Netlify build.

- **`wordle.js`:**
  - Known patterns, including repeated letters: SPEED vs ABIDE, GEESE vs SHEEP, EERIE vs THERE, LEVEL vs LEVER.
  - Filtering equals the brute-force consistency check on random states.
  - A seeded random-game property test: the answer is never excluded over thousands of games.
  - `findContradiction`.
  - The hard-mode rule.
- **`rank.js`:**
  - The best guess is always an accepted word.
  - Results are deterministic.
  - Hard mode is respected.
  - With two or fewer candidates, or the top candidate at 50% or more, the best guess is the most likely candidate.
  - Probabilities sum to 1.
  - The three original C# regression cases still contain their expected words.
- **`board.js`:** typing, Backspace, Enter validation, the color cycle order, removing a row shifts later rows up, filling a suggestion, and the date-based reset.

### Benchmark

`npm run benchmark` is dev-only and isn't part of the build. It plays every game in `bench/past-answers.json` (1,931) using the best guess and reports the solve rate within 6 guesses, the average guess count, and the guess-count distribution.

**Target:** at least 99% solved and an average of 3.7 or less in normal mode. It also reports hard mode.

**Baseline:** the current ranking (63% solved, 5.17 average on random dictionary answers).

### Browser verification

Done during development with Playwright:

- **Sizes:** 320, 375 and 1280 px.
- **Interaction:** the typing, color and keyboard flows.
- **Themes:** light, dark and high contrast.
- **Accessibility and quality:** screen-reader labels, no console errors, and the Lighthouse budget.
- **Analytics:** GA events firing.

## Rollout

1. Implement on the `redesign` branch.
2. **Local review:** the owner runs `npm start` and tries the site locally. Nothing is pushed until they approve.
3. Push the branch and open a PR. Netlify builds a deploy preview, useful for phone testing.
4. Merge to `main` to publish to production.
5. If needed, roll back with one click in Netlify to the previous deploy.
6. After launch, check the live site, Lighthouse and GA real-time events. Optionally submit `sitemap.xml` in Google Search Console with the owner.

## Success criteria

- The benchmark reaches its target (≥ 99% solved, average ≤ 3.7). The property test never excludes the answer.
- No horizontal scrolling at 320 px. Backspace, Enter and the gray → yellow → green cycle all work.
- The size budget and Lighthouse targets are met.
- The privacy policy matches the site's actual behavior.
- The owner approves after the local review.

## Open items for the implementation plan

- The specific display typeface (OFL) and exact palette values. Chosen during implementation, within the identity above.
- The Tier B threshold and the tier weights. They start at the values above (a cutoff of 2.0 catches 56 of the 62 past answers that came from outside the original list; 3.0 would catch only 18) and are tuned with the benchmark.
