import { describe, expect, it } from 'vitest';
import { evaluateDanger, readSujis } from './danger';
import {
  generateDangerQuestion,
  generateNanikiruQuestion,
  generateScoreQuestion,
  generateWaitQuestion,
} from './generate';
import { seededRng } from './random';
import { WinContext, scoreHand } from './scoring';
import { discardOptions, shantenOf, waits } from './shanten';
import { EAST, NORTH, SOUTH, formatTiles, parseTiles, toCounts } from './tiles';

const t = (s: string) => parseTiles(s);
const one = (s: string) => parseTiles(s)[0];

describe('tiles', () => {
  it('表記を読み書きできる', () => {
    expect(formatTiles(t('321m77z5p'))).toBe('123m5p77z');
  });
});

describe('シャンテン数', () => {
  it('和了形は -1', () => {
    expect(shantenOf(t('123m456p789s11122z'))).toBe(-1);
  });
  it('テンパイは 0', () => {
    expect(shantenOf(t('123456789m1234p'))).toBe(0);
  });
  it('バラバラの手', () => {
    expect(shantenOf(t('123m456p789s1234z'))).toBe(2);
  });
  it('七対子と国士無双', () => {
    expect(shantenOf(t('11m22p33s4455667z'))).toBe(0);
    expect(shantenOf(t('19m19p19s1234567z'))).toBe(0);
  });
});

describe('待ち', () => {
  it('ノベタン', () => {
    expect(formatTiles(waits(toCounts(t('123456789m1234p'))))).toBe('14p');
  });
  it('九蓮宝燈は9面待ち', () => {
    expect(waits(toCounts(t('1112345678999m')))).toHaveLength(9);
  });
  it('4枚使っている牌は待ちに入れない', () => {
    // 1m単騎の形だが、1mは4枚とも手の中にあるので待ちにならない
    expect(waits(toCounts(t('1111m234p567s789s')))).toEqual([]);
  });
});

describe('何切る', () => {
  it('孤立した字牌を切るのが最善', () => {
    const options = discardOptions(t('123m456p23478s99m1z'));
    expect(options[0].discard).toBe(one('1z'));
    expect(options[0].shanten).toBe(0);
  });
  it('受け入れ枚数は手の中の牌を引いて数える', () => {
    // 1m切りでテンパイ。待ちは 2p・5p の両面で 4+4=8枚
    const options = discardOptions(t('1m123456789s34p11z'));
    const best = options[0];
    expect(best.discard).toBe(one('1m'));
    expect(best.shanten).toBe(0);
    expect(best.ukeire).toBe(8);
  });
});

describe('点数計算', () => {
  const ctx = (hand: string, win: string, extra: Partial<WinContext> = {}): WinContext => ({
    hand: t(hand),
    winTile: one(win),
    tsumo: false,
    riichi: false,
    seatWind: SOUTH,
    roundWind: EAST,
    doraIndicators: [one('9p')], // ドラは1p（どの手牌にも入っていない）
    ...extra,
  });

  it('平和ツモ断幺九 20符3翻 子 700/1300', () => {
    const r = scoreHand(ctx('234567m234p678s55p', '2m', { tsumo: true }))!;
    expect(r.fu).toBe(20);
    expect(r.han).toBe(3);
    expect(r.label).toBe('700/1300');
  });

  it('立直平和ロン 30符2翻 子 2000', () => {
    const r = scoreHand(ctx('123m456p234789s55m', '4s', { riichi: true }))!;
    expect(r.yaku.map((y) => y.name)).toEqual(['立直', '平和']);
    expect(r.fu).toBe(30);
    expect(r.label).toBe('2000');
  });

  it('親のダブ東 40符2翻 ロン 3900', () => {
    const r = scoreHand(ctx('234m567p789s55p111z', '5p', { seatWind: EAST }))!;
    expect(r.han).toBe(2);
    expect(r.fu).toBe(40);
    expect(r.label).toBe('3900');
  });

  it('七対子 立直ロン 25符3翻 3200', () => {
    const r = scoreHand(ctx('11m22p33s44556677z', '7z', { riichi: true }))!;
    expect(r.fu).toBe(25);
    expect(r.han).toBe(3);
    expect(r.label).toBe('3200');
  });

  it('ロンで完成した刻子は明刻（三暗刻にならない）', () => {
    const r = scoreHand(ctx('222m333p444s678m55s', '4s', { riichi: true }))!;
    expect(r.yaku.map((y) => y.name)).not.toContain('三暗刻');
    // 同じ手でもツモなら三暗刻
    const r2 = scoreHand(ctx('222m333p444s678m55s', '4s', { tsumo: true }))!;
    expect(r2.yaku.map((y) => y.name)).toContain('三暗刻');
  });

  it('清一色は跳満以上', () => {
    const r = scoreHand(ctx('12334556778999m', '9m'))!;
    expect(r.yaku.map((y) => y.name)).toContain('清一色');
    expect(r.han).toBeGreaterThanOrEqual(6);
  });

  it('九蓮宝燈は役満', () => {
    const r = scoreHand(ctx('11123455678999m', '5m'))!;
    expect(r.yakuman).toContain('九蓮宝燈');
  });

  it('北家の北の刻子は自風になる', () => {
    const r = scoreHand(ctx('123m456p789s444z55m', '5m', { seatWind: NORTH, riichi: true }))!;
    expect(r.yaku.map((y) => y.name)).toContain('自風 北');
  });

  it('ドラは役がないと数えない', () => {
    const r = scoreHand(ctx('123m456p789s99m234p', '9m', { doraIndicators: [one('8m')] }))!;
    expect(r.label).toBe('役なし');
  });
});

