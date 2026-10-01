import { parseWordList, getMostLikelyWords } from './solver.js';

const wordListPromise = fetch('/words.txt')
    .then(response => response.text())
    .then(parseWordList);

const form = document.getElementById('wordleForm');
const rowsContainer = document.getElementById('wordle-rows');

// Build the six rows of five letter inputs, each followed by a hidden input holding its color
for (let i = 0; i < 6; i++) {
    const row = document.createElement('div');
    row.className = 'wordle-row';
    for (let j = 0; j < 5; j++) {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'letter-input letter-input-no-select';
        input.maxLength = 1;
        input.readOnly = true;
        input.style.backgroundColor = 'darkgrey';

        const color = document.createElement('input');
        color.type = 'hidden';
        color.value = 'darkgrey';

        row.append(input, color);
    }

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'btn btn-grey delete-button';
    deleteButton.innerHTML = '<i class="fas fa-trash-alt"></i>';
    deleteButton.addEventListener('click', () => clearRow(i));
    row.append(deleteButton);

    rowsContainer.append(row);
}

// Get all the letter-input elements
const letterInputs = document.querySelectorAll('.letter-input');

// Add a click event listener to each letter-input
letterInputs.forEach(input => {
    input.addEventListener('click', (event) => {

        event.preventDefault();

        if (input.style.backgroundColor.toLowerCase() === 'darkgrey') {
            input.style.backgroundColor = 'green';
        } else if (input.style.backgroundColor.toLowerCase() === 'green') {
            input.style.backgroundColor = 'yellow';
        } else {
            input.style.backgroundColor = 'darkgrey';
        }

        // Update the corresponding hidden input with the color value
        input.nextElementSibling.value = input.style.backgroundColor.toLowerCase();
    });

    // Disable text selection, copy, cut, and paste
    input.addEventListener('selectstart', (event) => {
        event.preventDefault();
    });
    input.setAttribute('oncopy', 'return false;');
    input.setAttribute('oncut', 'return false;');
    input.setAttribute('onpaste', 'return false;');
});

// Add an input event listener to each letter-input
letterInputs.forEach((input, index) => {
    input.addEventListener('input', () => {
        // Automatically advance to the next input box
        if (index < letterInputs.length - 1) {
            letterInputs[index + 1].focus();
        }
    });

    // Set the input color to dark grey when it gets focus for the first time
    input.addEventListener('focus', (event) => {
        if (!input.dataset.focused) {
            input.style.backgroundColor = 'darkgrey';
            input.nextElementSibling.value = input.style.backgroundColor.toLowerCase(); // Set the hidden input value to the lowercase color
            input.dataset.focused = 'true';
        }
        event.preventDefault(); // Prevent focus event
    });
});

document.addEventListener("keyup", (e) => {

    let pressedKey = String(e.key)

    let found = pressedKey.match(/[a-z]/gi)
    if (!found || found.length > 1) {
        return
    } else {
        insertLetter(pressedKey)
    }
})

function insertLetter(pressedKey) {
    // Find the next empty input box
    let nextEmptyInput = null;
    for (let i = 0; i < letterInputs.length; i++) {
        if (letterInputs[i].value === '') {
            nextEmptyInput = letterInputs[i];
            break;
        }
    }

    if (nextEmptyInput) {
        nextEmptyInput.value = pressedKey.toUpperCase();
        if (nextEmptyInput.nextElementSibling) {
            nextEmptyInput.nextElementSibling.focus();
        }
    }
}

const keyboardButtons = document.querySelectorAll('.keyboard-button');
keyboardButtons.forEach(button => {
    button.addEventListener('click', () => {
        let pressedKey = button.textContent;
        if (pressedKey.match(/[a-z]/i)) {
            insertLetter(pressedKey);
        }
    });
});

function validateForm() {
    let isValid = true;
    letterInputs.forEach(input => {
        if (
            input.style.backgroundColor !== 'green' &&
            input.style.backgroundColor !== 'yellow' &&
            input.style.backgroundColor !== 'darkgrey' &&
            input.style.backgroundColor !== ''
        ) {
            isValid = false;
        }
    });
    return isValid;
}

// Collect the non-empty rows as guesses of five { character, color } letters
function collectGuesses() {
    const guesses = [];
    for (let i = 0; i < 6; i++) {
        const guess = [];
        for (let j = 0; j < 5; j++) {
            const input = letterInputs[i * 5 + j];
            const inputValue = input.value.trim().toLowerCase();
            const color = input.nextElementSibling.value.trim();
            guess.push({
                character: inputValue ? inputValue[0] : ' ',
                color: color || 'lightgrey',
            });
        }

        if (guess.map(letter => letter.character).join('').trim()) {
            guesses.push(guess);
        }
    }
    return guesses;
}

form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!validateForm()) {
        return;
    }

    const mostLikelyWords = getMostLikelyWords(await wordListPromise, collectGuesses());
    showWordList(mostLikelyWords);
});

// Display the likely words below the keyboard
function showWordList(words) {
    document.querySelector('#wordList')?.remove();
    if (words.length === 0) {
        return;
    }

    const wordList = document.createElement('div');
    wordList.id = 'wordList';

    const heading = document.createElement('h2');
    heading.textContent = 'Most Likely Words (Click to Add):';

    const list = document.createElement('ul');
    for (const word of words) {
        const item = document.createElement('li');
        item.style.cssText = 'cursor:pointer; text-decoration: underline; color: #212529;';
        item.textContent = word.toUpperCase();
        item.addEventListener('click', () => insertWord(word.toUpperCase()));
        list.append(item);
    }

    wordList.append(heading, list);
    form.append(wordList);
}

function insertWord(word) {
    // Find the first empty row
    let emptyRowIndex = -1;
    for (let i = 0; i < 6; i++) {
        let rowEmpty = true;
        for (let j = 0; j < 5; j++) {
            if (letterInputs[i * 5 + j].value !== '') {
                rowEmpty = false;
                break;
            }
        }
        if (rowEmpty) {
            emptyRowIndex = i;
            break;
        }
    }

    // Insert the word into the empty row
    if (emptyRowIndex !== -1) {
        for (let i = 0; i < 5; i++) {
            letterInputs[emptyRowIndex * 5 + i].value = word[i];
        }
    } else {
        alert('No empty row available to insert the word.');
    }
}

function clearRow(rowIndex) {
    for (let i = 0; i < 5; i++) {
        const input = letterInputs[rowIndex * 5 + i];
        input.value = '';
        input.style.backgroundColor = 'darkgrey';
        input.nextElementSibling.value = input.style.backgroundColor;
    }
}

function clearAll() {
    // Clear all input boxes
    for (let i = 0; i < 30; i++) {
        const input = letterInputs[i];
        input.value = '';
        input.style.backgroundColor = 'darkgrey';
        input.nextElementSibling.value = input.style.backgroundColor;
    }

    // Remove the list of potential words
    const wordList = document.querySelector('#wordList');
    if (wordList) {
        wordList.remove();
    }
}

document.getElementById('clearAllButton').addEventListener('click', clearAll);
