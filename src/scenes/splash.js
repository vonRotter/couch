import * as THREE from 'three';
import { MiniGame } from '../core/minigame.js';
import { Character } from '../core/character.js';
import { makeGrumble } from '../core/critters.js';
import { COLORS, toon, basic, sharedGeo } from '../core/palette.js';
import { addLights, skyTexture, makeCloud, seeded } from '../core/world.js';
import { t, addStrings } from '../core/i18n.js';
import { esc } from '../core/ui.js';
import { TeamPicker, TEAM_COLORS, TEAM_CSS, helpersNeeded } from '../core/teams.js';

addStrings({
  en: {
    'game.splash': 'Splash Squad',
    'splash.intro': 'Take turns! Stick: walk and aim · A: jump · C: change tool · hold B for power, let go to throw',
    'splash.turn': "{name}'s turn!",
    'splash.turnPill': "{name}'s turn",
    'splash.turnOf': 'Turn {n}/{m}',
    'splash.lastTurn': 'Last turn!',
    'splash.wind': 'Wind',
    'splash.tool.balloon': 'Water balloon',
    'splash.tool.bouncy': 'Bouncy ball',
    'splash.tool.girder': 'Candy plank',
    'splash.tool.bubble': 'Big bubble',
    'splash.hint.throw': 'hold B, let go to throw',
    'splash.hint.girder': 'stick up/down tilts · B places',
    'splash.hint.bubble': 'short range · B blows',
    'splash.hint.used': 'one plank per turn',
    'splash.timeUp': "Time's up!",
    'splash.cold': 'Brr, too cold!',
    'splash.blocked': 'No room there!',
    'splash.soaked': 'SOAKED!',
    'splash.bubbled': 'Bubbled!',
    'splash.dunk': 'Splash! {name} took a swim',
    'splash.bot': 'Grumble Bot {n}',
    'splash.points': '{n} points', 'splash.point1': '1 point',
    'splash.detail': '{team} · {h} · {d}',
    'splash.hits': '{n} splashes', 'splash.hit1': '1 splash',
    'splash.dunks': '{n} dunks', 'splash.dunk1': '1 dunk',
  },
  no: {
    'game.splash': 'Plaskeslaget',
    'splash.intro': 'Bytt på! Pinnen: gå og sikt · A: hopp · C: bytt verktøy · hold B for kraft, slipp for å kaste',
    'splash.turn': '{name} sin tur!',
    'splash.turnPill': '{name} sin tur',
    'splash.turnOf': 'Tur {n}/{m}',
    'splash.lastTurn': 'Siste tur!',
    'splash.wind': 'Vind',
    'splash.tool.balloon': 'Vannballong',
    'splash.tool.bouncy': 'Sprettball',
    'splash.tool.girder': 'Godteplanke',
    'splash.tool.bubble': 'Kjempeboble',
    'splash.hint.throw': 'hold B, slipp for å kaste',
    'splash.hint.girder': 'pinnen opp/ned vipper · B setter ned',
    'splash.hint.bubble': 'kort rekkevidde · B blåser',
    'splash.hint.used': 'én planke per tur',
    'splash.timeUp': 'Tiden er ute!',
    'splash.cold': 'Brr, for kaldt!',
    'splash.blocked': 'Ikke plass der!',
    'splash.soaked': 'GJENNOMBLØTT!',
    'splash.bubbled': 'Boblet!',
    'splash.dunk': 'Plask! {name} tok seg en dukkert',
    'splash.bot': 'Grumlebot {n}',
    'splash.points': '{n} poeng', 'splash.point1': '1 poeng',
    'splash.detail': '{team} · {h} · {d}',
    'splash.hits': '{n} plask', 'splash.hit1': '1 plask',
    'splash.dunks': '{n} dukkerter', 'splash.dunk1': '1 dukkert',
  },
});

// Splash Squad: a turn-based Worms-style water fight on a destructible cookie island.
// Two teams take turns; the active bean walks, aims and throws water balloons. Splashes bite
// craters out of the cookie and knock beans around. Points: +1 per opponent splashed, +2 when
// an opponent gets soaked (wet meter full) and +2 when someone drops in the sea. Beans that fall
// in float straight back to the island in a bubble, so nobody ever sits out.

// Terrain grid in world units (side view: x right, y up, the island stands in the z = 0 plane).
const X0 = -24, X1 = 24, Y0 = -3, Y1 = 15;
const CELL = 0.125;
const GW = Math.round((X1 - X0) / CELL);
const GH = Math.round((Y1 - Y0) / CELL);
const PXU = 28; // canvas pixels per world unit
const TW = Math.round((X1 - X0) * PXU), TH = Math.round((Y1 - Y0) * PXU);
const SEA_Y = 0;
const G = 13; // gravity for beans and throws
const PH = 1 / 120; // fixed physics step for projectiles (the bot solver uses the same one)

const TURN_TIME = 20;
const OVERVIEW_T = 1.6; // zoomed-out look at the island before each turn
const MATCH_CAP = 330; // seconds; the match ends after the current pair of turns once this passes
const WALK = 2.3;
const JUMP_VY = 6.8, JUMP_VX = 3.2;
const MAX_WIND = 4.5;
const AIM_MIN = -1.3, AIM_MAX = 1.45, AIM_SPEED = 1.4;
const CHARGE_T = 1.25; // seconds from empty to full power
const FULL_HOLD = 0.45; // a full meter throws on its own after this
const MIN_SPEED = 5, MAX_SPEED = 20;
const BEAN_CY = 0.52, BEAN_R = 0.42; // collision circle center above the feet, radius
const HIT_R = 0.62; // projectile vs bean center
const GIRDER_L = 3.2, GIRDER_T = 0.4, GIRDER_D = 2.5;

const TOOLS = ['balloon', 'bouncy', 'girder', 'bubble'];
const TOOL = {
  balloon: { radius: 1.55, knock: 8, soggy: 34, wind: 1 },
  bouncy: { radius: 1.3, knock: 7.2, soggy: 30, wind: 0.5, bounces: 3, fuse: 3 },
  bubble: { wind: 0.3, speed: 6.5, life: 1.0 },
};

const FROST = { light: [255, 240, 248], base: [255, 159, 208], dark: [224, 103, 159] };
const FROST_PLAT = { light: [240, 255, 247], base: [159, 240, 200], dark: [79, 191, 138] };
const COOKIE = [224, 164, 100], COOKIE_DEEP = [201, 141, 85], COOKIE_EDGE = [122, 74, 44];
const CREAM = [255, 244, 224], CRUMB_L = [240, 197, 140], CRUMB_D = [184, 122, 72];
const SPRINKLES = ['#ff5d73', '#ffc93c', '#4cc9f0', '#3ddc97', '#9b5de5', '#ffffff'];

