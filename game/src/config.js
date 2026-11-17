// Emberhold configuration: the map, the towers, the enemies and the waves.
// Everything the world logic needs lives here, so tuning the game means
// editing this file and nothing else.

export const FIELD = { width: 960, height: 600, cell: 60 };

// The ember road the invaders march along, from off the left edge to the
// Lantern Core on the right. Waypoints are pixel centres.
export const PATH = [
  { x: -30, y: 150 },
  { x: 690, y: 150 },
  { x: 690, y: 330 },
  { x: 270, y: 330 },
  { x: 270, y: 510 },
  { x: 930, y: 510 },
];

// The Lantern Core the road ends at.
export const CORE = { x: 918, y: 510, radius: 30 };

// Build plots: stone circles near the road where towers may stand.
export const PLOTS = [
  { x: 150, y: 60 },
  { x: 330, y: 60 },
  { x: 510, y: 60 },
  { x: 120, y: 240 },
  { x: 300, y: 240 },
  { x: 480, y: 240 },
  { x: 780, y: 240 },
  { x: 120, y: 420 },
  { x: 480, y: 420 },
  { x: 780, y: 420 },
  { x: 600, y: 570 },
  { x: 840, y: 570 },
];

export const TOTAL_WAVES = 12;
export const START_GOLD = 150;
export const CORE_HP = 20;
export const MAX_TOWER_LEVEL = 3;
export const SELL_REFUND = 0.7;

// Tower kinds. damage/range/rate are level-1 values; each upgrade multiplies
// damage by UPGRADE_DAMAGE and adds UPGRADE_RANGE to the range.
export const UPGRADE_DAMAGE = 1.5;
export const UPGRADE_RANGE = 12;

export const TOWERS = {
  spark: {
    key: 'spark',
    name: 'Spark Spire',
    hotkey: '1',
    cost: 50,
    range: 135,
    damage: 12,
    rate: 2.0,
    projectileSpeed: 520,
    color: '#5ee6ff',
    dark: '#0e7490',
    blurb: 'Fast bolts, cheap and cheerful.',
  },
  frost: {
    key: 'frost',
    name: 'Frost Obelisk',
    hotkey: '2',
    cost: 75,
    range: 125,
    damage: 6,
    rate: 1.0,
    projectileSpeed: 420,
    slowFactor: 0.55,
    slowSeconds: 1.6,
    color: '#a5c8ff',
    dark: '#3b5bdb',
    blurb: 'Chills enemies to 55% speed.',
  },
  cannon: {
    key: 'cannon',
    name: 'Ember Cannon',
    hotkey: '3',
    cost: 120,
    range: 155,
    damage: 30,
    rate: 0.6,
    projectileSpeed: 380,
    splash: 55,
    color: '#ffb347',
    dark: '#c2410c',
    blurb: 'Slow shells, big splash damage.',
  },
};

export const TOWER_ORDER = ['spark', 'frost', 'cannon'];

// Enemy kinds. hp and speed are base values; waves scale hp up.
export const ENEMIES = {
  cinder: {
    key: 'cinder',
    name: 'Cinderling',
    hp: 34,
    speed: 56,
    reward: 6,
    leak: 1,
    radius: 12,
    color: '#ff7a3c',
    score: 10,
  },
  wisp: {
    key: 'wisp',
    name: 'Swift Wisp',
    hp: 20,
    speed: 98,
    reward: 7,
    leak: 1,
    radius: 9,
    color: '#ffe066',
    score: 15,
  },
  swarm: {
    key: 'swarm',
    name: 'Ember Mite',
    hp: 11,
    speed: 72,
    reward: 3,
    leak: 1,
    radius: 7,
    color: '#ff4d6d',
    score: 5,
  },
  golem: {
    key: 'golem',
    name: 'Stone Golem',
    hp: 150,
    speed: 33,
    reward: 18,
    leak: 3,
    radius: 17,
    color: '#9aa5b1',
    score: 30,
  },
  boss: {
    key: 'boss',
    name: 'Ash Titan',
    hp: 950,
    speed: 27,
    reward: 200,
    leak: 10,
    radius: 26,
    color: '#b42318',
    score: 500,
  },
};

/** Health multiplier for wave n (1-based). */
export function waveHpScale(wave) {
  return 1 + 0.2 * (wave - 1);
}

/** Speed multiplier for wave n (1-based): later waves march faster. */
export function waveSpeedScale(wave) {
  return 1 + 0.025 * (wave - 1);
}

/** Gold bonus for clearing wave n. */
export function waveClearBonus(wave) {
  return 15 + 4 * wave;
}

/** Seconds between spawns in wave n. */
export function waveSpawnGap(wave) {
  return Math.max(0.34, 0.9 - 0.045 * wave);
}

/**
 * The spawn list for wave n: an array of { kind, at } where `at` is the
 * seconds after the wave starts. Built from a seeded stream so the same
 * seed always deals the same wave.
 */
export function buildWave(wave, rng) {
  const list = [];
  let t = 0.4;
  const gap = waveSpawnGap(wave);
  const push = (kind, count, step) => {
    for (let i = 0; i < count; i += 1) {
      list.push({ kind, at: t });
      t += step;
    }
  };

  if (wave === TOTAL_WAVES) {
    // The final wave: escorts first, then the Ash Titan, then a last trickle.
    push('cinder', 6, gap);
    push('wisp', 6, gap * 0.8);
    push('golem', 3, gap * 1.6);
    list.push({ kind: 'boss', at: t + 1.2 });
    t += 2.0;
    push('swarm', 10, gap * 0.6);
    return list;
  }

  push('cinder', 5 + 2 * wave, gap);
  if (wave >= 3) push('wisp', wave, gap * 0.85);
  if (wave >= 4) push('swarm', 2 * wave, gap * 0.55);
  if (wave >= 5) push('golem', Math.floor(wave / 2), gap * 1.8);
  if (wave >= 8) push('wisp', Math.floor(wave / 2), gap * 0.7);
  // A little shuffle in the middle so no two waves feel identical, plus a
  // seeded jitter on the spawn times so the seed actually matters.
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = list[i];
    list[i] = list[j];
    list[j] = tmp;
  }
  // Keep the times increasing after the shuffle.
  list.sort((a, b) => a.at - b.at);
  for (let i = 0; i < list.length; i += 1) {
    list[i].at = 0.4 + i * gap * 0.92 + rng() * gap * 0.3;
  }
  return list;
}
