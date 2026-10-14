import {
  Counts,
  DRAGONS,
  EAST,
  TILE_KINDS,
  Tile,
  WINDS,
  doraFromIndicator,
  isHonor,
  isSimple,
  isTerminal,
  isYaochu,
  numberOf,
  suitOf,
  tileName,
  toCounts,
} from './tiles';

export type Meld = { type: 'shuntsu' | 'koutsu'; tile: Tile };
export type Decomposition = { pair: Tile; melds: Meld[] };

/** 14枚の和了形を「雀頭＋4面子」に分けるすべての方法 */
export function decompose(c: Counts): Decomposition[] {
  const result: Decomposition[] = [];
  const counts = [...c];
  const melds: Meld[] = [];

  const search = (pos: number, pair: Tile) => {
    while (pos < TILE_KINDS && counts[pos] === 0) pos++;
    if (pos >= TILE_KINDS) {
      if (melds.length === 4) result.push({ pair, melds: [...melds] });
      return;
    }
    if (counts[pos] >= 3) {
      counts[pos] -= 3;
      melds.push({ type: 'koutsu', tile: pos });
      search(pos, pair);
      melds.pop();
      counts[pos] += 3;
    }
    if (!isHonor(pos) && pos % 9 <= 6 && counts[pos + 1] > 0 && counts[pos + 2] > 0) {
      counts[pos]--;
      counts[pos + 1]--;
      counts[pos + 2]--;
      melds.push({ type: 'shuntsu', tile: pos });
      search(pos, pair);
      melds.pop();
      counts[pos]++;
      counts[pos + 1]++;
      counts[pos + 2]++;
    }
  };

  for (let t = 0; t < TILE_KINDS; t++) {
    if (counts[t] >= 2) {
      counts[t] -= 2;
      search(0, t);
      counts[t] += 2;
    }
  }
  return result;
}

export function isChiitoi(c: Counts): boolean {
  return c.filter((n) => n === 2).length === 7;
}

export function isKokushi(c: Counts): boolean {
  let kinds = 0;
  let total = 0;
  for (let t = 0; t < TILE_KINDS; t++) {
    if (c[t] > 0 && !isYaochu(t)) return false;
    if (c[t] > 0) kinds++;
    total += c[t];
  }
  return kinds === 13 && total === 14;
}

export type WinContext = {
  /** 和了牌を含む14枚 */
  hand: Tile[];
  winTile: Tile;
  tsumo: boolean;
  riichi: boolean;
  seatWind: Tile;
  roundWind: Tile;
  doraIndicators: Tile[];
};

export type WaitType = 'ryanmen' | 'kanchan' | 'penchan' | 'shanpon' | 'tanki';

export const WAIT_NAMES: Record<WaitType, string> = {
  ryanmen: '両面待ち',
  kanchan: '嵌張待ち',
  penchan: '辺張待ち',
  shanpon: '双碰待ち',
  tanki: '単騎待ち',
};

export type Yaku = { name: string; han: number };
export type FuItem = { label: string; fu: number };

export type ScoreResult = {
  yaku: Yaku[];
  /** 役満の役名（役満のときだけ） */
  yakuman: string[];
  dora: number;
  han: number;
  fu: number;
  fuItems: FuItem[];
  waitType: WaitType | null;
  limitName: string;
  /** ロンの点数、またはツモの合計 */
  total: number;
  /** "7700" や "2000/3900"、"2600オール" */
  label: string;
};

function ceil100(n: number): number {
  return Math.ceil(n / 100) * 100;
}

export function limitName(han: number, fu: number): string {
  if (han >= 13) return '数え役満';
  if (han >= 11) return '三倍満';
  if (han >= 8) return '倍満';
  if (han >= 6) return '跳満';
  if (han >= 5 || fu * 2 ** (han + 2) >= 2000) return '満貫';
  return '';
}

function basePoints(han: number, fu: number): number {
  if (han >= 13) return 8000;
  if (han >= 11) return 6000;
  if (han >= 8) return 4000;
  if (han >= 6) return 3000;
  return Math.min(2000, fu * 2 ** (han + 2));
}

