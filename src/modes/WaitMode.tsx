import { useState } from 'react';
import { Tile, TileRow } from '../components/Tile';
import type { WaitQuestion } from '../logic/generate';
import { Tile as TileId, suitOf, toCounts } from '../logic/tiles';

type Props = { question: WaitQuestion; onAnswer: (correct: boolean) => void };

export function WaitMode({ question, onAnswer }: Props) {
  const [selected, setSelected] = useState<TileId[]>([]);
  const [answered, setAnswered] = useState(false);

  // 清一色の問題なら、その色の牌だけを候補に出す
  const suits = new Set(question.hand.map(suitOf));
  const candidates = [...Array(34).keys()].filter((t) => suits.size !== 1 || suits.has(suitOf(t)));
  const rows = ['m', 'p', 's', 'z']
    .map((s) => candidates.filter((t) => suitOf(t) === s))
    .filter((r) => r.length);

  const toggle = (t: TileId) => {
    if (answered) return;
    setSelected((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));
  };

  const submit = () => {
    const correct = selected.length === question.waits.length && selected.every((t) => question.waits.includes(t));
    setAnswered(true);
    onAnswer(correct);
  };

  const counts = toCounts(question.hand);
  const markOf = (t: TileId) => {
    if (!answered) return undefined;
    const isWait = question.waits.includes(t);
    const picked = selected.includes(t);
    if (isWait && picked) return 'good';
    if (isWait || picked) return 'bad';
    return 'dim';
  };

  return (
    <div className="mode">
      <p className="prompt">この手の待ちをすべて選んでください。</p>
      <TileRow tiles={question.hand} />

      <div className="palette">
        {rows.map((row, i) => (
          <div key={i} className="tile-row">
            {row.map((t) => (
              <Tile key={t} tile={t} onClick={() => toggle(t)} selected={selected.includes(t)} mark={markOf(t)} />
            ))}
          </div>
        ))}
      </div>

      {!answered && (
        <button type="button" className="primary" onClick={submit} disabled={selected.length === 0}>
          答え合わせ（{selected.length}種類を選択中）
        </button>
      )}

      {answered && (
        <div className="explain">
          <h3>正解は {question.waits.length} 種類</h3>
          <div className="tile-row wait-answers">
            {question.waits.map((t) => (
              <div key={t} className="tile-with-note">
                <Tile tile={t} />
                <span className="note">残り{4 - counts[t]}枚</span>
              </div>
            ))}
          </div>
          <p className="muted">
            残り枚数の合計：{question.waits.reduce((a, t) => a + 4 - counts[t], 0)}枚（自分の手牌だけを引いた数）
          </p>
          <p className="legend">
            <span className="mark-good-text">緑</span>：選べた待ち　<span className="mark-bad-text">赤</span>
            ：見落とした待ち、または待ちではない牌
          </p>
        </div>
      )}
    </div>
  );
}
