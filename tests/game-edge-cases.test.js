import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { AttackResult, BOARD_SIZE, FLEET, Player } from '../src/constants.js';
import {
  allShipsSunk,
  canPlaceShip,
  computerAttack,
  createBoard,
  createGame,
  inBounds,
  isSunk,
  placeFleetRandomly,
  placeShip,
  playerAttack,
  receiveAttack,
  shipCells,
} from '../src/game.js';
import { seededRandom } from './helpers.js';

const NON_INTEGER_COORDINATES = [1.5, '1', NaN, Infinity, -Infinity, null, undefined];

const occupiedCells = (board) =>
  board.grid.flatMap((row, r) => row.flatMap((cell, c) => (cell.shipIndex === null ? [] : [[r, c]])));

const attackedCount = (board) => board.grid.flat().filter((cell) => cell.attacked).length;

describe('board geometry helpers', () => {
  test('shipCells lays out cells to the right or downwards from the origin', () => {
    assert.deepEqual(shipCells(2, 3, 3, true), [[2, 3], [2, 4], [2, 5]]);
    assert.deepEqual(shipCells(2, 3, 3, false), [[2, 3], [3, 3], [4, 3]]);
    assert.deepEqual(shipCells(0, 0, 1, true), [[0, 0]]);
  });

  test('inBounds accepts every corner and rejects the first cell outside each edge', () => {
    const board = createBoard();
    for (const [r, c] of [[0, 0], [0, 9], [9, 0], [9, 9]]) assert.equal(inBounds(board, r, c), true);
    for (const [r, c] of [[-1, 0], [0, -1], [10, 0], [0, 10]]) assert.equal(inBounds(board, r, c), false);
  });

  test('inBounds rejects non-integer coordinates', () => {
    const board = createBoard();
    for (const value of NON_INTEGER_COORDINATES) {
      assert.equal(inBounds(board, value, 0), false, `row ${String(value)}`);
      assert.equal(inBounds(board, 0, value), false, `col ${String(value)}`);
    }
  });

  test('inBounds respects a custom board size', () => {
    const board = createBoard(3);
    assert.equal(board.grid.length, 3);
    assert.equal(inBounds(board, 2, 2), true);
    assert.equal(inBounds(board, 3, 0), false);
  });
});

describe('invalid ship placements', () => {
  test('placing a ship off any edge throws and leaves the board untouched', () => {
    const attempts = [
      [0, 6, true], // runs off the right edge
      [6, 0, false], // runs off the bottom edge
      [-1, 0, true], // starts above the board
      [0, -1, false], // starts left of the board
      [10, 0, true], // starts below the board
    ];
    for (const [row, col, horizontal] of attempts) {
      const board = createBoard();
      assert.throws(
        () => placeShip(board, { name: 'Carrier', length: 5 }, row, col, horizontal),
        { message: `Cannot place Carrier at (${row}, ${col})` },
      );
      assert.deepEqual(board.ships, []);
      assert.deepEqual(occupiedCells(board), []);
    }
  });

  test('an overlapping placement does not claim any of its free cells', () => {
    const board = createBoard();
    placeShip(board, { name: 'Destroyer', length: 2 }, 4, 6, true);
    assert.throws(() => placeShip(board, { name: 'Carrier', length: 5 }, 4, 2, true));
    assert.deepEqual(occupiedCells(board), [[4, 6], [4, 7]]);
    assert.equal(board.grid[4][2].shipIndex, null);
  });

  test('non-integer origins are not placeable', () => {
    const board = createBoard();
    for (const value of NON_INTEGER_COORDINATES) {
      assert.equal(canPlaceShip(board, 2, value, 0, true), false, `row ${String(value)}, horizontal`);
      assert.equal(canPlaceShip(board, 2, 0, value, false), false, `col ${String(value)}, vertical`);
      assert.throws(() => placeShip(board, { name: 'Destroyer', length: 2 }, value, 0, true));
    }
    // Along the ship's own axis, `null + i` coerces to an integer, so null is only rejected on the fixed axis.
    for (const value of NON_INTEGER_COORDINATES.filter((v) => v !== null)) {
      assert.equal(canPlaceShip(board, 2, 0, value, true), false, `col ${String(value)}, horizontal`);
    }
    assert.deepEqual(board.ships, []);
  });

  test('ships may touch as long as they do not share a cell', () => {
    const board = createBoard();
    placeShip(board, { name: 'Destroyer', length: 2 }, 0, 0, true);
    placeShip(board, { name: 'Submarine', length: 3 }, 1, 0, true);
    placeShip(board, { name: 'Cruiser', length: 3 }, 0, 3, false);
    assert.equal(board.ships.length, 3);
  });

  test('a ship may end exactly on the last row or column', () => {
    const board = createBoard();
    assert.deepEqual(placeShip(board, { name: 'Carrier', length: 5 }, 9, 5, true).cells.at(-1), [9, 9]);
    assert.deepEqual(placeShip(board, { name: 'Battleship', length: 4 }, 0, 9, false).cells.at(-1), [3, 9]);
  });
});

