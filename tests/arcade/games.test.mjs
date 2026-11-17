// The Game Hall's nine classic games (src/scenes/arcade): each starts, its controls work, it scores or reaches its
// goal, it ends with a card that retries at once, the high score is saved for the profile, and its "Help me play"
// assists do what they say. One browser, one profile; every test starts its game from the scene key.
import { open, close, test, assert, done, sim, press } from '../lively/helper.mjs';
import { startArcade, R, setAssist, hold, answerOffer, screenOf, bests } from './arcade.mjs';

const page = await open();
const offersOff = () => setAssist(page, { offers: false });
const plain = () => setAssist(page, { timing: false, aim: 0, aimChosen: true, toggle: false, calm: false, speed: 1, offers: false });

// ---------- Wiggle Worm ----------

await test('snake: starts, steers, eats a berry, game over card, instant retry, best saved', async () => {
  await startArcade(page, 'snake');
  await plain();
  assert(await R(page, (r) => r.state) === 'play', 'playing after Ready');
  await press(page, 'KeyW');
  await sim(page, 0.5);
  assert(await R(page, (r, g) => g.dir[1] === -1), 'W turned the worm up');
  await R(page, (r, g) => { const h = g.body[0]; g.food = { c: h.c + g.dir[0], r: h.r + g.dir[1] }; g.timer = 0; });
  await sim(page, 0.4);
  const s = await R(page, (r, g) => ({ score: g.score, len: g.body.length }));
  assert(s.score === 1 && s.len === 4, JSON.stringify(s));
  // up into the fence
  await sim(page, 4);
  const c = await R(page, (r, g) => ({ st: r.state, g: g.state, items: r.items }));
  assert(c.st === 'card' && c.g === 'over' && c.items.includes('again'), JSON.stringify(c));
  const b = await bests(page);
  assert(b.mem.snake === 1 && b.stored.snake === 1, JSON.stringify(b));
  await R(page, (r) => r.choose('again'));
  const a = await R(page, (r, g) => ({ st: r.state, score: g.score }));
  assert(a.st === 'ready' && a.score === 0, JSON.stringify(a));
  await sim(page, 1.2);
  assert(await R(page, (r) => r.state) === 'play', 'playing again at once');
});

await test('snake: forgiving timing stops the worm at a bump and waits for a turn', async () => {
  await setAssist(page, { timing: true });
  await R(page, (r, g) => { g.body = [{ c: g.cols - 1, r: 5 }, { c: g.cols - 2, r: 5 }, { c: g.cols - 3, r: 5 }]; g.prev = g.body.map((x) => ({ ...x })); g.dir = [1, 0]; g.queue = []; g.timer = g.interval - 0.01; g.food = { c: 0, r: 0 }; });
  await sim(page, 0.1);
  const w = await R(page, (r, g) => ({ grace: g.grace, st: g.state }));
  assert(w.grace > 0 && w.st === 'play', JSON.stringify(w));
  await press(page, 'KeyS');
  await sim(page, 0.5);
  const after = await R(page, (r, g) => ({ st: g.state, dir: g.dir, grace: g.grace }));
  assert(after.st === 'play' && after.dir[1] === 1 && after.grace <= 0, JSON.stringify(after));
  await plain();
});

// ---------- Block Drop ----------

await test('blocks: move, turn, drop fills a row and clears it, a full well ends the game', async () => {
  await startArcade(page, 'blocks');
  await plain();
  const p0 = await R(page, (r, g) => ({ px: g.px, rot: g.rot }));
  await press(page, 'KeyD');
  await press(page, 'Space');
  const p1 = await R(page, (r, g) => ({ px: g.px, rot: g.rot }));
  assert(p1.px === p0.px + 1 && p1.rot === p0.rot + 1, JSON.stringify([p0, p1]));
  // a bar over a row with a gap of four on the left
  await R(page, (r, g) => { const R0 = g.rows - 1; for (let c = 4; c < g.cols; c++) g.grid[R0][c] = 'O'; g.kind = 'I'; g.rot = 0; g.px = 0; g.py = 0; });
  await press(page, 'KeyW');
  await sim(page, 0.6);
  const l = await R(page, (r, g) => ({ lines: g.lines, score: g.score, bottom: g.grid[g.rows - 1].filter(Boolean).length }));
  assert(l.lines === 1 && l.score > 0 && l.bottom === 0, JSON.stringify(l));
  await R(page, (r, g) => { for (const row of g.grid) for (let c = 0; c < g.cols - 1; c++) row[c] = 'G'; g.spawn(); });
  await sim(page, 0.2);
  const o = await R(page, (r, g) => ({ st: r.state, g: g.state }));
  assert(o.st === 'card' && o.g === 'over', JSON.stringify(o));
  assert((await bests(page)).stored.blocks > 0, 'best saved');
});

