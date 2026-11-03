import { AttackResult, BOARD_SIZE } from './constants.js';

const DIRECTIONS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

const key = (row, col) => `${row},${col}`;
const parseKey = (k) => k.split(',').map(Number);

/**
 * Hunt/target computer opponent: fires at random untried cells until it scores
 * a hit, then works around unresolved hits (extending lines first) until the
 * ship sinks. Never fires at the same cell twice.
 */
export function createAI(size = BOARD_SIZE, random = Math.random) {
  const untried = new Set();
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) untried.add(key(row, col));
  }
  let pendingHits = [];

  const isPendingHit = (row, col) => pendingHits.some(([r, c]) => r === row && c === col);

  function lineCandidates() {
    const candidates = new Set();
    for (const [row, col] of pendingHits) {
      for (const [dr, dc] of [
        [0, 1],
        [1, 0],
      ]) {
        if (!isPendingHit(row + dr, col + dc)) continue;
        let r = row;
        let c = col;
        while (isPendingHit(r - dr, c - dc)) {
          r -= dr;
          c -= dc;
        }
        if (untried.has(key(r - dr, c - dc))) candidates.add(key(r - dr, c - dc));
        r = row;
        c = col;
        while (isPendingHit(r + dr, c + dc)) {
          r += dr;
          c += dc;
        }
        if (untried.has(key(r + dr, c + dc))) candidates.add(key(r + dr, c + dc));
      }
    }
    return candidates;
  }

  function neighbourCandidates() {
    const candidates = new Set();
    for (const [row, col] of pendingHits) {
      for (const [dr, dc] of DIRECTIONS) {
        const k = key(row + dr, col + dc);
        if (untried.has(k)) candidates.add(k);
      }
    }
    return candidates;
  }

  return {
    nextMove() {
      if (untried.size === 0) throw new Error('No cells left to attack');
      let candidates = new Set();
      if (pendingHits.length > 0) {
        candidates = lineCandidates();
        if (candidates.size === 0) candidates = neighbourCandidates();
      }
      const pool = [...(candidates.size > 0 ? candidates : untried)];
      const choice = pool[Math.floor(random() * pool.length)];
      untried.delete(choice);
      return parseKey(choice);
    },

    recordResult({ row, col, result, ship }) {
      if (result === AttackResult.HIT) {
        pendingHits.push([row, col]);
      } else if (result === AttackResult.SUNK) {
        const sunkCells = new Set(ship.cells.map(([r, c]) => key(r, c)));
        pendingHits = pendingHits.filter(([r, c]) => !sunkCells.has(key(r, c)));
      }
    },

    get hasTargets() {
      return pendingHits.length > 0;
    },

    get remainingCells() {
      return untried.size;
    },
  };
}