describe('random fleet placement edge cases', () => {
  test('throws a descriptive error when a ship cannot fit on the board', () => {
    assert.throws(
      () => placeFleetRandomly(createBoard(2), [{ name: 'Cruiser', length: 3 }]),
      { message: 'No room left to place Cruiser' },
    );
  });

  test('throws once the board fills up, naming the ship that did not fit', () => {
    const board = createBoard(2);
    const fleet = [
      { name: 'First', length: 2 },
      { name: 'Second', length: 2 },
      { name: 'Third', length: 2 },
    ];
    assert.throws(() => placeFleetRandomly(board, fleet, seededRandom(1)), { message: 'No room left to place Third' });
    assert.deepEqual(board.ships.map((s) => s.name), ['First', 'Second']);
  });

  test('fills a board that has exactly enough room', () => {
    const board = placeFleetRandomly(createBoard(1), [{ name: 'Dinghy', length: 1 }]);
    assert.deepEqual(board.ships[0].cells, [[0, 0]]);
  });

  test('uses the injected random source to choose among all legal positions', () => {
    const first = placeFleetRandomly(createBoard(), [{ name: 'Carrier', length: 5 }], () => 0);
    assert.deepEqual(first.ships[0].cells, shipCells(0, 0, 5, true));

    const last = placeFleetRandomly(createBoard(), [{ name: 'Carrier', length: 5 }], () => 0.999999);
    assert.deepEqual(last.ships[0].cells, shipCells(5, 9, 5, false));
  });

  test('uses the standard fleet when none is given', () => {
    const board = placeFleetRandomly(createBoard(), undefined, seededRandom(42));
    assert.deepEqual(board.ships.map((s) => s.name), FLEET.map((s) => s.name));
  });
});

describe('invalid attack coordinates', () => {
  test('non-integer coordinates are rejected without touching the board', () => {
    const board = placeFleetRandomly(createBoard(), FLEET, seededRandom(8));
    for (const value of NON_INTEGER_COORDINATES) {
      assert.deepEqual(receiveAttack(board, value, 0), { result: AttackResult.INVALID, row: value, col: 0 });
      assert.equal(receiveAttack(board, 0, value).result, AttackResult.INVALID);
    }
    assert.equal(attackedCount(board), 0);
    assert.ok(board.ships.every((ship) => ship.hits === 0));
  });

  test('coordinates just outside every edge are rejected', () => {
    const board = createBoard();
    for (const [r, c] of [[-1, 5], [10, 5], [5, -1], [5, 10]]) {
      assert.equal(receiveAttack(board, r, c).result, AttackResult.INVALID);
    }
    assert.equal(attackedCount(board), 0);
  });

  test('an out-of-bounds player shot does not use up the turn', () => {
    const game = createGame({ random: seededRandom(9) });
    assert.equal(playerAttack(game, 10, 10).result, AttackResult.INVALID);
    assert.equal(playerAttack(game, 0.5, 0).result, AttackResult.INVALID);
    assert.equal(game.turn, Player.HUMAN);
    assert.equal(attackedCount(game.computer), 0);
  });

  test('a player shot out of turn is ignored and does not mark the cell', () => {
    const game = createGame({ random: seededRandom(10) });
    playerAttack(game, 0, 0);
    assert.equal(playerAttack(game, 5, 5).result, AttackResult.INVALID);
    assert.equal(game.computer.grid[5][5].attacked, false);
    assert.equal(attackedCount(game.computer), 1);
  });
});

