import { Tile, isHonor, numberOf, tileName } from './tiles';

export type DangerInfo = {
  tile: Tile;
  /** 0 が最も安全。大きいほど危険 */
  score: number;
  label: string;
  reason: string;
};

type ShapeStatus = 'live' | 'suji' | 'nochance';

/**
 * リーチ者に対する牌の危険度を、両面待ちの残り方を中心にざっくり評価する。
 * river: リーチ者の捨て牌, visible: 自分から見えているすべての牌（自分の手牌・全員の捨て牌・ドラ表示牌）
 */
export function evaluateDanger(tile: Tile, river: Tile[], visible: Tile[]): DangerInfo {
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
  const score = 1 + live * 3 + (n !== 1 && n !== 9 ? 1 : 0) + (n >= 3 && n <= 7 ? 1 : 0);

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
  return { tile, score, label, reason: parts.join('。') + '。' };
}
