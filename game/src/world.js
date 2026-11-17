// Emberhold world: the pure tower-defense simulation. No DOM, no canvas,
// no Math.random — everything runs off a seeded stream, so the same seed
// always plays the same game. main.js and shots.js drive it; render.js
// only draws the state it leaves behind.

import {
  CORE,
  CORE_HP,
  ENEMIES,
  MAX_TOWER_LEVEL,
  PATH,
  PLOTS,
  SELL_REFUND,
  START_GOLD,
  TOTAL_WAVES,
  TOWERS,
  UPGRADE_DAMAGE,
  UPGRADE_RANGE,
  buildWave,
  waveClearBonus,
  waveHpScale,
  waveSpeedScale,
} from './config.js';
import { mulberry32 } from './rng.js';

export const AUTO_START_SECONDS = 12;

let nextId = 1;

/** Effective stats of a tower at its current level. */
export function towerStats(tower) {
  const base = TOWERS[tower.type];
  return {
    damage: Math.round(base.damage * Math.pow(UPGRADE_DAMAGE, tower.level - 1)),
    range: base.range + UPGRADE_RANGE * (tower.level - 1),
    rate: base.rate,
    cost: base.cost,
  };
}

/** Gold an upgrade to the next level costs. */
export function upgradeCost(tower) {
  return Math.round(TOWERS[tower.type].cost * 0.8 * tower.level);
}

/** Gold a tower sells for. */
export function sellValue(tower) {
  return Math.round(tower.invested * SELL_REFUND);
}

export function createWorld(seed) {
  const rng = mulberry32(seed);
  return {
    seed,
    rng,
    gold: START_GOLD,
    coreHp: CORE_HP,
    wave: 0,
    phase: 'build', // 'build' | 'wave' | 'won' | 'lost'
    buildTimer: 0,
    waveTime: 0,
    spawnQueue: [],
    enemies: [],
    towers: [],
    projectiles: [],
    particles: [],
    floaters: [],
    kills: 0,
    score: 0,
    time: 0,
    events: [],
  };
}

export function towerAtPlot(world, plotIndex) {
  return world.towers.find((t) => t.plot === plotIndex) || null;
}

function distance(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

/** Start the next wave. Returns false when there is no next wave. */
export function startWave(world) {
  if (world.phase !== 'build' || world.wave >= TOTAL_WAVES) return false;
  world.wave += 1;
  world.phase = 'wave';
  world.waveTime = 0;
  world.buildTimer = 0;
  world.spawnQueue = buildWave(world.wave, world.rng);
  world.events.push({ type: 'wave', wave: world.wave });
  return true;
}

/** Build a tower on a plot. Returns the tower, or null when it cannot be built. */
export function buildTower(world, plotIndex, typeKey) {
  if (world.phase === 'won' || world.phase === 'lost') return null;
  const def = TOWERS[typeKey];
  if (!def || plotIndex < 0 || plotIndex >= PLOTS.length) return null;
  if (towerAtPlot(world, plotIndex)) return null;
  if (world.gold < def.cost) {
    world.events.push({ type: 'denied' });
    return null;
  }
  world.gold -= def.cost;
  const plot = PLOTS[plotIndex];
  const tower = {
    id: nextId,
    plot: plotIndex,
    x: plot.x,
    y: plot.y,
    type: typeKey,
    level: 1,
    cooldown: 0,
    invested: def.cost,
    angle: -Math.PI / 2,
    kills: 0,
  };
  nextId += 1;
  world.towers.push(tower);
  burst(world, plot.x, plot.y, def.color, 10);
  world.events.push({ type: 'build', tower });
  return tower;
}

/** Upgrade a tower one level. Returns false when it cannot be upgraded. */
export function upgradeTower(world, tower) {
  if (!tower || tower.level >= MAX_TOWER_LEVEL) return false;
  const cost = upgradeCost(tower);
  if (world.gold < cost) {
    world.events.push({ type: 'denied' });
    return false;
  }
  world.gold -= cost;
  tower.invested += cost;
  tower.level += 1;
  burst(world, tower.x, tower.y, TOWERS[tower.type].color, 14);
  world.events.push({ type: 'upgrade', tower });
  return true;
}

/** Sell a tower for a refund. Returns the gold refunded, or 0. */
export function sellTower(world, tower) {
  if (!tower) return 0;
  const value = sellValue(tower);
  world.gold += value;
  world.towers = world.towers.filter((t) => t !== tower);
  burst(world, tower.x, tower.y, '#e5e7eb', 8);
  world.events.push({ type: 'sell', value });
  return value;
}

export function burst(world, x, y, color, count) {
  for (let i = 0; i < count; i += 1) {
    const angle = world.rng() * Math.PI * 2;
    const speed = 30 + world.rng() * 90;
    world.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.45 + world.rng() * 0.3,
      maxLife: 0.75,
      color,
      size: 2 + world.rng() * 3,
    });
  }
}