await test('blocks: forgiving timing gives a longer moment before a piece locks', async () => {
  const lockAfter = async () => {
    await R(page, (r) => r.choose('again'));
    await sim(page, 1.2);
    await R(page, (r, g) => { g.kind = 'O'; g.rot = 0; g.px = 4; g.py = g.rows - 2; g.lockT = 0; g.fallT = 0; });
    await sim(page, 0.7);
    return R(page, (r, g) => g.grid[g.rows - 1].filter(Boolean).length > 0);
  };
  assert(await lockAfter() === true, 'locked after 0.7 s');
  await setAssist(page, { timing: true });
  await R(page, (r, g) => { g.state = 'over'; });
  await sim(page, 0.2);
  assert(await lockAfter() === false, 'still movable after 0.7 s with forgiving timing');
  await plain();
});

// ---------- Tunnel Trek ----------

const mazePath = (page) => R(page, (r, g) => {
  const q = [[g.pos.c, g.pos.r]], prev = { [`${g.pos.c},${g.pos.r}`]: null };
  while (q.length) {
    const [c, rr] = q.shift();
    if (c === g.end.c && rr === g.end.r) break;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = `${c + dx},${rr + dy}`; if (g.open(c + dx, rr + dy) && !(k in prev)) { prev[k] = [c, rr, dx, dy]; q.push([c + dx, rr + dy]); } }
  }
  const out = [];
  let k = `${g.end.c},${g.end.r}`;
  while (prev[k]) { const [c, rr, dx, dy] = prev[k]; out.unshift([dx, dy]); k = `${c},${rr}`; }
  return out;
});
const walk = async (page, path) => { for (const [dx, dy] of path) { await press(page, dx > 0 ? 'KeyD' : dx < 0 ? 'KeyA' : dy > 0 ? 'KeyS' : 'KeyW'); await sim(page, 0.12); } };

await test('maze: a wall bumps, [B] peeks at the map, the lantern ends the level, the next level comes', async () => {
  await startArcade(page, 'maze');
  await plain();
  await press(page, 'KeyW'); // (the start is in the top-left corner: a wall above)
  assert(await R(page, (r, g) => g.bumps) === 1, 'bumped');
  await press(page, 'KeyE');
  const pk = await R(page, (r, g) => ({ t: g.peekT, n: g.peeks }));
  assert(pk.t > 0 && pk.n === 2, JSON.stringify(pk));
  await walk(page, await mazePath(page));
  await sim(page, 0.3);
  const c = await R(page, (r, g) => ({ st: r.state, g: g.state, items: r.items }));
  assert(c.st === 'card' && c.g === 'level' && c.items[0] === 'next', JSON.stringify(c));
  assert((await bests(page)).stored.maze === 1, 'levels cleared saved');
  await R(page, (r) => r.choose('next'));
  assert(await R(page, (r, g) => g.level) === 1, 'level 2');
});

await test('maze: taking long counts tries; a skip is offered and moves on (marked skipped)', async () => {
  await setAssist(page, { offers: true });
  await sim(page, 1.2);
  // the skip is offered at the fifth try (levels: assist 3, speed 4 (none here: nothing moves), skip 5)
  let kind = null;
  for (let i = 0; i < 8 && kind !== 'skip'; i++) {
    await R(page, (r) => r.fail('any'));
    await sim(page, 0.1);
    kind = await page.evaluate(() => window.game.offer?.kind || null);
    if (kind && kind !== 'skip') await answerOffer(page, 'no');
  }
  if (kind === 'skip') await answerOffer(page, 'yes');
  await sim(page, 0.2);
  const s = await page.evaluate(() => ({ lv: window.game.current.runner.g.level, skipped: window.game.roster.progress.skipped?.maze || [] }));
  assert(s.lv === 2 && s.skipped.includes('lv1'), JSON.stringify({ kind, s }));
  await offersOff();
});

