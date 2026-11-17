// Emberhold renderer: everything the player sees, drawn on one canvas.
// The game logic lives in world.js; this file only reads state and draws it.
// Logical field is 960x600 (FIELD); the canvas is scaled to the window with
// letterboxing, so screenshots stay crisp at any window size.

import { CORE, CORE_HP, ENEMIES, FIELD, PATH, PLOTS, TOTAL_WAVES, TOWERS, TOWER_ORDER } from './config.js';
import { sellValue, towerStats, upgradeCost, waveRemaining } from './world.js';

const TOP_BAR = 46;
const BOTTOM_BAR = 60;
const GOLD = '#ffd166';
const CORE_RED = '#ff6b6b';

/** Scale + offset that maps logical FIELD coordinates onto the canvas. */
export function viewTransform(canvas) {
  const scale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
  const ox = (canvas.width - FIELD.width * scale) / 2;
  const oy = (canvas.height - FIELD.height * scale) / 2;
  return { scale, ox, oy };
}

/** A client (mouse) position converted into logical FIELD coordinates. */
export function toLogical(canvas, clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const { scale, ox, oy } = viewTransform(canvas);
  const px = (clientX - rect.left) * (canvas.width / Math.max(1, rect.width));
  const py = (clientY - rect.top) * (canvas.height / Math.max(1, rect.height));
  return { x: (px - ox) / scale, y: (py - oy) / scale };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawPath(ctx, time) {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // Ember glow under the road.
  ctx.strokeStyle = 'rgba(255, 122, 60, 0.20)';
  ctx.lineWidth = 56;
  tracePath(ctx);
  ctx.stroke();
  // Stone road.
  ctx.strokeStyle = '#33291c';
  ctx.lineWidth = 46;
  tracePath(ctx);
  ctx.stroke();
  ctx.strokeStyle = '#4a3a26';
  ctx.lineWidth = 38;
  tracePath(ctx);
  ctx.stroke();
  // Marching ember dashes down the centre.
  ctx.strokeStyle = 'rgba(255, 170, 80, 0.75)';
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 26]);
  ctx.lineDashOffset = -time * 24;
  tracePath(ctx);
  ctx.stroke();
  ctx.restore();
}

function tracePath(ctx) {
  ctx.beginPath();
  ctx.moveTo(PATH[0].x, PATH[0].y);
  for (let i = 1; i < PATH.length; i += 1) ctx.lineTo(PATH[i].x, PATH[i].y);
}

