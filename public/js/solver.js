// Splits the space-separated words.txt contents into a de-duplicated list, preserving file order
export function parseWordList(text) {
    return [...new Set(text.trim().split(' '))];
}

// guesses: an array of rows, each row an array of five { character, color } letters
// where color is "green", "yellow", or "darkgrey"
export function getMostLikelyWords(wordList, guesses) {
    // Create maps to store the known green, yellow, and darkgrey letters with their positions
    const greenLetters = new Map();
    const yellowLetters = new Map();
    const darkgreyLetters = new Map();

    // Iterate through the guesses and populate the maps
    for (const guess of guesses) {
        guess.forEach(({ character, color }, position) => {
            if (color === 'green') {
                greenLetters.set(position, character);
            } else if (color === 'yellow') {
                if (!yellowLetters.has(position)) {
                    yellowLetters.set(position, []);
                }
                yellowLetters.get(position).push(character);
            } else if (color === 'darkgrey') {
                if (!darkgreyLetters.has(position)) {
                    darkgreyLetters.set(position, []);
                }
                darkgreyLetters.get(position).push(character);
            }
        });
    }

    const greenCharacters = [...greenLetters.values()];

    const possibleWords = wordList.filter(word => {
        // Exclude the word if it doesn't have every green letter in its position
        for (const [position, character] of greenLetters) {
            if (word[position] !== character) {
                return false;
            }
        }

        for (const [position, characters] of yellowLetters) {
            // Exclude the word if any of the yellow letters are at the current position
            if (characters.includes(word[position])) {
                return false;
            }

            // Exclude the word unless all the yellow letters are found in it, excluding the current position
            for (const character of characters) {
                const indexInWord = word.indexOf(character);
                if (indexInWord === -1 || indexInWord === position) {
                    return false;
                }
            }
        }

        for (const characters of darkgreyLetters.values()) {
            for (const character of characters) {
                // Exclude the word if the character is in it and not green or yellow in a different position
                if (word.includes(character) && !greenCharacters.includes(character)) {
                    let isYellowCharacter = false;
                    for (const [position, yellowCharacters] of yellowLetters) {
                        if (yellowCharacters.includes(character) && word.indexOf(character) !== position) {
                            isYellowCharacter = true;
                            break;
                        }
                    }

                    if (!isYellowCharacter) {
                        return false;
                    }
                }
            }
        }

        // Exclude the word if a grey character is in the same position
        for (const [position, characters] of darkgreyLetters) {
            if (characters.includes(word[position])) {
                return false;
            }
        }

        return true;
    });

    // Calculate the frequency of letters used in the possible words
    const letterFrequency = new Map();
    for (const word of possibleWords) {
        for (const letter of word) {
            letterFrequency.set(letter, (letterFrequency.get(letter) ?? 0) + 1);
        }
    }

    // Sort the possible words by the average frequency of their letters (stable, so ties keep word list order)
    const score = word => [...word].reduce((sum, letter) => sum + letterFrequency.get(letter), 0) / word.length;
    const scores = new Map(possibleWords.map(word => [word, score(word)]));

    return possibleWords.sort((a, b) => scores.get(b) - scores.get(a));
}