// ---------- Crate Shove ----------

await test('crates: every level can be solved (a solver), push, undo, start over, a level done', async () => {
  const solvable = await page.evaluate(async () => {
    const { CRATE_LEVELS, parseCrates } = await import('/src/scenes/arcade/games/crates.js');
    const solve = (L) => {
      const W = L.W, wall = L.isWall, G = new Set(L.goals.map(([c, r]) => r * W + c));
      const start = { p: L.p[1] * W + L.p[0], b: L.boxes.map(([c, r]) => r * W + c) };
      const key = (p, b) => `${p}|${[...b].sort((a, z) => a - z)}`;
      const seen = new Set([key(start.p, start.b)]);
      const q = [start];
      for (let i = 0; i < q.length && i < 4000000; i++) {
        const s = q[i];
        if (s.b.every((x) => G.has(x))) return true;
        for (const d of [1, -1, W, -W]) {
          const np = s.p + d;
          if (wall.has(np)) continue;
          let b = s.b;
          const bi = b.indexOf(np);
          if (bi >= 0) { const nb = np + d; if (wall.has(nb) || b.includes(nb)) continue; b = b.slice(); b[bi] = nb; }
          const k = key(np, b);
          if (!seen.has(k)) { seen.add(k); q.push({ p: np, b }); }
        }
      }
      return false;
    };
    return CRATE_LEVELS.map((l) => solve(parseCrates(l)));
  });
  assert(solvable.every(Boolean), JSON.stringify(solvable));
  await startArcade(page, 'crates');
  await plain();
  await press(page, 'KeyD');
  await sim(page, 0.2);
  assert(await R(page, (r, g) => g.boxes[0][0]) === 4, 'pushed');
  await press(page, 'Space');
  await sim(page, 0.2);
  const u = await R(page, (r, g) => ({ box: g.boxes[0][0], undos: g.undos }));
  assert(u.box === 3 && u.undos === 1, JSON.stringify(u));
  await press(page, 'KeyD'); await sim(page, 0.2);
  await press(page, 'KeyE'); await press(page, 'KeyE');
  assert(await R(page, (r, g) => g.moves) === 0, 'started over');
  await press(page, 'KeyD'); await sim(page, 0.2);
  await press(page, 'KeyD'); await sim(page, 0.3);
  const c = await R(page, (r, g) => ({ st: r.state, g: g.state }));
  assert(c.st === 'card' && c.g === 'level', JSON.stringify(c));
  assert((await bests(page)).stored.crates === 1, 'saved');
});

// ---------- Echo Bells ----------

const DIRKEY = ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'];
const answerTune = async (page) => {
  await page.waitForFunction(() => window.game.current.runner.g.phase === 'answer', null, { timeout: 5000 }).catch(() => {});
  for (let i = 0; i < 40 && await R(page, (r, g) => g.phase) !== 'answer'; i++) await sim(page, 0.25);
  const seq = await R(page, (r, g) => g.seq);
  for (const b of seq) { await press(page, DIRKEY[b]); await sim(page, 0.1); }
  return seq.length;
};

await test('simon: the tune plays, ringing it back (arrow keys) grows it, a wrong bell costs a heart', async () => {
  await startArcade(page, 'simon');
  await plain();
  const n1 = await answerTune(page);
  assert(await R(page, (r, g) => g.score) === n1, 'repeated');
  await sim(page, 1.2);
  const n2 = await answerTune(page);
  assert(n2 === n1 + 1 && await R(page, (r, g) => g.score) === n2, 'the tune grew');
  for (let i = 0; i < 40 && await R(page, (r, g) => g.phase) !== 'answer'; i++) await sim(page, 0.25);
  const wrong = await R(page, (r, g) => (g.seq[0] + 1) % 4);
  await press(page, DIRKEY[wrong]);
  assert(await R(page, (r, g) => g.hearts) === 2, 'a heart gone');
});

