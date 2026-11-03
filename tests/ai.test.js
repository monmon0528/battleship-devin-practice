import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createAI } from '../src/ai.js';
import { AttackResult } from '../src/constants.js';
import { createBoard, placeFleetRandomly, placeShip, receiveAttack } from '../src/game.js';
import { seededRandom } from './helpers.js';

const isAdjacent = ([r1, c1], [r2, c2]) => Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1;

describe('computer AI', () => {
  test('fires at every cell exactly once and never repeats', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const ai = createAI(10, seededRandom(seed));
      const board = placeFleetRandomly(createBoard(), undefined, seededRandom(seed + 100));
      const seen = new Set();
      for (let i = 0; i < 100; i++) {
        const [r, c] = ai.nextMove();
        assert.ok(!seen.has(`${r},${c}`), 'no repeated cell');
        seen.add(`${r},${c}`);
        ai.recordResult(receiveAttack(board, r, c));
      }
      assert.equal(seen.size, 100);
      assert.throws(() => ai.nextMove());
    }
  });

  test('after a hit, the next shot is adjacent to the hit', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const ai = createAI(10, seededRandom(seed));
      ai.recordResult({ row: 5, col: 5, result: AttackResult.HIT });
      assert.ok(isAdjacent(ai.nextMove(), [5, 5]));
    }
  });

  test('after two hits in a line, it keeps shooting along that line', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const ai = createAI(10, seededRandom(seed));
      ai.recordResult({ row: 3, col: 4, result: AttackResult.HIT });
      ai.recordResult({ row: 3, col: 5, result: AttackResult.HIT });
      const move = ai.nextMove();
      assert.ok(
        [[3, 3], [3, 6]].some(([r, c]) => r === move[0] && c === move[1]),
        `expected (3,3) or (3,6), got (${move})`,
      );
    }
  });

  test('returns to hunting once the targeted ship is sunk', () => {
    const board = createBoard();
    placeShip(board, { name: 'Destroyer', length: 2 }, 0, 0, true);
    const ai = createAI(10, seededRandom(1));
    ai.recordResult(receiveAttack(board, 0, 0));
    assert.equal(ai.hasTargets, true);
    ai.recordResult(receiveAttack(board, 0, 1));
    assert.equal(ai.hasTargets, false);
  });

  test('ignores misses when choosing targets', () => {
    const ai = createAI(10, seededRandom(1));
    ai.recordResult({ row: 0, col: 0, result: AttackResult.MISS });
    assert.equal(ai.hasTargets, false);
  });
});
