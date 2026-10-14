import { Tile, isHonor, numberOf, tileName } from './tiles';

export type DangerInfo = {
  tile: Tile;
  /** 0 が最も安全。大きいほど危険 */
  score: number;
  label: string;
  reason: string;
  /** 手出し・ツモ切りからの読みで危険度が上がったときの説明 */
  read?: string;
};

/** 手出し・ツモ切りから読むための情報 */
export type ReadContext = {
  riichiTile: Tile;
  /** リーチ宣言牌がツモ切りなら true（手の形の情報がない） */
  riichiTsumogiri: boolean;
  /** 宣言牌より前で、最後に手出しされた牌 */
  lastTedashi: Tile | null;
};

/** 宣言牌 x から見て、lo-hi のスジ（両面待ち）が裏スジ・またぎスジに当たるか */
export function sujiRelation(x: number, lo: number, hi: number): '裏スジ' | 'またぎスジ' | null {
  // 裏スジ: x, x+2, x+3 から x を切ると x+2, x+3 が残り x+1-x+4 待ち（反対側も同様）
  if (lo === x + 1 || hi === x - 1) return '裏スジ';
  // またぎスジ: x, x, x+1 から x を切ると x, x+1 が残り x-1-x+2 待ち（x-2-x+1 も同様）
  if (lo === x - 2 || lo === x - 1) return 'またぎスジ';
  return null;
}

/** 宣言牌 x の裏スジとまたぎスジ（1〜9 の範囲に入るものだけ） */
export function readSujis(x: number): { kind: '裏スジ' | 'またぎスジ'; lo: number; hi: number }[] {
  const out: { kind: '裏スジ' | 'またぎスジ'; lo: number; hi: number }[] = [];
  for (let lo = 1; lo <= 6; lo++) {
    const kind = sujiRelation(x, lo, lo + 3);
    if (kind) out.push({ kind, lo, hi: lo + 3 });
  }
  return out;
}

type ShapeStatus = 'live' | 'suji' | 'nochance';

/**
 * リーチ者に対する牌の危険度を、両面待ちの残り方を中心にざっくり評価する。
 * river: リーチ者の捨て牌, visible: 自分から見えているすべての牌（自分の手牌・全員の捨て牌・ドラ表示牌）
 */
export function evaluateDanger(tile: Tile, river: Tile[], visible: Tile[], ctx?: ReadContext): DangerInfo {
  const seen = (t: Tile) => visible.filter((v) => v === t).length;

  if (river.includes(tile)) {
    return { tile, score: 0, label: '現物', reason: 'リーチ者が捨てている牌なので、ロンされません（フリテン）。' };
  }

  if (isHonor(tile)) {
    const v = seen(tile);
    const score = [4, 3, 2, 1][Math.min(v, 3)];
    const reason =
      v >= 3
        ? `${v}枚見えているので、当たるのは単騎待ちだけです。`
        : v === 2
          ? '2枚見えているので、当たるのは残り2枚を対子で持つ双碰待ちか、単騎待ちだけです。'
          : '自分の1枚以外は見えていないので、双碰待ちや単騎待ちに当たりやすい牌です。';
    return { tile, score, label: `字牌（${v}枚見え）`, reason };
  }

  const n = numberOf(tile);
  const base = tile - (n - 1);
  // tile を両面で待つ形は (n+1, n+2) と (n-2, n-1)
  const shapes: { a: number; status: ShapeStatus }[] = [];
  const checkShape = (a: number, outer: number) => {
    // a, a+1 の両面（待ちは a-1 と a+2）。outer はもう一方の待ち牌
    let status: ShapeStatus = 'live';
    if (river.includes(base + outer - 1)) status = 'suji';
    else if (seen(base + a - 1) >= 4 || seen(base + a) >= 4) status = 'nochance';
    shapes.push({ a, status });
  };
  if (n <= 6) checkShape(n + 1, n + 3);
  if (n >= 4) checkShape(n - 2, n - 3);

  const live = shapes.filter((s) => s.status === 'live').length;
  let score = 1 + live * 3 + (n !== 1 && n !== 9 ? 1 : 0) + (n >= 3 && n <= 7 ? 1 : 0);

  // 手出しされた宣言牌・直前の手出し牌の裏スジ／またぎスジにある待ちは残りやすい
  let read: string | undefined;
  const readFrom = (src: Tile, what: string, bonus: number) => {
    if (read || isHonor(src) || src - (numberOf(src) - 1) !== base) return;
    for (const sh of shapes) {
      if (sh.status !== 'live') continue;
      const lo = sh.a - 1;
      const kind = sujiRelation(numberOf(src), lo, lo + 3);
      if (kind) {
        score += bonus;
        read = `${what}${tileName(src)}の${kind}（${lo}-${lo + 3}）に当たります。`;
        return;
      }
    }
  };
  if (ctx && !ctx.riichiTsumogiri) readFrom(ctx.riichiTile, '手出しのリーチ宣言牌', 2);
  if (ctx?.lastTedashi != null) readFrom(ctx.lastTedashi, 'リーチ直前の手出し牌', 1);

  const sujiTiles = shapes
    .filter((s) => s.status === 'suji')
    .map((s) => tileName(base + (s.a === n + 1 ? n + 3 : n - 3) - 1));
  const noChance = shapes
    .filter((s) => s.status === 'nochance')
    .map((s) => (seen(base + s.a - 1) >= 4 ? base + s.a - 1 : base + s.a))
    .map(tileName);

  let label: string;
  if (live === 0) {
    if (noChance.length === 0) label = shapes.length === 2 ? '両スジ' : 'スジ';
    else if (sujiTiles.length === 0) label = 'ノーチャンス';
    else label = 'スジ＋ノーチャンス';
  } else if (live < shapes.length) {
    label = sujiTiles.length ? '片スジ' : '片側ノーチャンス';
  } else {
    label = '無スジ';
  }

  const parts: string[] = [];
  if (sujiTiles.length) parts.push(`${sujiTiles.join('・')}が捨てられているので、その筋の両面待ちには当たりません`);
  if (noChance.length) parts.push(`${noChance.join('・')}が4枚見えているので、その牌を使う両面待ちはありません`);
  if (live > 0) parts.push(`両面待ちに当たる形が${live}通り残っています`);
  else parts.push('両面待ちには当たりません。嵌張・単騎・双碰には当たることがあります');
  return { tile, score, label, reason: parts.join('。') + '。', read };
}