function drawCore(ctx, world, time) {
  const pulse = 1 + Math.sin(time * 2.4) * 0.08;
  const hpFrac = Math.max(0, world.coreHp / CORE_HP);
  const glow = ctx.createRadialGradient(CORE.x, CORE.y, 4, CORE.x, CORE.y, 64 * pulse);
  glow.addColorStop(0, 'rgba(255, 190, 90, 0.9)');
  glow.addColorStop(0.45, 'rgba(255, 122, 60, 0.35)');
  glow.addColorStop(1, 'rgba(255, 122, 60, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(CORE.x, CORE.y, 64 * pulse, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#1c1410';
  ctx.strokeStyle = hpFrac > 0.4 ? '#ffb347' : '#ff4d4d';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(CORE.x, CORE.y, CORE.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // The lantern flame.
  ctx.fillStyle = hpFrac > 0.4 ? '#ffd166' : '#ff6b6b';
  ctx.beginPath();
  ctx.ellipse(CORE.x, CORE.y - 2, 9, 13 * pulse, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff3d6';
  ctx.beginPath();
  ctx.ellipse(CORE.x, CORE.y - 2, 4, 7 * pulse, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e5e7eb';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('CORE', CORE.x, CORE.y + 42);
}

function drawPlots(ctx, world, ui) {
  for (let i = 0; i < PLOTS.length; i += 1) {
    const plot = PLOTS[i];
    const tower = world.towers.find((t) => t.plot === i);
    const hovered = ui.mouse.inside && Math.hypot(ui.mouse.x - plot.x, ui.mouse.y - plot.y) < 26;
    const selected = ui.selectedPlot === i;
    if (!tower) {
      ctx.fillStyle = hovered || selected ? '#2b3242' : '#20242e';
      ctx.strokeStyle = selected ? '#ffd166' : hovered ? '#8b95a7' : '#4b5563';
      ctx.lineWidth = selected ? 3 : 1.5;
      ctx.setLineDash(selected ? [] : [5, 5]);
      ctx.beginPath();
      ctx.arc(plot.x, plot.y, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
      if (selected || hovered) {
        ctx.fillStyle = '#9aa5b1';
        ctx.font = 'bold 16px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('+', plot.x, plot.y + 6);
      }
    }
  }
}

function drawTower(ctx, tower, time) {
  const def = TOWERS[tower.type];
  const stats = towerStats(tower);
  // Base.
  ctx.fillStyle = '#151a24';
  ctx.strokeStyle = def.dark;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(tower.x, tower.y, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Aim barrel.
  ctx.strokeStyle = def.color;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(tower.x, tower.y);
  ctx.lineTo(tower.x + Math.cos(tower.angle) * 18, tower.y + Math.sin(tower.angle) * 18);
  ctx.stroke();
  // Glyph.
  ctx.fillStyle = def.color;
  if (tower.type === 'spark') {
    ctx.beginPath();
    ctx.moveTo(tower.x, tower.y - 11);
    ctx.lineTo(tower.x + 10, tower.y + 8);
    ctx.lineTo(tower.x - 10, tower.y + 8);
    ctx.closePath();
    ctx.fill();
  } else if (tower.type === 'frost') {
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const a = (Math.PI / 3) * i - Math.PI / 6;
      const px = tower.x + Math.cos(a) * 11;
      const py = tower.y + Math.sin(a) * 11;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(tower.x, tower.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1c1410';
    ctx.beginPath();
    ctx.arc(tower.x, tower.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Level pips.
  for (let i = 0; i < tower.level; i += 1) {
    ctx.fillStyle = GOLD;
    ctx.beginPath();
    ctx.arc(tower.x - 10 + i * 10, tower.y + 26, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawEnemy(ctx, enemy, time) {
  const def = ENEMIES[enemy.kind];
  const slowed = time < enemy.slowUntil;
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  if (enemy.kind === 'golem') {
    ctx.rotate(Math.sin(time * 3 + enemy.id) * 0.06);
    ctx.fillStyle = def.color;
    ctx.strokeStyle = '#4b5563';
    ctx.lineWidth = 2;
    ctx.fillRect(-14, -14, 28, 28);
    ctx.strokeRect(-14, -14, 28, 28);
    ctx.fillStyle = '#374151';
    ctx.fillRect(-8, -8, 5, 5);
    ctx.fillRect(3, -8, 5, 5);
  } else if (enemy.kind === 'boss') {
    ctx.fillStyle = def.color;
    ctx.beginPath();
    for (let i = 0; i < 8; i += 1) {
      const a = (Math.PI / 4) * i;
      const r = i % 2 === 0 ? 30 : 20;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(-8, -4, 3.5, 0, Math.PI * 2);
    ctx.arc(8, -4, 3.5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const bob = enemy.kind === 'wisp' ? Math.sin(time * 6 + enemy.id) * 2 : 0;
    ctx.translate(0, bob);
    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#1c1410';
    ctx.beginPath();
    ctx.arc(-4, -2, 2, 0, Math.PI * 2);
    ctx.arc(4, -2, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  if (slowed) {
    ctx.strokeStyle = 'rgba(165, 200, 255, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.radius + 4, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (enemy.hp < enemy.maxHp) {
    const w = enemy.kind === 'boss' ? 52 : 30;
    const frac = Math.max(0, enemy.hp / enemy.maxHp);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(enemy.x - w / 2, enemy.y - enemy.radius - 11, w, 5);
    ctx.fillStyle = frac > 0.5 ? '#4ade80' : frac > 0.25 ? '#facc15' : '#ef4444';
    ctx.fillRect(enemy.x - w / 2, enemy.y - enemy.radius - 11, w * frac, 5);
  }
}

function drawProjectiles(ctx, world) {
  for (const p of world.projectiles) {
    ctx.strokeStyle = p.color;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x - Math.cos(Math.atan2(p.target.y - p.y, p.target.x - p.x)) * 14, p.y - Math.sin(Math.atan2(p.target.y - p.y, p.target.x - p.x)) * 14);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.kind === 'cannon' ? 6 : 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawParticles(ctx, world) {
  for (const p of world.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const f of world.floaters) {
    ctx.globalAlpha = Math.max(0, f.life);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

function button(ctx, ui, id, x, y, w, h, label, opts = {}) {
  const hovered = ui.mouse.inside && ui.mouse.x >= x && ui.mouse.x <= x + w && ui.mouse.y >= y && ui.mouse.y <= y + h;
  const active = opts.active || false;
  ctx.fillStyle = active ? '#3a2c14' : hovered ? '#2b3242' : '#1d2330';
  ctx.strokeStyle = active ? GOLD : opts.accent || '#4b5563';
  ctx.lineWidth = active ? 2.5 : 1.5;
  roundRect(ctx, x, y, w, h, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = opts.color || '#e5e7eb';
  ctx.font = `${opts.bold === false ? '' : 'bold '}${opts.fontSize || 14}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + h / 2 + (opts.fontSize || 14) / 2 - 2);
  ui.buttons[id] = { x, y, w, h };
  return hovered;
}

function drawTopBar(ctx, world, ui) {
  ctx.fillStyle = 'rgba(10, 12, 18, 0.92)';
  ctx.fillRect(0, 0, FIELD.width, TOP_BAR);
  ctx.fillStyle = '#e5e7eb';
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`WAVE ${Math.max(1, world.wave)}/${TOTAL_WAVES}`, 14, 29);
  ctx.fillStyle = GOLD;
  ctx.fillText(`◆ ${world.gold}`, 150, 29);
  ctx.fillStyle = world.coreHp > 6 ? '#fca5a5' : CORE_RED;
  ctx.fillText(`♥ ${world.coreHp}/${CORE_HP}`, 260, 29);
  ctx.fillStyle = '#e5e7eb';
  ctx.textAlign = 'right';
  ctx.fillText(`SCORE ${world.score}`, FIELD.width - 170, 29);
  ctx.fillStyle = '#9aa5b1';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText(`KILLS ${world.kills}`, FIELD.width - 290, 28);
  if (world.phase === 'wave') {
    ctx.fillStyle = '#ffb347';
    ctx.textAlign = 'left';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText(`${waveRemaining(world)} left`, 380, 29);
  }
  button(ctx, ui, 'pause', FIELD.width - 96, 8, 40, 30, ui.screen === 'paused' ? '▶' : 'II', { fontSize: 14 });
  button(ctx, ui, 'mute', FIELD.width - 48, 8, 40, 30, ui.muted ? '✕' : '♪', { fontSize: 15 });
}

function drawBottomBar(ctx, world, ui) {
  const y = FIELD.height - BOTTOM_BAR;
  ctx.fillStyle = 'rgba(10, 12, 18, 0.92)';
  ctx.fillRect(0, y, FIELD.width, BOTTOM_BAR);
  let x = 12;
  for (const key of TOWER_ORDER) {
    const def = TOWERS[key];
    const affordable = world.gold >= def.cost;
    const active = ui.selectedType === key;
    const hovered = button(ctx, ui, `tower-${key}`, x, y + 8, 168, 44, '', { active, accent: affordable ? def.color : '#4b5563' });
    ctx.textAlign = 'left';
    ctx.fillStyle = affordable ? def.color : '#6b7280';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText(`[${def.hotkey}] ${def.name}`, x + 10, y + 26);
    ctx.fillStyle = affordable ? GOLD : '#6b7280';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText(`◆ ${def.cost}  ·  ${def.damage} dmg  ·  ${def.rate}/s`, x + 10, y + 43);
    void hovered;
    x += 178;
  }
  // Wave button.
  const waveLabel = world.phase === 'wave'
    ? `WAVE ${world.wave}…`
    : world.wave >= TOTAL_WAVES
      ? 'FINAL WAVE DONE'
      : `SEND WAVE ${world.wave + 1}`;
  button(ctx, ui, 'wave', FIELD.width - 216, y + 8, 204, 44, waveLabel, {
    accent: '#ffb347',
    color: world.phase === 'wave' ? '#9aa5b1' : '#ffd166',
    fontSize: 15,
  });
}

function drawSelectedPanel(ctx, world, ui) {
  const tower = ui.selectedTower;
  if (!tower || !world.towers.includes(tower)) return;
  const def = TOWERS[tower.type];
  const stats = towerStats(tower);
  const y = FIELD.height - BOTTOM_BAR - 92;
  ctx.fillStyle = 'rgba(10, 12, 18, 0.94)';
  ctx.strokeStyle = def.color;
  ctx.lineWidth = 1.5;
  roundRect(ctx, 12, y, 330, 84, 10);
  ctx.fill();
  ctx.stroke();
  ctx.textAlign = 'left';
  ctx.fillStyle = def.color;
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.fillText(`${def.name}  ·  Lv ${tower.level}`, 24, y + 22);
  ctx.fillStyle = '#d1d5db';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(`Damage ${stats.damage}   Range ${stats.range}   Rate ${stats.rate}/s   Kills ${tower.kills}`, 24, y + 42);
  ctx.fillStyle = '#9aa5b1';
  ctx.fillText('U upgrade · X sell', 24, y + 62);
  if (tower.level < 3) {
    button(ctx, ui, 'upgrade', 200, y + 48, 62, 26, `UP ◆${upgradeCost(tower)}`, { fontSize: 11 });
  }
  button(ctx, ui, 'sell', 268, y + 48, 62, 26, `SELL ◆${sellValue(tower)}`, { fontSize: 11 });
  // Range ring.
  ctx.fillStyle = 'rgba(255, 209, 102, 0.05)';
  ctx.strokeStyle = 'rgba(255, 209, 102, 0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(tower.x, tower.y, stats.range, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function drawBuildHint(ctx, world, ui) {
  if (ui.selectedPlot === null && !ui.selectedTower) return;
  const y = FIELD.height - BOTTOM_BAR - 30;
  ctx.textAlign = 'left';
  ctx.font = '13px system-ui, sans-serif';
  if (ui.selectedPlot !== null && !world.towers.find((t) => t.plot === ui.selectedPlot)) {
    const type = ui.selectedType ? TOWERS[ui.selectedType] : null;
    ctx.fillStyle = type ? '#ffd166' : '#d1d5db';
    ctx.fillText(
      type ? `Click this plot to build a ${type.name} (◆${type.cost}) — or pick another tower below.` : 'Pick a tower below (1 / 2 / 3), then click the plot to build.',
      14,
      y,
    );
  }
  if (world.phase === 'build' && world.wave < TOTAL_WAVES) {
    const left = Math.max(0, Math.ceil(12 - world.buildTimer));
    ctx.fillStyle = '#ffb347';
    ctx.textAlign = 'right';
    ctx.fillText(`Next wave auto-sends in ${left}s — SPACE sends it now`, FIELD.width - 14, y);
  }
}

function overlay(ctx, title, lines, accent, footer) {
  ctx.fillStyle = 'rgba(5, 7, 11, 0.78)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = accent;
  ctx.font = 'bold 52px system-ui, sans-serif';
  ctx.fillText(title, FIELD.width / 2, 190);
  ctx.fillStyle = '#e5e7eb';
  ctx.font = '17px system-ui, sans-serif';
  lines.forEach((line, i) => ctx.fillText(line, FIELD.width / 2, 238 + i * 28));
  if (footer) {
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText(footer, FIELD.width / 2, 238 + lines.length * 28 + 26);
  }
}

/** Draw one frame. `ui` carries the screen and the player's selections. */
export function draw(ctx, canvas, world, ui) {
  ui.buttons = {};
  const { scale, ox, oy } = viewTransform(canvas);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0b0e14';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(scale, 0, 0, scale, ox, oy);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, FIELD.width, FIELD.height);
  ctx.clip();

  // Backdrop.
  const bg = ctx.createLinearGradient(0, 0, 0, FIELD.height);
  bg.addColorStop(0, '#171c26');
  bg.addColorStop(1, '#0d1017');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
  for (let gx = 30; gx < FIELD.width; gx += 60) {
    for (let gy = 30; gy < FIELD.height; gy += 60) {
      ctx.fillRect(gx, gy, 2, 2);
    }
  }

  drawPath(ctx, world.time);
  drawPlots(ctx, world, ui);
  drawCore(ctx, world, world.time);
  for (const tower of world.towers) drawTower(ctx, tower, world.time);
  for (const enemy of world.enemies) drawEnemy(ctx, enemy, world.time);
  drawProjectiles(ctx, world);
  drawParticles(ctx, world);
  drawSelectedPanel(ctx, world, ui);
  drawBuildHint(ctx, world, ui);
  drawTopBar(ctx, world, ui);
  drawBottomBar(ctx, world, ui);
  ctx.restore();

  if (ui.screen === 'title') {
    overlay(ctx, 'EMBERHOLD', [
      'A tower defense for the last lantern.',
      'Invaders march the ember road. Build spires on the stone plots,',
      'stop them before they reach the Core. Survive all 12 waves.',
      '',
      'Mouse: click a plot, pick a tower (1 / 2 / 3), click to build.',
      'Click a tower to upgrade (U) or sell (X). SPACE sends the next wave.',
      'P pauses · M mutes · R restarts.',
    ], '#ffb347', ui.best > 0 ? `Best score: ${ui.best}` : 'Press ENTER or click to begin');
  } else if (ui.screen === 'paused') {
    overlay(ctx, 'PAUSED', ['The ember road waits.', ''], '#a5c8ff', 'Press P or click ▶ to resume');
  } else if (ui.screen === 'won') {
    overlay(ctx, 'THE LANTERN STANDS!', [
      `All ${TOTAL_WAVES} waves broken. The road is quiet again.`,
      `Score ${world.score}  ·  Kills ${world.kills}  ·  Core ${world.coreHp}/${CORE_HP}  ·  Gold left ${world.gold}`,
      '',
    ], '#ffd166', 'Press R to defend it again');
  } else if (ui.screen === 'lost') {
    overlay(ctx, 'THE LIGHT HAS FALLEN', [
      `The Core broke on wave ${Math.max(1, world.wave)} of ${TOTAL_WAVES}.`,
      `Score ${world.score}  ·  Kills ${world.kills}`,
      '',
    ], '#ff6b6b', 'Press R to try again');
  }
}