/** 基本点から支払い額を求める */
export function payment(base: number, dealer: boolean, tsumo: boolean): { total: number; label: string } {
  if (!tsumo) {
    const p = ceil100(base * (dealer ? 6 : 4));
    return { total: p, label: String(p) };
  }
  if (dealer) {
    const each = ceil100(base * 2);
    return { total: each * 3, label: `${each}オール` };
  }
  const fromChild = ceil100(base);
  const fromDealer = ceil100(base * 2);
  return { total: fromChild * 2 + fromDealer, label: `${fromChild}/${fromDealer}` };
}

export function pointsFor(han: number, fu: number, dealer: boolean, tsumo: boolean) {
  return payment(basePoints(han, fu), dealer, tsumo);
}

function countDora(ctx: WinContext): number {
  let n = 0;
  for (const ind of ctx.doraIndicators) {
    const d = doraFromIndicator(ind);
    n += ctx.hand.filter((t) => t === d).length;
  }
  return n;
}

function isYakuhai(t: Tile, ctx: WinContext): boolean {
  return DRAGONS.includes(t) || t === ctx.seatWind || t === ctx.roundWind;
}

function meldTiles(m: Meld): Tile[] {
  return m.type === 'koutsu' ? [m.tile, m.tile, m.tile] : [m.tile, m.tile + 1, m.tile + 2];
}

/** 和了牌がどこに入ったかの候補 */
function waitAssignments(d: Decomposition, win: Tile): { type: WaitType; meldIndex: number }[] {
  const out: { type: WaitType; meldIndex: number }[] = [];
  if (d.pair === win) out.push({ type: 'tanki', meldIndex: -1 });
  d.melds.forEach((m, i) => {
    if (m.type === 'koutsu' && m.tile === win) out.push({ type: 'shanpon', meldIndex: i });
    if (m.type === 'shuntsu' && win >= m.tile && win <= m.tile + 2) {
      const pos = win - m.tile;
      const low = numberOf(m.tile);
      let type: WaitType;
      if (pos === 1) type = 'kanchan';
      else if ((pos === 2 && low === 1) || (pos === 0 && low === 7)) type = 'penchan';
      else type = 'ryanmen';
      out.push({ type, meldIndex: i });
    }
  });
  return out;
}

function yakumanOf(ctx: WinContext, d: Decomposition | null, concealedKoutsu: number): string[] {
  const c = toCounts(ctx.hand);
  const tiles = ctx.hand;
  const out: string[] = [];
  if (isKokushi(c)) out.push('国士無双');
  if (tiles.every(isHonor)) out.push('字一色');
  if (tiles.every(isTerminal)) out.push('清老頭');
  const green = [19, 20, 21, 23, 25, 32]; // 2346 8索 發
  if (tiles.every((t) => green.includes(t))) out.push('緑一色');
  if (d) {
    if (concealedKoutsu === 4) out.push('四暗刻');
    const koutsu = d.melds.filter((m) => m.type === 'koutsu').map((m) => m.tile);
    if (DRAGONS.every((t) => koutsu.includes(t))) out.push('大三元');
    const windK = WINDS.filter((t) => koutsu.includes(t)).length;
    if (windK === 4) out.push('大四喜');
    else if (windK === 3 && WINDS.includes(d.pair)) out.push('小四喜');
    // 九蓮宝燈: 1112345678999 + 1枚（同じ種類）
    const suit = suitOf(tiles[0]);
    if (!isHonor(tiles[0]) && tiles.every((t) => suitOf(t) === suit)) {
      const base = Math.floor(tiles[0] / 9) * 9;
      const need = [3, 1, 1, 1, 1, 1, 1, 1, 3];
      if (need.every((n, i) => c[base + i] >= n)) out.push('九蓮宝燈');
    }
  }
  return out;
}

