import { DangerInfo, ReadContext, evaluateDanger } from './danger';
import type { Discard, ReadQuestion } from './simulate';
import { Tile } from './tiles';

export type ReadInfo = DangerInfo & {
  /** 本当に当たり牌か */
  hit: boolean;
};

export type ReadAnalysis = {
  /** リーチ者に通っている牌（リーチ者の捨て牌と、リーチ後に誰かが切って通った牌） */
  safe: Tile[];
  ctx: ReadContext;
  /** 自分の手牌の各種類の評価（危険度の低い順） */
  infos: ReadInfo[];
};

export function readContextOfRiver(river: Discard[]): ReadContext {
  const idx = river.findIndex((d) => d.riichi);
  let lastTedashi: Tile | null = null;
  for (let i = idx - 1; i >= 0; i--) {
    if (!river[i].tsumogiri) {
      lastTedashi = river[i].tile;
      break;
    }
  }
  return { riichiTile: river[idx].tile, riichiTsumogiri: river[idx].tsumogiri, lastTedashi };
}

export function analyzeRead(q: ReadQuestion): ReadAnalysis {
  const own = q.rivers[q.riichiSeat];
  const passed = q.rivers.flatMap((r, seat) => (seat === q.riichiSeat ? [] : r.filter((d) => d.afterRiichi).map((d) => d.tile)));
  const safe = [...new Set([...own.map((d) => d.tile), ...passed])];
  const visible = [...q.hand, ...q.rivers.flatMap((r) => r.map((d) => d.tile)), q.doraIndicator];
  const ctx = readContextOfRiver(own);
  const ownTiles = own.map((d) => d.tile);

  const infos = [...new Set(q.hand)]
    .map((t): ReadInfo => {
      const info = evaluateDanger(t, safe, visible, ctx);
      if (info.score === 0 && !ownTiles.includes(t)) {
        info.label = '通った牌';
        info.reason = 'リーチの後に他家が切って、ロンされなかった牌です。';
      }
      return { ...info, hit: q.waits.includes(t) };
    })
    .sort((a, b) => a.score - b.score || a.tile - b.tile);

  return { safe, ctx, infos };
}
