import { useMemo, useState } from 'react';
import { Tile } from '../components/Tile';
import { readSujis } from '../logic/danger';
import { analyzeRead } from '../logic/read';
import { WAIT_NAMES, waitTypesOf } from '../logic/scoring';
import { Discard, ReadQuestion, SEAT_NAMES } from '../logic/simulate';
import { Tile as TileId, doraFromIndicator, isHonor, numberOf, tileName } from '../logic/tiles';

type Props = { question: ReadQuestion; onAnswer: (correct: boolean) => void };

export function ReadMode({ question, onAnswer }: Props) {
  const [choice, setChoice] = useState<TileId | null>(null);
  const analysis = useMemo(() => analyzeRead(question), [question]);
  const isSafe = (t: TileId) => analysis.safe.includes(t);
  const answered = choice !== null;
  const riichiName = SEAT_NAMES[question.riichiSeat];

  const choose = (t: TileId) => {
    if (answered || isSafe(t)) return;
    setChoice(t);
    onAnswer(question.waits.includes(t));
  };

  const markOf = (t: TileId) => {
    if (isSafe(t)) return 'dim';
    if (!answered) return undefined;
    if (question.waits.includes(t)) return 'good';
    if (t === choice) return 'bad';
    return undefined;
  };

  // リーチ者の河を先頭に、残りは下家・対面・上家・自分の順
  const seatOrder = [question.riichiSeat, ...[1, 2, 3, 0].filter((s) => s !== question.riichiSeat)];
  const myTiles = question.hand.slice(0, 13);
  const drawn = question.hand[13];
  const hitsInHand = [...new Set(question.hand.filter((t) => question.waits.includes(t)))];

  return (
    <div className="mode">
      <p className="prompt">
        {riichiName}が{question.riichiTurn}巡目にリーチ。自分の手牌から、当たり牌だと思う牌を1枚選んでください。
      </p>

      <div className="board">
        <div className="board-info">
          <span>ドラ表示牌</span>
          <Tile tile={question.doraIndicator} small />
          <span className="muted">（ドラ：</span>
          <Tile tile={doraFromIndicator(question.doraIndicator)} small />
          <span className="muted">）</span>
        </div>
        <div className="rivers">
          {seatOrder.map((seat) => (
            <RiverPanel
              key={seat}
              name={SEAT_NAMES[seat]}
              river={question.rivers[seat]}
              riichi={seat === question.riichiSeat}
            />
          ))}
        </div>
        <p className="legend muted">横向き：リーチ宣言牌／灰色：ツモ切り／下に点：リーチ後に切られて通った牌</p>
      </div>

      <div className="hand-with-win">
        <div className="tile-row">
          {myTiles.map((t, i) => (
            <Tile key={i} tile={t} onClick={isSafe(t) ? undefined : () => choose(t)} mark={markOf(t)} />
          ))}
        </div>
        <div className="win-tile">
          <Tile tile={drawn} onClick={isSafe(drawn) ? undefined : () => choose(drawn)} mark={markOf(drawn)} />
          <span className="note">ツモ</span>
        </div>
      </div>
      {question.hand.some(isSafe) && <p className="muted small-text">暗くなっている牌は、リーチ者に通っている牌（現物）なので選べません。</p>}

      {answered && (
        <div className="explain">
          <h3>
            {riichiName}の手牌と待ち
          </h3>
          <div className="tile-row wrap">
            {question.riichiHand.map((t, i) => (
              <Tile key={i} tile={t} small />
            ))}
          </div>
          <ul className="wait-list">
            {question.waits.map((w) => (
              <li key={w}>
                <Tile tile={w} small />
                <span>{waitTypesOf(question.riichiHand, w).map((t) => WAIT_NAMES[t]).join('・')}</span>
                {hitsInHand.includes(w) && <span className="hit-badge">手牌にあり</span>}
              </li>
            ))}
          </ul>

          <ReadPoints
            riichiTile={analysis.ctx.riichiTile}
            tsumogiri={analysis.ctx.riichiTsumogiri}
            lastTedashi={analysis.ctx.lastTedashi}
          />

          <h3>手牌の牌ごとの読み（危険な順）</h3>
          <ol className="danger-list">
            {[...analysis.infos].reverse().map((info) => (
              <li key={info.tile} className={info.hit ? 'hit' : info.tile === choice ? 'yours' : ''}>
                <div className="danger-head">
                  <Tile tile={info.tile} small />
                  <strong>{info.label}</strong>
                  <span className="muted">{info.score === 0 ? '選択不可' : `危険度 ${info.score}`}</span>
                  {info.hit && <span className="hit-badge">当たり</span>}
                </div>
                <p>{info.reason}</p>
                {info.read && <p className="read-note">読み：{info.read}</p>}
              </li>
            ))}
          </ol>
          <p className="muted">
            危険度は、スジ・ノーチャンス・字牌の見え方と、手出し・ツモ切りからの読みを合わせた目安です。読みで絞り込めても、実際の待ちが別の形のこともあります。
          </p>
        </div>
      )}
    </div>
  );
}

