import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { AttackResult, BOARD_SIZE, FLEET, Player } from '../src/constants.js';
import {
  allShipsSunk,
  canPlaceShip,
  computerAttack,
  createBoard,
  createGame,
  placeFleetRandomly,
  placeShip,
  playerAttack,
  receiveAttack,
} from '../src/game.js';
import { seededRandom } from './helpers.js';

const shipCellsOf = (board) => board.ships.flatMap((ship) => ship.cells);

function sinkAll(board, attack) {
  let last;
  for (const [row, col] of shipCellsOf(board)) last = attack(row, col);
  return last;
}

describe('board', () => {
  test('is a 10x10 grid of empty, unattacked cells', () => {
    const board = createBoard();
    assert.equal(BOARD_SIZE, 10);
    assert.equal(board.grid.length, 10);
    for (const row of board.grid) {
      assert.equal(row.length, 10);
      for (const cell of row) assert.deepEqual(cell, { shipIndex: null, attacked: false });
    }
    assert.deepEqual(board.ships, []);
  });
});

describe('ship placement', () => {
  test('places a ship horizontally and vertically', () => {
    const board = createBoard();
    const h = placeShip(board, { name: 'Destroyer', length: 2 }, 0, 0, true);
    const v = placeShip(board, { name: 'Cruiser', length: 3 }, 5, 9, false);
    assert.deepEqual(h.cells, [[0, 0], [0, 1]]);
    assert.deepEqual(v.cells, [[5, 9], [6, 9], [7, 9]]);
    assert.equal(board.grid[0][1].shipIndex, 0);
    assert.equal(board.grid[7][9].shipIndex, 1);
  });

  test('rejects ships that overlap another ship', () => {
    const board = createBoard();
    placeShip(board, { name: 'Carrier', length: 5 }, 2, 2, true);
    assert.equal(canPlaceShip(board, 3, 0, 4, false), false);
    assert.throws(() => placeShip(board, { name: 'Cruiser', length: 3 }, 0, 4, false));
    assert.equal(board.ships.length, 1);
  });

  test('rejects ships that go off the board', () => {
    const board = createBoard();
    assert.equal(canPlaceShip(board, 5, 0, 6, true), false);
    assert.equal(canPlaceShip(board, 5, 6, 0, false), false);
    assert.equal(canPlaceShip(board, 2, -1, 0, true), false);
    assert.equal(canPlaceShip(board, 5, 0, 5, true), true);
  });

  test('random placement always produces the full fleet with no overlaps', () => {
    const expectedLengths = FLEET.map((s) => s.length);
    const totalCells = expectedLengths.reduce((a, b) => a + b, 0);
    for (let seed = 1; seed <= 500; seed++) {
      const board = placeFleetRandomly(createBoard(), FLEET, seededRandom(seed));
      assert.deepEqual(board.ships.map((s) => s.name), FLEET.map((s) => s.name));
      assert.deepEqual(board.ships.map((s) => s.cells.length), expectedLengths);

      const seen = new Set();
      board.ships.forEach((ship, index) => {
        const rows = new Set(ship.cells.map(([r]) => r));
        const cols = new Set(ship.cells.map(([, c]) => c));
        assert.ok(rows.size === 1 || cols.size === 1, 'ship is a straight line');
        for (const [r, c] of ship.cells) {
          assert.ok(r >= 0 && r < 10 && c >= 0 && c < 10, 'ship is on the board');
          assert.equal(board.grid[r][c].shipIndex, index);
          seen.add(`${r},${c}`);
        }
      });
      assert.equal(seen.size, totalCells, 'no overlapping cells');
    }
  });
});