describe('game rule edge cases', () => {
  test('repeat shots at water or at a sunk ship never change the outcome', () => {
    const board = createBoard();
    placeShip(board, { name: 'Destroyer', length: 2 }, 0, 0, true);
    receiveAttack(board, 5, 5);
    assert.equal(receiveAttack(board, 5, 5).result, AttackResult.REPEAT);

    receiveAttack(board, 0, 0);
    assert.equal(receiveAttack(board, 0, 1).result, AttackResult.SUNK);
    assert.equal(receiveAttack(board, 0, 1).result, AttackResult.REPEAT);
    assert.equal(receiveAttack(board, 0, 0).result, AttackResult.REPEAT);
    assert.equal(board.ships[0].hits, 2);
  });

  test('a miss does not report a ship or add hits', () => {
    const board = createBoard();
    placeShip(board, { name: 'Destroyer', length: 2 }, 0, 0, true);
    const outcome = receiveAttack(board, 9, 9);
    assert.deepEqual(outcome, { result: AttackResult.MISS, row: 9, col: 9 });
    assert.equal(board.ships[0].hits, 0);
  });

  test('isSunk is true exactly when hits reach the ship length', () => {
    assert.equal(isSunk({ length: 3, hits: 2 }), false);
    assert.equal(isSunk({ length: 3, hits: 3 }), true);
  });

  test('a board with no ships is never "all sunk"', () => {
    assert.equal(allShipsSunk(createBoard()), false);
  });

  test('one sunk ship is not enough while another ship is still afloat', () => {
    const board = createBoard();
    placeShip(board, { name: 'Destroyer', length: 2 }, 0, 0, true);
    placeShip(board, { name: 'Submarine', length: 3 }, 2, 0, true);
    receiveAttack(board, 0, 0);
    receiveAttack(board, 0, 1);
    receiveAttack(board, 2, 0);
    assert.equal(allShipsSunk(board), false);
  });

  test('createGame honours a custom board size and fleet for both sides and the AI', () => {
    const fleet = [{ name: 'Patrol', length: 2 }];
    const game = createGame({ random: seededRandom(11), size: 4, fleet });
    for (const board of [game.player, game.computer]) {
      assert.equal(board.size, 4);
      assert.equal(board.grid.length, 4);
      assert.deepEqual(board.ships.map((s) => s.name), ['Patrol']);
    }
    assert.equal(game.ai.remainingCells, 16);
  });

  test('createGame defaults to the standard board and fleet', () => {
    const game = createGame();
    assert.equal(game.player.size, BOARD_SIZE);
    assert.equal(game.computer.ships.length, FLEET.length);
  });

  test('a winning shot ends the game immediately without handing the turn over', () => {
    const game = createGame({ random: seededRandom(12), size: 1, fleet: [{ name: 'Dinghy', length: 1 }] });
    const outcome = playerAttack(game, 0, 0);
    assert.equal(outcome.result, AttackResult.SUNK);
    assert.equal(game.winner, Player.HUMAN);
    assert.equal(game.turn, Player.HUMAN);
    assert.equal(computerAttack(game).result, AttackResult.INVALID);
    assert.equal(attackedCount(game.player), 0, 'the computer never fires after losing');
  });

  test('every computer shot consumes one AI cell and lands on the player board', () => {
    const game = createGame({ random: seededRandom(13) });
    playerAttack(game, 0, 0);
    const before = game.ai.remainingCells;
    const reply = computerAttack(game);
    assert.equal(game.ai.remainingCells, before - 1);
    assert.equal(game.player.grid[reply.row][reply.col].attacked, true);
  });
});