await test('simon: a click on a bell rings it (the mouse), three wrong bells end the game, best saved', async () => {
  for (let i = 0; i < 40 && await R(page, (r, g) => g.phase) !== 'answer'; i++) await sim(page, 0.25);
  const right = await R(page, (r, g) => g.seq[0]);
  const bell = await R(page, (r, g, G, i) => ({ x: g.bells[i].x, z: g.bells[i].z }), right);
  const at = await screenOf(page, bell.x, bell.z, 0.6);
  await page.mouse.click(at.x, at.y);
  await sim(page, 0.1);
  assert(await R(page, (r, g) => g.idx) >= 1, 'the click rang the right bell');
  for (let k = 0; k < 2; k++) {
    for (let i = 0; i < 40 && await R(page, (r, g) => g.phase) !== 'answer'; i++) await sim(page, 0.25);
    await R(page, (r, g) => g.answer((g.seq[g.idx] + 1) % 4));
    await sim(page, 0.1);
  }
  const c = await R(page, (r, g) => ({ st: r.state, g: g.state }));
  assert(c.st === 'card' && c.g === 'over', JSON.stringify(c));
  assert((await bests(page)).stored.simon >= 2, 'best saved');
  await setAssist(page, { timing: true });
  assert(await R(page, (r, g) => g.slow) > 1, 'forgiving timing plays the tune slower');
  await plain();
});

// ---------- Sleepy Lanterns ----------

await test('lights: the ring moves, [A] taps, a click taps, [B] takes it back, all asleep ends the level', async () => {
  await startArcade(page, 'lights');
  await plain();
  const c0 = await R(page, (r, g) => ({ ...g.cur, on: [...g.on] }));
  await press(page, 'KeyD');
  await press(page, 'Space');
  const c1 = await R(page, (r, g) => ({ ...g.cur, moves: g.moves, on: [...g.on] }));
  assert(c1.c === Math.min(c0.c + 1, 2) && c1.moves === 1 && c1.on.join() !== c0.on.join(), JSON.stringify([c0, c1]));
  await press(page, 'KeyE');
  const c2 = await R(page, (r, g) => ({ moves: g.moves, on: [...g.on] }));
  assert(c2.moves === 0 && c2.on.join() === c0.on.join(), 'taken back');
  const lamp = await R(page, (r, g) => g.lamps[0].g.position.clone());
  const at = await screenOf(page, lamp.x, lamp.z, 0.4);
  await page.mouse.move(at.x, at.y);
  await page.mouse.click(at.x, at.y);
  await sim(page, 0.1);
  assert(await R(page, (r, g) => g.moves) === 1, 'the click tapped');
  // solve it (try every set of taps on the 3x3 square)
  await R(page, (r, g) => {
    g.reset();
    const n = g.n;
    for (let m = 0; m < 1 << (n * n); m++) {
      const on = [...g.L.on];
      const flip = (c, rr) => { for (const [dc, dr] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = c + dc, y = rr + dr; if (x >= 0 && y >= 0 && x < n && y < n) on[y * n + x] = !on[y * n + x]; } };
      for (let i = 0; i < n * n; i++) if (m & (1 << i)) flip(i % n, Math.floor(i / n));
      if (on.every((x) => !x)) { for (let i = 0; i < n * n; i++) if (m & (1 << i)) g.tap(i % n, Math.floor(i / n)); return; }
    }
  });
  await sim(page, 0.2);
  const d = await R(page, (r, g) => ({ st: r.state, g: g.state }));
  assert(d.st === 'card' && d.g === 'level', JSON.stringify(d));
  assert((await bests(page)).stored.lights === 1, 'saved');
});

// ---------- Brick Bonk ----------

await test('bonk: the paddle follows the stick and the mouse, [A] launches, a brick scores, three lost balls end it', async () => {
  await startArcade(page, 'bonk');
  await plain();
  await hold(page, 'KeyA', 0.3);
  assert(await R(page, (r, g) => g.px) < -1, 'moved left');
  const at = await screenOf(page, 3, 7.4, 0.2);
  await page.mouse.move(at.x, at.y);
  await sim(page, 0.4);
  const px = await R(page, (r, g) => g.px);
  assert(Math.abs(px - 3) < 0.6, `the mouse moved the paddle (${px})`);
  await press(page, 'Space');
  assert(await R(page, (r, g) => !g.held && g.ball.vz < 0), 'launched');
  await R(page, (r, g) => { const k = g.bricks[g.bricks.length - 1]; g.ball.x = k.x; g.ball.z = k.z + 0.7; g.ball.vx = 0; g.ball.vz = -8; });
  await sim(page, 0.2);
  assert(await R(page, (r, g) => g.score) > 0, 'a brick bonked');
  await R(page, (r, g) => { g.lose(); g.lose(); g.lose(); });
  await sim(page, 0.2);
  const c = await R(page, (r, g) => ({ st: r.state, g: g.state }));
  assert(c.st === 'card' && c.g === 'over', JSON.stringify(c));
  assert((await bests(page)).stored.bonk > 0, 'saved');
});

