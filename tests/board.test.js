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
