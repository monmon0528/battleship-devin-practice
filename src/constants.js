export const BOARD_SIZE = 10;

export const FLEET = Object.freeze([
  Object.freeze({ name: 'Carrier', length: 5 }),
  Object.freeze({ name: 'Battleship', length: 4 }),
  Object.freeze({ name: 'Cruiser', length: 3 }),
  Object.freeze({ name: 'Submarine', length: 3 }),
  Object.freeze({ name: 'Destroyer', length: 2 }),
]);

export const AttackResult = Object.freeze({
  MISS: 'miss',
  HIT: 'hit',
  SUNK: 'sunk',
  REPEAT: 'repeat',
  INVALID: 'invalid',
});

export const Player = Object.freeze({
  HUMAN: 'player',
  COMPUTER: 'computer',
});