function addFloater(world, x, y, text, color) {
  world.floaters.push({ x, y, text, color, life: 1 });
}

function spawnEnemy(world, kind) {
  const def = ENEMIES[kind];
  const hp = Math.round(def.hp * waveHpScale(world.wave));
  const start = PATH[0];
  const enemy = {
    id: nextId,
    kind,
    x: start.x,
    y: start.y,
    wp: 1,
    hp,
    maxHp: hp,
    speed: Math.round(def.speed * waveSpeedScale(world.wave)),
    slowUntil: 0,
    slowFactor: 1,
    progress: 0,
    reward: def.reward,
    leak: def.leak,
    radius: def.radius,
    score: def.score,
  };
  nextId += 1;
  world.enemies.push(enemy);
}

function killEnemy(world, enemy) {
  world.enemies = world.enemies.filter((e) => e !== enemy);
  world.gold += enemy.reward;
  world.score += enemy.score;
  world.kills += 1;
  burst(world, enemy.x, enemy.y, ENEMIES[enemy.kind].color, 12);
  addFloater(world, enemy.x, enemy.y - 14, `+${enemy.reward}g`, '#ffd166');
  world.events.push({ type: 'kill', x: enemy.x, y: enemy.y });
}

function damageEnemy(world, enemy, amount) {
  enemy.hp -= amount;
  if (enemy.hp <= 0) killEnemy(world, enemy);
}

function stepEnemies(world, dt) {
  for (let i = world.enemies.length - 1; i >= 0; i -= 1) {
    const enemy = world.enemies[i];
    const slowed = world.time < enemy.slowUntil;
    const speed = enemy.speed * (slowed ? enemy.slowFactor : 1);
    let remaining = speed * dt;
    while (remaining > 0 && enemy.wp < PATH.length) {
      const target = PATH[enemy.wp];
      const dx = target.x - enemy.x;
      const dy = target.y - enemy.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= remaining) {
        enemy.x = target.x;
        enemy.y = target.y;
        enemy.progress += dist;
        remaining -= dist;
        enemy.wp += 1;
      } else {
        enemy.x += (dx / dist) * remaining;
        enemy.y += (dy / dist) * remaining;
        enemy.progress += remaining;
        remaining = 0;
      }
    }
    if (enemy.wp >= PATH.length) {
      // Reached the Lantern Core.
      world.enemies.splice(i, 1);
      world.coreHp -= enemy.leak;
      burst(world, CORE.x, CORE.y, '#ff4d4d', 16);
      addFloater(world, CORE.x - 20, CORE.y - 34, `-${enemy.leak} core`, '#ff6b6b');
      world.events.push({ type: 'leak', leak: enemy.leak });
      if (world.coreHp <= 0) {
        world.coreHp = 0;
        world.phase = 'lost';
        world.events.push({ type: 'lose', score: world.score });
      }
    }
  }
}

