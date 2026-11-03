# Commuter Tapes 📼🎸

**Learn the guitar fretboard and how to read music, in short lessons you can finish between train stops.**

**[▶ Try it in your browser](https://christinatrujillo.github.io/commuter-tapes/)**. On Android, open it in Chrome and choose **Install app**. Once installed, it works offline.

Commuter Tapes is set in an analog recording studio. Each unit is a cassette on your tape shelf, and each lesson is a track you record. Your progress shows up on VU meters, CLIP lights and LCD readouts. There are no accounts and no ads, and nothing leaves your phone.

## How it plays

- **One tape shelf, one path.** Reading tapes follow method-book order (like Hal Leonard): the staff and note values first, then first position string by string from the high E string down (E F G, B C D, G A, D E F, A B C, E F G), with a new rhythm idea on each string. Fretboard tapes take each string up the neck, followed by sharps and flats, the whole neck, reading up the neck, octaves and intervals. Tap a tape to open it in the deck, with its track list and liner notes (tips).
- **Reading rhythm.** Covers whole, half, quarter and eighth notes, rests, dotted notes, ties, and 4/4 and 3/4 time. Exercises include naming a symbol, counting its beats, filling an incomplete measure, tapping the note on a given count, and **tapping the rhythm** after a one-measure count-in, on the big pad or with Space on a laptop. The metronome is a click or, on phones, a gentle vibration.
- **Rehearsal before each take.** The first time you record a track, a short rehearsal teaches what's new. Each note, rhythm or shape gets a card that shows where it is, how it sounds and how it connects to what you already know. Cards come two at a time, each pair followed by a quick check with no penalty. Then comes a mixed check and "Ready to record." Notes you've already learned by reading aren't taught again on the fretboard tapes, and tracks with nothing new get a quick warm-up instead.
- **Recording a take.** The tape winds from reel to reel as you answer. Each mistake lights a red **CLIP** lamp, and three clips ruin the take. Finished takes are stamped **Master take** (no clips), **Keeper** (one) or **Rough take**. Missed questions come back at the end.
- **Speed-based mastery.** Every answer is timed against a fluency target: about 2s to name a note, 2.5s to find one, and 3s to read one from the staff. A spot is *learning* until you get it right reliably, then *accurate*, and *fluent* only when you're right **and** fast. Slow notes come up more often, just like wrong ones.
- **Notes nailed.** Every correct answer counts toward your daily goal, shown on the VU meter in the top-left.
- **Jam room.** A **60-second sprint** with a personal best for each kind, "trouble spots" (your weakest notes), and a custom jam setup.
- **Fretboard.** A reference neck. Tap any fret to hear it and see where it's written on the staff, or **solo** one note to see everywhere it appears on the neck.
- **Meters.** Totals on LCD readouts, plus a signal map of the fretboard: red is still learning, amber is right but slow, and green is fluent.
- **Settings.** Sound, vibration, metronome, auto-advance, left-handed mode, unsealing every tape, daily goal, and backup and restore.

The fretboard stands upright like a chord chart when the phone is upright, and turns sideways like tab when you rotate it.

## Tech

- React, TypeScript and Vite, styled with Tailwind CSS
- [VexFlow](https://www.vexflow.com/) for sheet music. The fretboard is a hand-built SVG.
- Guitar tones synthesized in the browser (Karplus–Strong), so there are no audio files
- Zustand for state, saved to local storage
- Installable PWA with a custom service worker for offline use
- Vitest and Testing Library: music logic, every lesson in the curriculum, and a click-through of the whole app

## Run locally

Requires Node.js 22.22+ or 24.15+.

```sh
git clone https://github.com/christinatrujillo/commuter-tapes.git
cd commuter-tapes
npm install
npm run dev
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server (add `-- --host` to open it from a phone on the same Wi-Fi) |
| `npm test` | Run the test suite |
| `npm run build` | Type-check and build into `dist/` |
| `npm run preview` | Serve the production build locally |

## Deploy your own

Pushes to `main` run the tests, build the site and publish it to GitHub Pages (`.github/workflows/deploy.yml`). If you fork the repo, turn on **Settings → Pages → Source: GitHub Actions**. The build uses relative paths, so it works at any URL.

## Project structure

```
src/
  music/        notes, fretboard math, rhythm, and the lesson plan (curriculum.ts)
  game/         question generation (weighted toward weak and slow notes), rehearsal planning, drills
  components/   fretboard, staff, rhythm notation, tap pad, cassette and studio-hardware UI
  screens/      tape shelf, deck, rehearsal, lesson, sprint, jam room, explorer, stats, settings
  store/        saved progress, streaks and settings
  audio/        plucked-string synthesis and metronome
public/         icons and web app manifest
```

To add a tape or a track, edit `UNITS` in `src/music/curriculum.ts`. The tests check that every lesson produces valid questions. Fluency targets are set in `FLUENT_MS` in `src/game/questions.ts`.

## Good to know

- **Progress is saved per browser and per address.** Each device and browser keeps its own progress, and so does each address. If port 5173 is busy, the dev server starts on 5174 instead, with fresh progress. To move progress or keep it safe, use **Settings → Export backup / Load backup**. Clearing Chrome's site data erases it.
- **Trying it on a phone during development:** run `npm run dev -- --host` and open the "Network" address on a phone on the same Wi-Fi. Installing to the home screen and offline use need `https://`, so they only work on the deployed version.
- **Updates:** after a new deploy, the installed app picks up the new version the next time it's opened. Sometimes it takes closing and reopening it twice.
