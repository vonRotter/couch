export class IslandGames {
  constructor(host) { this.host = host; }
  interactions() { return false; }
  onLand() {}
  onJump() {}
  tick() {}
  update() {}
  updateMode() { this.host.mode = 'walk'; }
  tasks() { return []; }
  dispose() {}
}
