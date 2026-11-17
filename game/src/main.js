// Emberhold entry point: boots the canvas, runs the loop, and turns input
// into world actions. The simulation itself lives in world.js; this file
// only decides *when* it runs and what the player asked for.

import { PLOTS, TOWER_ORDER, TOWERS } from './config.js';
import { drainEvents, startWave, stepWorld, buildTower, createWorld, sellTower, upgradeTower } from './world.js';
import { draw } from './render.js';
import { createInput } from './input.js';
import { ensureAudio, isMuted, sfx, toggleMute } from './audio.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const BEST_KEY = 'emberhold-best';

const params = new URLSearchParams(location.search);
const seedParam = Number(params.get('seed'));
const seed = Number.isFinite(seedParam) && seedParam > 0 ? Math.floor(seedParam) : 1;

let world = createWorld(seed);
let screen = 'title'; // 'title' | 'play' | 'paused' | 'won' | 'lost'
let best = 0;
try {
  best = Number(localStorage.getItem(BEST_KEY)) || 0;
} catch {
  best = 0;
}

const ui = {
  screen,
  selectedType: null,
  selectedPlot: null,
  selectedTower: null,
  mouse: { x: 0, y: 0, inside: false },
  buttons: {},
  muted: isMuted(),
  best,
};

const input = createInput(canvas);

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

function setStatus(text) {
  statusEl.textContent = text;
}

function saveBest() {
  if (world.score > best) {
    best = world.score;
    ui.best = best;
    try {
      localStorage.setItem(BEST_KEY, String(best));
    } catch {
      // Storage is a nicety, not a requirement.
    }
  }
}

function restart() {
  world = createWorld((Math.random() * 2147483647) | 0);
  screen = 'play';
  ui.screen = screen;
  ui.selectedType = null;
  ui.selectedPlot = null;
  ui.selectedTower = null;
  setStatus('New game. Build towers on the stone plots, then send wave 1.');
}

function beginGame() {
  ensureAudio();
  sfx.click();
  screen = 'play';
  ui.screen = screen;
  setStatus('Wave 1 ready. Build towers on the stone plots, then press Space to send the wave.');
}

function togglePause() {
  if (screen === 'play') {
    screen = 'paused';
    setStatus('Paused.');
  } else if (screen === 'paused') {
    screen = 'play';
    setStatus('Resumed.');
  }
  ui.screen = screen;
}

function pointIn(rect, p) {
  return rect && p.x >= rect.x && p.x <= rect.x + rect.w && p.y >= rect.y && p.y <= rect.y + rect.h;
}

function plotAt(p) {
  for (let i = 0; i < PLOTS.length; i += 1) {
    if (Math.hypot(p.x - PLOTS[i].x, p.y - PLOTS[i].y) < 26) return i;
  }
  return -1;
}

function towerAt(p) {
  for (const tower of world.towers) {
    if (Math.hypot(p.x - tower.x, p.y - tower.y) < 24) return tower;
  }
  return null;
}

function handleClick(point) {
  ensureAudio();
  ui.mouse = { x: point.x, y: point.y, inside: true };

  if (screen === 'title') {
    beginGame();
    return;
  }
  if (screen === 'won' || screen === 'lost') {
    restart();
    return;
  }
  if (screen === 'paused') {
    if (pointIn(ui.buttons.pause, point)) togglePause();
    return;
  }

  // HUD buttons first.
  for (const key of TOWER_ORDER) {
    if (pointIn(ui.buttons[`tower-${key}`], point)) {
      ui.selectedType = ui.selectedType === key ? null : key;
      ui.selectedPlot = null;
      sfx.click();
      return;
    }
  }
  if (pointIn(ui.buttons.wave, point)) {
    if (world.phase === 'build') {
      if (startWave(world)) sfx.wave();
    }
    return;
  }
  if (pointIn(ui.buttons.pause, point)) {
    togglePause();
    return;
  }
  if (pointIn(ui.buttons.mute, point)) {
    ui.muted = toggleMute();
    return;
  }
  if (ui.selectedTower && pointIn(ui.buttons.upgrade, point)) {
    if (upgradeTower(world, ui.selectedTower)) sfx.upgrade();
    return;
  }
  if (ui.selectedTower && pointIn(ui.buttons.sell, point)) {
    sellTower(world, ui.selectedTower);
    ui.selectedTower = null;
    sfx.sell();
    return;
  }

  // A tower on the map?
  const tower = towerAt(point);
  if (tower) {
    ui.selectedTower = tower;
    ui.selectedPlot = null;
    sfx.click();
    return;
  }

  // A plot on the map?
  const plot = plotAt(point);
  if (plot >= 0) {
    const existing = world.towers.find((t) => t.plot === plot);
    if (existing) {
      ui.selectedTower = existing;
      ui.selectedPlot = null;
    } else if (ui.selectedType) {
      const built = buildTower(world, plot, ui.selectedType);
      if (built) {
        sfx.build();
        ui.selectedPlot = null;
      } else {
        sfx.denied();
      }
    } else {
      ui.selectedPlot = plot;
      ui.selectedTower = null;
      sfx.click();
    }
    return;
  }

  // Empty ground: clear the selection.
  ui.selectedPlot = null;
  ui.selectedTower = null;
}

