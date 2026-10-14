import { Rng, randInt, shuffle } from './random';
import { analyzeRead } from './read';
import { shanten, waits } from './shanten';
import { Counts, DRAGONS, TILE_KINDS, Tile, isHonor, numberOf, sortTiles, toCounts } from './tiles';

// 4人が山から引いて切る簡易対局を回し、リーチがかかった場面を作る。
// 鳴き・他家のリーチ・流局処理はない。誰かが和了しそうになったら作り直す。

export type Discard = {
  tile: Tile;
  /** 引いた牌をそのまま切ったら true */
  tsumogiri: boolean;
  /** リーチ宣言牌 */
  riichi?: boolean;
  /** リーチの後に切られた牌（リーチ者に通っている） */
  afterRiichi?: boolean;
};

/** 席。0 が自分、1 が下家、2 が対面、3 が上家 */
export type Seat = 0 | 1 | 2 | 3;
export const SEAT_NAMES = ['自分', '下家', '対面', '上家'] as const;

export type ReadQuestion = {
  kind: 'read';
  /** 席ごとの捨て牌 */
  rivers: Discard[][];
  riichiSeat: Exclude<Seat, 0>;
  /** リーチ者が何巡目にリーチしたか */
  riichiTurn: number;
  doraIndicator: Tile;
  /** 自分の手牌（ツモ牌を含む14枚。最後がツモ牌） */
  hand: Tile[];
  /** リーチ者の手牌（13枚）と待ち */
  riichiHand: Tile[];
  waits: Tile[];
};

/** 簡易AIの評価値。小さい牌ほど不要とみなして切る */
function tileValue(c: Counts, t: Tile): number {
  if (isHonor(t)) {
    if (c[t] >= 2) return 6;
    return DRAGONS.includes(t) ? 1 : 0.5;
  }
  const n = numberOf(t);
  let v = (c[t] - 1) * 3;
  for (const d of [-2, -1, 1, 2]) {
    const m = n + d;
    if (m < 1 || m > 9) continue;
    v += c[t + d] * (Math.abs(d) === 1 ? 2 : 1);
  }
  if (n === 1 || n === 9) v -= 0.6;
  else if (n === 2 || n === 8) v -= 0.2;
  return v;
}

/** 他家と自分の打牌：評価値が最も低い牌（avoid に入っている牌はできるだけ切らない） */
function simpleDiscard(rng: Rng, hand: Tile[], avoid: Tile[] = []): Tile {
  const c = toCounts(hand);
  let best: Tile = hand[0];
  let bestV = Infinity;
  for (const t of new Set(hand)) {
    const v = tileValue(c, t) + rng() * 0.3 + (avoid.includes(t) ? 100 : 0);
    if (v < bestV) {
      bestV = v;
      best = t;
    }
  }
  return best;
}

/** リーチ者の打牌：シャンテン数が最小で、受け入れが最も広い牌 */
function efficientDiscard(hand: Tile[]): Tile {
  const c = toCounts(hand);
  const kinds = [...new Set(hand)];
  const byShanten = kinds.map((d) => {
    c[d]--;
    const s = shanten(c);
    c[d]++;
    return { d, s };
  });
  const minS = Math.min(...byShanten.map((x) => x.s));
  let best: Tile = kinds[0];
  let bestKey = -Infinity;
  for (const { d, s } of byShanten) {
    if (s !== minS) continue;
    c[d]--;
    let ukeire = 0;
    for (let t = 0; t < TILE_KINDS; t++) {
      if (c[t] >= 4) continue;
      c[t]++;
      if (shanten(c) < s) ukeire += 4 - c[t] + 1;
      c[t]--;
    }
    c[d]++;
    // 受け入れが同じなら、価値の低い牌（字牌・端の牌）から切る
    const key = ukeire * 100 - tileValue(c, d);
    if (key > bestKey) {
      bestKey = key;
      best = d;
    }
  }
  return best;
}

function removeOne(hand: Tile[], t: Tile) {
  hand.splice(hand.indexOf(t), 1);
}

