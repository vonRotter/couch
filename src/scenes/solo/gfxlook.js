import * as THREE from 'three';

// The solo island's side of the graphics trial (core/gfx.js has the switches and the post-processing chain).
// Each look is switched on and off here every frame from game.gfx.on, so a change in the settings shows at once.

export class IslandLook {
  constructor(host) {
    this.host = host;
    this.gfx = host.game.gfx;
    this.t = 0;
  }

  update(dt) {
    this.t += dt;
  }

  /** What the post-processing needs this frame (core/gfx.js render()). */
  frameLook() {
    return {};
  }

  render(renderer) {
    const H = this.host;
    if (!this.gfx) { renderer.render(H.scene, H.camera); return; }
    this.gfx.render(H.scene, H.camera, this.frameLook());
  }

  dispose() {}
}
