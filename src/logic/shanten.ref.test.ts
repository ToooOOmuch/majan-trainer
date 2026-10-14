import { describe, expect, it } from 'vitest';
import { seededRng, shuffle } from './random';
import { standardShanten } from './shanten';
import { Counts, TILE_KINDS, isHonor, toCounts } from './tiles';

// 速い計算方法が、素直な総当たり（旧版）と同じ結果になることを確かめる
/** 通常形（4面子1雀頭）のシャンテン数。和了形なら -1。鳴きのない13枚・14枚の手が対象 */
function referenceShanten(c: Counts): number {
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

describe('シャンテン数の高速版', () => {
  it('ランダムな手で総当たりと一致する', () => {
    const rng = seededRng(7);
    const wall = [...Array(TILE_KINDS).keys()].flatMap((t) => [t, t, t, t]);
    for (let i = 0; i < 3000; i++) {
      const n = i % 2 ? 13 : 14;
      const c = toCounts(shuffle(rng, wall).slice(0, n));
      expect(standardShanten(c)).toBe(referenceShanten(c));
    }
  });

  it('1色に偏った手でも一致する', () => {
    const rng = seededRng(8);
    const wall = [...Array(9).keys()].flatMap((t) => [t, t, t, t]).concat([27, 28, 29, 30, 31, 32, 33]);
    for (let i = 0; i < 1000; i++) {
      const c = toCounts(shuffle(rng, wall).slice(0, 14));
      expect(standardShanten(c)).toBe(referenceShanten(c));
    }
  });
});