function RiverPanel({ name, river, riichi }: { name: string; river: Discard[]; riichi: boolean }) {
  // 捨て牌は実物と同じく6枚ずつ並べる
  const rows = [0, 6, 12, 18].map((start) => river.slice(start, start + 6)).filter((r) => r.length);
  return (
    <div className={'river-panel' + (riichi ? ' riichi' : '')}>
      <div className="river-name">
        {name}
        {riichi && <span className="riichi-badge">リーチ</span>}
      </div>
      <div className="river">
        {rows.map((row, r) => (
          <div key={r} className="tile-row">
            {row.map((d, i) => (
              <span key={i} className={d.afterRiichi && !riichi ? 'passed' : undefined}>
                <Tile tile={d.tile} small sideways={d.riichi} mark={d.tsumogiri ? 'tsumogiri' : undefined} />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function ReadPoints({
  riichiTile,
  tsumogiri,
  lastTedashi,
}: {
  riichiTile: TileId;
  tsumogiri: boolean;
  lastTedashi: TileId | null;
}) {
  const sujiText = (t: TileId) => {
    const list = readSujis(numberOf(t));
    const ura = list.filter((s) => s.kind === '裏スジ').map((s) => `${s.lo}-${s.hi}`);
    const matagi = list.filter((s) => s.kind === 'またぎスジ').map((s) => `${s.lo}-${s.hi}`);
    const parts = [];
    if (ura.length) parts.push(`裏スジ（${ura.join('・')}）`);
    if (matagi.length) parts.push(`またぎスジ（${matagi.join('・')}）`);
    return parts.join('と');
  };

  return (
    <div className="read-points">
      <h3>読みのポイント</h3>
      {tsumogiri ? (
        <p>
          リーチ宣言牌の{tileName(riichiTile)}は<strong>ツモ切り</strong>
          です。引いてきた牌をそのまま切っただけなので、宣言牌から手の形は読めません。
        </p>
      ) : isHonor(riichiTile) ? (
        <p>リーチ宣言牌の{tileName(riichiTile)}は手出しの字牌です。数牌の待ちの形の手がかりにはなりません。</p>
      ) : (
        <p>
          リーチ宣言牌の{tileName(riichiTile)}は<strong>手出し</strong>
          です。テンパイの直前まで手の中にあった牌なので、その周りの形が残りやすく、同じ色の{sujiText(riichiTile)}
          が危険になります。
        </p>
      )}
      {lastTedashi != null && !isHonor(lastTedashi) && (
        <p>
          リーチ直前の手出しは{tileName(lastTedashi)}です。宣言牌ほどではありませんが、同じ色の{sujiText(lastTedashi)}
          もやや危険です。
        </p>
      )}
      <p className="muted small-text">
        裏スジ：宣言牌の1つ隣から始まるスジ（例：5切りなら1-4・6-9）。またぎスジ：宣言牌をまたぐスジ（例：5切りなら3-6・4-7）。
      </p>
    </div>
  );
}
