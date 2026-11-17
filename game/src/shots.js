// Screenshot scenes for Emberhold, behind ?shot=start|play|clear|end&seed=N.
// Each scene plays the real rules forward from a fresh world with a fixed
// seed and a simple autopilot, so the frame is what a real game looks like
// and the same seed always gives the same frame. Nothing here is staged
// by hand: towers are bought with real gold, waves are fought for real.

import { TOWERS } from './config.js';
import { buildTower, createWorld, startWave, stepWorld, towerAtPlot, upgradeTower } from './world.js';

const STEP = 1 / 60;
const START_SECONDS = 5;
const PLAY_WAVE = 3;
const SIM_LIMIT_SECONDS = 1200;

// The autopilot's build order: plot index, tower kind. Good coverage of
// every leg of the road, frost where the road bends, cannons at the end.
const BUILD_PLAN = [
  [3, 'spark'],
  [4, 'spark'],
  [5, 'frost'],
  [8, 'spark'],
  [6, 'cannon'],
  [7, 'spark'],
  [9, 'frost'],
  [10, 'cannon'],
  [1, 'spark'],
  [2, 'spark'],
  [11, 'cannon'],
  [0, 'frost'],
];

/** Spend gold between waves: build the next planned tower, else upgrade. */
function spendGold(world, planIndex) {
  if (planIndex < BUILD_PLAN.length) {
    const [plot, kind] = BUILD_PLAN[planIndex];
    if (towerAtPlot(world, plot)) return planIndex + 1;
    if (world.gold < TOWERS[kind].cost) return planIndex; // Earn more first.
    buildTower(world, plot, kind);
    return planIndex + 1;
  }
  // Plan done: upgrade the weakest tower we can afford, cheapest first.
  const upgradable = world.towers
    .filter((t) => t.level < 3)
    .sort((a, b) => a.level - b.level);
  for (const tower of upgradable) {
    if (upgradeTower(world, tower)) return planIndex;
  }
  return planIndex;
}

/** One autopilot turn: spend, then send the wave when nothing is left to buy. */
function autopilot(world, planIndex) {
  if (world.phase !== 'build') return planIndex;
  const next = spendGold(world, planIndex);
  if (next === planIndex) {
    // Nothing could be bought right now — the next tower is still
    // unaffordable, or the plan is done and no upgrade is affordable —
    // so send the wave and earn more gold.
    startWave(world);
  }
  return next;
}

/**
 * Set `world` to the named scene and return the screen to draw over it and
 * the best score to show. Any unknown name is the title scene.
 */
export function stageShot(name, world) {
  if (name === 'start') {
    // A quiet map with two spires already standing, under the title.
    buildTower(world, 3, 'spark');
    buildTower(world, 4, 'spark');
    for (let i = 0; i < START_SECONDS / STEP; i += 1) stepWorld(world, STEP);
    return { screen: 'title', best: 0 };
  }

  if (name === 'play') {
    let planIndex = 0;
    for (let i = 0; i < SIM_LIMIT_SECONDS / STEP; i += 1) {
      planIndex = autopilot(world, planIndex);
      stepWorld(world, STEP);
      if (world.phase === 'won' || world.phase === 'lost') break;
      // Mid-fight in wave 3: enemies on the road, towers firing.
      if (world.phase === 'wave' && world.wave >= PLAY_WAVE && world.waveTime >= 6) break;
      if (world.phase === 'build' && world.wave > PLAY_WAVE) break;
    }
    return { screen: 'play', best: world.score };
  }

  if (name === 'clear') {
    let planIndex = 0;
    for (let i = 0; i < SIM_LIMIT_SECONDS / STEP; i += 1) {
      planIndex = autopilot(world, planIndex);
      stepWorld(world, STEP);
      if (world.phase === 'won' || world.phase === 'lost') break;
    }
    const screen = world.phase === 'won' ? 'won' : world.phase === 'lost' ? 'lost' : 'play';
    return { screen, best: world.score };
  }

  // 'end': one lonely spire against the road — the Core falls.
  buildTower(world, 3, 'spark');
  for (let i = 0; i < SIM_LIMIT_SECONDS / STEP; i += 1) {
    if (world.phase === 'build') startWave(world);
    stepWorld(world, STEP);
    if (world.phase === 'lost' || world.phase === 'won') break;
  }
  const screen = world.phase === 'lost' ? 'lost' : world.phase === 'won' ? 'won' : 'play';
  return { screen, best: world.score };
}