describe('危険牌', () => {
  it('現物', () => {
    expect(evaluateDanger(one('5m'), t('5m'), []).label).toBe('現物');
  });
  it('スジの1', () => {
    const d = evaluateDanger(one('1m'), t('4m'), t('1m4m'));
    expect(d.label).toBe('スジ');
    expect(d.score).toBe(1);
  });
  it('両スジと片スジと無スジ', () => {
    expect(evaluateDanger(one('5p'), t('28p'), t('5p28p')).label).toBe('両スジ');
    expect(evaluateDanger(one('5p'), t('2p'), t('5p2p')).label).toBe('片スジ');
    expect(evaluateDanger(one('5p'), t('1z'), t('5p1z')).label).toBe('無スジ');
  });
  it('手出しの宣言牌の裏スジ・またぎスジは危険度が上がる', () => {
    const ctx = { riichiTile: one('5m'), riichiTsumogiri: false, lastTedashi: null };
    // 4m は 1-4（5m の裏スジ）と 4-7（またぎスジ）の両方の両面待ちに当たる
    const plain = evaluateDanger(one('4m'), t('5m'), t('4m5m'));
    const read = evaluateDanger(one('4m'), t('5m'), t('4m5m'), ctx);
    expect(read.score).toBe(plain.score + 2);
    expect(read.read).toContain('5萬');
  });
  it('ツモ切りリーチなら宣言牌からは読まない', () => {
    const ctx = { riichiTile: one('5m'), riichiTsumogiri: true, lastTedashi: null };
    const d = evaluateDanger(one('4m'), t('5m'), t('4m5m'), ctx);
    expect(d.read).toBeUndefined();
  });
  it('スジで消えている待ちは、宣言牌の裏スジでも危険度を上げない', () => {
    const ctx = { riichiTile: one('5m'), riichiTsumogiri: false, lastTedashi: null };
    // 1m は 1-4（5m の裏スジ）だけに当たるが、4m が捨てられているので 1-4 待ちはない
    const d = evaluateDanger(one('1m'), t('4m5m'), t('1m4m5m'), ctx);
    expect(d.read).toBeUndefined();
    expect(d.label).toBe('スジ');
  });
  it('裏スジとまたぎスジの一覧', () => {
    expect(readSujis(5).map((s) => `${s.kind}${s.lo}-${s.hi}`).sort()).toEqual(
      ['またぎスジ3-6', 'またぎスジ4-7', '裏スジ1-4', '裏スジ6-9'].sort(),
    );
  });
  it('ノーチャンス', () => {
    expect(evaluateDanger(one('3s'), t('1z'), t('3s4444s1z')).label).toBe('ノーチャンス');
  });
});

describe('問題の生成', () => {
  const rng = seededRng(12345);

  it('待ち当て', () => {
    for (let i = 0; i < 30; i++) {
      const q = generateWaitQuestion(rng, i % 2 ? 'chinitsu' : 'normal');
      expect(q.hand).toHaveLength(13);
      expect(q.waits.length).toBeGreaterThan(0);
      expect(toCounts(q.hand).every((n) => n <= 4)).toBe(true);
    }
  });

  it('何切る', () => {
    for (let i = 0; i < 20; i++) {
      const q = generateNanikiruQuestion(rng);
      expect(q.hand).toHaveLength(14);
      expect(q.best.length).toBeGreaterThan(0);
      expect(toCounts(q.hand).every((n) => n <= 4)).toBe(true);
    }
  });

  it('危険牌', () => {
    for (let i = 0; i < 20; i++) {
      const q = generateDangerQuestion(rng);
      expect(q.hand).toHaveLength(13);
      const all = [...q.hand, ...q.river, q.doraIndicator];
      expect(q.tsumogiri).toHaveLength(q.river.length);
      expect(toCounts(all).every((n) => n <= 4)).toBe(true);
    }
  });

  it('点数計算', () => {
    for (let i = 0; i < 50; i++) {
      const q = generateScoreQuestion(rng);
      expect(q.choices).toContain(q.result.label);
      expect(new Set(q.choices).size).toBe(q.choices.length);
      expect(q.result.han).toBeGreaterThan(0);
    }
  });
});
