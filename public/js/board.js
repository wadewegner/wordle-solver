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
