# battleship-devin-practice

A simple Battleship game you play in the browser against the computer. It uses plain HTML, CSS and JavaScript, with no dependencies and no build step.

## Quick start

Requirements: [Node.js](https://nodejs.org/) 18 or newer.

```bash
git clone https://github.com/monmon0528/battleship-devin-practice.git
cd battleship-devin-practice
npm start
```

Then open http://localhost:8080 in your browser. To use a different port, run `PORT=3000 npm start`.

> The game is loaded as ES modules, so it must be served over HTTP. Opening `index.html` directly from disk (`file://`) won't work.
> Without Node, any static server works too, e.g. `python3 -m http.server 8080`.

## How to play

- Both you and the computer get a 10x10 board. Each fleet is placed at random, with no ships overlapping:
  Carrier (5), Battleship (4), Cruiser (3), Submarine (3), Destroyer (2).
- Click a cell in **Enemy Waters** to fire. After each shot, the computer fires back at **Your Fleet**.
- Markers: **red ✕** = hit, **white dot** = miss, **dark red** = sunk ship. Sunk ships are also crossed out in the fleet lists under each board.
- The first side to sink the whole enemy fleet wins. When the game ends, the computer's remaining ships are revealed.
- Click **Restart Game** at any time to deal new fleets and start again.

The computer uses a hunt/target strategy. It fires at random until it scores a hit, then searches around the hit (following the line once it has two hits) until the ship sinks. It never fires at the same cell twice.

## Tests

```bash
npm test
```

This runs the unit tests in `tests/` with Node's built-in test runner. They cover:

- board creation
- ship placement: overlaps, edges, and 500 randomised fleets
- attack results: hit, miss, sunk, repeat and invalid shots
- turn order
- win and lose detection
- full simulated games
- the computer's targeting

## Project structure

| Path               | Purpose                                                        |
| ------------------ | -------------------------------------------------------------- |
| `index.html`       | Page layout                                                    |
| `styles.css`       | Styling                                                        |
| `src/constants.js` | Board size, fleet and result constants                         |
| `src/game.js`      | Game rules: boards, placement, attacks, turns, winner (no DOM) |
| `src/ai.js`        | Computer opponent                                              |
| `src/ui.js`        | Rendering and click handling                                   |
| `server.js`        | Tiny zero-dependency static server used by `npm start`         |
| `tests/`           | Unit tests                                                     |
