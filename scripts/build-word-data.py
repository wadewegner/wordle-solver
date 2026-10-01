"""Generates public/data/original-answers.txt and public/data/common.txt.

original-answers.txt: the 2,315-word answer list from the original 2021 Wordle, minus the six words
NYT removed in 2022. That leaves the 2,309 words NYT's game still ships as its answer list.
common.txt: other accepted words that are common in English (wordfreq Zipf frequency at or above
--threshold) and aren't a plural or past tense of a common shorter word.
Both files are sorted most frequent first, which is how the site breaks ties between equally
likely words.

wordfreq data is CC BY-SA 4.0 (https://github.com/rspeer/wordfreq); the site credits it.

Usage:
    python3 -m venv /tmp/wfvenv && /tmp/wfvenv/bin/pip install wordfreq
    /tmp/wfvenv/bin/python scripts/build-word-data.py [--threshold 2.0]
"""
import argparse
import urllib.request
from pathlib import Path

from wordfreq import zipf_frequency

ORIGINAL_ANSWERS_URL = (
    'https://gist.githubusercontent.com/cfreshman/a03ef2cba789d8cf00c08f767e0fad7b'
    '/raw/wordle-answers-alphabetical.txt'
)
REMOVED_BY_NYT = {'agora', 'fibre', 'lynch', 'pupal', 'slave', 'wench'}
DATA = Path(__file__).resolve().parent.parent / 'public' / 'data'
STEM_THRESHOLD = 3.0


def zipf(word):
    return zipf_frequency(word, 'en')


def is_inflection(word):
    """True for plurals and past tenses of common shorter words, e.g. aches, acted, rated."""
    if word.endswith('s') and not word.endswith(('ss', 'us', 'is')) and zipf(word[:-1]) >= STEM_THRESHOLD:
        return True
    if word.endswith('es') and zipf(word[:-2]) >= STEM_THRESHOLD:
        return True
    if word.endswith('ed') and (zipf(word[:-2]) >= STEM_THRESHOLD or zipf(word[:-1]) >= STEM_THRESHOLD):
        return True
    return False


def by_frequency(words):
    return sorted(words, key=lambda word: (-zipf(word), word))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--threshold', type=float, default=2.0)
    args = parser.parse_args()

    accepted = (DATA / 'words.txt').read_text().split()
    with urllib.request.urlopen(ORIGINAL_ANSWERS_URL) as response:
        downloaded = response.read().decode().split()
    original = [word for word in downloaded if word not in REMOVED_BY_NYT]
    assert len(original) == 2309, f'expected 2,309 original answers, got {len(original)}'
    assert set(original) <= set(accepted), 'original answers must all be accepted guesses'

    original_set = set(original)
    common = [
        word for word in accepted
        if word not in original_set and zipf(word) >= args.threshold and not is_inflection(word)
    ]

    (DATA / 'original-answers.txt').write_text('\n'.join(by_frequency(original)) + '\n')
    (DATA / 'common.txt').write_text('\n'.join(by_frequency(common)) + '\n')
    print(f'original-answers.txt: {len(original)} words; common.txt: {len(common)} words (threshold {args.threshold})')


if __name__ == '__main__':
    main()
