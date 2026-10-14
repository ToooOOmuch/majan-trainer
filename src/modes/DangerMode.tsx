import { useState } from 'react';
import { Tile } from '../components/Tile';
import { readSujis } from '../logic/danger';
import { readContextOf, type DangerQuestion } from '../logic/generate';
import { Tile as TileId, doraFromIndicator, isHonor, numberOf, tileName } from '../logic/tiles';

type Props = { question: DangerQuestion; onAnswer: (correct: boolean) => void };

export function DangerMode({ question, onAnswer }: Props) {
  const [choice, setChoice] = useState<TileId | null>(null);
  const safest = question.infos[0].score;
  const scoreOf = (t: TileId) => question.infos.find((i) => i.tile === t)!.score;

  const choose = (t: TileId) => {
    if (choice !== null) return;
    setChoice(t);
    onAnswer(scoreOf(t) === safest);
  };

  const answered = choice !== null;
  const markOf = (t: TileId) => {
    if (!answered) return undefined;
    if (scoreOf(t) === safest) return 'good';
    if (t === choice) return 'bad';
    return undefined;
  };

  const riichiIndex = question.river.length - 1;
  const ctx = readContextOf(question);
  // 捨て牌は実物と同じく6枚ずつ並べる
  const rows = [0, 6, 12]
    .map((start) => question.river.slice(start, start + 6).map((t, i) => ({ t, i: start + i })))
    .filter((r) => r.length);

  return (
    <div className="mode">
      <p className="prompt">対面がリーチしました。いちばん安全な牌を切ってください。</p>

      <div className="board">
        <div className="board-info">
          <span>ドラ表示牌</span>
          <Tile tile={question.doraIndicator} small />
          <span className="muted">（ドラ：</span>
          <Tile tile={doraFromIndicator(question.doraIndicator)} small />
          <span className="muted">）</span>
        </div>
        <div className="river-label">
          リーチ者の捨て牌　横向き：リーチ宣言牌{question.tsumogiri && '／灰色：ツモ切り'}
        </div>
        <div className="river">
          {rows.map((row, r) => (
            <div key={r} className="tile-row">
              {row.map(({ t, i }) => (
                <Tile
                  key={i}
                  tile={t}
                  small
                  sideways={i === riichiIndex}
                  mark={question.tsumogiri?.[i] ? 'tsumogiri' : undefined}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="tile-row">
        {question.hand.map((t, i) => (
          <Tile key={i} tile={t} onClick={() => choose(t)} mark={markOf(t)} />
        ))}
      </div>

      {answered && (
        <div className="explain">
          {ctx && <ReadPoints riichiTile={ctx.riichiTile} tsumogiri={ctx.riichiTsumogiri} lastTedashi={ctx.lastTedashi} />}

          <h3>安全な順</h3>
          <ol className="danger-list">
            {question.infos.map((info) => (
              <li
                key={info.tile}
                className={info.score === safest ? 'best' : info.tile === choice ? 'yours' : ''}
              >
                <div className="danger-head">
                  <Tile tile={info.tile} small />
                  <strong>{info.label}</strong>
                  <span className="muted">危険度 {info.score}</span>
                </div>
                <p>{info.reason}</p>
                {info.read && <p className="read-note">読み：{info.read}</p>}
              </li>
            ))}
          </ol>
          <p className="muted">
            危険度は、両面待ちに当たる形がいくつ残っているかを中心に、手出し・ツモ切りからの読みを加えた目安です。
          </p>
        </div>
      )}
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
    if (isHonor(t)) return null;
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
        <p>
          リーチ宣言牌の{tileName(riichiTile)}は手出しの字牌です。数牌の待ちの形の手がかりにはなりません。
        </p>
      ) : (
        <p>
          リーチ宣言牌の{tileName(riichiTile)}は<strong>手出し</strong>
          です。テンパイの直前まで手の中にあった牌なので、その周りの形が残りやすく、
          同じ色の{sujiText(riichiTile)}が危険になります。
        </p>
      )}
      {lastTedashi != null && !isHonor(lastTedashi) && (
        <p>
          リーチ直前の手出しは{tileName(lastTedashi)}です。宣言牌ほどではありませんが、
          同じ色の{sujiText(lastTedashi)}もやや危険です。
        </p>
      )}
      <p className="muted small-text">
        裏スジ：宣言牌の1つ隣から始まるスジ（例：5切りなら1-4・6-9）。またぎスジ：宣言牌をまたぐスジ（例：5切りなら3-6・4-7）。
      </p>
    </div>
  );
}