await test('bonk: aim help shows the ball\'s path; forgiving timing catches a ball just past the paddle', async () => {
  await R(page, (r) => r.choose('again'));
  await sim(page, 1.2);
  assert(!(await R(page, (r, g) => g.dots.list.some((d) => d.visible))), 'no path without aim help');
  await setAssist(page, { aim: 1, aimChosen: true });
  await sim(page, 0.1);
  assert(await R(page, (r, g) => g.dots.list.some((d) => d.visible)), 'aim help draws the path');
  const edge = async () => {
    await R(page, (r, g) => { g.held = false; g.px = 0; g.ball = { x: g.hw + 0.24 + 0.25, z: 6.6, vx: 0, vz: 6 }; });
    await sim(page, 0.15);
    return R(page, (r, g) => g.ball.vz < 0);
  };
  assert(await edge() === false, 'missed without forgiving timing');
  await setAssist(page, { timing: true });
  await R(page, (r, g) => { g.lives = 3; g.state = 'play'; });
  assert(await edge() === true, 'caught with forgiving timing');
  await plain();
});

// ---------- Paddle Pals ----------

await test('pong: up/down moves, [A] serves, a point counts, winning to 7 beats Pip (trial), a friend can join', async () => {
  await startArcade(page, 'pong');
  await plain();
  await hold(page, 'KeyW', 0.3);
  assert(await R(page, (r, g) => g.y1) < -1, 'moved up');
  await press(page, 'Space');
  assert(await R(page, (r, g) => !g.held && g.ball.vx > 0), 'served');
  await R(page, (r, g) => { g.ball.x = 9.6; g.ball.z = 4.5; g.ball.vx = 10; });
  await sim(page, 0.1);
  assert(await R(page, (r, g) => g.mine) === 1, 'a point for me');
  await R(page, (r, g) => { g.mine = 6; g.point(1); });
  await sim(page, 0.2);
  const c = await R(page, (r, g, G) => ({ st: r.state, title: r.card?.title, trial: !!G.passport.loadPassport(G.solo.profile.id).trials['pong.win'] }));
  assert(c.st === 'card' && /Pip/.test(c.title) && c.trial, JSON.stringify(c));
  await R(page, (r) => r.choose('again'));
  await sim(page, 1.2);
  await press(page, 'Enter'); // the arrow keys' scheme presses A: a friend takes Pip's paddle
  assert(await R(page, (r, g) => !!g.two), 'a second player joined');
});

await test('pong: aim help marks where the ball comes', async () => {
  await R(page, (r) => r.choose('again'));
  await R(page, (r) => r.makeGame());
  await sim(page, 1.2);
  await setAssist(page, { aim: 2, aimChosen: true });
  await R(page, (r, g) => { g.held = false; g.ball = { x: 0, z: 0, vx: -7, vz: 3 }; });
  await sim(page, 0.05);
  assert(await R(page, (r, g) => g.mark.visible), 'marked');
  await plain();
});

// ---------- Rock Patrol ----------

