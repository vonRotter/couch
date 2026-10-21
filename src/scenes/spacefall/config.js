// Spacefall tuning constants (from the Spacefall repo, lightly retuned for the couch).
// World units: 1 unit = 1 map tile. +y is up.

export const STEP = 1 / 60; // fixed simulation step

export const SHIP = {
  halfW: 0.33,
  halfH: 0.28,
  startAmmo: 3,
  maxAmmo: 7,
  fireCooldown: 0.22,
  dashSpeed: 17,
  dashTime: 0.17,
  dashCooldown: 0.55,
  dashInvuln: 0.24,
  respawnInvuln: 2.0,
  aimAssistDeg: 9,
  aimAssistRange: 22,
  emptyRefill: 5, // seconds with an empty rack before one missile reloads by itself
};

// Movement when the map has artificial gravity.
export const GRAV = {
  gravity: 15,
  thrust: 33, // upward accel while thrusting (net = thrust - gravity)
  maxRise: 8,
  maxFall: 11,
  accelGround: 55,
  accelAir: 34,
  maxRun: 7.2,
  frictionGround: 14,
  dragAir: 2.2,
  fuelMax: 1,
  fuelUse: 0.85, // per second while thrusting
  fuelRegenGround: 3,
  fuelRegenAir: 0.32,
  stompSpeed: 1.5,
  stompBounce: 9,
};

// Movement in zero-g maps.
export const ZERO = {
  accel: 24,
  maxSpeed: 9.5,
  drag: 0.55,
  restitution: 0.45,
};

export const MISSILE = {
  speed: 23,
  gravity: 5, // only on gravity maps
  ownerGrace: 0.14, // seconds before the shooter can be hit by their own missile
  pickupRadius: 0.72,
  dropGravity: 18,
};

export const VERSUS = {
  roundEndDelay: 1.4,
  readyTime: 1.4,
  crateInterval: [11, 17],
  alienInterval: [9, 15],
  maxHazardAliens: 2,
};

export const FRENZY = {
  respawn: 2.2,
};

export const COOP = {
  waves: 7, // wave 7 is the Hive Queen
  respawnDelay: 2.6,
  waveBreak: 3.5,
  spawnInterval: [0.55, 1.15],
};

export const VIEW = {
  fov: 40,
  // Visible world height of a follow viewport, by its share of the screen height.
  heightFull: 17,
  heightHalf: 12.5,
  followLerp: 7,
};
