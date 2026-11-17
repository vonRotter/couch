// The Game Hall's nine classic arcade games (the classic mini-games round). Each one teaches one basic video-game
// skill, in the island's own toon look with its own name (English and Norwegian, strings.js); nothing is copied
// from the originals but the idea. The order is the row of cabinets along the hall's back wall (left to right).
//
// key: the game key (main.js GAMES, the passport, the high scores); kind: 'score' (play until the game is over,
// best score) or 'levels' (levels in order, best = levels cleared); color: the cabinet; mouse: the mouse plays
// it too; calm: nothing moves by itself (no "slower game" offer); holds: buttons that are held (hold to toggle, "Help me play").

export const ARCADE = [
  { key: 'snake', kind: 'score', color: 0x8ac926, accent: 0xff5d73 }, // Wiggle Worm: reaction, planning ahead
  { key: 'blocks', kind: 'score', color: 0x4cc9f0, accent: 0xffc93c }, // Block Drop: spatial reasoning
  { key: 'maze', kind: 'levels', calm: true, color: 0x9a6440, accent: 0xffd23f }, // Tunnel Trek: finding a way, reading a map
  { key: 'crates', kind: 'levels', calm: true, color: 0xc68a52, accent: 0x3ddc97 }, // Crate Shove: planning, undo
  { key: 'simon', kind: 'score', color: 0x9b5de5, accent: 0xffc93c, mouse: true }, // Echo Bells: remembering a sequence
  { key: 'lights', kind: 'levels', calm: true, color: 0x3a4a9a, accent: 0xffd23f, mouse: true }, // Sleepy Lanterns: logic
  { key: 'bonk', kind: 'score', color: 0xff5d73, accent: 0x4cc9f0, mouse: true }, // Brick Bonk: timing, angles
  { key: 'pong', kind: 'score', color: 0x3ddc97, accent: 0xffffff }, // Paddle Pals: timing, angles (two players)
  { key: 'rocks', kind: 'score', color: 0x5b4fd8, accent: 0xff9f1c, holds: ['a'] }, // Rock Patrol: aiming, steering with momentum
];
export const ARCADE_KEYS = ARCADE.map((g) => g.key);
export const arcadeDef = (key) => ARCADE.find((g) => g.key === key) || null;
export const isArcade = (key) => ARCADE_KEYS.includes(key);
