// The board: six rows of up to five letters, each gray, yellow or green. Letters fill the rows in
// order, like one 30-letter line, and a row counts toward suggestions as soon as it holds a five-letter
// word. Every function returns a new board (or the same one when nothing changes) and never modifies
// the board it is given.

export const ROWS = 6;
export const LENGTH = 5;

const NEXT_COLOR = { gray: 'yellow', yellow: 'green', green: 'gray' };
const COLOR_STRENGTH = { gray: 1, yellow: 2, green: 3 };

function emptyRow() {
    return { letters: '', colors: Array(LENGTH).fill('gray') };
}

function replaceRow(board, index, row) {
    return board.map((existing, i) => (i === index ? row : existing));
}

export function createBoard() {
    return Array.from({ length: ROWS }, emptyRow);
}

// The row being typed: the first one with room for another letter, or -1 when the board is full
export function activeRow(board) {
    return board.findIndex(row => row.letters.length < LENGTH);
}

// A full row that isn't an accepted word and so blocks typing into the next row, or -1
export function blockingRow(board, isWord) {
    const index = activeRow(board);
    const previous = index === -1 ? ROWS - 1 : index - 1;
    if (previous < 0 || (index !== -1 && board[index].letters !== '')) {
        return -1;
    }
    return isWord(board[previous].letters) ? -1 : previous;
}

export function typeLetter(board, letter, isWord) {
    const index = activeRow(board);
    if (index === -1 || !/^[a-z]$/.test(letter) || blockingRow(board, isWord) !== -1) {
        return board;
    }
    const row = board[index];
    return replaceRow(board, index, { ...row, letters: row.letters + letter });
}

// Removes the last letter on the board, which may be in an earlier row
export function deleteLetter(board) {
    const index = board.findLastIndex(row => row.letters.length > 0);
    if (index === -1) {
        return board;
    }
    const row = board[index];
    const colors = [...row.colors];
    colors[row.letters.length - 1] = 'gray';
    return replaceRow(board, index, { letters: row.letters.slice(0, -1), colors });
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

export function setColors(board, rowIndex, colors) {
    return replaceRow(board, rowIndex, { ...board[rowIndex], colors: [...colors] });
}

// Removes a full row; later rows move up and an empty row is added at the bottom
export function removeRow(board, rowIndex) {
    if (board[rowIndex]?.letters.length !== LENGTH) {
        return board;
    }
    return [...board.slice(0, rowIndex), ...board.slice(rowIndex + 1), emptyRow()];
}

// Puts a suggested word in the row being typed, replacing any letters there, all gray. A full row
// that isn't a word is replaced instead, since nothing can be typed after it.
export function fillWord(board, word, isWord) {
    const blocked = blockingRow(board, isWord);
    const index = blocked !== -1 ? blocked : activeRow(board);
    if (index === -1) {
        return board;
    }
    return replaceRow(board, index, { ...emptyRow(), letters: word });
}

// The rows that count toward suggestions: full rows holding accepted words
export function guesses(board, isWord) {
    return board
        .filter(row => row.letters.length === LENGTH && isWord(row.letters))
        .map(row => ({ word: row.letters, colors: [...row.colors] }));
}

export function isSolved(board, isWord) {
    const counted = guesses(board, isWord);
    return counted.length > 0 && counted.at(-1).colors.every(color => color === 'green');
}

// The best color known for each letter from counted rows: green beats yellow beats gray
export function keyboardColors(board, isWord) {
    const known = {};
    for (const { word, colors } of guesses(board, isWord)) {
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
            return data.board.map(({ letters, colors }) => ({ letters, colors }));
        }
    } catch {
        // Unreadable saved data falls through to a fresh board
    }
    return createBoard();
}

// Letters must fill rows in order: a row can only have letters if the one above it is full
function isValidBoard(board) {
    return Array.isArray(board) && board.length === ROWS && board.every((row, i) =>
        typeof row?.letters === 'string' && /^[a-z]{0,5}$/.test(row.letters) &&
        Array.isArray(row.colors) && row.colors.length === LENGTH && row.colors.every(color => color in NEXT_COLOR) &&
        (row.letters === '' || i === 0 || board[i - 1].letters.length === LENGTH));
}
