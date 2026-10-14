import { useState } from 'react';
import { Tile } from '../components/Tile';
import type { DangerQuestion } from '../logic/generate';
import { Tile as TileId, doraFromIndicator } from '../logic/tiles';

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
        <div className="river-label">リーチ者の捨て牌（横向きがリーチ宣言牌）</div>
        <div className="river">
          {question.river.map((t, i) => (
            <Tile key={i} tile={t} small sideways={i === riichiIndex} />
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
              </li>
            ))}
          </ol>
          <p className="muted">
            危険度は、両面待ちに当たる形がいくつ残っているかを中心にした目安です。実戦では、他家の手出し・ツモ切りや場況も合わせて判断します。
          </p>
        </div>
      )}
    </div>
  );
}