function tryOnce(rng: Rng): ReadQuestion | null {
  const wall = shuffle(
    rng,
    [...Array(TILE_KINDS).keys()].flatMap((t) => [t, t, t, t]),
  );
  const doraIndicator = wall.pop()!;
  // 王牌（14枚）の分を残す
  const liveEnd = 13;
  const hands: Tile[][] = [0, 1, 2, 3].map(() => wall.splice(0, 13));
  const rivers: Discard[][] = [[], [], [], []];
  const riichiSeat = (1 + randInt(rng, 3)) as Exclude<Seat, 0>;
  let riichiWaits: Tile[] | null = null;
  let riichiTurn = 0;
  // リーチ後、自分の手番が何回来たら出題するか
  const myTurnsAfter = randInt(rng, 2);
  let myTurnsSeen = 0;

  let seat = randInt(rng, 4) as Seat;
  while (wall.length > liveEnd) {
    const hand = hands[seat];
    const drawn = wall.shift()!;
    hand.push(drawn);

    if (riichiWaits) {
      if (seat === riichiSeat) {
        if (riichiWaits.includes(drawn)) return null; // ツモ和了してしまう
        hand.pop();
        rivers[seat].push({ tile: drawn, tsumogiri: true, afterRiichi: true });
        seat = ((seat + 1) % 4) as Seat;
        continue;
      }
      if (seat === 0) {
        if (myTurnsSeen === myTurnsAfter) {
          const hits = new Set(hand.filter((t) => riichiWaits!.includes(t)));
          if (hits.size === 0 || hits.size > 2) return null;
          return {
            kind: 'read',
            rivers,
            riichiSeat,
            riichiTurn,
            doraIndicator,
            hand: [...sortTiles(hand.slice(0, 13)), hand[13]],
            riichiHand: sortTiles(hands[riichiSeat]),
            waits: riichiWaits,
          };
        }
        myTurnsSeen++;
      }
      const d = simpleDiscard(rng, hand, riichiWaits);
      if (riichiWaits.includes(d)) return null; // 放銃してしまう
      removeOne(hand, d);
      rivers[seat].push({ tile: d, tsumogiri: d === drawn, afterRiichi: true });
      seat = ((seat + 1) % 4) as Seat;
      continue;
    }

    if (seat === riichiSeat) {
      const d = efficientDiscard(hand);
      removeOne(hand, d);
      const c = toCounts(hand);
      const discard: Discard = { tile: d, tsumogiri: d === drawn };
      rivers[seat].push(discard);
      if (shanten(c) === 0) {
        const w = waits(c);
        const ownRiver = rivers[seat].map((x) => x.tile);
        // 待ちがあり、フリテンでなく、捨て牌がある程度並んでからリーチする
        if (w.length && !w.some((t) => ownRiver.includes(t)) && rivers[seat].length >= 7) {
          discard.riichi = true;
          riichiWaits = w;
          riichiTurn = rivers[seat].length;
        }
      }
    } else {
      const d = simpleDiscard(rng, hand);
      removeOne(hand, d);
      rivers[seat].push({ tile: d, tsumogiri: d === drawn });
    }
    seat = ((seat + 1) % 4) as Seat;
  }
  return null;
}

export function generateReadQuestion(rng: Rng): ReadQuestion {
  for (;;) {
    const q = tryOnce(rng);
    if (!q) continue;
    // 選べる牌（通っていない牌）が少なすぎる問題は避ける
    const choices = analyzeRead(q).infos.filter((i) => i.score > 0);
    if (choices.length < 5) continue;
    // 多くの問題では、読み（危険度の目安）の上位3種類に当たり牌が入るようにする。
    // 残りは、読みだけでは当てにくい問題もそのまま出す
    if (rng() < 0.7) {
      const top = [...choices].sort((a, b) => b.score - a.score).slice(0, 3);
      if (!top.some((i) => i.hit)) continue;
    }
    return q;
  }
}
