import { AttackResult, Player } from './constants.js';
import { computerAttack, createGame, playerAttack } from './game.js';

const COMPUTER_DELAY_MS = 600;
const MAX_LOG_ENTRIES = 6;
const COLUMN_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const els = {
  status: document.getElementById('status'),
  playerBoard: document.getElementById('player-board'),
  computerBoard: document.getElementById('computer-board'),
  playerShips: document.getElementById('player-ships'),
  computerShips: document.getElementById('computer-ships'),
  log: document.getElementById('log'),
  restart: document.getElementById('restart'),
};

let game;
let computerTimer = null;
let logEntries = [];

const coordinate = (row, col) => `${COLUMN_LABELS[col]}${row + 1}`;

function buildBoard(container, size, isEnemy) {
  container.replaceChildren();
  container.appendChild(label(''));
  for (let col = 0; col < size; col++) container.appendChild(label(COLUMN_LABELS[col]));
  for (let row = 0; row < size; row++) {
    container.appendChild(label(String(row + 1)));
    for (let col = 0; col < size; col++) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'cell';
      cell.dataset.row = row;
      cell.dataset.col = col;
      cell.setAttribute('aria-label', coordinate(row, col));
      if (!isEnemy) cell.disabled = true;
      container.appendChild(cell);
    }
  }
}

function label(text) {
  const el = document.createElement('div');
  el.className = 'label';
  el.textContent = text;
  return el;
}

function renderBoard(container, board, { revealShips, enemy }) {
  for (const cell of container.querySelectorAll('.cell')) {
    const { attacked, shipIndex } = board.grid[cell.dataset.row][cell.dataset.col];
    const ship = shipIndex === null ? null : board.ships[shipIndex];
    const sunk = ship !== null && ship.hits >= ship.length;
    cell.classList.toggle('ship', ship !== null && (revealShips || sunk));
    cell.classList.toggle('miss', attacked && ship === null);
    cell.classList.toggle('hit', attacked && ship !== null && !sunk);
    cell.classList.toggle('sunk', attacked && sunk);
    if (enemy) {
      cell.disabled = attacked || game.winner !== null || game.turn !== Player.HUMAN;
    }
  }
}

function renderShips(list, board) {
  list.replaceChildren(
    ...board.ships.map((ship) => {
      const item = document.createElement('li');
      const sunk = ship.hits >= ship.length;
      item.textContent = `${ship.name} (${ship.length})`;
      item.classList.toggle('sunk', sunk);
      if (sunk) item.setAttribute('aria-label', `${ship.name} sunk`);
      return item;
    }),
  );
}

function renderStatus() {
  els.status.classList.remove('win', 'lose');
  if (game.winner === Player.HUMAN) {
    els.status.textContent = 'You win! All enemy ships have been sunk.';
    els.status.classList.add('win');
  } else if (game.winner === Player.COMPUTER) {
    els.status.textContent = 'You lose! The computer sank your entire fleet.';
    els.status.classList.add('lose');
  } else if (game.turn === Player.HUMAN) {
    els.status.textContent = 'Your turn: click a cell in Enemy Waters to fire.';
  } else {
    els.status.textContent = 'Computer is taking aim...';
  }
}

function renderLog() {
  els.log.replaceChildren(
    ...logEntries.map((text) => {
      const item = document.createElement('li');
      item.textContent = text;
      return item;
    }),
  );
}

function render() {
  const revealEnemy = game.winner !== null;
  renderBoard(els.playerBoard, game.player, { revealShips: true, enemy: false });
  renderBoard(els.computerBoard, game.computer, { revealShips: revealEnemy, enemy: true });
  renderShips(els.playerShips, game.player);
  renderShips(els.computerShips, game.computer);
  renderStatus();
  renderLog();
}

function describe(shooter, outcome) {
  const where = coordinate(outcome.row, outcome.col);
  const isPlayer = shooter === Player.HUMAN;
  const actor = isPlayer ? 'You' : 'Computer';
  switch (outcome.result) {
    case AttackResult.MISS:
      return `${actor} fired at ${where}: miss.`;
    case AttackResult.HIT:
      return `${actor} fired at ${where}: hit!`;
    case AttackResult.SUNK:
      return isPlayer
        ? `You fired at ${where}: you sank the enemy's ${outcome.ship.name}!`
        : `Computer fired at ${where}: it sank your ${outcome.ship.name}!`;
    default:
      return null;
  }
}

function log(text) {
  if (!text) return;
  logEntries = [text, ...logEntries].slice(0, MAX_LOG_ENTRIES);
}

function handleEnemyClick(event) {
  const cell = event.target.closest('.cell');
  if (!cell || cell.disabled) return;
  const outcome = playerAttack(game, Number(cell.dataset.row), Number(cell.dataset.col));
  if (outcome.result === AttackResult.REPEAT || outcome.result === AttackResult.INVALID) return;
  log(describe(Player.HUMAN, outcome));
  render();
  if (game.turn === Player.COMPUTER && !game.winner) {
    computerTimer = setTimeout(takeComputerTurn, COMPUTER_DELAY_MS);
  }
}

function takeComputerTurn() {
  computerTimer = null;
  const outcome = computerAttack(game);
  log(describe(Player.COMPUTER, outcome));
  render();
}

function startGame() {
  clearTimeout(computerTimer);
  computerTimer = null;
  game = createGame();
  logEntries = [];
  buildBoard(els.playerBoard, game.player.size, false);
  buildBoard(els.computerBoard, game.computer.size, true);
  render();
}

els.computerBoard.addEventListener('click', handleEnemyClick);
els.restart.addEventListener('click', startGame);
startGame();
