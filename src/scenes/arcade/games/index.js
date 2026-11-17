import { SnakeGame } from './snake.js';
import { BlocksGame } from './blocks.js';
import { MazeGame } from './maze.js';
import { CratesGame } from './crates.js';
import { SimonGame } from './simon.js';
import { LightsGame } from './lights.js';
import { BonkGame } from './bonk.js';
import { PongGame } from './pong.js';
import { RocksGame } from './rocks.js';

// The nine classic games' logic and toon boards (one class each), by game key (defs.js).
export const GAME_CLASSES = {
  snake: SnakeGame, blocks: BlocksGame, maze: MazeGame, crates: CratesGame, simon: SimonGame,
  lights: LightsGame, bonk: BonkGame, pong: PongGame, rocks: RocksGame,
};
