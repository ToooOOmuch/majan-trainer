import { DangerInfo, ReadContext, evaluateDanger } from './danger';
import { Rng, pick, randInt, shuffle } from './random';
import { ScoreResult, WinContext, pointsFor, scoreHand } from './scoring';
import { DiscardOption, bestDiscards, chiitoiShanten, discardOptions, standardShanten, waits } from './shanten';
import { EAST, SOUTH, TILE_KINDS, Tile, WINDS, isHonor, isYaochu, sortTiles, toCounts } from './tiles';

/** 山（各牌の残り枚数） */
class Wall {
  counts = new Array(TILE_KINDS).fill(4);

  take(t: Tile): boolean {
    if (this.counts[t] <= 0) return false;
    this.counts[t]--;
    return true;
  }

  takeMany(tiles: Tile[]): boolean {
    const ok = tiles.every((t) => this.counts[t] >= tiles.filter((x) => x === t).length);
    if (ok) tiles.forEach((t) => this.counts[t]--);
    return ok;
  }

  draw(rng: Rng, filter: (t: Tile) => boolean = () => true): Tile {
    const pool: Tile[] = [];
    this.counts.forEach((n, t) => {
      if (filter(t)) for (let i = 0; i < n; i++) pool.push(t);
    });
    const t = pick(rng, pool);
    this.counts[t]--;
    return t;
  }
}

type AgariOptions = {
  /** 使う牌の種類（例: 清一色なら1種類だけ） */
  allowed?: (t: Tile) => boolean;
  /** 刻子を選ぶ確率 */
  koutsuRate?: number;
};

/** ランダムな和了形（14枚、雀頭＋4面子）を作る */
export function randomAgari(rng: Rng, opts: AgariOptions = {}, wall = new Wall()): Tile[] {
  const allowed = opts.allowed ?? (() => true);
  const koutsuRate = opts.koutsuRate ?? 0.25;
  const candidates = [...Array(TILE_KINDS).keys()].filter(allowed);
  for (;;) {
    const w = new Wall();
    w.counts = [...wall.counts];
    const tiles: Tile[] = [];
    const pair = pick(rng, candidates);
    if (!w.takeMany([pair, pair])) continue;
    tiles.push(pair, pair);
    let melds = 0;
    let tries = 0;
    while (melds < 4 && tries++ < 50) {
      const t = pick(rng, candidates);
      const seq = !isHonor(t) && t % 9 <= 6 && allowed(t + 1) && allowed(t + 2) && rng() >= koutsuRate;
      const meld = seq ? [t, t + 1, t + 2] : [t, t, t];
      if (w.takeMany(meld)) {
        tiles.push(...meld);
        melds++;
      }
    }
    if (melds === 4) {
      wall.counts = w.counts;
      return sortTiles(tiles);
    }
  }
}

// ---- 待ち当て ----

export type WaitMode = 'normal' | 'chinitsu';
export type WaitQuestion = { kind: 'wait'; hand: Tile[]; waits: Tile[] };

export function generateWaitQuestion(rng: Rng, mode: WaitMode): WaitQuestion {
  const suitBase = randInt(rng, 3) * 9;
  const allowed = mode === 'chinitsu' ? (t: Tile) => t >= suitBase && t < suitBase + 9 : undefined;
  const minWaits = mode === 'chinitsu' ? 2 : rng() < 0.7 ? 2 : 1;
  for (;;) {
    const agari = randomAgari(rng, { allowed, koutsuRate: mode === 'chinitsu' ? 0.3 : 0.25 });
    const removeAt = randInt(rng, agari.length);
    const hand = agari.filter((_, i) => i !== removeAt);
    const w = waits(toCounts(hand));
    if (w.length >= minWaits) return { kind: 'wait', hand, waits: w };
  }
}

// ---- 何切る ----

export type NanikiruQuestion = {
  kind: 'nanikiru';
  hand: Tile[];
  options: DiscardOption[];
  best: Tile[];
};

export function generateNanikiruQuestion(rng: Rng): NanikiruQuestion {
  for (;;) {
    const wall = new Wall();
    const agari = randomAgari(rng, {}, wall);
    const replace = 2 + randInt(rng, 3);
    const hand = [...agari];
    for (let i = 0; i < replace; i++) {
      hand[randInt(rng, hand.length)] = wall.draw(rng);
    }
    const c = toCounts(hand);
    if (c.some((n) => n > 4)) continue;
    const s = standardShanten(c);
    // 七対子の方が早い手は、何切るの練習としてわかりにくいので避ける
    if (s < 1 || s > 2 || chiitoiShanten(c) <= s) continue;
    const options = discardOptions(hand);
    const best = bestDiscards(options);
    // 正解が多すぎる問題は避ける
    if (best.length > 2) continue;
    // 正解と次点の受け入れ枚数の差が小さすぎる問題も避ける
    const second = options.find((o) => !best.includes(o.discard));
    if (second && second.shanten === options[0].shanten && options[0].ukeire - second.ukeire < 2) continue;
    return { kind: 'nanikiru', hand: sortTiles(hand), options, best };
  }
}

// ---- 危険牌 ----

export type DangerQuestion = {
  kind: 'danger';
  hand: Tile[];
  /** リーチ者の捨て牌（最後がリーチ宣言牌） */
  river: Tile[];
  /** 捨て牌ごとのツモ切りかどうか（古い記録には無い） */
  tsumogiri?: boolean[];
  doraIndicator: Tile;
  infos: DangerInfo[];
};