function stepTowers(world, dt) {
  for (const tower of world.towers) {
    tower.cooldown -= dt;
    if (tower.cooldown > 0) continue;
    const stats = towerStats(tower);
    const base = TOWERS[tower.type];
    let target = null;
    for (const enemy of world.enemies) {
      if (distance(tower.x, tower.y, enemy.x, enemy.y) > stats.range) continue;
      if (!target || enemy.progress > target.progress) target = enemy;
    }
    if (!target) continue;
    tower.angle = Math.atan2(target.y - tower.y, target.x - tower.x);
    tower.cooldown = 1 / stats.rate;
    world.projectiles.push({
      x: tower.x + Math.cos(tower.angle) * 16,
      y: tower.y + Math.sin(tower.angle) * 16,
      target,
      speed: base.projectileSpeed,
      damage: stats.damage,
      splash: base.splash || 0,
      slowFactor: base.slowFactor || 1,
      slowSeconds: base.slowSeconds || 0,
      kind: tower.type,
      color: base.color,
      tower,
    });
    world.events.push({ type: 'shoot', kind: tower.type });
  }
}

function stepProjectiles(world, dt) {
  for (let i = world.projectiles.length - 1; i >= 0; i -= 1) {
    const p = world.projectiles[i];
    const target = p.target;
    if (!target || !world.enemies.includes(target)) {
      world.projectiles.splice(i, 1);
      continue;
    }
    const dx = target.x - p.x;
    const dy = target.y - p.y;
    const dist = Math.hypot(dx, dy);
    const stepLen = p.speed * dt;
    if (dist <= Math.max(stepLen, 10)) {
      world.projectiles.splice(i, 1);
      if (p.slowSeconds > 0) {
        target.slowUntil = world.time + p.slowSeconds;
        target.slowFactor = p.slowFactor;
      }
      if (p.splash > 0) {
        burst(world, target.x, target.y, p.color, 8);
        const hit = [...world.enemies];
        for (const other of hit) {
          if (distance(target.x, target.y, other.x, other.y) <= p.splash) {
            damageEnemy(world, other, p.damage);
          }
        }
      } else {
        damageEnemy(world, target, p.damage);
      }
      if (world.enemies.includes(target) === false && p.tower) p.tower.kills += 1;
    } else {
      p.x += (dx / dist) * stepLen;
      p.y += (dy / dist) * stepLen;
    }
  }
}

function stepParticles(world, dt) {
  for (let i = world.particles.length - 1; i >= 0; i -= 1) {
    const p = world.particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      world.particles.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.96;
    p.vy *= 0.96;
  }
  for (let i = world.floaters.length - 1; i >= 0; i -= 1) {
    const f = world.floaters[i];
    f.life -= dt * 0.9;
    f.y -= 26 * dt;
    if (f.life <= 0) world.floaters.splice(i, 1);
  }
}

/** Advance the simulation by dt seconds. Events land on world.events. */
export function stepWorld(world, dt) {
  if (world.phase === 'won' || world.phase === 'lost') {
    stepParticles(world, dt);
    return;
  }
  world.time += dt;

  if (world.phase === 'build') {
    world.buildTimer += dt;
    if (world.buildTimer >= AUTO_START_SECONDS) startWave(world);
  }

  if (world.phase === 'wave') {
    world.waveTime += dt;
    while (world.spawnQueue.length > 0 && world.spawnQueue[0].at <= world.waveTime) {
      spawnEnemy(world, world.spawnQueue.shift().kind);
    }
    stepEnemies(world, dt);
    if (world.phase === 'lost') {
      stepParticles(world, dt);
      return;
    }
    stepTowers(world, dt);
    stepProjectiles(world, dt);
    if (world.spawnQueue.length === 0 && world.enemies.length === 0) {
      const bonus = waveClearBonus(world.wave);
      world.gold += bonus;
      world.score += 150;
      world.events.push({ type: 'clear', wave: world.wave, bonus });
      if (world.wave >= TOTAL_WAVES) {
        world.phase = 'won';
        world.score += world.coreHp * 25 + world.gold;
        world.events.push({ type: 'win', score: world.score });
      } else {
        world.phase = 'build';
        world.buildTimer = 0;
      }
    }
  }

  stepParticles(world, dt);
}

/** Take and clear the events queued since the last drain. */
export function drainEvents(world) {
  return world.events.splice(0, world.events.length);
}

/** Enemies still to come in the current wave, alive plus queued. */
export function waveRemaining(world) {
  return world.enemies.length + world.spawnQueue.length;
}