describe('attacks', () => {
  function boardWithDestroyer() {
    const board = createBoard();
    placeShip(board, { name: 'Destroyer', length: 2 }, 4, 4, true);
    return board;
  }

  test('reports a miss on empty water', () => {
    const board = boardWithDestroyer();
    assert.equal(receiveAttack(board, 0, 0).result, AttackResult.MISS);
    assert.equal(board.grid[0][0].attacked, true);
  });

  test('reports a hit, then sunk when every cell of the ship is hit', () => {
    const board = boardWithDestroyer();
    const first = receiveAttack(board, 4, 4);
    assert.equal(first.result, AttackResult.HIT);
    assert.equal(first.ship.name, 'Destroyer');
    const second = receiveAttack(board, 4, 5);
    assert.equal(second.result, AttackResult.SUNK);
    assert.equal(second.ship.name, 'Destroyer');
  });

  test('rejects repeat attacks without counting extra hits', () => {
    const board = boardWithDestroyer();
    receiveAttack(board, 4, 4);
    assert.equal(receiveAttack(board, 4, 4).result, AttackResult.REPEAT);
    assert.equal(board.ships[0].hits, 1);
  });

  test('rejects attacks outside the board', () => {
    const board = boardWithDestroyer();
    assert.equal(receiveAttack(board, 10, 0).result, AttackResult.INVALID);
    assert.equal(receiveAttack(board, 0, -1).result, AttackResult.INVALID);
  });

  test('all ships sunk only after the last ship cell is hit', () => {
    const board = placeFleetRandomly(createBoard(), FLEET, seededRandom(7));
    const cells = shipCellsOf(board);
    for (const [r, c] of cells.slice(0, -1)) receiveAttack(board, r, c);
    assert.equal(allShipsSunk(board), false);
    const [r, c] = cells.at(-1);
    receiveAttack(board, r, c);
    assert.equal(allShipsSunk(board), true);
  });
});

describe('game turns', () => {
  test('a new game has two fleets, player to move and no winner', () => {
    const game = createGame({ random: seededRandom(1) });
    assert.equal(game.player.ships.length, FLEET.length);
    assert.equal(game.computer.ships.length, FLEET.length);
    assert.equal(game.turn, Player.HUMAN);
    assert.equal(game.winner, null);
  });

  test('turns alternate between player and computer', () => {
    const game = createGame({ random: seededRandom(2) });
    const outcome = playerAttack(game, 0, 0);
    assert.notEqual(outcome.result, AttackResult.INVALID);
    assert.equal(game.turn, Player.COMPUTER);

    assert.equal(playerAttack(game, 1, 1).result, AttackResult.INVALID, 'player cannot fire twice');

    const reply = computerAttack(game);
    assert.ok([AttackResult.MISS, AttackResult.HIT, AttackResult.SUNK].includes(reply.result));
    assert.equal(game.player.grid[reply.row][reply.col].attacked, true);
    assert.equal(game.turn, Player.HUMAN);
  });

  test('computer cannot attack on the player turn', () => {
    const game = createGame({ random: seededRandom(3) });
    assert.equal(computerAttack(game).result, AttackResult.INVALID);
  });

  test('repeat attacks by the player do not use up the turn', () => {
    const game = createGame({ random: seededRandom(4) });
    playerAttack(game, 0, 0);
    computerAttack(game);
    assert.equal(playerAttack(game, 0, 0).result, AttackResult.REPEAT);
    assert.equal(game.turn, Player.HUMAN);
  });

  test('player wins by sinking every enemy ship, and play stops', () => {
    const game = createGame({ random: seededRandom(5) });
    const last = sinkAll(game.computer, (r, c) => {
      const outcome = playerAttack(game, r, c);
      if (!game.winner) computerAttack(game);
      return outcome;
    });
    assert.equal(last.result, AttackResult.SUNK);
    assert.equal(game.winner, Player.HUMAN);
    assert.equal(computerAttack(game).result, AttackResult.INVALID);
    assert.equal(playerAttack(game, 9, 9).result, AttackResult.INVALID);
  });

  test('computer wins by sinking every player ship', () => {
    const game = createGame({ random: seededRandom(6) });
    const misses = [];
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) if (game.computer.grid[r][c].shipIndex === null) misses.push([r, c]);
    }
    while (!game.winner) {
      const [r, c] = misses.shift();
      playerAttack(game, r, c);
      computerAttack(game);
    }
    assert.equal(game.winner, Player.COMPUTER);
    assert.equal(allShipsSunk(game.player), true);
  });

  test('simulated games always finish with exactly one winner', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const random = seededRandom(seed);
      const game = createGame({ random });
      const playerTargets = [];
      for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) playerTargets.push([r, c]);
      let turns = 0;
      while (!game.winner) {
        const [r, c] = playerTargets.splice(Math.floor(random() * playerTargets.length), 1)[0];
        playerAttack(game, r, c);
        if (!game.winner) computerAttack(game);
        turns++;
        assert.ok(turns <= 100, 'game ends within 100 turns');
      }
      const loser = game.winner === Player.HUMAN ? game.computer : game.player;
      const survivor = game.winner === Player.HUMAN ? game.player : game.computer;
      assert.equal(allShipsSunk(loser), true);
      assert.equal(allShipsSunk(survivor), false);
    }
  });
});
