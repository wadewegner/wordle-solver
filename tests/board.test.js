import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    ROWS, createBoard, activeRow, blockingRow, typeLetter, deleteLetter, cycleColor, removeRow, fillWord,
    guesses, isSolved, keyboardColors, localDate, serializeBoard, restoreBoard,
} from '../public/js/board.js';

const ACCEPTED = new Set(['crane', 'slate', 'pious', 'udder', 'under']);
const isWord = word => ACCEPTED.has(word);

function typeWord(board, word) {
    return [...word].reduce((next, letter) => typeLetter(next, letter, isWord), board);
}

test('a new board has six empty rows and starts typing in row 0', () => {
    const board = createBoard();
    assert.equal(board.length, ROWS);
    assert.ok(board.every(row => row.letters === '' && row.colors.every(c => c === 'gray')));
    assert.equal(activeRow(board), 0);
});

test('typing flows from one row into the next', () => {
    const board = typeWord(createBoard(), 'craneslate');
    assert.equal(board[0].letters, 'crane');
    assert.equal(board[1].letters, 'slate');
    assert.equal(activeRow(board), 2);
    assert.equal(typeLetter(board, 'A', isWord), board, 'only lowercase a-z is accepted');
});

test('a full row that is not a word blocks the next row until fixed', () => {
    let board = typeWord(createBoard(), 'zzzzz');
    assert.equal(blockingRow(board, isWord), 0);
    assert.equal(typeLetter(board, 'a', isWord), board);
    board = typeWord(deleteLetter(deleteLetter(deleteLetter(deleteLetter(deleteLetter(board))))), 'crane');
    assert.equal(blockingRow(board, isWord), -1);
    assert.equal(typeLetter(board, 's', isWord)[1].letters, 's');
});

test('deleteLetter removes the last letter on the board, even in an earlier row', () => {
    let board = typeWord(createBoard(), 'crane');
    board = cycleColor(board, 0, 4);
    board = deleteLetter(board);
    assert.equal(board[0].letters, 'cran');
    assert.equal(board[0].colors[4], 'gray');
    assert.equal(deleteLetter(createBoard()).length, ROWS, 'deleting from an empty board is harmless');
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

test('guesses counts only full rows holding accepted words', () => {
    let board = typeWord(createBoard(), 'cranesl');
    board = cycleColor(board, 0, 1);
    assert.deepEqual(guesses(board, isWord), [{ word: 'crane', colors: ['gray', 'yellow', 'gray', 'gray', 'gray'] }]);
    assert.deepEqual(guesses(typeWord(createBoard(), 'zzzzz'), isWord), []);
});

test('removeRow removes a full row and shifts later rows up', () => {
    let board = typeWord(createBoard(), 'craneslatepi');
    board = removeRow(board, 0);
    assert.equal(board[0].letters, 'slate');
    assert.equal(board[1].letters, 'pi');
    assert.equal(board.length, ROWS);
    assert.equal(board[ROWS - 1].letters, '');
    assert.equal(removeRow(board, 1), board, 'a partial row is not removed');
});

test('fillWord replaces the row being typed with a suggestion', () => {
    let board = typeWord(createBoard(), 'cranesl');
    board = fillWord(board, 'pious', isWord);
    assert.equal(board[1].letters, 'pious');
    assert.ok(board[1].colors.every(c => c === 'gray'));
    assert.equal(activeRow(board), 2);
});

test('fillWord replaces a full row that is not a word', () => {
    const board = fillWord(typeWord(createBoard(), 'cranezzzzz'), 'slate', isWord);
    assert.equal(board[1].letters, 'slate');
});

test('fillWord and typing do nothing when the board is full', () => {
    const board = typeWord(createBoard(), 'crane'.repeat(ROWS));
    assert.equal(activeRow(board), -1);
    assert.equal(fillWord(board, 'slate', isWord), board);
    assert.equal(typeLetter(board, 'a', isWord), board);
});

test('isSolved when the last counted row is all green', () => {
    let board = typeWord(createBoard(), 'crane');
    assert.equal(isSolved(board, isWord), false);
    for (let i = 0; i < 5; i++) {
        board = cycleColor(cycleColor(board, 0, i), 0, i);
    }
    assert.equal(isSolved(board, isWord), true);
});

test('keyboardColors keeps the best color per letter', () => {
    let board = typeWord(createBoard(), 'craneudder');
    board = cycleColor(board, 0, 1);                       // r yellow in CRANE
    board = cycleColor(cycleColor(board, 1, 4), 1, 4);     // r green in UDDER
    const colors = keyboardColors(board, isWord);
    assert.equal(colors.c, 'gray');
    assert.equal(colors.r, 'green');
});

test('operations never modify the board they are given', () => {
    const board = typeWord(createBoard(), 'crane');
    const copy = structuredClone(board);
    cycleColor(board, 0, 0);
    deleteLetter(board);
    typeLetter(board, 's', isWord);
    fillWord(board, 'slate', isWord);
    removeRow(board, 0);
    assert.deepEqual(board, copy);
});

test('localDate uses the local calendar date', () => {
    assert.equal(localDate(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
    assert.equal(localDate(new Date(2026, 11, 31, 0, 1)), '2026-12-31');
});

test('restoreBoard returns the saved board only for the same day', () => {
    const board = typeWord(createBoard(), 'cranesl');
    const saved = serializeBoard(board, '2026-10-01');
    assert.deepEqual(restoreBoard(saved, '2026-10-01'), board);
    assert.deepEqual(restoreBoard(saved, '2026-10-02'), createBoard());
    assert.deepEqual(restoreBoard(null, '2026-10-01'), createBoard());
});

test('restoreBoard ignores corrupt or malformed saved data', () => {
    const fresh = createBoard();
    const gray = Array(5).fill('gray');
    const bad = [
        'not json',
        '{"date":"2026-10-01"}',
        JSON.stringify({ date: '2026-10-01', board: createBoard().slice(0, 5) }),
        JSON.stringify({ date: '2026-10-01', board: [{ letters: 'CRANE', colors: gray }, ...createBoard().slice(1)] }),
        JSON.stringify({ date: '2026-10-01', board: [{ letters: 'crane', colors: Array(5).fill('purple') }, ...createBoard().slice(1)] }),
        JSON.stringify({ date: '2026-10-01', board: [{ letters: 'cra', colors: gray }, { letters: 'slate', colors: gray }, ...createBoard().slice(2)] }),
    ];
    for (const saved of bad) {
        assert.deepEqual(restoreBoard(saved, '2026-10-01'), fresh, saved);
    }
});
