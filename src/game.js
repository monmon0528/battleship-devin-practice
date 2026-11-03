import { AttackResult, BOARD_SIZE, FLEET, Player } from './constants.js';
import { createAI } from './ai.js';

export function createBoard(size = BOARD_SIZE) {
  const grid = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => ({ shipIndex: null, attacked: false })),
  );
  return { size, grid, ships: [] };
}

export function inBounds(board, row, col) {
  return (
    Number.isInteger(row) &&
    Number.isInteger(col) &&
    row >= 0 &&
    col >= 0 &&
    row < board.size &&
    col < board.size
  );
}

export function shipCells(row, col, length, horizontal) {
  return Array.from({ length }, (_, i) => (horizontal ? [row, col + i] : [row + i, col]));
}

export function canPlaceShip(board, length, row, col, horizontal) {
  return shipCells(row, col, length, horizontal).every(
    ([r, c]) => inBounds(board, r, c) && board.grid[r][c].shipIndex === null,
  );
}

export function placeShip(board, { name, length }, row, col, horizontal) {
  if (!canPlaceShip(board, length, row, col, horizontal)) {
    throw new Error(`Cannot place ${name} at (${row}, ${col})`);
  }
  const cells = shipCells(row, col, length, horizontal);
  const shipIndex = board.ships.length;
  const ship = { name, length, cells, hits: 0 };
  board.ships.push(ship);
  for (const [r, c] of cells) {
    board.grid[r][c].shipIndex = shipIndex;
  }
  return ship;
}

export function placeFleetRandomly(board, fleet = FLEET, random = Math.random) {
  for (const ship of fleet) {
    const options = [];
    for (const horizontal of [true, false]) {
      for (let row = 0; row < board.size; row++) {
        for (let col = 0; col < board.size; col++) {
          if (canPlaceShip(board, ship.length, row, col, horizontal)) {
            options.push([row, col, horizontal]);
          }
        }
      }
    }
    if (options.length === 0) {
      throw new Error(`No room left to place ${ship.name}`);
    }
    const [row, col, horizontal] = options[Math.floor(random() * options.length)];
    placeShip(board, ship, row, col, horizontal);
  }
  return board;
}

export function isSunk(ship) {
  return ship.hits >= ship.length;
}

export function allShipsSunk(board) {
  return board.ships.length > 0 && board.ships.every(isSunk);
}

export function receiveAttack(board, row, col) {
  if (!inBounds(board, row, col)) return { result: AttackResult.INVALID, row, col };
  const cell = board.grid[row][col];
  if (cell.attacked) return { result: AttackResult.REPEAT, row, col };
  cell.attacked = true;
  if (cell.shipIndex === null) return { result: AttackResult.MISS, row, col };
  const ship = board.ships[cell.shipIndex];
  ship.hits += 1;
  return { result: isSunk(ship) ? AttackResult.SUNK : AttackResult.HIT, row, col, ship };
}

export function createGame({ random = Math.random, fleet = FLEET, size = BOARD_SIZE } = {}) {
  return {
    player: placeFleetRandomly(createBoard(size), fleet, random),
    computer: placeFleetRandomly(createBoard(size), fleet, random),
    ai: createAI(size, random),
    turn: Player.HUMAN,
    winner: null,
  };
}

export function playerAttack(game, row, col) {
  if (game.winner || game.turn !== Player.HUMAN) {
    return { result: AttackResult.INVALID, row, col };
  }
  const outcome = receiveAttack(game.computer, row, col);
  if (outcome.result === AttackResult.REPEAT || outcome.result === AttackResult.INVALID) {
    return outcome;
  }
  if (allShipsSunk(game.computer)) {
    game.winner = Player.HUMAN;
  } else {
    game.turn = Player.COMPUTER;
  }
  return outcome;
}

export function computerAttack(game) {
  if (game.winner || game.turn !== Player.COMPUTER) {
    return { result: AttackResult.INVALID };
  }
  const [row, col] = game.ai.nextMove();
  const outcome = receiveAttack(game.player, row, col);
  game.ai.recordResult(outcome);
  if (allShipsSunk(game.player)) {
    game.winner = Player.COMPUTER;
  } else {
    game.turn = Player.HUMAN;
  }
  return outcome;
}
