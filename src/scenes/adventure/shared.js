import { makeSeagull, makeDuck } from './props.js';

// Helpers shared by every room: Mine (the seagull who is Pip's hat AND pet) sitting on Pip's head
// with her duck, her speech bubble, her idle animation and the hotspot for clicking her.

export const GRUM_CSS = '#7b6cf6';
export const GULL_CSS = '#4a9fd8';

/** Put the seagull (P.gull) and her duck on Pip's head. */
export function putGullOnHead(s, P) {
  const gull = P.gull;
  gull.parent?.remove(gull);
  gull.position.set(-0.05, -0.06, -0.02);
  gull.rotation.set(0, -Math.PI / 2, 0);
  gull.scale.setScalar(0.8);
  gull.userData.head.rotation.set(0, 0, 0);
  s.attachToHead(gull);
  if (!P.gullDuck) {
    const duck = makeDuck();
    duck.scale.setScalar(0.42);
    duck.position.set(0.24, -0.02, 0.12);
    duck.rotation.y = -1.2;
    s.attachToHead(duck);
    P.gullDuck = duck;
  }
}

/** For rooms after scene 1: make Mine and sit her on Pip's head. */
export function addMine(s, P) {
  P.gull = makeSeagull();
  P.next ||= {};
  P.next.gullLook = 1;
  if (s.flag('gullOnHead')) putGullOnHead(s, P);
}

/** Mine's speaker entry (voice: high and fast, a squawk before every line). */
export function mineActor(s, P) {
  return {
    name: () => (s.flag('gullOnHead') ? 'adv.who.mine' : 'adv.who.gull'), css: GULL_CSS, voice: { pitch: 2, rate: 1.3 }, sfx: 'mine',
    head: (v) => P.gull.localToWorld(v.set(0.2, 0.75, 0)),
  };
}

/** Beady head jerks, a talking beak and a flap now and then. */
export function animateGull(s, dt, P) {
  const gu = P.gull.userData;
  const tm = s.room.time;
  gu.jaw.rotation.z = s.isTalking('gull') ? -Math.abs(Math.sin(tm * 12)) * 0.6 : 0;
  if ((P.next.gullLook -= dt) <= 0) {
    P.next.gullLook = 0.8 + Math.random() * 2.2;
    if (!s.tweens.some((tw) => tw.obj === gu.head)) gu.head.rotation.y = (Math.random() - 0.5) * 1.2;
  }
  const flap = Math.max(0, Math.sin(tm * 0.9)) > 0.97 || s.isTalking('gull') ? Math.sin(tm * 30) * 0.5 : 0;
  gu.wings[0].rotation.x = flap;
  gu.wings[1].rotation.x = -flap;
}
