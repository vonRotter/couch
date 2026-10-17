// Side-view physics shared by the arena and platformer games.
// Solids: { x, y, w, h, oneWay?, dx?, dy? } with (x, y) the bottom-left corner.
// Bodies: { x, y, w, h, vx, vy } with (x, y) the bottom-center (feet).

export function overlaps(b, s) {
  return b.x + b.w / 2 > s.x && b.x - b.w / 2 < s.x + s.w && b.y + b.h > s.y && b.y < s.y + s.h;
}

export function boxesTouch(a, b, pad = 0) {
  return Math.abs(a.x - b.x) < (a.w + b.w) / 2 + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;
}

export function approach(v, target, step) {
  return v < target ? Math.min(v + step, target) : Math.max(v - step, target);
}

export function moveBody(b, dt, solids) {
  if (b.grounded && b.ground && (b.ground.dx || b.ground.dy)) {
    b.x += b.ground.dx || 0;
    b.y += b.ground.dy || 0;
  }
  if (b.dropTimer > 0) b.dropTimer -= dt;
  const prevY = b.y;
  b.wallHit = 0;
  b.bonk = false;

  b.x += b.vx * dt;
  for (const s of solids) {
    if (s.oneWay || !overlaps(b, s)) continue;
    const pushLeft = b.vx > 0 || (b.vx === 0 && b.x < s.x + s.w / 2);
    if (pushLeft) {
      b.x = s.x - b.w / 2 - 1e-4;
      b.wallHit = 1;
    } else {
      b.x = s.x + s.w + b.w / 2 + 1e-4;
      b.wallHit = -1;
    }
    b.vx = 0;
  }

  const wasGrounded = b.grounded;
  b.y += b.vy * dt;
  b.grounded = false;
  b.ground = null;
  for (const s of solids) {
    if (!overlaps(b, s)) continue;
    if (s.oneWay && b.dropTimer > 0) continue;
    const top = s.y + s.h;
    const tol = 0.06 + Math.abs(s.dy || 0) + Math.max(0, -b.vy * dt);
    if (b.vy <= 0 && prevY >= top - tol) {
      b.y = top;
      b.vy = 0;
      b.grounded = true;
      b.ground = s;
    } else if (!s.oneWay) {
      if (b.vy > 0) {
        b.y = s.y - b.h - 1e-4;
        b.vy = 0;
        b.bonk = true;
      } else {
        b.y = top;
        b.vy = 0;
        b.grounded = true;
        b.ground = s;
      }
    }
  }
  b.justLanded = b.grounded && !wasGrounded;
}

/** The solid (if any) whose area contains the point. */
export function solidAt(solids, x, y) {
  for (const s of solids) if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) return s;
  return null;
}

/**
 * Forgiving platformer controller: coyote time, jump buffering,
 * variable jump height, optional double jump, down+jump to drop through clouds.
 * Returns 0 (no jump), 1 (jump), 2 (double jump).
 */
export function platformerControl(b, input, dt, P) {
  const target = input.x * P.speed;
  const acc = b.grounded ? P.accel : P.airAccel;
  b.vx = approach(b.vx, target, acc * dt);

  if (b.grounded) {
    b.coyote = P.coyote;
    b.jumps = 0;
  } else {
    b.coyote = (b.coyote || 0) - dt;
  }
  b.buffer = input.aPressed ? P.buffer : (b.buffer || 0) - dt;

  let jumped = 0;
  if (b.buffer > 0 && b.grounded && b.ground?.oneWay && input.y < -0.5) {
    b.dropTimer = 0.25;
    b.buffer = 0;
    b.grounded = false;
  } else if (b.buffer > 0 && b.coyote > 0) {
    b.vy = P.jump;
    b.coyote = 0;
    b.buffer = 0;
    b.grounded = false;
    jumped = 1;
  } else if (b.buffer > 0 && P.doubleJump && !b.grounded && (b.jumps || 0) < 1) {
    b.vy = P.jump2;
    b.jumps = 1;
    b.buffer = 0;
    jumped = 2;
  }

  const g = b.vy < 0 || !input.a ? P.gravity * P.fallMul : P.gravity;
  b.vy = Math.max(P.maxFall, b.vy - g * dt);
  return jumped;
}
