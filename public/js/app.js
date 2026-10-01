import {
    ROWS, LENGTH, createBoard, activeRow, blockingRow, typeLetter, deleteLetter, cycleColor, removeRow, fillWord,
    guesses, isSolved, keyboardColors, localDate, serializeBoard, restoreBoard,
} from './board.js';

const BOARD_KEY = 'wordle-wizard-board';
const SETTINGS_KEY = 'wordle-wizard-settings';
const LIKELY_PREVIEW = 10;
const SHOW_ALL_BATCH = 500;
const SLOW_MS = 150;
const MESSAGE_MS = 1500;
const KEY_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm<'];   // < is Backspace

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
    moreGuesses: $('more-guesses'),
    likelyCount: $('likely-count'),
    likelyMessage: $('likely-message'),
    likelyList: $('likely-list'),
    showAll: $('show-all'),
    liveSummary: $('live-summary'),
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
            theme: ['system', 'light', 'dark'].includes(saved.theme) ? saved.theme : 'system',
            highContrast: saved.highContrast === true,
        };
    } catch {
        return { theme: 'system', highContrast: false };
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

// Until the word list loads, every full row is treated as a word so typing isn't blocked
const isWord = word => !words || words.has(word);

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
        const full = row.letters.length === LENGTH;
        tiles[r].forEach((tile, p) => {
            const letter = row.letters[p] ?? '';
            tile.textContent = letter;
            tile.dataset.color = letter ? row.colors[p] : 'empty';
            tile.disabled = !letter;
            tile.setAttribute('aria-label', letter
                ? `Row ${r + 1}, letter ${p + 1}, ${letter.toUpperCase()}, ${row.colors[p]}`
                : `Row ${r + 1}, letter ${p + 1}, empty`);
        });
        const rowElement = tiles[r][0].parentElement;
        rowElement.classList.toggle('active', r === active);
        rowElement.classList.toggle('invalid', full && !isWord(row.letters));
        removeButtons[r].style.visibility = full ? 'visible' : 'hidden';
    });
    renderKeyboard();
    elements.useBest.disabled = active === -1 || !results?.best || isSolved(board, isWord);
}

// Applies a new board: saves it, redraws it, and asks for new results if the counted guesses changed
function update(next) {
    if (next === board) {
        return;
    }
    const before = JSON.stringify(guesses(board, isWord));
    board = next;
    save(BOARD_KEY, serializeBoard(board, localDate()));
    renderBoard();
    if (JSON.stringify(guesses(board, isWord)) !== before) {
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
    const index = activeRow(board);
    const next = typeLetter(board, letter, isWord);
    if (next === board) {
        const blocked = blockingRow(board, isWord);
        if (blocked !== -1) {
            showMessage('Not in word list');
            shakeRow(blocked);
        }
        return;
    }
    update(next);

    // Feedback the moment a row is complete
    const row = board[index];
    if (row.letters.length === LENGTH) {
        if (isWord(row.letters)) {
            track('guess_entered', { guess_number: index + 1 });
        } else {
            showMessage('Not in word list');
            shakeRow(index);
        }
    }
}

function erase() {
    update(deleteLetter(board));
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
            if (key === '<') {
                button.innerHTML = ICONS.backspace;
                button.setAttribute('aria-label', 'Backspace');
                button.classList.add('wide');
                button.addEventListener('click', erase);
            } else {
                button.textContent = key;
                button.addEventListener('click', () => type(key));
                letterKeys[key] = button;
            }
            row.append(button);
        }
        elements.keyboard.append(row);
    }
}

function renderKeyboard() {
    const known = keyboardColors(board, isWord);
    for (const [letter, button] of Object.entries(letterKeys)) {
        button.dataset.color = known[letter] ?? 'unknown';
        button.setAttribute('aria-label', known[letter] ? `${letter.toUpperCase()}, ${known[letter]}` : letter.toUpperCase());
    }
}

// After a mouse or touch click, drop focus from the button so typing and Backspace go to the board
// instead of pressing that button again. Keyboard activation (detail 0) leaves focus where it is.
document.addEventListener('click', event => {
    const button = event.target instanceof Element ? event.target.closest('button') : null;
    if (button && event.detail > 0 && !button.closest('dialog')) {
        button.blur();
    }
});

