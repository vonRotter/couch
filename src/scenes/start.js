import * as THREE from 'three';
import { BaseScene } from '../core/scene.js';
import { Character } from '../core/character.js';
import { COLORS, PLAYER_COLORS, toon } from '../core/palette.js';
import { addLights, skyTexture, makeTree, makeCloud, makeFlower, seeded } from '../core/world.js';
import { KEYBOARD_SCHEMES } from '../core/input.js';
import { t, addStrings } from '../core/i18n.js';
import { ProfilePicker, listProfiles } from '../core/profiles.js';

// The start screen: "Who is playing?" over a little island with everyone's beans. Any keyboard or gamepad
// steers the picker. The last player is chosen already: [A] goes straight to that player's own island
// (Game.enterSolo); "New player" makes a profile, and "Play together" opens the shared island for a group
// (Game.openTogether), where everyone joins as a profile or a guest.

addStrings({
  en: { 'start.sub': 'Learn to play games, on your own island or together' },
  no: { 'start.sub': 'Lær å spille spill, på din egen øy eller sammen' },
});

export class StartScene extends BaseScene {
  constructor(game) {
    super(game);
    this.key = null;
    this.ownMenu = true; // no pause menu here (Esc / Start do nothing)
    this.launching = false;
    // nobody plays on the start screen: the device that picks joins as that player
    for (const p of [...game.roster.players]) game.roster.leave(p);

    this.camera.fov = 40;
    this.camera.position.set(0, 4.2, 15);
    this.camera.lookAt(0, 3.2, 0);
    this.camera.updateProjectionMatrix();
    this.scene.background = skyTexture('#6fd0ff', '#fff1d6');
    addLights(this.scene, { size: 14 });
    this.buildWorld();
    this.buildBeans();

    this.picker = new ProfilePicker(this, {
      className: 'start-panel',
      header: `<div class="title-logo start-logo">${t('hub.title')}</div><div class="start-sub">${t('start.sub')}</div>`,
      inputs: () => this.devices(),
      onDone: (profile, deviceId) => { this.picker = null; this.launching = true; game.enterSolo(profile, deviceId); },
      onTogether: (deviceId) => { this.picker = null; this.launching = true; game.openTogether(deviceId); },
    });
    game.audio.playMusic('hub');
  }

  /** Every keyboard scheme and every connected gamepad can steer the picker. */
  devices() {
    const out = KEYBOARD_SCHEMES.map((s) => ({ d: this.game.input.get(s.id), id: s.id }));
    for (let i = 0; i < 4; i++) {
      const d = this.game.input.get(`gp${i}`);
      if (d?.connected) out.push({ d, id: d.id });
    }
    return out;
  }

  buildWorld() {
    const s = this.scene;
    const water = new THREE.Mesh(new THREE.CircleGeometry(160, 40), toon(COLORS.water));
    water.rotation.x = -Math.PI / 2;
    water.position.y = -0.6;
    s.add(water);
    const sand = new THREE.Mesh(new THREE.CylinderGeometry(9.6, 10.4, 1, 48), toon(COLORS.sand));
    sand.position.y = -0.55;
    sand.receiveShadow = true;
    const grass = new THREE.Mesh(new THREE.CylinderGeometry(8.4, 8.8, 1, 48), toon(COLORS.grass));
    grass.position.y = -0.45;
    grass.receiveShadow = true;
    s.add(sand, grass);
    const rand = seeded(7);
    for (const [x, z, k] of [[-6.5, -3, 1.3], [6.8, -2.5, 1.2], [-3.5, -6, 1.5], [3.8, -6.2, 1.4], [0, -7.4, 1.6], [-8, 1.5, 1]]) {
      const tr = makeTree(rand, k);
      tr.position.set(x, 0, z);
      s.add(tr);
    }
    for (let i = 0; i < 30; i++) {
      const f = makeFlower(rand);
      const a = rand() * Math.PI * 2, r = 2 + rand() * 6;
      f.position.set(Math.cos(a) * r, 0, Math.sin(a) * r - 1);
      s.add(f);
    }
    this.clouds = [];
    for (let i = 0; i < 6; i++) {
      const c = makeCloud(rand, 1.4 + rand());
      c.position.set(-30 + i * 12, 11 + rand() * 4, -30 - rand() * 10);
      c.userData.speed = 0.3 + rand() * 0.4;
      s.add(c);
      this.clouds.push(c);
    }
  }

  /** One bean per profile along the front of the island (and two friends when there are none yet). */
  buildBeans() {
    const list = listProfiles().slice(0, 8);
    const looks = list.length ? list.map((p) => ({ id: p.id, color: PLAYER_COLORS[p.colorIndex]?.hex ?? COLORS.white, hat: p.hat ?? 1 }))
      : [{ color: PLAYER_COLORS[0].hex, hat: 1 }, { color: PLAYER_COLORS[3].hex, hat: 2 }];
    const n = looks.length;
    this.beans = looks.map((lk, i) => {
      const ch = new Character(lk.color, { hat: lk.hat });
      const x = (i - (n - 1) / 2) * Math.min(1.6, 11 / Math.max(1, n));
      ch.group.position.set(x, 0, 3.4);
      ch.face(0, 1);
      this.scene.add(ch.group);
      return { ...lk, ch, x, hop: 0, phase: i * 0.7 };
    });
  }

  update(dt) {
    this.picker?.update(dt);
    const cur = this.picker?.current;
    const together = !!cur?.together;
    for (const b of this.beans) {
      // the chosen player's bean hops; on "Play together" everyone hops
      const active = together || (b.id && cur?.prof?.id === b.id);
      b.hop = active ? (b.hop + dt * 5.5) % Math.PI : Math.max(0, b.hop - dt * 4);
      const y = active ? Math.abs(Math.sin(b.hop)) * 0.7 : 0;
      b.ch.group.position.set(b.x, y, 3.4);
      b.ch.update(dt, { moving: 0, grounded: y < 0.05 });
    }
    for (const c of this.clouds) {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 40) c.position.x = -40;
    }
  }

  idle(dt) {
    for (const b of this.beans) b.ch.update(dt, {});
  }
}