const clamp = THREE.MathUtils.clamp;
const smooth = (a, b, x) => { const k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
const pxOf = (x) => (x - X0) * PXU;
const pyOf = (y) => (Y1 - y) * PXU;
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5; // roughly -1..1, centered
const speedOf = (power) => MIN_SPEED + power * (MAX_SPEED - MIN_SPEED);
const waveY = (x, tm) => 0.12 * Math.sin(x * 0.6 + tm * 1.6) + 0.06 * Math.sin(x * 1.7 - tm * 2.3);

const ICONS = {
  balloon: '<svg viewBox="0 0 24 24" width="1.6em" height="1.6em"><path d="M12 2c4.4 0 7 3.4 7 7.2 0 4.3-3.6 8-7 8.3-3.4-.3-7-4-7-8.3C5 5.4 7.6 2 12 2z" fill="#4cc9f0" stroke="#2b2340" stroke-width="1.2"/><path d="M10.5 17.4h3L12 19.6z" fill="#4cc9f0" stroke="#2b2340" stroke-width="1"/><ellipse cx="9" cy="7" rx="1.5" ry="2.1" fill="#fff" opacity=".85"/></svg>',
  bouncy: '<svg viewBox="0 0 24 24" width="1.6em" height="1.6em"><circle cx="12" cy="12" r="8.5" fill="#ff9fd0" stroke="#2b2340" stroke-width="1.2"/><path d="M3.8 10.6c5 2.6 11.4 2.6 16.4 0" stroke="#fff" stroke-width="2.6" fill="none"/><circle cx="8.6" cy="7.4" r="1.5" fill="#fff"/></svg>',
  girder: '<svg viewBox="0 0 24 24" width="1.6em" height="1.6em"><g transform="rotate(-25 12 12)"><rect x="2" y="9" width="20" height="6" rx="3" fill="#fff8f0" stroke="#2b2340" stroke-width="1.2"/><path d="M7 9.6l-2.4 4.8M11.5 9.6l-2.4 4.8M16 9.6l-2.4 4.8M20.5 9.6l-2.4 4.8" stroke="#ff5d73" stroke-width="2"/></g></svg>',
  bubble: '<svg viewBox="0 0 24 24" width="1.6em" height="1.6em"><circle cx="12" cy="12" r="9" fill="#bfe9ff" fill-opacity=".6" stroke="#4cc9f0" stroke-width="1.6"/><path d="M7 9.5a6 6 0 0 1 4-3.6" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
};

// ---------- destructible cookie terrain ----------

/**
 * A boolean grid for physics plus a painted canvas for looks. Both start from the same smooth
 * shape (rolling hills + two floating candy ledges); craters and planks update both.
 */
class Terrain {
  constructor(seed) {
    const r = seeded(seed);
    const ph = [r() * 6.28, r() * 6.28, r() * 6.28, r() * 6.28, r() * 6.28];
    const a1 = 1.1 + r() * 0.8, a2 = 0.5 + r() * 0.6;
    this.surf = (x) => {
      const e = smooth(15.5, 20.5, Math.abs(x));
      // A gentle valley in the middle keeps the two teams from staring straight into a wall.
      let h = 4.3 + a1 * Math.sin(x * 0.27 + ph[0]) + a2 * Math.sin(x * 0.61 + ph[1]) + 0.45 * Math.sin(x * 1.33 + ph[2]);
      h -= 1.3 * Math.exp(-(x * x) / 10);
      h = clamp(h, 1.8, 8);
      return h * (1 - e) + (Y0 - 1) * e;
    };
    this.drip = (x) => 0.45 + 0.26 * Math.max(0, Math.sin(x * 2.3 + ph[3])) ** 6 + 0.12 * Math.max(0, Math.sin(x * 5.1 + ph[4])) ** 4;
    // Two floating ledges, one over each half, a little above the hills.
    this.plats = [-1, 1].map((s) => {
      const x = s * (5 + r() * 5);
      let top = -9;
      for (let k = -2.4; k <= 2.4; k += 0.2) top = Math.max(top, this.surf(x + k));
      return { x, y: top + 3.1 + r() * 0.6, rx: 2.3, ry: 0.55 };
    });

    this.cells = new Uint8Array(GW * GH);
    for (let cy = 0; cy < GH; cy++) {
      const y = Y0 + (cy + 0.5) * CELL;
      for (let cx = 0; cx < GW; cx++) {
        if (this.shapeDepth(X0 + (cx + 0.5) * CELL, y) >= 0) this.cells[cy * GW + cx] = 1;
      }
    }

    this.canvas = document.createElement('canvas');
    this.canvas.width = TW;
    this.canvas.height = TH;
    this.ctx = this.canvas.getContext('2d');
    this.paint(r);
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
  }

  /** Depth below the original shape's top at (x, y), or -1 for air. Platforms report negative-or-positive by kind. */
  shapeDepth(x, y) {
    const h = this.surf(x);
    if (y < h && y > Y0) return h - y;
    for (const p of this.plats) {
      const dx = (x - p.x) / p.rx;
      if (Math.abs(dx) >= 1) continue;
      const hh = p.ry * Math.sqrt(1 - dx * dx);
      if (Math.abs(y - p.y) < hh) return p.y + hh - y;
    }
    return -1;
  }

  inPlat(x) {
    return this.plats.some((p) => Math.abs(x - p.x) < p.rx);
  }

  /** Paint frosting, layer-cake cookie, chocolate chips and sprinkles from the smooth shape. */
  paint(r) {
    const { ctx } = this;
    const img = ctx.createImageData(TW, TH);
    const D = img.data;
    const OUT = 2.2 / PXU; // outline thickness
    for (let py = 0; py < TH; py++) {
      const y = Y1 - (py + 0.5) / PXU;
      for (let px = 0; px < TW; px++) {
        const x = X0 + (px + 0.5) / PXU;
        const d = this.shapeDepth(x, y);
        if (d < 0) continue;
        const plat = this.shapeDepth(x, y) >= 0 && y > this.surf(x) + 0.01;
        const fr = plat ? FROST_PLAT : FROST;
        const edge = this.shapeDepth(x - OUT, y) < 0 || this.shapeDepth(x + OUT, y) < 0 || this.shapeDepth(x, y + OUT) < 0 || this.shapeDepth(x, y - OUT) < 0;
        const ft = plat ? 0.32 : this.drip(x);
        let c;
        if (edge) c = d < ft ? fr.dark : COOKIE_EDGE;
        else if (d < 0.09) c = fr.light;
        else if (d < ft - 0.06) c = fr.base;
        else if (d < ft) c = fr.dark;
        else {
          const band = ((y + 20.6) % 2.3 + 2.3) % 2.3;
          if (!plat && band < 0.3) c = CREAM;
          else if (!plat && band < 0.38) c = fr.base;
          else {
            const n = Math.abs(Math.sin(px * 12.9898 + py * 78.233) * 43758.5453) % 1;
            c = n > 0.965 ? CRUMB_L : n < 0.025 ? CRUMB_D : y < SEA_Y + 0.6 ? COOKIE_DEEP : COOKIE;
          }
        }
        const i = (py * TW + px) * 4;
        D[i] = c[0]; D[i + 1] = c[1]; D[i + 2] = c[2]; D[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);

    // Chocolate chips deep in the cookie.
    for (let k = 0; k < 150; k++) {
      const x = X0 + 4 + r() * (X1 - X0 - 8), y = Y0 + r() * (Y1 - Y0);
      const d = this.shapeDepth(x, y);
      if (d < 0.95) continue;
      const rad = (0.1 + r() * 0.09) * PXU;
      ctx.fillStyle = '#6b3f22';
      ctx.beginPath(); ctx.ellipse(pxOf(x), pyOf(y), rad, rad * 0.8, r() * 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#9a6440';
      ctx.beginPath(); ctx.arc(pxOf(x) - rad * 0.3, pyOf(y) - rad * 0.3, rad * 0.3, 0, Math.PI * 2); ctx.fill();
    }
    // Sprinkles on the frosting.
    for (let k = 0; k < 340; k++) {
      const x = X0 + 2 + r() * (X1 - X0 - 4);
      let top = this.surf(x);
      if (r() < 0.25 && this.inPlat(x)) {
        const p = this.plats.find((q) => Math.abs(x - q.x) < q.rx);
        const dx = (x - p.x) / p.rx;
        top = p.y + p.ry * Math.sqrt(1 - dx * dx);
      }
      if (top < SEA_Y + 0.3) continue;
      const y = top - 0.12 - r() * 0.22;
      if (this.shapeDepth(x, y) < 0.1) continue;
      ctx.save();
      ctx.translate(pxOf(x), pyOf(y));
      ctx.rotate(r() * Math.PI);
      ctx.fillStyle = SPRINKLES[Math.floor(r() * SPRINKLES.length)];
      ctx.beginPath(); ctx.roundRect(-0.11 * PXU, -0.035 * PXU, 0.22 * PXU, 0.07 * PXU, 0.035 * PXU); ctx.fill();
      ctx.restore();
    }
  }

  solid(x, y) {
    const cx = Math.floor((x - X0) / CELL), cy = Math.floor((y - Y0) / CELL);
    if (cx < 0 || cy < 0 || cx >= GW || cy >= GH) return false;
    return this.cells[cy * GW + cx] !== 0;
  }

  /** Outward surface normal near (x, y): points away from the solid cells around it. */
  normal(x, y, rad = 0.45) {
    let nx = 0, ny = 0;
    for (const rr of [rad * 0.5, rad]) {
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        const ox = Math.cos(a), oy = Math.sin(a);
        if (this.solid(x + ox * rr, y + oy * rr)) { nx -= ox; ny -= oy; }
      }
    }
    const l = Math.hypot(nx, ny);
    return l < 1e-4 ? { x: 0, y: 1 } : { x: nx / l, y: ny / l };
  }

  /** Top of the highest solid cell in this column (or -Infinity). */
  top(x) {
    const cx = Math.floor((x - X0) / CELL);
    if (cx < 0 || cx >= GW) return -Infinity;
    for (let cy = GH - 1; cy >= 0; cy--) if (this.cells[cy * GW + cx]) return Y0 + (cy + 1) * CELL;
    return -Infinity;
  }

  /** Is there any ground above the waterline below this point? */
  groundBelow(x, y) {
    for (let yy = y; yy > SEA_Y + 0.15; yy -= CELL) if (this.solid(x, yy)) return true;
    return false;
  }

  count() {
    let n = 0;
    for (let i = 0; i < this.cells.length; i++) n += this.cells[i];
    return n;
  }

  /** Bite a round crater out of the cookie (grid + canvas, with a darker crumb rim). */
  crater(x, y, rad) {
    const c0 = Math.max(0, Math.floor((x - rad - X0) / CELL)), c1 = Math.min(GW - 1, Math.ceil((x + rad - X0) / CELL));
    const r0 = Math.max(0, Math.floor((y - rad - Y0) / CELL)), r1 = Math.min(GH - 1, Math.ceil((y + rad - Y0) / CELL));
    for (let cy = r0; cy <= r1; cy++) {
      for (let cx = c0; cx <= c1; cx++) {
        const dx = X0 + (cx + 0.5) * CELL - x, dy = Y0 + (cy + 0.5) * CELL - y;
        if (dx * dx + dy * dy <= rad * rad) this.cells[cy * GW + cx] = 0;
      }
    }
    const { ctx } = this;
    const px = pxOf(x), py = pyOf(y);
    const circle = (rr) => { ctx.beginPath(); ctx.arc(px, py, rr * PXU, 0, Math.PI * 2); ctx.fill(); };
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = '#c98a52'; circle(rad + 0.34);
    ctx.fillStyle = '#7a4a2c'; circle(rad + 0.1);
    ctx.globalCompositeOperation = 'destination-out';
    circle(rad);
    ctx.restore();
    this.texture.needsUpdate = true;
  }

  /** Add a candy-striped plank (solid) centered at (x, y), tilted by ang. */
  plank(x, y, ang) {
    const cs = Math.cos(ang), sn = Math.sin(ang);
    const ext = GIRDER_L / 2 + GIRDER_T;
    const c0 = Math.max(0, Math.floor((x - ext - X0) / CELL)), c1 = Math.min(GW - 1, Math.ceil((x + ext - X0) / CELL));
    const r0 = Math.max(0, Math.floor((y - ext - Y0) / CELL)), r1 = Math.min(GH - 1, Math.ceil((y + ext - Y0) / CELL));
    for (let cy = r0; cy <= r1; cy++) {
      for (let cx = c0; cx <= c1; cx++) {
        const dx = X0 + (cx + 0.5) * CELL - x, dy = Y0 + (cy + 0.5) * CELL - y;
        const u = dx * cs + dy * sn, v = -dx * sn + dy * cs;
        if (Math.abs(u) <= GIRDER_L / 2 && Math.abs(v) <= GIRDER_T / 2) this.cells[cy * GW + cx] = 1;
      }
    }
    const { ctx } = this;
    const w = GIRDER_L * PXU, h = GIRDER_T * PXU;
    ctx.save();
    ctx.translate(pxOf(x), pyOf(y));
    ctx.rotate(-ang);
    ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, h / 2);
    ctx.fillStyle = '#fff8f0'; ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = '#ff5d73';
    for (let sx = -w / 2 - h; sx < w / 2 + h; sx += h * 1.3) {
      ctx.beginPath(); ctx.moveTo(sx, -h / 2); ctx.lineTo(sx + h * 0.55, -h / 2); ctx.lineTo(sx - h * 0.05, h / 2); ctx.lineTo(sx - h * 0.6, h / 2); ctx.fill();
    }
    ctx.restore();
    ctx.lineWidth = 3; ctx.strokeStyle = '#8a2c44';
    ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, h / 2); ctx.stroke();
    ctx.restore();
    this.texture.needsUpdate = true;
  }
}

/** One fixed physics step for a thrown thing. Shared by real throws and the bot's aim solver. */
function stepProj(ter, p, h, wind) {
  p.t += h;
  p.vx += wind * p.windK * h;
  if (p.kind === 'bubble') {
    // Bubbles drift: they slow down and rise a little instead of falling.
    const k = Math.max(0, 1 - 1.3 * h);
    p.vx *= k; p.vy = p.vy * k + 0.8 * h;
  } else p.vy -= G * h;
  const nx = p.x + p.vx * h, ny = p.y + p.vy * h;
  if (ny < SEA_Y - 0.1 || nx < X0 - 8 || nx > X1 + 8) { p.x = nx; p.y = ny; return 'sea'; }
  if (ter.solid(nx, ny)) {
    if (p.kind === 'bubble') return 'fizzle';
    if (p.kind === 'bouncy' && p.bounces > 0) {
      const n = ter.normal(nx, ny, 0.35);
      const vn = p.vx * n.x + p.vy * n.y;
      if (vn < 0) { p.vx -= 1.62 * vn * n.x; p.vy -= 1.62 * vn * n.y; }
      p.vx *= 0.92; p.vy *= 0.92;
      p.bounces--;
      if (Math.hypot(p.vx, p.vy) < 2.5) return 'pop';
      return 'bounce';
    }
    p.x = nx; p.y = ny;
    return 'pop';
  }
  p.x = nx; p.y = ny;
  if (p.kind === 'bouncy' && p.t > TOOL.bouncy.fuse) return 'pop';
  if (p.kind === 'bubble' && p.t > TOOL.bubble.life) return 'fizzle';
  return null;
}

/** A grumble dressed up to behave like a Character (for the bots). */
function grumbleBody(color) {
  const group = new THREE.Group();
  const critter = makeGrumble(color);
  group.add(critter);
  return {
    group, pivot: critter, yaw: 0, targetYaw: 0, sq: 1, sqVel: 0, walk: 0,
    faceSide(d) { this.targetYaw = d >= 0 ? 0.9 : -0.9; },
    squash(a) { this.sq = a; this.sqVel = 0; },
    update(dt, { moving = 0 } = {}) {
      this.walk += dt * (5 + moving * 10);
      critter.position.y = Math.abs(Math.sin(this.walk)) * 0.08 * moving;
      this.sqVel += ((1 - this.sq) * 300 - this.sqVel * 15) * dt;
      this.sq += this.sqVel * dt;
      const s = clamp(this.sq, 0.55, 1.5);
      critter.scale.set(1 / Math.sqrt(s), s, 1 / Math.sqrt(s));
      let d = this.targetYaw - this.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yaw += d * Math.min(1, dt * 12);
      group.rotation.y = this.yaw;
    },
  };
}

export class SplashScene extends MiniGame {
  constructor(game, opts) {
    super(game, opts);
    this.camera.fov = 40;
    this.camera.far = 500;
    this.camera.updateProjectionMatrix();
    this.scene.background = skyTexture('#86d8ff', '#fff1f6');
    addLights(this.scene, { size: 30, target: new THREE.Vector3(0, 4, 0), dir: new THREE.Vector3(-0.4, 1, 0.8) });

    this.terrain = new Terrain((Math.random() * 1e9) | 0);
    this.score = [0, 0];
    this.projectiles = [];
    this.floaters = [];
    this.decor = [];
    this.projAcc = 0;
    this.wind = 0;
    this.turnNo = 0;
    this.phase = 'wait';
    this.phaseT = 0;
    this.turnLeft = TURN_TIME;
    this.cam = { x: 0, y: 5.5, w: 42 };
    this.camGoal = { x: 0, y: 5.5, w: 42 };
    this.buildWorld();

    // One controller per player; 1-2 players get two beans each so it feels like Worms.
    const per = this.players.length <= 2 ? 2 : 1;
    this.ctrls = this.players.map((p, i) => this.makeCtrl(p, i % 2));
    for (const c of this.ctrls) for (let k = 0; k < per; k++) this.makeUnit(c);
    this.placeUnits();
    this.frame();
    game.audio.playMusic('party');

    const begin = () => {
      this.addBots();
      this.placeUnits();
      this.intro(t('game.splash'), t('splash.intro'));
    };
    if (opts.coop) {
      // Story campaign style: all players on one side against helper bots.
      for (const c of this.ctrls) this.setTeam(c, 0);
      begin();
    } else {
      this.state = 'teams';
      this.picker = new TeamPicker(this, {
        title: () => t('game.splash'),
        ents: this.ctrls,
        setTeam: (c, team) => this.setTeam(c, team),
        onChange: () => this.placeUnits(),
        onDone: () => { this.picker = null; begin(); },
      });
    }
  }

  onLanguage() {
    this.picker?.render();
  }

  // ---------- world ----------

  buildWorld() {
    const ter = this.terrain;
    const W = X1 - X0, H = Y1 - Y0;
    const geo = new THREE.PlaneGeometry(W, H);
    // The painted cookie slab: one front face and a few darker copies behind it for thickness.
    const front = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: ter.texture, alphaTest: 0.5 }));
    front.position.set((X0 + X1) / 2, (Y0 + Y1) / 2, -0.45);
    this.scene.add(front);
    const tint = new THREE.Color();
    for (let i = 0; i < 8; i++) {
      tint.setRGB(0.9 - i * 0.035, 0.85 - i * 0.04, 0.85 - i * 0.04);
      const back = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: ter.texture, alphaTest: 0.5, color: tint.clone() }));
      back.position.set((X0 + X1) / 2, (Y0 + Y1) / 2 + 0.018 * (i + 1), -0.6 - i * 0.13);
      this.scene.add(back);
    }

    // Sea: a far flat sea for the horizon and a see-through front sheet with gentle waves.
    const far = new THREE.Mesh(new THREE.PlaneGeometry(600, 160), basic(COLORS.waterDeep));
    far.rotation.x = -Math.PI / 2;
    far.position.set(0, -0.2, -80);
    this.scene.add(far);
    const seaGeo = new THREE.PlaneGeometry(160, 12, 160, 1);
    this.sea = new THREE.Mesh(seaGeo, new THREE.MeshBasicMaterial({ color: COLORS.water, transparent: true, opacity: 0.8, depthWrite: false }));
    this.sea.position.set(0, -6, 0.9);
    this.sea.renderOrder = 2;
    this.scene.add(this.sea);
    this.foam = new THREE.Mesh(new THREE.PlaneGeometry(160, 0.2, 160, 1), basic(COLORS.white));
    this.foam.position.set(0, 0, 0.92);
    this.foam.renderOrder = 3;
    this.scene.add(this.foam);
    this.seaTop = [];
    const pos = seaGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) if (pos.getY(i) > 0) this.seaTop.push(i);

    // A little dock on each shore (where floating beans get fished out... just for looks).
    for (const s of [-1, 1]) {
      const dock = new THREE.Group();
      for (let k = 0; k < 4; k++) {
        const plank = new THREE.Mesh(sharedGeo('spDock', () => new THREE.BoxGeometry(0.55, 0.14, 1.6)), toon(k % 2 ? 0xc98a52 : 0xb87a48));
        plank.position.set(k * 0.6, 0.45, 0);
        dock.add(plank);
      }
      for (const k of [0, 3]) {
        const post = new THREE.Mesh(sharedGeo('spPost', () => new THREE.CylinderGeometry(0.12, 0.12, 1.4, 8)), toon(0x8a5a36));
        post.position.set(k * 0.6, -0.1, 0.65);
        dock.add(post);
      }
      dock.position.set(s * 21.2 - (s > 0 ? 0 : 1.8), 0, -0.2);
      this.scene.add(dock);
    }

    // Candy decorations planted along the frosting (behind the beans).
    const r = seeded(7);
    for (let x = -16.5; x < 16.5; x += 1.6 + r() * 1.9) {
      const y = ter.surf(x);
      if (y < SEA_Y + 0.6) continue;
      const d = this.makeCandy(r);
      d.position.set(x, y - 0.12, -0.52 - r() * 0.06);
      this.scene.add(d);
      this.decor.push({ mesh: d, x, y: y - 0.12, vy: 0, falling: false });
    }

    // Background: clouds, far candy islands.
    this.clouds = [];
    for (let i = 0; i < 9; i++) {
      const c = makeCloud(r, 1.4 + r() * 1.6);
      c.position.set(-70 + i * 17 + r() * 6, 11 + r() * 9, -40 - r() * 20);
      this.scene.add(c);
      this.clouds.push(c);
    }
    for (let i = 0; i < 6; i++) {
      const isle = new THREE.Mesh(sharedGeo('spIsle', () => new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2)), toon([COLORS.candyPink, COLORS.candyMint, COLORS.candyLilac][i % 3]));
      isle.scale.set(5 + r() * 6, 2 + r() * 2.5, 3);
      isle.position.set(-80 + i * 32 + r() * 10, -0.2, -100 - r() * 20);
      this.scene.add(isle);
    }

    // Turn arrow, aim dots, plank preview and the bubble look.
    this.arrow = new THREE.Mesh(sharedGeo('spArrow', () => new THREE.ConeGeometry(0.28, 0.5, 4)), toon(COLORS.white));
    this.arrow.rotation.x = Math.PI;
    this.arrow.visible = false;
    this.scene.add(this.arrow);
    this.dots = [];
    for (let i = 0; i < 9; i++) {
      const dot = new THREE.Mesh(sharedGeo('spDot', () => new THREE.SphereGeometry(0.08, 8, 6)), basic(COLORS.white));
      dot.visible = false;
      this.scene.add(dot);
      this.dots.push(dot);
    }
    this.okMat = new THREE.MeshBasicMaterial({ color: 0x3ddc97, transparent: true, opacity: 0.55, depthWrite: false });
    this.badMat = new THREE.MeshBasicMaterial({ color: 0xff5d73, transparent: true, opacity: 0.55, depthWrite: false });
    this.preview = new THREE.Mesh(sharedGeo('spPlank', () => new THREE.BoxGeometry(GIRDER_L, GIRDER_T, 0.5)), this.okMat);
    this.preview.visible = false;
    this.scene.add(this.preview);
    this.bubbleMat = toon(0xbfe9ff, { transparent: true, opacity: 0.42 });
  }

  makeCandy(r) {
    const g = new THREE.Group();
    const kind = Math.floor(r() * 4);
    const col = [COLORS.candyPink, COLORS.candyBlue, COLORS.candyYellow, COLORS.candyMint, COLORS.candyLilac][Math.floor(r() * 5)];
    if (kind === 0) { // lollipop
      const stick = new THREE.Mesh(sharedGeo('spStick', () => new THREE.CylinderGeometry(0.05, 0.05, 1.3, 6)), toon(COLORS.white));
      stick.position.y = 0.65;
      const disc = new THREE.Mesh(sharedGeo('spLolly', () => new THREE.CylinderGeometry(0.42, 0.42, 0.14, 20)), toon(col));
      disc.rotation.x = Math.PI / 2;
      disc.position.y = 1.4;
      const swirl = new THREE.Mesh(sharedGeo('spSwirl', () => new THREE.TorusGeometry(0.24, 0.05, 6, 20)), toon(COLORS.white));
      swirl.position.set(0, 1.4, 0.08);
      g.add(stick, disc, swirl);
    } else if (kind === 1) { // gumdrop
      const drop = new THREE.Mesh(sharedGeo('spGum', () => new THREE.SphereGeometry(0.4, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2)), toon(col));
      drop.scale.y = 1.3;
      g.add(drop);
      for (let k = 0; k < 4; k++) {
        const s = new THREE.Mesh(sharedGeo('spSugar', () => new THREE.BoxGeometry(0.06, 0.06, 0.06)), toon(COLORS.white));
        s.position.set(Math.cos(k * 1.7) * 0.25, 0.2 + (k % 2) * 0.18, Math.sin(k * 1.7) * 0.25);
        g.add(s);
      }
    } else if (kind === 2) { // candy cane
      const cane = new THREE.Mesh(sharedGeo('spCane', () => new THREE.CylinderGeometry(0.08, 0.08, 1.2, 8)), toon(0xff5d73));
      cane.position.y = 0.6;
      const hook = new THREE.Mesh(sharedGeo('spHook', () => new THREE.TorusGeometry(0.22, 0.08, 8, 14, Math.PI)), toon(0xff5d73));
      hook.position.set(0.22, 1.2, 0);
      for (let k = 0; k < 3; k++) {
        const band = new THREE.Mesh(sharedGeo('spBand', () => new THREE.CylinderGeometry(0.085, 0.085, 0.1, 8)), toon(COLORS.white));
        band.position.y = 0.25 + k * 0.32;
        g.add(band);
      }
      g.add(cane, hook);
    } else { // cherry on a little cream swirl
      const cream = new THREE.Mesh(sharedGeo('spCream', () => new THREE.ConeGeometry(0.4, 0.55, 12)), toon(COLORS.cream));
      cream.position.y = 0.27;
      const cherry = new THREE.Mesh(sharedGeo('spCherry', () => new THREE.SphereGeometry(0.17, 12, 8)), toon(0xff3b5c));
      cherry.position.y = 0.66;
      g.add(cream, cherry);
    }
    g.rotation.y = (r() - 0.5) * 0.6;
    return g;
  }

  // ---------- teams, controllers and beans ----------

  makeCtrl(p, team, botNo = 0) {
    return {
      p, bot: !p, team, units: [], unitIdx: 0, tool: 0,
      color: p ? p.color : TEAM_COLORS[team],
      get css() { return p ? p.css : TEAM_CSS[this.team]; },
      get name() { return p ? p.name : t('splash.bot', { n: botNo }); },
      points: 0, hits: 0, dunks: 0, soaks: 0, throws: 0,
    };
  }

  setTeam(c, team) {
    c.team = team;
    for (const u of c.units) u.ring.material = toon(TEAM_COLORS[team]);
  }

  makeUnit(ctrl) {
    const ch = ctrl.p ? new Character(ctrl.p.color, { hat: ctrl.p.hat }) : grumbleBody(TEAM_COLORS[ctrl.team]);
    this.scene.add(ch.group);
    // A swim ring in the team color around the waist.
    const ring = new THREE.Mesh(sharedGeo('spRing', () => new THREE.TorusGeometry(0.45, 0.12, 8, 22)), toon(TEAM_COLORS[ctrl.team]));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = ctrl.p ? 0.4 : 0.32;
    ch.pivot.add(ring);
    // The thing in hand while aiming.
    const hold = new THREE.Mesh(sharedGeo('spHold', () => new THREE.SphereGeometry(0.18, 12, 9)), toon(0x4cc9f0));
    hold.position.set(0.5, 0.75, 0.25);
    hold.visible = false;
    ch.group.add(hold);
    const bubble = new THREE.Mesh(sharedGeo('spBubble', () => new THREE.SphereGeometry(0.85, 20, 14)), this.bubbleMat || toon(0xbfe9ff, { transparent: true, opacity: 0.42 }));
    bubble.visible = false;
    bubble.renderOrder = 4;
    this.scene.add(bubble);
    const label = this.game.ui.label('label player-tag');
    const u = {
      ctrl, ch, ring, hold, bubble, label, labelHtml: '',
      x: 0, y: 5, vx: 0, vy: 0, grounded: true, facing: 1, still: 0,
      aim: 0.6, power: 0, charging: false, fullT: 0, walking: 0,
      soggy: 0, rescue: null, float: null, lastHitBy: null, drip: 0,
      head: ctrl.p ? 1.3 : 1.05,
      get team() { return ctrl.team; },
    };
    ctrl.units.push(u);
    (this.units ||= []).push(u);
    return u;
  }

  /** Helper bots fill out the smaller team so both sides have the same number of beans. */
  addBots() {
    const need = helpersNeeded(this.ctrls);
    if (this.ctrls.length === 1) need[1 - this.ctrls[0].team] = 2; // solo: two grumble bots
    const unitsOf = (team) => this.units.filter((u) => u.team === team).length;
    let botNo = 1;
    [0, 1].forEach((team) => {
      const n = need[team];
      if (!n) return;
      const gap = Math.max(n, unitsOf(1 - team) - unitsOf(team));
      for (let i = 0; i < n; i++) {
        const c = this.makeCtrl(null, team, botNo++);
        this.ctrls.push(c);
        const k = Math.min(3, Math.max(1, Math.floor(gap / n) + (i < gap % n ? 1 : 0)));
        for (let j = 0; j < k; j++) this.makeUnit(c);
      }
    });
    // Turn order: teams alternate; inside a team the controllers take turns, each cycling their beans.
    this.teamCtrls = [0, 1].map((team) => this.ctrls.filter((c) => c.team === team));
    this.teamIdx = [0, 0];
    const maxCtrls = Math.max(...this.teamCtrls.map((l) => l.length));
    this.turnsPerTeam = Math.max(6, maxCtrls * 2);
    this.totalTurns = this.turnsPerTeam * 2;
    this.firstTeam = Math.random() < 0.5 ? 0 : 1;
  }

  /** Spread each team over its own half of the island (team 0 left, team 1 right). */
  placeUnits() {
    for (const team of [0, 1]) {
      const list = this.units.filter((u) => u.team === team);
      list.forEach((u, i) => {
        const span = 12;
        const k = list.length === 1 ? 0.5 : i / (list.length - 1);
        let x = (team ? 1 : -1) * (3.5 + k * span);
        for (let tries = 0; tries < 8 && this.terrain.top(x) < SEA_Y + 0.8; tries++) x -= (team ? 1 : -1) * 0.8;
        u.x = x;
        u.y = this.terrain.top(x);
        u.vx = u.vy = 0;
        u.grounded = true;
        u.facing = team ? -1 : 1;
        u.ch.faceSide(u.facing);
        u.ch.group.position.set(u.x, u.y, 0);
      });
    }
  }

  // ---------- turns ----------

  onStart() {
    // Let the GO! banner clear before the first turn banner.
    this.later(0.7, () => this.nextTurn());
  }

  nextTurn() {
    this.active = null;
    const pairDone = this.turnNo % 2 === 0;
    const overTime = this.time - (this.playStart ?? 0) > MATCH_CAP;
    if (this.turnNo >= this.totalTurns || (overTime && pairDone)) { this.end(); return; }
    const team = (this.firstTeam + this.turnNo) % 2;
    this.turnNo++;
    const list = this.teamCtrls[team];
    const ctrl = list[this.teamIdx[team]++ % list.length];
    const u = ctrl.units[ctrl.unitIdx++ % ctrl.units.length];
    this.active = u;
    u.power = 0;
    u.charging = false;
    u.fullT = 0;
    u.brain = null;
    this.plankUsed = false;
    // Wind changes every turn (in quarter steps so the arrows read clearly).
    this.wind = Math.round((Math.random() * 2 - 1) * 4) / 4 * MAX_WIND * (this.turnNo === 1 ? 0.5 : 1);
    this.phase = 'overview';
    this.phaseT = OVERVIEW_T;
    this.turnLeft = TURN_TIME;
    this.lastBeep = 99;
    this.focus = null;
    this.arrow.material = toon(ctrl.color);
    for (const d of this.dots) d.material = basic(ctrl.color);
    this.game.audio.play('join');
    this.game.ui.banner(t('splash.turn', { name: ctrl.name }), this.turnNo === this.totalTurns ? t('splash.lastTurn') : '', 1300);
  }

  updateTurn(dt) {
    const u = this.active;
    if (!u) return;
    switch (this.phase) {
      case 'overview':
        this.phaseT -= dt;
        if (this.phaseT <= 0) {
          this.phase = 'aim';
          if (u.ctrl.bot) u.brain = { stage: 'think', t: 0.7 + Math.random() * 0.6, walked: false };
        }
        break;
      case 'aim': {
        this.turnLeft -= dt;
        const secs = Math.ceil(this.turnLeft);
        if (secs <= 5 && secs < this.lastBeep && secs > 0) { this.lastBeep = secs; this.game.audio.play('beep'); }
        if (u.ctrl.bot) this.botAim(u, dt); else this.humanAim(u, dt);
        if (this.phase === 'aim' && this.turnLeft <= 0) {
          if (u.charging) this.fire(u);
          else { this.game.ui.toast(t('splash.timeUp')); this.toSettle(0.5); }
        }
        break;
      }
      case 'flight':
        if (!this.projectiles.length) this.toSettle(0.9);
        break;
      case 'settle':
        this.phaseT -= dt;
        this.settleT += dt;
        if (this.phaseT <= 0 && (this.calm() || this.settleT > 7)) this.nextTurn();
        break;
      default: break;
    }
  }

  toSettle(min) {
    this.phase = 'settle';
    this.phaseT = min;
    this.settleT = 0;
    this.active.charging = false;
  }

  /** Everything has stopped moving: no throws in the air, no bubbles, every bean on the ground. */
  calm() {
    return !this.projectiles.length && this.units.every((u) => !u.rescue && !u.float && u.grounded);
  }

  // ---------- controls ----------

  humanAim(u, dt) {
    const d = this.input(u.ctrl.p) || {};
    const tool = TOOLS[u.ctrl.tool];
    if (d.cPressed && !u.charging) {
      // C cycles tools (C keys also count as B, so check it first).
      u.ctrl.tool = (u.ctrl.tool + 1) % TOOLS.length;
      this.game.audio.play('select');
      return;
    }
    if (!u.charging) {
      if (Math.abs(d.x) > 0.3) {
        u.facing = Math.sign(d.x);
        if (u.grounded) u.walking = this.walk(u, u.facing, dt) ? 1 : 0;
      }
      if (d.aPressed && u.grounded) this.jump(u);
    }
    if (Math.abs(d.y) > 0.3) u.aim = clamp(u.aim + Math.sign(d.y) * AIM_SPEED * dt * Math.min(1, Math.abs(d.y) * 1.3), AIM_MIN, AIM_MAX);

    if (tool === 'balloon' || tool === 'bouncy') {
      if (!u.charging && d.bPressed && u.grounded) { u.charging = true; u.power = 0; u.fullT = 0; }
      if (u.charging) {
        u.power = Math.min(1, u.power + dt / CHARGE_T);
        if (u.power >= 1) u.fullT += dt;
        if (!d.b || u.fullT > FULL_HOLD) this.fire(u);
      }
    } else if (tool === 'girder') {
      if (d.bPressed) this.placePlank(u);
    } else if (tool === 'bubble') {
      if (d.bPressed) this.fire(u);
    }
  }

  jump(u) {
    u.grounded = false;
    u.vy = JUMP_VY;
    u.vx = u.facing * JUMP_VX;
    u.ch.squash(1.25);
    this.game.audio.play('jump');
  }

  /** Walk one frame along the ground. Returns false when blocked. Walking never takes you into the sea. */
  walk(u, dir, dt) {
    const ter = this.terrain;
    const dx = dir * WALK * dt;
    const nx = u.x + dx;
    if (nx < X0 + 1 || nx > X1 - 1) return false;
    const climb = Math.max(0.05, Math.abs(dx) * 1.6);
    let y = u.y + climb;
    if (ter.solid(nx, y)) return false; // too steep
    const lim = u.y - 0.45;
    while (y > lim && !ter.solid(nx, y - 0.02)) y -= 0.02;
    if (y <= lim) {
      // A ledge: hop off it, unless only the sea is down there.
      if (!ter.groundBelow(nx, u.y)) { this.cold(u); return false; }
      u.x = nx;
      u.grounded = false;
      u.vx = dir * WALK * 0.8;
      u.vy = 0;
      return true;
    }
    if (y < SEA_Y + 0.25) { this.cold(u); return false; }
    if (this.bodyBlocked(nx, y)) return false;
    u.x = nx;
    u.y = y;
    return true;
  }

  cold(u) {
    if (this.time - (this.coldT ?? -9) < 2) return;
    this.coldT = this.time;
    this.floatText(u.x, u.y + u.head + 0.6, t('splash.cold'), '#1aa7d8');
  }

  bodyBlocked(x, y) {
    const s = (ox, oy) => this.terrain.solid(x + ox, y + oy);
    return s(-0.24, 0.38) || s(0.24, 0.38) || s(-0.24, 0.7) || s(0.24, 0.7) || s(0, 1.0) || s(-0.2, 1.0) || s(0.2, 1.0);
  }

  hitsTerrain(x, y) {
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      if (this.terrain.solid(x + Math.cos(a) * (BEAN_R - 0.02), y + BEAN_CY + Math.sin(a) * BEAN_R)) return true;
    }
    return false;
  }

  /** Where the throw starts: in front of the bean at hand height. */
  hand(u, dir = u.facing, aim = u.aim) {
    return { x: u.x + dir * Math.cos(aim) * 0.55, y: u.y + 0.78 + Math.sin(aim) * 0.55 };
  }

  fire(u) {
    const tool = TOOLS[u.ctrl.tool];
    const h = this.hand(u);
    const dirX = u.facing * Math.cos(u.aim), dirY = Math.sin(u.aim);
    const sp = tool === 'bubble' ? TOOL.bubble.speed : speedOf(u.power);
    const p = {
      kind: tool, x: h.x, y: h.y, vx: dirX * sp, vy: dirY * sp, t: 0,
      bounces: TOOL.bouncy.bounces, windK: TOOL[tool].wind, owner: u, mesh: this.projMesh(tool, u.ctrl.color),
    };
    p.mesh.position.set(p.x, p.y, 0);
    this.scene.add(p.mesh);
    this.projectiles.push(p);
    this.projAcc = 0;
    u.charging = false;
    u.power = 0;
    u.ctrl.throws++;
    u.ch.squash(0.75);
    this.game.audio.play(tool === 'bubble' ? 'bubble' : 'whoosh');
    this.phase = 'flight';
  }

  projMesh(kind, color) {
    const g = new THREE.Group();
    if (kind === 'balloon') {
      const b = new THREE.Mesh(sharedGeo('spBalloon', () => new THREE.SphereGeometry(0.24, 14, 10)), toon(color));
      b.scale.set(1, 1.15, 1);
      const knot = new THREE.Mesh(sharedGeo('spKnot', () => new THREE.ConeGeometry(0.07, 0.12, 6)), toon(color));
      knot.position.y = -0.3;
      const shine = new THREE.Mesh(sharedGeo('spShine', () => new THREE.SphereGeometry(0.06, 8, 6)), toon(COLORS.white));
      shine.position.set(-0.09, 0.1, 0.18);
      g.add(b, knot, shine);
    } else if (kind === 'bouncy') {
      g.add(new THREE.Mesh(sharedGeo('spBouncy', () => new THREE.SphereGeometry(0.22, 14, 10)), toon(0xff9fd0)));
      const stripe = new THREE.Mesh(sharedGeo('spStripe', () => new THREE.TorusGeometry(0.215, 0.05, 6, 20)), toon(COLORS.white));
      g.add(stripe);
    } else {
      const b = new THREE.Mesh(sharedGeo('spBlow', () => new THREE.SphereGeometry(0.5, 18, 12)), this.bubbleMat);
      b.renderOrder = 4;
      const shine = new THREE.Mesh(sharedGeo('spShine2', () => new THREE.SphereGeometry(0.09, 8, 6)), toon(COLORS.white));
      shine.position.set(-0.2, 0.22, 0.35);
      g.add(b, shine);
    }
    return g;
  }

  /** Plank preview position for the current aim. */
  plankSpot(u) {
    const dx = u.facing * Math.cos(u.aim), dy = Math.sin(u.aim);
    const x = u.x + dx * GIRDER_D, y = u.y + BEAN_CY + dy * GIRDER_D;
    const ang = Math.atan2(dy, dx);
    // Blocked if it would trap a bean or stick out of the world.
    const cs = Math.cos(ang), sn = Math.sin(ang);
    let ok = x > X0 + 2 && x < X1 - 2 && y > SEA_Y + 0.3 && y < Y1 - 1;
    for (const o of this.units) {
      const ox = o.x - x, oy = o.y + BEAN_CY - y;
      const along = clamp(ox * cs + oy * sn, -GIRDER_L / 2, GIRDER_L / 2);
      if (Math.hypot(ox - along * cs, oy - along * sn) < 0.75) ok = false;
    }
    return { x, y, ang, ok };
  }

  placePlank(u) {
    if (this.plankUsed) { this.game.ui.toast(t('splash.hint.used')); return; }
    const s = this.plankSpot(u);
    if (!s.ok) { this.game.audio.play('bump'); this.game.ui.toast(t('splash.blocked')); return; }
    this.terrain.plank(s.x, s.y, s.ang);
    this.plankUsed = true;
    u.ctrl.tool = 0;
    this.puffs.burst(new THREE.Vector3(s.x, s.y, 0), 0xffffff, { count: 10, size: 0.5, life: 0.5, speed: 2 });
    this.game.audio.play('land');
  }

  // ---------- grumble bots ----------

  botAim(u, dt) {
    const b = u.brain;
    if (!b) return;
    switch (b.stage) {
      case 'think':
        b.t -= dt;
        if (b.t <= 0) this.botPlan(u);
        break;
      case 'walk':
        b.t -= dt;
        u.walking = this.walk(u, b.dir, dt) ? 1 : 0;
        if (b.t <= 0 || !u.walking) { u.walking = 0; b.stage = 'think'; b.t = 0.3; }
        break;
      case 'aim': {
        u.facing = b.dir;
        const d = b.angle - u.aim;
        u.aim += Math.sign(d) * Math.min(Math.abs(d), AIM_SPEED * 1.2 * dt);
        if (Math.abs(b.angle - u.aim) < 0.01) {
          if (b.tool === 'bubble') this.fire(u);
          else { b.stage = 'charge'; u.charging = true; u.power = 0; }
        }
        break;
      }
      case 'charge':
        u.power = Math.min(b.power, u.power + dt / CHARGE_T);
        if (u.power >= b.power) this.fire(u);
        break;
      default: break;
    }
  }

  botPlan(u) {
    const b = u.brain;
    const foes = this.units.filter((o) => o.team !== u.team && !o.rescue);
    if (!foes.length) { this.toSettle(0.4); return; }
    foes.sort((a, c) => Math.abs(a.x - u.x) - Math.abs(c.x - u.x));
    const near = foes[0];
    // Close by: blow a big bubble at them now and then.
    if (Math.abs(near.x - u.x) < 3.2 && Math.abs(near.y - u.y) < 1.2 && Math.random() < 0.6) {
      Object.assign(b, { stage: 'aim', tool: 'bubble', dir: Math.sign(near.x - u.x) || 1, angle: 0.12 });
      u.ctrl.tool = TOOLS.indexOf('bubble');
      return;
    }
    const tool = Math.random() < 0.22 ? 'bouncy' : 'balloon';
    let best = null;
    for (const f of foes.slice(0, 3)) {
      const s = this.solve(u, f, tool);
      if (s && (!best || s.miss < best.miss)) best = s;
    }
    if ((!best || best.miss > 2.2) && !b.walked) {
      // No clean shot from here: shuffle toward the other team a little and look again.
      b.walked = true;
      Object.assign(b, { stage: 'walk', t: 1.2, dir: Math.sign(near.x - u.x) || 1 });
      return;
    }
    if (!best) { this.toSettle(0.4); return; }
    // Grumbles are not perfect: a little error on angle and power.
    Object.assign(b, {
      stage: 'aim', tool, dir: best.dir,
      angle: clamp(best.angle + gauss() * 0.1, AIM_MIN, AIM_MAX),
      power: clamp(best.power * (1 + gauss() * 0.09), 0.05, 1),
      planned: best,
    });
    u.ctrl.tool = TOOLS.indexOf(tool);
  }

  /** Brute-force aim search with the real projectile physics (no error). */
  solve(u, target, tool) {
    const tx = target.x, ty = target.y + BEAN_CY;
    const dir = Math.sign(tx - u.x) || 1;
    let best = null;
    for (let angle = -0.45; angle <= 1.35; angle += 0.06) {
      for (let power = 0.16; power <= 1.001; power += 0.04) {
        const res = this.simShot(u, dir, angle, power, tool, tx, ty);
        let miss = res.miss;
        if (Math.hypot(res.x - u.x, res.y - u.y - BEAN_CY) < TOOL[tool].radius + 1.2) miss += 50; // don't splash yourself
        if (!best || miss < best.miss) best = { angle, power, dir, miss, x: res.x, y: res.y };
      }
    }
    return best;
  }

  simShot(u, dir, angle, power, tool, tx, ty) {
    const h = this.hand(u, dir, angle);
    const sp = speedOf(power);
    const p = { kind: tool, x: h.x, y: h.y, vx: dir * Math.cos(angle) * sp, vy: Math.sin(angle) * sp, t: 0, bounces: TOOL.bouncy.bounces, windK: TOOL[tool].wind };
    for (let i = 0; i < 6 / PH; i++) {
      const ev = stepProj(this.terrain, p, PH, this.wind);
      if (Math.hypot(p.x - tx, p.y - ty) < HIT_R) return { miss: 0, x: p.x, y: p.y };
      if (ev === 'pop') return { miss: Math.hypot(p.x - tx, p.y - ty), x: p.x, y: p.y };
      if (ev === 'sea') return { miss: Math.hypot(p.x - tx, p.y - ty) + 6, x: p.x, y: p.y };
    }
    return { miss: 99, x: p.x, y: p.y };
  }

  // ---------- throws in flight ----------

  updateProjectiles(dt) {
    if (!this.projectiles.length) { this.projAcc = 0; return; }
    this.projAcc += dt;
    while (this.projAcc >= PH && this.projectiles.length) {
      this.projAcc -= PH;
      for (const p of [...this.projectiles]) this.stepLive(p);
    }
    for (const p of this.projectiles) {
      p.mesh.position.set(p.x, p.y, 0);
      if (p.kind === 'bubble') p.mesh.scale.setScalar(1 + Math.sin(this.time * 12) * 0.05);
      else p.mesh.rotation.z = Math.atan2(p.vy, p.vx) - Math.PI / 2;
      if (p.kind !== 'bubble' && Math.random() < 0.3) this.puffs.burst(new THREE.Vector3(p.x, p.y, 0), 0xdff4ff, { count: 1, size: 0.18, life: 0.35, speed: 0.3, up: 0 });
    }
  }

  stepLive(p) {
    const ev = stepProj(this.terrain, p, PH, this.wind);
    if (ev === 'bounce') { this.game.audio.play('boing'); return; }
    if (ev === 'pop') { this.removeProj(p); this.splash(p.x, p.y, p.kind, p.owner); return; }
    if (ev === 'sea') {
      this.removeProj(p);
      const at = new THREE.Vector3(p.x, SEA_Y, 0.5);
      this.puffs.burst(at, 0xffffff, { count: 8, size: 0.5, life: 0.6, speed: 2 });
      this.game.audio.play('splat');
      this.focus = { x: p.x, y: SEA_Y + 2 };
      return;
    }
    if (ev === 'fizzle') { this.removeProj(p); this.popBubble(p.x, p.y); return; }
    // Touching a bean pops the throw right there (the thrower is safe for a moment).
    for (const u of this.units) {
      if (u.rescue || u.float) continue;
      if (u === p.owner && p.t < 0.3) continue;
      if (Math.hypot(p.x - u.x, p.y - u.y - BEAN_CY) > HIT_R + (p.kind === 'bubble' ? 0.25 : 0)) continue;
      this.removeProj(p);
      if (p.kind === 'bubble') this.bubbleUp(u, p);
      else this.splash(p.x, p.y, p.kind, p.owner);
      return;
    }
  }

  removeProj(p) {
    const i = this.projectiles.indexOf(p);
    if (i >= 0) this.projectiles.splice(i, 1);
    this.scene.remove(p.mesh);
  }

  popBubble(x, y) {
    this.puffs.burst(new THREE.Vector3(x, y, 0), 0xbfe9ff, { count: 8, size: 0.35, life: 0.4, speed: 2.5 });
    this.game.audio.play('pop');
  }

  /** A splash: crater in the cookie, knock nearby beans away, make them soggy, score points. */
  splash(x, y, kind, owner) {
    const info = TOOL[kind];
    this.terrain.crater(x, y, info.radius);
    this.focus = { x, y };
    const at = new THREE.Vector3(x, y, 0.3);
    this.puffs.burst(at, 0xbfe9ff, { count: 16, size: 0.75, life: 0.7, speed: 4.5 });
    this.confetti.burst(at, 0, { count: 34, speed: 8, up: 5, colors: [0x56c6f0, 0xbfe9ff, 0xffffff, 0xe0a464, 0xff9fd0], life: 1.1, gravity: -14, size: 0.17 });
    this.game.audio.play('splat');

    // Candy decorations caught in the splash pop off; the rest fall if their ground is gone.
    for (const d of [...this.decor]) {
      if (Math.hypot(d.x - x, d.y - y) < info.radius + 0.4) {
        this.confetti.burst(new THREE.Vector3(d.x, d.y + 0.5, -0.6), 0, { count: 10, speed: 5, up: 4, colors: [COLORS.candyPink, COLORS.candyYellow, COLORS.white], life: 0.8, size: 0.14 });
        this.scene.remove(d.mesh);
        this.decor.splice(this.decor.indexOf(d), 1);
      } else if (!this.terrain.solid(d.x, d.y - 0.05)) d.falling = true;
    }

    const reach = info.radius + 1.1;
    for (const u of this.units) {
      if (u.rescue) continue;
      const dx = u.x - x, dy = u.y + BEAN_CY - y;
      const d = Math.hypot(dx, dy);
      if (d > reach) continue;
      const f = 1 - d / reach;
      // Push away from the splash, always with a bit of lift so beans hop rather than slide.
      let nx = d > 0.05 ? dx / d : (u.x >= x ? 1 : -1) * 0.5, ny = d > 0.05 ? dy / d : 0.5;
      ny += 0.7;
      const l = Math.hypot(nx, ny);
      nx /= l; ny /= l;
      const k = info.knock * (0.45 + 0.55 * f) * (1 + u.soggy / 160);
      if (u.float) { u.float = null; u.bubble.visible = false; }
      u.vx += nx * k;
      u.vy = Math.max(0, u.vy) + ny * k;
      u.grounded = false;
      u.still = 0;
      u.ch.squash(0.6);
      u.lastHitBy = owner.ctrl;
      u.soggy += Math.round(info.soggy * (0.4 + 0.6 * f));
      if (u.team !== owner.team) {
        this.award(owner.ctrl, 1, u.x, u.y + u.head + 0.4);
        owner.ctrl.hits++;
      }
      if (u.soggy >= 100) {
        // Wet meter full: a big shake-off. Bonus points if an opponent did it.
        u.soggy = 0;
        this.confetti.burst(new THREE.Vector3(u.x, u.y + 0.7, 0.3), 0, { count: 30, speed: 6, up: 4, colors: [0x56c6f0, 0xbfe9ff, 0xffffff], life: 1, size: 0.15 });
        if (u.team !== owner.team) {
          owner.ctrl.soaks++;
          this.award(owner.ctrl, 2, u.x, u.y + u.head + 1.1, t('splash.soaked'));
        }
      }
    }
  }

  /** The big bubble tool: lifts a bean gently and floats it away for a moment. */
  bubbleUp(u, p) {
    u.float = { t: 2.4, vx: Math.sign(p.vx || 1) * 1.4 + this.wind * 0.25 };
    u.grounded = false;
    u.vx = u.vy = 0;
    u.lastHitBy = p.owner.ctrl;
    u.soggy += 10;
    this.focus = null;
    this.game.audio.play('trap');
    if (u.team !== p.owner.team) this.award(p.owner.ctrl, 1, u.x, u.y + u.head + 0.9, t('splash.bubbled'));
  }

  award(ctrl, n, x, y, text = '') {
    this.score[ctrl.team] += n;
    ctrl.points += n;
    this.floatText(x, y, `${text ? esc(text) + ' ' : ''}+${n}`, TEAM_CSS[ctrl.team]);
    this.game.audio.play(n > 1 ? 'star' : 'coin');
  }

  floatText(x, y, html, css) {
    const el = this.game.ui.label('label');
    el.innerHTML = `<span style="color:${css}">${html}</span>`;
    this.floaters.push({ el, x, y, t: 0 });
  }

  // ---------- bean physics ----------

  updateUnits(dt) {
    const ter = this.terrain;
    for (const u of this.units) {
      if (u.rescue) this.updateRescue(u, dt);
      else if (u.float) this.updateFloat(u, dt);
      else if (!u.grounded) this.updateAir(u, dt);
      else {
        // Ground can disappear (craters): snap down a little, or start falling.
        if (!ter.solid(u.x, u.y - 0.04)) {
          let yy = u.y;
          for (let k = 0; k < 6 && !ter.solid(u.x, yy - 0.04); k++) yy -= 0.03;
          if (ter.solid(u.x, yy - 0.04)) u.y = yy;
          else { u.grounded = false; u.vx = 0; u.vy = 0; }
        }
      }
      if (!u.rescue && u.y < SEA_Y - 0.5) this.dunk(u);

      // Look: soggy beans drip.
      if (u.soggy > 30 && !u.rescue) {
        u.drip -= dt;
        if (u.drip <= 0) {
          u.drip = 0.5 - u.soggy / 300;
          this.puffs.burst(new THREE.Vector3(u.x + (Math.random() - 0.5) * 0.6, u.y + 0.5, 0.3), 0x8fd8ff, { count: 1, size: 0.13, life: 0.5, speed: 0.4, up: -1 });
        }
      }
      const active = u === this.active && this.phase === 'aim';
      if (active || u.grounded) u.ch.faceSide(u.facing);
      u.ch.update(dt, { moving: active ? u.walking : 0, grounded: u.grounded && !u.float, vy: u.vy });
      u.walking = 0;
      u.ch.group.position.set(u.x, u.y, 0);
      u.bubble.visible = !!(u.rescue || u.float);
      if (u.bubble.visible) {
        u.bubble.position.set(u.x, u.y + BEAN_CY + 0.05, 0);
        u.bubble.scale.setScalar(1 + Math.sin(this.time * 6) * 0.04);
      }
      const tool = TOOLS[u.ctrl.tool];
      u.hold.visible = active && (tool === 'balloon' || tool === 'bouncy');
      if (u.hold.visible) u.hold.material = toon(tool === 'balloon' ? u.ctrl.color : 0xff9fd0);
    }
  }

  updateAir(u, dt) {
    const ter = this.terrain;
    u.vy -= G * dt;
    const steps = Math.ceil((Math.max(Math.abs(u.vx), Math.abs(u.vy)) * dt) / 0.06) + 1;
    const h = dt / steps;
    const x0 = u.x, y0 = u.y;
    for (let i = 0; i < steps; i++) {
      const nx = u.x + u.vx * h, ny = u.y + u.vy * h;
      if (!this.hitsTerrain(nx, ny)) { u.x = nx; u.y = ny; continue; }
      const n = ter.normal(nx, ny + BEAN_CY, 0.55);
      const vn = u.vx * n.x + u.vy * n.y;
      if (vn < 0) { u.vx -= 1.35 * vn * n.x; u.vy -= 1.35 * vn * n.y; }
      u.vx *= 0.8; u.vy *= 0.8;
      if (n.y > 0.5 && Math.hypot(u.vx, u.vy) < 2.6) { this.land(u); return; }
      if (vn < -2) this.game.audio.play('bump');
      // Nudge out if we ended up inside.
      for (let k = 0; k < 6 && this.hitsTerrain(u.x, u.y); k++) { u.x += n.x * 0.04; u.y += n.y * 0.04; }
      break;
    }
    // Wedged in a corner with no speed left: find the ground or slide off.
    const moved = Math.hypot(u.x - x0, u.y - y0);
    u.still = moved < 0.01 ? u.still + dt : 0;
    if (u.still > 0.35) {
      if (!this.land(u)) { const n = ter.normal(u.x, u.y + BEAN_CY, 0.6); u.x += (n.x || 0.5) * 0.06; }
    }
  }

  /** Put the bean on the ground right below it. Returns false if there is none close by. */
  land(u) {
    const ter = this.terrain;
    for (let yy = u.y + 0.5; yy > u.y - 0.7; yy -= 0.02) {
      if (!ter.solid(u.x, yy) && ter.solid(u.x, yy - 0.02)) {
        u.y = yy;
        u.vx = u.vy = 0;
        u.grounded = true;
        u.still = 0;
        u.ch.squash(0.8);
        this.game.audio.play('land');
        return true;
      }
    }
    u.vx *= 0.5;
    return false;
  }

  updateFloat(u, dt) {
    const f = u.float;
    f.t -= dt;
    u.x += f.vx * dt;
    u.y += Math.max(0.35, f.t * 0.6) * dt;
    if (f.t <= 0 || this.hitsTerrain(u.x, u.y + 0.2) || u.x < X0 + 1 || u.x > X1 - 1) {
      u.float = null;
      u.vx = f.vx * 0.5;
      u.vy = 0;
      this.popBubble(u.x, u.y + BEAN_CY);
    }
  }

  /** Fell in the sea: points for the other side, then float back to the island in a bubble. */
  dunk(u) {
    const other = 1 - u.team;
    const hitter = u.lastHitBy && u.lastHitBy.team === other ? u.lastHitBy : null;
    if (hitter) { hitter.dunks++; this.award(hitter, 2, u.x, SEA_Y + 2); } else {
      this.score[other] += 2;
      this.floatText(u.x, SEA_Y + 2, '+2', TEAM_CSS[other]);
    }
    this.puffs.burst(new THREE.Vector3(u.x, SEA_Y, 0.6), 0xffffff, { count: 14, size: 0.7, life: 0.8, speed: 3 });
    this.confetti.burst(new THREE.Vector3(u.x, SEA_Y, 0.6), 0, { count: 24, speed: 5, up: 6, colors: [0x56c6f0, 0xbfe9ff, 0xffffff], life: 1, size: 0.16 });
    this.game.audio.play('splat');
    this.game.audio.play('bubble');
    this.game.ui.toast(t('splash.dunk', { name: u.ctrl.name }));
    u.lastHitBy = null;
    u.vx = u.vy = 0;
    u.float = null;
    u.grounded = false;
    u.rescue = { t: 0, x0: u.x, y0: u.y, to: this.respawnSpot(u.team) };
    this.focus = { x: u.x, y: SEA_Y + 2 };
  }

  respawnSpot(team) {
    const ter = this.terrain;
    for (let i = 0; i < 60; i++) {
      const x = (team ? 1 : -1) * (1 + Math.random() * 14) + (i > 30 ? (Math.random() - 0.5) * 10 : 0);
      const y = ter.top(x);
      if (y < SEA_Y + 0.6 || y > Y1 - 2) continue;
      if (this.units.some((o) => !o.rescue && Math.abs(o.x - x) < 1.4)) continue;
      if (this.bodyBlocked(x, y + 0.02)) continue;
      return { x, y };
    }
    return { x: 0, y: Math.max(SEA_Y + 1, ter.top(0)) };
  }

  updateRescue(u, dt) {
    const r = u.rescue;
    r.t += dt;
    if (r.t < 0.7) {
      // Bob up out of the water...
      const k = r.t / 0.7;
      u.x = r.x0;
      u.y = THREE.MathUtils.lerp(r.y0, SEA_Y + 1.2, k * k * (3 - 2 * k));
    } else if (r.t < 2.1) {
      // ...float over to a dry spot...
      const k = smooth(0, 1, (r.t - 0.7) / 1.4);
      u.x = THREE.MathUtils.lerp(r.x0, r.to.x, k);
      u.y = THREE.MathUtils.lerp(SEA_Y + 1.2, r.to.y + 0.6, k) + Math.sin(k * Math.PI) * 2.5;
      u.facing = Math.sign(r.to.x - r.x0) || 1;
    } else {
      // ...and pop.
      u.rescue = null;
      u.soggy = Math.max(0, u.soggy - 20);
      u.x = r.to.x;
      u.y = r.to.y + 0.5;
      u.vx = u.vy = 0;
      u.grounded = false;
      this.popBubble(u.x, u.y + BEAN_CY);
      this.game.audio.play('rescue');
    }
  }

  // ---------- camera, HUD, look ----------

  frame() {
    this.updateCamera(1, true);
  }

  resize(w, h) {
    super.resize(w, h);
    this.frame();
  }

  updateCamera(dt, snap = false) {
    const g = this.camGoal;
    const over = () => { g.x = 0; g.y = 5.5; g.w = 41; };
    if (this.state !== 'play' || !this.active) over();
    else if (this.phase === 'overview') over();
    else if (this.phase === 'aim') {
      const u = this.active;
      g.x = u.x + u.facing * 1.8; g.y = u.y + 1.8; g.w = 21;
    } else if (this.phase === 'flight' && this.projectiles.length) {
      const p = this.projectiles[0];
      g.x = p.x; g.y = p.y; g.w = 26;
    } else if (this.phase === 'settle' || this.phase === 'flight') {
      const r = this.units.find((u) => u.rescue);
      const f = r ? { x: r.x, y: r.y } : this.focus;
      if (f && this.settleT < 2.5) { g.x = f.x; g.y = f.y + 1; g.w = 26; } else over();
    }
    const c = this.cam;
    const k = snap ? 1 : 1 - Math.exp(-dt * (this.phase === 'flight' ? 5 : 3.2));
    c.x += (g.x - c.x) * k;
    c.y += (g.y - c.y) * k;
    c.w += (g.w - c.w) * k;
    const dist = this.fitDistance(c.w, c.w * 0.42);
    const half = this.viewHalfSize(dist);
    // Keep the view over the island and never deep under water.
    let cx = c.x, cy = c.y;
    const maxX = Math.max(0, 26 - half.w);
    cx = clamp(cx, -maxX, maxX);
    cy = Math.max(cy, -2.6 + half.h);
    this.camera.position.set(cx, cy + dist * 0.12, dist);
    this.camera.lookAt(cx, cy, 0);
    this.confettiOrigin = new THREE.Vector3(cx, cy + 2, 0);
  }

  animateWorld(dt) {
    // Waves.
    const pos = this.sea.geometry.attributes.position;
    const fpos = this.foam.geometry.attributes.position;
    for (const i of this.seaTop) pos.setY(i, 6 + waveY(pos.getX(i), this.time));
    for (let i = 0; i < fpos.count; i++) fpos.setY(i, waveY(fpos.getX(i), this.time) + (fpos.getY(i) > 0 ? 0.08 : -0.1) * 1);
    pos.needsUpdate = true;
    fpos.needsUpdate = true;
    // Clouds drift with the wind.
    for (const c of this.clouds) {
      c.position.x += (0.3 + this.wind * 0.6) * dt;
      if (c.position.x > 85) c.position.x -= 170;
      if (c.position.x < -85) c.position.x += 170;
    }
    // Decorations whose ground was splashed away tumble down.
    for (const d of [...this.decor]) {
      if (!d.falling) continue;
      d.vy -= G * dt;
      d.y += d.vy * dt;
      d.mesh.rotation.z += dt * 2;
      if (this.terrain.solid(d.x, d.y - 0.05) && d.vy < 0) { d.falling = false; d.vy = 0; }
      if (d.y < SEA_Y - 1.5) { this.scene.remove(d.mesh); this.decor.splice(this.decor.indexOf(d), 1); }
      d.mesh.position.y = d.y;
    }
  }

  updateAimLook() {
    const u = this.active;
    const show = this.state === 'play' && u && this.phase === 'aim';
    this.arrow.visible = !!show || (this.state === 'play' && u && this.phase === 'overview');
    if (this.arrow.visible) this.arrow.position.set(u.x, u.y + u.head + 0.55 + Math.abs(Math.sin(this.time * 5)) * 0.25, 0);
    const tool = u ? TOOLS[u.ctrl.tool] : null;
    // Dotted preview for the first part of the throw (gravity only, the wind is up to you).
    const arc = show && (tool === 'balloon' || tool === 'bouncy' || tool === 'bubble');
    if (arc) {
      const h = this.hand(u);
      const sp = tool === 'bubble' ? TOOL.bubble.speed : speedOf(u.charging ? u.power : 0.55);
      const vx = u.facing * Math.cos(u.aim) * sp, vy = Math.sin(u.aim) * sp;
      this.dots.forEach((d, i) => {
        const tt = (i + 1) * (tool === 'bubble' ? 0.07 : 0.055);
        d.visible = true;
        d.position.set(h.x + vx * tt, h.y + vy * tt - (tool === 'bubble' ? 0 : 0.5 * G * tt * tt), 0.1);
        d.scale.setScalar((u.charging ? 1.2 : 0.9) * (1 - i * 0.06));
      });
    } else for (const d of this.dots) d.visible = false;
    // Plank preview.
    this.preview.visible = !!(show && tool === 'girder' && !this.plankUsed);
    if (this.preview.visible) {
      const s = this.plankSpot(u);
      this.preview.position.set(s.x, s.y, 0);
      this.preview.rotation.z = s.ang;
      this.preview.material = s.ok ? this.okMat : this.badMat;
    }
  }

  updateLabels() {
    const ui = this.game.ui;
    for (const u of this.units) {
      if (this.state === 'results') { u.label.style.display = 'none'; continue; }
      const active = u === this.active && this.state === 'play' && (this.phase === 'aim' || this.phase === 'overview');
      const wet = Math.min(100, Math.round(u.soggy));
      const meter = active && u.charging;
      const html = `<span style="color:${TEAM_CSS[u.team]}">●</span> <span style="color:${u.ctrl.css}">${esc(u.ctrl.name)}</span>`
        + `<div style="width:46px;height:8px;margin:2px auto 0;border-radius:5px;background:#fff;border:2px solid #2b2340;overflow:hidden"><div style="height:100%;width:${wet}%;background:#4cc9f0"></div></div>`
        + (meter ? `<div style="width:76px;height:14px;margin:4px auto 0;border-radius:9px;background:#fff;border:3px solid ${u.ctrl.css};overflow:hidden"><div style="height:100%;width:${Math.round(u.power * 100)}%;background:linear-gradient(90deg,#3ddc97,#ffc93c,#ff5d73)"></div></div>` : '');
      if (html !== u.labelHtml) { u.label.innerHTML = html; u.labelHtml = html; }
      u.label.style.fontSize = active ? '1.25em' : '';
      ui.place(u.label, new THREE.Vector3(u.x, u.y + u.head + (active ? 1.05 : 0.35) + (u.bubble.visible ? 0.4 : 0), 0), this.camera);
    }
    for (const f of [...this.floaters]) {
      f.t += this.frameDt || 0.016;
      f.y += (this.frameDt || 0.016) * 1.1;
      ui.place(f.el, new THREE.Vector3(f.x, f.y, 0), this.camera);
      f.el.style.opacity = String(clamp(1 - (f.t - 0.9) / 0.5, 0, 1));
      if (f.t > 1.4) { f.el.remove(); this.floaters.splice(this.floaters.indexOf(f), 1); }
    }
  }

  windHtml() {
    const n = Math.round((Math.abs(this.wind) / MAX_WIND) * 3);
    const arrows = n === 0 ? '·' : (this.wind < 0 ? '◀' : '▶').repeat(n);
    return `<div class="pill">${t('splash.wind')} <b style="color:#1aa7d8;letter-spacing:-0.1em;min-width:3ch;text-align:center">${arrows}</b></div>`;
  }

  updateHud() {
    if (this.state === 'teams' || this.state === 'intro') return;
    const sc = `<div class="pill ball-score"><span style="color:${TEAM_CSS[0]}">${t('ball.team.0')}</span><span class="big-num">${this.score[0]} - ${this.score[1]}</span><span style="color:${TEAM_CSS[1]}">${t('ball.team.1')}</span></div>`;
    let html = sc + `<div class="pill">${t('splash.turnOf', { n: Math.max(1, this.turnNo), m: this.totalTurns })}</div>` + this.windHtml();
    const u = this.active;
    if (u) {
      const tool = TOOLS[u.ctrl.tool];
      const icons = TOOLS.map((k) => `<span style="display:inline-flex;padding:3px;border-radius:50%;background:${k === tool ? '#ffe47a' : 'transparent'};opacity:${k === tool ? 1 : 0.55}">${ICONS[k]}</span>`).join('');
      const hint = u.ctrl.bot ? '' : `<small style="font-weight:600;opacity:.75">${t(tool === 'girder' ? (this.plankUsed ? 'splash.hint.used' : 'splash.hint.girder') : tool === 'bubble' ? 'splash.hint.bubble' : 'splash.hint.throw')}</small>`;
      const secs = Math.max(0, Math.ceil(this.turnLeft));
      html += '<div style="flex-basis:100%;height:0"></div>'
        + `<div class="pill" style="border:4px solid ${u.ctrl.css}"><b style="color:${u.ctrl.css}">${esc(t('splash.turnPill', { name: u.ctrl.name }))}</b><span class="big-num" style="font-size:1.5em;color:${secs <= 5 ? '#ff5d73' : '#2b2340'}">${secs}</span></div>`
        + `<div class="pill">${icons}<b>${t(`splash.tool.${tool}`)}</b>${hint}</div>`;
    }
    this.game.ui.setTop(html);
    this.game.ui.bar(this.players, (p) => {
      const c = this.ctrls.find((x) => x.p === p);
      return c ? `<span style="color:${TEAM_CSS[c.team]}">●</span> ${c.points}` : '';
    });
  }

  update(dt) {
    this.frameDt = dt;
    this.animateWorld(dt);
    if (this.state === 'teams') this.picker?.update();
    if (this.state === 'play') this.updateTurn(dt);
    this.updateProjectiles(dt);
    this.updateUnits(dt);
    this.updateAimLook();
    this.updateCamera(dt);
    this.updateLabels();
    if (this.updateResults(dt)) return;
    this.updateHud();
  }

  end() {
    if (this.state === 'results') return;
    this.active = null;
    this.arrow.visible = false;
    for (const u of this.units) u.label.style.display = 'none';
    const [a, b] = this.score;
    const winner = a === b ? -1 : a > b ? 0 : 1;
    const ranked = [...this.ctrls].sort((x, y) => (y.team === winner) - (x.team === winner) || y.points - x.points || y.hits - x.hits);
    this.finish({
      title: winner < 0 ? t('ball.draw') : t('ball.winTitle', { team: t(`ball.team.${winner}`) }),
      subtitle: `${t('ball.team.0')} ${t('ball.sub', { a, b })} ${t('ball.team.1')}`,
      rows: ranked.map((c) => ({
        css: c.css, name: c.name,
        value: c.points === 1 ? t('splash.point1') : t('splash.points', { n: c.points }),
        detail: t('splash.detail', { team: t(`ball.team.${c.team}`), h: c.hits === 1 ? t('splash.hit1') : t('splash.hits', { n: c.hits }), d: c.dunks === 1 ? t('splash.dunk1') : t('splash.dunks', { n: c.dunks }) }),
        crown: c.team === winner,
      })),
      stars: 2,
    });
  }
}