await test('rocks: turn, push (held), zap; a zapped big rock splits; three bumps end it', async () => {
  await startArcade(page, 'rocks');
  await plain();
  assert((await page.evaluate(() => window.game.current.holdButtons)).includes('a'), 'push is a held button (hold to toggle)');
  const a0 = await R(page, (r, g) => g.s.a);
  await hold(page, 'KeyA', 0.3);
  assert(await R(page, (r, g) => g.s.a) !== a0, 'turned');
  await hold(page, 'Space', 0.4);
  assert(await R(page, (r, g) => Math.hypot(g.s.vx, g.s.vz)) > 1, 'pushed forward');
  await press(page, 'KeyE');
  assert(await R(page, (r, g) => g.shots.length) >= 1, 'zapped');
  const n0 = await R(page, (r, g) => g.rocks.length);
  await R(page, (r, g) => { const k = g.rocks.find((x) => x.size === 3); g.shots.length = 0; g.fireT = 0; g.s.x = k.x - 3; g.s.z = k.z; g.s.a = Math.PI / 2; g.s.vx = 0; g.s.vz = 0; g.safe = 5; g.fire(); });
  await sim(page, 0.4);
  const r1 = await R(page, (r, g) => ({ n: g.rocks.length, score: g.score }));
  assert(r1.n === n0 + 1 && r1.score >= 20, JSON.stringify({ n0, r1 }));
  await R(page, (r, g) => { g.bumped(); g.bumped(); g.bumped(); });
  await sim(page, 0.2);
  const c = await R(page, (r, g) => ({ st: r.state, g: g.state }));
  assert(c.st === 'card' && c.g === 'over', JSON.stringify(c));
  assert((await bests(page)).stored.rocks >= 20, 'saved');
});

await test('rocks: aim help bends a zap toward a rock; hold to toggle keeps pushing after one tap', async () => {
  await R(page, (r) => r.choose('again'));
  await sim(page, 1.2);
  const shot = async () => R(page, (r, g) => {
    g.rocks.forEach((k) => k.m.removeFromParent()); g.rocks = [];
    g.addRock(3, 6, 1.5, 0); g.rocks[0].vx = 0; g.rocks[0].vz = 0;
    g.shots.forEach((b) => b.m.removeFromParent()); g.shots = []; g.fireT = 0;
    g.s.x = 0; g.s.z = 0; g.s.a = Math.PI / 2; g.fire();
    return g.shots[0].vz;
  });
  assert(Math.abs(await shot()) < 0.01, 'straight without aim help');
  await setAssist(page, { aim: 2, aimChosen: true });
  assert(await shot() > 0.5, 'bent toward the rock with aim help');
  await setAssist(page, { aim: 0, toggle: true });
  await sim(page, 0.1);
  await R(page, (r, g) => { g.s.vx = 0; g.s.vz = 0; g.safe = 9; g.rocks.forEach((k) => { k.x = 11; k.z = 7; k.vx = 0; k.vz = 0; }); });
  await press(page, 'Space');
  await sim(page, 0.5);
  assert(await R(page, (r, g) => Math.hypot(g.s.vx, g.s.vz)) > 1, 'still pushing after a tap');
  await press(page, 'Space');
  await plain();
});

// ---------- every game ----------

await test('every game: game speed slows it, a profile keeps its own best, back goes to its cabinet', async () => {
  assert(await page.evaluate(() => window.game.current.speedable === true), 'game speed applies');
  const keys = ['snake', 'blocks', 'maze', 'crates', 'simon', 'lights', 'bonk', 'pong', 'rocks'];
  const plays = await page.evaluate(() => JSON.parse(localStorage.getItem(`couch-party.solo.${window.game.solo.profile.id}`)).progress.arcade.plays);
  assert(keys.every((k) => plays[k] > 0), JSON.stringify(plays));
  await R(page, (r) => r.leave({}));
  await page.waitForFunction(() => window.game.current?.constructor?.name === 'SoloIslandScene' && !window.game.switching && window.game.current.player, null, { timeout: 30000 });
  const at = await page.evaluate(() => { const I = window.game.current; const pl = I.map.places.find((p) => p.id === 'arc-rocks'); return Math.hypot(I.player.x - pl.door.x, I.player.z - pl.door.z); });
  assert(at < 1.5, `back by the Rock Patrol cabinet (${at})`);
  // another child on this device has no bests of their own
  const other = await page.evaluate(async () => {
    const P = await import('/src/core/profiles.js');
    const prof = P.createProfile({ name: 'Mia', colorIndex: 3 });
    const raw = localStorage.getItem(P.soloSaveKey(prof.id));
    return raw ? JSON.parse(raw).progress?.arcade || null : null;
  });
  assert(!other, 'a new profile starts with no high scores');
});

await test('no console errors', async () => { assert(!page.errors.length, page.errors.join('\n')); });
await close(page);
done();
