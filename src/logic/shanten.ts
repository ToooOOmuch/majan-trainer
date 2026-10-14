import { Counts, TILE_KINDS, Tile, isHonor, isYaochu, toCounts } from './tiles';

/** 通常形（4面子1雀頭）のシャンテン数。和了形なら -1。鳴きのない13枚・14枚の手が対象 */
export function standardShanten(c: Counts): number {
  const counts = [...c];
  let best = 8;

  const search = (pos: number, mentsu: number, taatsu: number, pair: number) => {
    while (pos < TILE_KINDS && counts[pos] === 0) pos++;
    if (pos >= TILE_KINDS) {
      const t = Math.min(taatsu, 4 - mentsu);
      const s = 8 - mentsu * 2 - t - pair;
      if (s < best) best = s;
      return;
    }
    const num = pos % 9;
    const honor = isHonor(pos);

    if (counts[pos] >= 3) {
      counts[pos] -= 3;
      search(pos, mentsu + 1, taatsu, pair);
      counts[pos] += 3;
    }
    if (!honor && num <= 6 && counts[pos + 1] > 0 && counts[pos + 2] > 0) {
      counts[pos]--;
      counts[pos + 1]--;
      counts[pos + 2]--;
      search(pos, mentsu + 1, taatsu, pair);
      counts[pos]++;
      counts[pos + 1]++;
      counts[pos + 2]++;
    }
    if (counts[pos] >= 2) {
      counts[pos] -= 2;
      search(pos, mentsu, taatsu + 1, pair);
      counts[pos] += 2;
    }
    if (!honor && num <= 7 && counts[pos + 1] > 0) {
      counts[pos]--;
      counts[pos + 1]--;
      search(pos, mentsu, taatsu + 1, pair);
      counts[pos]++;
      counts[pos + 1]++;
    }
    if (!honor && num <= 6 && counts[pos + 2] > 0) {
      counts[pos]--;
      counts[pos + 2]--;
      search(pos, mentsu, taatsu + 1, pair);
      counts[pos]++;
      counts[pos + 2]++;
    }
    // 孤立牌として扱う
    counts[pos]--;
    search(pos, mentsu, taatsu, pair);
    counts[pos]++;
  };

  for (let t = 0; t < TILE_KINDS; t++) {
    if (counts[t] >= 2) {
      counts[t] -= 2;
      search(0, 0, 0, 1);
      counts[t] += 2;
    }
  }
  search(0, 0, 0, 0);
  return best;
}

export function chiitoiShanten(c: Counts): number {
  let pairs = 0;
  let kinds = 0;
  for (const n of c) {
    if (n >= 1) kinds++;
    if (n >= 2) pairs++;
  }
  return 6 - pairs + Math.max(0, 7 - kinds);
}

export function kokushiShanten(c: Counts): number {
  let kinds = 0;
  let pair = 0;
  c.forEach((n, t) => {
    if (isYaochu(t) && n > 0) {
      kinds++;
      if (n >= 2) pair = 1;
    }
  });
  return 13 - kinds - pair;
}

export function shanten(c: Counts): number {
  return Math.min(standardShanten(c), chiitoiShanten(c), kokushiShanten(c));
}

export function shantenOf(tiles: Tile[]): number {
  return shanten(toCounts(tiles));
}

function isMentsuOnly(c: Counts, pos: number): boolean {
  while (pos < TILE_KINDS && c[pos] === 0) pos++;
  if (pos >= TILE_KINDS) return true;
  if (c[pos] >= 3) {
    c[pos] -= 3;
    const ok = isMentsuOnly(c, pos);
    c[pos] += 3;
    if (ok) return true;
  }
  if (!isHonor(pos) && pos % 9 <= 6 && c[pos + 1] > 0 && c[pos + 2] > 0) {
    c[pos]--;
    c[pos + 1]--;
    c[pos + 2]--;
    const ok = isMentsuOnly(c, pos);
    c[pos]++;
    c[pos + 1]++;
    c[pos + 2]++;
    return ok;
  }
  return false;
}

/** 14枚の手が和了形かどうか（シャンテン数の計算より速い） */
export function isAgari(c: Counts): boolean {
  if (chiitoiShanten(c) === -1 || kokushiShanten(c) === -1) return true;
  for (let t = 0; t < TILE_KINDS; t++) {
    if (c[t] < 2) continue;
    c[t] -= 2;
    const ok = isMentsuOnly(c, 0);
    c[t] += 2;
    if (ok) return true;
  }
  return false;
}

/** 13枚の手の待ち牌（5枚目になる牌は除く） */
export function waits(c: Counts): Tile[] {
  const result: Tile[] = [];
  for (let t = 0; t < TILE_KINDS; t++) {
    if (c[t] >= 4) continue;
    c[t]++;
    if (isAgari(c)) result.push(t);
    c[t]--;
  }
  return result;
}

export type DiscardOption = {
  discard: Tile;
  shanten: number;
  /** シャンテン数を進める牌 */
  ukeireTiles: Tile[];
  /** 受け入れ枚数（手の中で見えている牌は引く） */
  ukeire: number;
};

/** 14枚の手から、各牌を切ったときのシャンテン数と受け入れを調べる */
export function discardOptions(hand: Tile[]): DiscardOption[] {
  const c = toCounts(hand);
  const options: DiscardOption[] = [];
  for (let d = 0; d < TILE_KINDS; d++) {
    if (c[d] === 0) continue;
    c[d]--;
    const s = shanten(c);
    const ukeireTiles: Tile[] = [];
    let ukeire = 0;
    for (let t = 0; t < TILE_KINDS; t++) {
      if (c[t] >= 4) continue;
      // 残り枚数。手の中の牌と、切った牌は見えているので引く
      const left = 4 - c[t] - (t === d ? 1 : 0);
      if (left <= 0) continue;
      c[t]++;
      if (shanten(c) < s) {
        ukeireTiles.push(t);
        ukeire += left;
      }
      c[t]--;
    }
    c[d]++;
    options.push({ discard: d, shanten: s, ukeireTiles, ukeire });
  }
  options.sort((a, b) => a.shanten - b.shanten || b.ukeire - a.ukeire || a.discard - b.discard);
  return options;
}

/** 最善の打牌（シャンテン数が最小で、受け入れ枚数が最大のもの） */
export function bestDiscards(options: DiscardOption[]): Tile[] {
  const top = options[0];
  return options
    .filter((o) => o.shanten === top.shanten && o.ukeire === top.ukeire)
    .map((o) => o.discard);
}