function evaluateStandard(ctx: WinContext, d: Decomposition, wait: { type: WaitType; meldIndex: number }) {
  const yaku: Yaku[] = [];
  const dealer = ctx.seatWind === EAST;
  const melds = d.melds;
  const shuntsu = melds.filter((m) => m.type === 'shuntsu');
  const koutsu = melds.filter((m) => m.type === 'koutsu');
  // ロンで完成した刻子は明刻扱い
  const concealedKoutsu = melds.filter(
    (m, i) => m.type === 'koutsu' && !(wait.type === 'shanpon' && !ctx.tsumo && i === wait.meldIndex),
  ).length;

  const yakuman = yakumanOf(ctx, d, concealedKoutsu);

  const pairYakuhai = isYakuhai(d.pair, ctx);
  const isPinfu = shuntsu.length === 4 && !pairYakuhai && wait.type === 'ryanmen';

  if (ctx.riichi) yaku.push({ name: '立直', han: 1 });
  if (ctx.tsumo) yaku.push({ name: '門前清自摸和', han: 1 });
  if (isPinfu) yaku.push({ name: '平和', han: 1 });
  if (ctx.hand.every(isSimple)) yaku.push({ name: '断幺九', han: 1 });

  // 一盃口・二盃口
  const seqKeys = shuntsu.map((m) => m.tile).sort((a, b) => a - b);
  let peiko = 0;
  for (let i = 0; i + 1 < seqKeys.length; i++) {
    if (seqKeys[i] === seqKeys[i + 1]) {
      peiko++;
      i++;
    }
  }
  if (peiko === 2) yaku.push({ name: '二盃口', han: 3 });
  else if (peiko === 1) yaku.push({ name: '一盃口', han: 1 });

  // 役牌
  for (const m of koutsu) {
    if (DRAGONS.includes(m.tile)) yaku.push({ name: `役牌 ${tileName(m.tile)}`, han: 1 });
    if (m.tile === ctx.seatWind) yaku.push({ name: `自風 ${tileName(m.tile)}`, han: 1 });
    if (m.tile === ctx.roundWind) yaku.push({ name: `場風 ${tileName(m.tile)}`, han: 1 });
  }

  // 三色同順
  for (let n = 0; n < 7; n++) {
    if ([0, 9, 18].every((s) => shuntsu.some((m) => m.tile === s + n))) {
      yaku.push({ name: '三色同順', han: 2 });
      break;
    }
  }
  // 一気通貫
  for (const s of [0, 9, 18]) {
    if ([0, 3, 6].every((n) => shuntsu.some((m) => m.tile === s + n))) {
      yaku.push({ name: '一気通貫', han: 2 });
      break;
    }
  }
  // 三色同刻
  for (let n = 0; n < 9; n++) {
    if ([0, 9, 18].every((s) => koutsu.some((m) => m.tile === s + n))) {
      yaku.push({ name: '三色同刻', han: 2 });
      break;
    }
  }

  // 全帯系
  const groups = [...melds.map(meldTiles), [d.pair, d.pair]];
  const allHaveYaochu = groups.every((g) => g.some(isYaochu));
  const allHaveTerminal = groups.every((g) => g.some(isTerminal));
  const hasHonor = ctx.hand.some(isHonor);
  const allYaochu = ctx.hand.every(isYaochu);
  if (allYaochu) {
    yaku.push({ name: '混老頭', han: 2 });
  } else if (allHaveTerminal && !hasHonor) {
    yaku.push({ name: '純全帯幺九', han: 3 });
  } else if (allHaveYaochu) {
    yaku.push({ name: '混全帯幺九', han: 2 });
  }

  if (koutsu.length === 4) yaku.push({ name: '対々和', han: 2 });
  if (concealedKoutsu === 3) yaku.push({ name: '三暗刻', han: 2 });

  const dragonK = koutsu.filter((m) => DRAGONS.includes(m.tile)).length;
  if (dragonK === 2 && DRAGONS.includes(d.pair)) yaku.push({ name: '小三元', han: 2 });

  pushFlush(ctx.hand, yaku);

  // 符
  const fuItems: FuItem[] = [];
  let fu: number;
  if (isPinfu && ctx.tsumo) {
    fuItems.push({ label: '平和ツモ', fu: 20 });
    fu = 20;
  } else if (isPinfu) {
    fuItems.push({ label: '副底', fu: 20 }, { label: '門前ロン', fu: 10 });
    fu = 30;
  } else {
    fuItems.push({ label: '副底', fu: 20 });
    if (!ctx.tsumo) fuItems.push({ label: '門前ロン', fu: 10 });
    else fuItems.push({ label: 'ツモ', fu: 2 });
    melds.forEach((m, i) => {
      if (m.type !== 'koutsu') return;
      const open = wait.type === 'shanpon' && !ctx.tsumo && i === wait.meldIndex;
      const yao = isYaochu(m.tile);
      const f = (yao ? 4 : 2) * (open ? 1 : 2);
      fuItems.push({ label: `${open ? '明刻' : '暗刻'} ${tileName(m.tile)}${yao ? '（幺九牌）' : ''}`, fu: f });
    });
    let pairFu = 0;
    if (DRAGONS.includes(d.pair)) pairFu += 2;
    if (d.pair === ctx.seatWind) pairFu += 2;
    if (d.pair === ctx.roundWind) pairFu += 2;
    if (pairFu) fuItems.push({ label: `役牌の雀頭 ${tileName(d.pair)}`, fu: pairFu });
    if (wait.type === 'kanchan' || wait.type === 'penchan' || wait.type === 'tanki') {
      fuItems.push({ label: WAIT_NAMES[wait.type], fu: 2 });
    }
    const raw = fuItems.reduce((a, b) => a + b.fu, 0);
    fu = Math.ceil(raw / 10) * 10;
  }

  return finish(ctx, yaku, yakuman, fu, fuItems, wait.type, dealer);
}