document.addEventListener('keydown', event => {
    if (event.metaKey || event.ctrlKey || event.altKey || document.querySelector('dialog[open]')) {
        return;
    }
    if (event.key === 'Backspace') {
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
        renderBoard();
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
    worker.postMessage({ type: 'solve', id: requestId, guesses: guesses(board, isWord) });
    clearTimeout(slowTimer);
    slowTimer = setTimeout(() => document.body.classList.add('computing'), SLOW_MS);
}

function showLoadError() {
    clearTimeout(slowTimer);
    document.body.classList.remove('computing');
    elements.bestWord.innerHTML = '&nbsp;';
    elements.bestDetail.textContent = "Couldn't load the word list. Check your connection and reload the page.";
    elements.useBest.disabled = true;
    elements.moreGuesses.replaceChildren();
}

function formatPercent(probability) {
    return probability < 0.01 ? '<1%' : `${Math.round(probability * 100)}%`;
}

function formatRemaining(remaining) {
    return remaining < 10 ? remaining.toFixed(1) : Math.round(remaining).toLocaleString();
}

function renderBest() {
    const { count, likely, best } = results;
    const counted = guesses(board, isWord);

    if (isSolved(board, isWord)) {
        elements.bestWord.textContent = counted.at(-1).word;
        elements.bestDetail.textContent = `Solved in ${counted.length}!`;
    } else if (!best) {
        elements.bestWord.innerHTML = '&nbsp;';
        elements.bestDetail.textContent = 'Fix the colors to get a suggestion.';
    } else {
        elements.bestWord.textContent = best.word;
        if (counted.length === 0) {
            elements.bestDetail.textContent = `Strong opener: ${count.toLocaleString()} words → ~${formatRemaining(best.expectedRemaining)} left`;
        } else if (count === 1) {
            elements.bestDetail.textContent = 'This is the only word left.';
        } else if (best.goForWin) {
            elements.bestDetail.textContent = `Go for the win: ${formatPercent(likely[0].probability)} likely`;
        } else {
            elements.bestDetail.textContent = `${count.toLocaleString()} words → ~${formatRemaining(best.expectedRemaining)} left`;
        }
    }
    elements.useBest.disabled = activeRow(board) === -1 || !best || isSolved(board, isWord);
    renderMoreGuesses();
}

function useWord(word, list, position) {
    update(fillWord(board, word, isWord));
    track('suggestion_clicked', { list, position });
}

// The rest of the top guesses, as chips that fill the next row
function renderMoreGuesses() {
    const others = isSolved(board, isWord) ? [] : results.guesses.slice(1);
    if (others.length === 0) {
        elements.moreGuesses.replaceChildren();
        return;
    }
    const label = document.createElement('span');
    label.className = 'more-label';
    label.textContent = 'Also strong';
    const chips = others.map(({ word }, i) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'guess-chip';
        chip.textContent = word;
        chip.setAttribute('aria-label', `${word.toUpperCase()}. Add to board.`);
        chip.addEventListener('click', () => useWord(word, 'guesses', i + 2));
        return chip;
    });
    elements.moreGuesses.replaceChildren(label, ...chips);
}

function likelyItem({ word, probability }, position) {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'likely-word';
    button.style.setProperty('--probability', `${Math.max(probability * 100, 1)}%`);
    button.innerHTML = `<span>${word.toUpperCase()}</span><span class="likely-percent">${formatPercent(probability)}</span>`;
    button.setAttribute('aria-label', `${word.toUpperCase()}, ${formatPercent(probability)} likely. Add to board.`);
    button.addEventListener('click', () => useWord(word, 'answers', position + 1));
    item.append(button);
    return item;
}

function renderLikely() {
    const { count, likely, contradiction } = results;
    listVersion++;
    elements.likelyList.replaceChildren();
    elements.showAll.hidden = true;

    if (guesses(board, isWord).length === 0) {
        elements.likelyCount.textContent = '';
        elements.likelyMessage.textContent = 'Type your first guess to see likely answers.';
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
    if (guesses(board, isWord).length > 0) {
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
    elements.theme.value = settings.theme;
    elements.highContrast.checked = settings.highContrast;
}

function changeSettings(changes) {
    settings = { ...settings, ...changes };
    save(SETTINGS_KEY, JSON.stringify(settings));
    applySettings();
}

elements.theme.addEventListener('change', () => changeSettings({ theme: elements.theme.value }));
elements.highContrast.addEventListener('change', () => changeSettings({ highContrast: elements.highContrast.checked }));

// Closing a dialog returns focus to the button that opened it; after a mouse or touch click, drop it
// again so typing goes back to the board
function openDialog(dialog, event) {
    dialog.showModal();
    if (event.detail > 0) {
        dialog.addEventListener('close', () => document.activeElement?.blur(), { once: true });
    }
}

$('help-button').addEventListener('click', event => openDialog($('help-dialog'), event));
$('settings-button').addEventListener('click', event => openDialog($('settings-dialog'), event));

$('new-game').addEventListener('click', () => update(createBoard()));
elements.useBest.addEventListener('click', () => {
    if (results?.best) {
        update(fillWord(board, results.best.word, isWord));
        track('best_guess_used', { guess_number: guesses(board, isWord).length });
    }
});
elements.showAll.addEventListener('click', showAll);

buildBoard();
buildKeyboard();
applySettings();
renderBoard();