/** 捨て牌の手出し・ツモ切りから、読みに使う情報を取り出す */
export function readContextOf(q: Pick<DangerQuestion, 'river' | 'tsumogiri'>): ReadContext | undefined {
  if (!q.tsumogiri) return undefined;
  const last = q.river.length - 1;
  let lastTedashi: Tile | null = null;
  for (let i = last - 1; i >= 0; i--) {
    if (!q.tsumogiri[i]) {
      lastTedashi = q.river[i];
      break;
    }
  }
  return { riichiTile: q.river[last], riichiTsumogiri: q.tsumogiri[last], lastTedashi };
}

/** 現物を除いた中で、最も安全な牌の危険度 */
export function safestScore(q: Pick<DangerQuestion, 'infos'>): number {
  return Math.min(...q.infos.filter((i) => i.score > 0).map((i) => i.score));
}

export function generateDangerQuestion(rng: Rng): DangerQuestion {
  for (;;) {
    const wall = new Wall();
    const doraIndicator = wall.draw(rng);
    const riverLen = 7 + randInt(rng, 8);
    const river: Tile[] = [];
    const tsumogiri: boolean[] = [];
    for (let i = 0; i < riverLen - 1; i++) {
      // 序盤は字牌や端の牌を手出しで切ることが多い
      const early = i < 5;
      river.push(wall.draw(rng, early && rng() < 0.7 ? isYaochu : () => true));
      tsumogiri.push(rng() < (early ? 0.15 : 0.45));
    }
    // リーチ宣言牌。手出しなら、手の形の情報が出やすい中張牌にすることが多い
    const riichiTsumogiri = rng() < 0.2;
    const simple = (t: Tile) => !isYaochu(t);
    river.push(wall.draw(rng, !riichiTsumogiri && rng() < 0.75 ? simple : () => true));
    tsumogiri.push(riichiTsumogiri);

    const hand = sortTiles(Array.from({ length: 13 }, () => wall.draw(rng)));
    const visible = [...hand, ...river, doraIndicator];
    const ctx = readContextOf({ river, tsumogiri });
    const kinds = [...new Set(hand)];
    const infos = kinds.map((t) => evaluateDanger(t, river, visible, ctx)).sort((a, b) => a.score - b.score || a.tile - b.tile);
    // 現物は選べないので、現物以外の牌の中で問題を作る
    const choices = infos.filter((i) => i.score > 0);
    if (choices.length < 5) continue;
    const safest = choices[0].score;
    if (new Set(choices.map((i) => i.score)).size < 4) continue;
    // 最も安全な牌が多すぎる問題は避ける
    if (choices.filter((i) => i.score === safest).length > 2) continue;
    // 手出しリーチの問題では、読みを入れないと選んでしまう牌（スジだけ見れば最も安全に見える牌）がある問題を多めにする
    if (!riichiTsumogiri && rng() < 0.6) {
      const trap = choices.some((i) => i.read && evaluateDanger(i.tile, river, visible).score <= safest);
      if (!trap) continue;
    }
    return { kind: 'danger', hand, river, tsumogiri, doraIndicator, infos };
  }
}

// ---- 点数計算 ----

export type ScoreQuestion = {
  kind: 'score';
  ctx: WinContext;
  result: ScoreResult;
  choices: string[];
};

function randomChiitoi(rng: Rng, wall: Wall): Tile[] {
  const kinds = shuffle(rng, [...Array(TILE_KINDS).keys()]).slice(0, 7);
  kinds.forEach((t) => wall.takeMany([t, t]));
  return sortTiles(kinds.flatMap((t) => [t, t]));
}

export function generateScoreQuestion(rng: Rng): ScoreQuestion {
  for (;;) {
    const wall = new Wall();
    const style = rng();
    let hand: Tile[];
    if (style < 0.1) hand = randomChiitoi(rng, wall);
    else if (style < 0.25) {
      // 混一色・清一色寄りの手
      const base = randInt(rng, 3) * 9;
      const withHonors = rng() < 0.6;
      hand = randomAgari(rng, { allowed: (t) => (t >= base && t < base + 9) || (withHonors && isHonor(t)) }, wall);
    } else hand = randomAgari(rng, { koutsuRate: 0.2 }, wall);

    const winTile = pick(rng, hand);
    const seatWind = pick(rng, WINDS);
    const ctx: WinContext = {
      hand,
      winTile,
      tsumo: rng() < 0.4,
      riichi: rng() < 0.6,
      seatWind,
      roundWind: rng() < 0.7 ? EAST : SOUTH,
      doraIndicators: [wall.draw(rng)],
    };
    let result = scoreHand(ctx);
    if (result && result.han === 0) {
      ctx.riichi = true;
      result = scoreHand(ctx);
    }
    if (!result || result.han === 0 || result.yakuman.length || result.han >= 13) continue;
    return { kind: 'score', ctx, result, choices: makeScoreChoices(rng, result, ctx) };
  }
}

function makeScoreChoices(rng: Rng, result: ScoreResult, ctx: WinContext): string[] {
  const dealer = ctx.seatWind === EAST;
  const labels = new Set<string>([result.label]);
  const alternatives: [number, number][] = [];
  for (const dh of [-1, 1, 2, -2, 3, -3, 4]) {
    for (const df of [0, 10, -10, 20]) {
      const han = result.han + dh;
      const fu = result.fu === 25 ? 25 : result.fu + df;
      if (han >= 1 && fu >= 20) alternatives.push([han, fu]);
    }
  }
  for (const df of [10, -10, 20]) {
    if (result.fu !== 25 && result.fu + df >= 20) alternatives.push([result.han, result.fu + df]);
  }
  for (const [han, fu] of shuffle(rng, alternatives)) {
    if (labels.size >= 4) break;
    labels.add(pointsFor(han, fu, dealer, ctx.tsumo).label);
  }
  return shuffle(rng, [...labels]);
}

export type Question = WaitQuestion | NanikiruQuestion | DangerQuestion | ScoreQuestion;