function handleKeys() {
  for (const key of input.drainPressed()) {
    if (screen === 'title') {
      if (key === 'enter' || key === ' ') beginGame();
      continue;
    }
    if (screen === 'won' || screen === 'lost') {
      if (key === 'r' || key === 'enter' || key === ' ') restart();
      continue;
    }
    if (key === 'p' || key === 'escape') {
      togglePause();
      continue;
    }
    if (screen === 'paused') {
      if (key === 'r') restart();
      continue;
    }
    if (key === 'm') {
      ui.muted = toggleMute();
    } else if (key === ' ') {
      if (world.phase === 'build' && startWave(world)) sfx.wave();
    } else if (key === '1' || key === '2' || key === '3') {
      const type = TOWER_ORDER[Number(key) - 1];
      ui.selectedType = ui.selectedType === type ? null : type;
      ui.selectedPlot = null;
      sfx.click();
    } else if (key === 'u' && ui.selectedTower) {
      if (upgradeTower(world, ui.selectedTower)) sfx.upgrade();
      else sfx.denied();
    } else if (key === 'x' && ui.selectedTower) {
      sellTower(world, ui.selectedTower);
      ui.selectedTower = null;
      sfx.sell();
    } else if (key === 'r') {
      restart();
    }
  }
}

function playEvents() {
  for (const event of drainEvents(world)) {
    if (event.type === 'shoot') {
      if (event.kind === 'frost') sfx.frost();
      else if (event.kind === 'cannon') sfx.cannon();
      else sfx.shoot();
    } else if (event.type === 'kill') {
      sfx.kill();
    } else if (event.type === 'leak') {
      sfx.leak();
    } else if (event.type === 'build') {
      sfx.build();
    } else if (event.type === 'wave') {
      sfx.wave();
      setStatus(`Wave ${event.wave} of 12 incoming.`);
    } else if (event.type === 'clear') {
      sfx.clear();
      setStatus(`Wave ${event.wave} cleared. Bonus ${event.bonus} gold.`);
    } else if (event.type === 'win') {
      sfx.win();
      saveBest();
      screen = 'won';
      ui.screen = screen;
      setStatus(`Victory. Final score ${event.score}.`);
    } else if (event.type === 'lose') {
      sfx.lose();
      saveBest();
      screen = 'lost';
      ui.screen = screen;
      setStatus(`Defeat on wave ${world.wave}. Final score ${event.score}.`);
    }
  }
}

function frame(now, last) {
  const dt = Math.min(0.05, (now - last) / 1000);
  ui.mouse = input.mouse();
  // Keys first: a tower hotkey pressed just before a click must already
  // be in effect when that click is handled, even in the same frame.
  handleKeys();
  for (const click of input.drainClicks()) handleClick(click);
  if (screen === 'play') {
    stepWorld(world, dt);
    playEvents();
    if (world.phase === 'won' && screen === 'play') {
      saveBest();
      screen = 'won';
      ui.screen = screen;
    } else if (world.phase === 'lost' && screen === 'play') {
      saveBest();
      screen = 'lost';
      ui.screen = screen;
    }
  }
  draw(ctx, canvas, world, ui);
}

// Screenshot mode: stage one deterministic scene, draw it once, and stop.
// The status line records the outcome so a headless run can read it back.
const shotName = params.get('shot');
if (shotName) {
  const staged = stageShot(shotName, world);
  screen = staged.screen;
  ui.screen = screen;
  ui.best = staged.best;
  ui.selectedType = 'spark';
  draw(ctx, canvas, world, ui);
  setStatus(`shot=${shotName} screen=${staged.screen} wave=${world.wave} score=${world.score} gold=${world.gold} core=${world.coreHp} kills=${world.kills} towers=${world.towers.length} phase=${world.phase}`);
} else {
  setStatus('Emberhold. Press Enter or click to begin.');
  let last = performance.now();
  const loop = (now) => {
    frame(now, last);
    last = now;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

// Exposed for headless play-tests: the live world and screen.
window.__emberhold = {
  get world() {
    return world;
  },
  get screen() {
    return screen;
  },
  restart,
  beginGame,
};
