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