function pushFlush(hand: Tile[], yaku: Yaku[]) {
  const numberSuits = new Set(hand.filter((t) => !isHonor(t)).map(suitOf));
  const hasHonor = hand.some(isHonor);
  if (numberSuits.size === 1 && !hasHonor) yaku.push({ name: '清一色', han: 6 });
  else if (numberSuits.size === 1 && hasHonor) yaku.push({ name: '混一色', han: 3 });
}

function evaluateChiitoi(ctx: WinContext) {
  const yaku: Yaku[] = [];
  if (ctx.riichi) yaku.push({ name: '立直', han: 1 });
  if (ctx.tsumo) yaku.push({ name: '門前清自摸和', han: 1 });
  yaku.push({ name: '七対子', han: 2 });
  if (ctx.hand.every(isSimple)) yaku.push({ name: '断幺九', han: 1 });
  if (ctx.hand.every(isYaochu)) yaku.push({ name: '混老頭', han: 2 });
  pushFlush(ctx.hand, yaku);
  const yakuman = yakumanOf(ctx, null, 0);
  return finish(ctx, yaku, yakuman, 25, [{ label: '七対子', fu: 25 }], 'tanki', ctx.seatWind === EAST);
}

function finish(
  ctx: WinContext,
  yaku: Yaku[],
  yakuman: string[],
  fu: number,
  fuItems: FuItem[],
  waitType: WaitType | null,
  dealer: boolean,
): ScoreResult {
  if (yakuman.length) {
    const pay = payment(8000 * yakuman.length, dealer, ctx.tsumo);
    return { yaku: [], yakuman, dora: 0, han: 13 * yakuman.length, fu, fuItems, waitType, limitName: '役満', ...pay };
  }
  const yakuHan = yaku.reduce((a, b) => a + b.han, 0);
  const dora = countDora(ctx);
  if (yakuHan === 0) {
    return { yaku, yakuman, dora, han: 0, fu, fuItems, waitType, limitName: '', total: 0, label: '役なし' };
  }
  const han = yakuHan + dora;
  const pay = pointsFor(han, fu, dealer, ctx.tsumo);
  return { yaku, yakuman, dora, han, fu, fuItems, waitType, limitName: limitName(han, fu), ...pay };
}

/** 和了の点数を計算する。高点法で、いちばん高くなる解釈を採用する。和了形でなければ null */
export function scoreHand(ctx: WinContext): ScoreResult | null {
  const c = toCounts(ctx.hand);
  if (ctx.hand.length !== 14 || c[ctx.winTile] === 0) return null;
  const candidates: ScoreResult[] = [];
  if (isKokushi(c)) {
    return finish(ctx, [], ['国士無双'], 0, [], null, ctx.seatWind === EAST);
  }
  for (const d of decompose(c)) {
    for (const w of waitAssignments(d, ctx.winTile)) {
      candidates.push(evaluateStandard(ctx, d, w));
    }
  }
  if (isChiitoi(c)) candidates.push(evaluateChiitoi(ctx));
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.total - a.total || b.han - a.han || b.fu - a.fu);
  return candidates[0];
}

/** 13枚の手が win で和了するときの待ちの形（複数の解釈があればすべて） */
export function waitTypesOf(hand: Tile[], win: Tile): WaitType[] {
  const c = toCounts([...hand, win]);
  const types = new Set<WaitType>();
  for (const d of decompose(c)) {
    for (const w of waitAssignments(d, win)) types.add(w.type);
  }
  if (isChiitoi(c) || isKokushi(c)) types.add('tanki');
  const order: WaitType[] = ['ryanmen', 'shanpon', 'kanchan', 'penchan', 'tanki'];
  return order.filter((t) => types.has(t));
}
