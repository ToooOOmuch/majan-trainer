import { useState } from 'react';
import { Tile } from '../components/Tile';
import type { NanikiruQuestion } from '../logic/generate';
import { Tile as TileId } from '../logic/tiles';

type Props = { question: NanikiruQuestion; onAnswer: (correct: boolean) => void };

function shantenText(s: number): string {
  return s === 0 ? 'テンパイ' : `${s}シャンテン`;
}

export function NanikiruMode({ question, onAnswer }: Props) {
  const [choice, setChoice] = useState<TileId | null>(null);

  const choose = (t: TileId) => {
    if (choice !== null) return;
    setChoice(t);
    onAnswer(question.best.includes(t));
  };

  const answered = choice !== null;
  const markOf = (t: TileId) => {
    if (!answered) return undefined;
    if (question.best.includes(t)) return 'good';
    if (t === choice) return 'bad';
    return undefined;
  };
  const chosen = question.options.find((o) => o.discard === choice);

  return (
    <div className="mode">
      <p className="prompt">受け入れが最も広くなる牌を切ってください（タップで打牌）。</p>
      <div className="tile-row">
        {question.hand.map((t, i) => (
          <Tile key={i} tile={t} onClick={() => choose(t)} mark={markOf(t)} />
        ))}
      </div>

      {answered && chosen && (
        <div className="explain">
          <h3>
            あなたの打牌：{shantenText(chosen.shanten)}・受け入れ {chosen.ukeire}枚
          </h3>
          <table className="options">
            <thead>
              <tr>
                <th>打牌</th>
                <th>形</th>
                <th>枚数</th>
                <th>受け入れ</th>
              </tr>
            </thead>
            <tbody>
              {question.options.map((o) => (
                <tr
                  key={o.discard}
                  className={question.best.includes(o.discard) ? 'best' : o.discard === choice ? 'yours' : ''}
                >
                  <td>
                    <Tile tile={o.discard} small />
                  </td>
                  <td className="nowrap">{shantenText(o.shanten)}</td>
                  <td className="nowrap">{o.ukeire}枚</td>
                  <td>
                    <div className="tile-row wrap">
                      {o.ukeireTiles.map((t) => (
                        <Tile key={t} tile={t} small />
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted">
            受け入れ枚数は、引くとシャンテン数が進む牌の残り枚数です（自分の手牌と切った牌だけを見えている牌として数えています）。
          </p>
        </div>
      )}
    </div>
  );
}
