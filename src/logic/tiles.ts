// 牌は 0〜33 の番号で表す。
// 0-8: 萬子 1-9, 9-17: 筒子 1-9, 18-26: 索子 1-9, 27-33: 東南西北白發中
export type Tile = number;
export type Counts = number[]; // 長さ34、各牌の枚数

export const TILE_KINDS = 34;
export const SUITS = ['m', 'p', 's', 'z'] as const;
export type Suit = (typeof SUITS)[number];

export const HONOR_NAMES = ['東', '南', '西', '北', '白', '發', '中'];
export const SUIT_NAMES: Record<Suit, string> = { m: '萬', p: '筒', s: '索', z: '' };

export const EAST = 27;
export const SOUTH = 28;
export const WEST = 29;
export const NORTH = 30;
export const WHITE = 31;
export const GREEN = 32;
export const RED = 33;
export const WINDS = [EAST, SOUTH, WEST, NORTH];
export const DRAGONS = [WHITE, GREEN, RED];

export function suitOf(t: Tile): Suit {
  return SUITS[Math.floor(t / 9)];
}

export function numberOf(t: Tile): number {
  return (t % 9) + 1;
}

export function isHonor(t: Tile): boolean {
  return t >= 27;
}

export function isTerminal(t: Tile): boolean {
  return !isHonor(t) && (numberOf(t) === 1 || numberOf(t) === 9);
}

export function isYaochu(t: Tile): boolean {
  return isHonor(t) || isTerminal(t);
}

export function isSimple(t: Tile): boolean {
  return !isYaochu(t);
}

export function makeTile(suit: Suit, num: number): Tile {
  return SUITS.indexOf(suit) * 9 + num - 1;
}

/** "123m456p77z" のような表記を牌の配列にする */
export function parseTiles(s: string): Tile[] {
  const result: Tile[] = [];
  let pending: number[] = [];
  for (const ch of s.replace(/\s/g, '')) {
    if (ch >= '0' && ch <= '9') {
      pending.push(Number(ch));
    } else if ((SUITS as readonly string[]).includes(ch)) {
      for (const n of pending) result.push(makeTile(ch as Suit, n));
      pending = [];
    } else {
      throw new Error(`不正な文字: ${ch}`);
    }
  }
  if (pending.length) throw new Error('種類の指定がありません');
  return result;
}

/** 牌の配列を "123m456p77z" のような表記にする */
export function formatTiles(tiles: Tile[]): string {
  const sorted = [...tiles].sort((a, b) => a - b);
  let out = '';
  for (const suit of SUITS) {
    const nums = sorted.filter((t) => suitOf(t) === suit).map(numberOf);
    if (nums.length) out += nums.join('') + suit;
  }
  return out;
}

export function tileName(t: Tile): string {
  if (isHonor(t)) return HONOR_NAMES[t - 27];
  return `${numberOf(t)}${SUIT_NAMES[suitOf(t)]}`;
}

export function toCounts(tiles: Tile[]): Counts {
  const c = new Array(TILE_KINDS).fill(0);
  for (const t of tiles) c[t]++;
  return c;
}

export function fromCounts(c: Counts): Tile[] {
  const tiles: Tile[] = [];
  c.forEach((n, t) => {
    for (let i = 0; i < n; i++) tiles.push(t);
  });
  return tiles;
}

export function sortTiles(tiles: Tile[]): Tile[] {
  return [...tiles].sort((a, b) => a - b);
}

/** ドラ表示牌から実際のドラを求める */
export function doraFromIndicator(t: Tile): Tile {
  if (t < 27) return Math.floor(t / 9) * 9 + ((t % 9) + 1) % 9;
  if (t <= NORTH) return EAST + ((t - EAST + 1) % 4);
  return WHITE + ((t - WHITE + 1) % 3);
}
