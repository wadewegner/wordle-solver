# Wordle Wizard

Wordle Wizard helps you solve the daily NYT Wordle. Enter the guesses you've played and the colors Wordle showed, and it suggests the best next guess and the likeliest answers.

[Try it at wordlewizard.com](https://www.wordlewizard.com/)

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

## Contributing

Contributions are welcome! Feel free to report any issues or submit pull requests.

1. Fork the repository and create your branch from `main`.
2. Make your changes and commit them.
3. Push your branch and open a pull request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.