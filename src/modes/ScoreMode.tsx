import { useState } from 'react';
import { Tile } from '../components/Tile';
import type { ScoreQuestion } from '../logic/generate';
import { WAIT_NAMES } from '../logic/scoring';
import { EAST, doraFromIndicator, tileName } from '../logic/tiles';

type Props = { question: ScoreQuestion; onAnswer: (correct: boolean) => void };

export function ScoreMode({ question, onAnswer }: Props) {
  const [choice, setChoice] = useState<string | null>(null);
  const { ctx, result } = question;

  // 和了牌を1枚だけ手牌から外して、横に表示する
  const winIndex = ctx.hand.indexOf(ctx.winTile);
  const rest = ctx.hand.filter((_, i) => i !== winIndex);
  const dealer = ctx.seatWind === EAST;

  const choose = (c: string) => {
    if (choice !== null) return;
    setChoice(c);
    onAnswer(c === result.label);
  };

  const answered = choice !== null;

  return (
    <div className="mode">
      <p className="prompt">この和了は何点？</p>

      <div className="conditions">
        <span className="chip">{dealer ? '親' : '子'}（自風 {tileName(ctx.seatWind)}）</span>
        <span className="chip">場風 {tileName(ctx.roundWind)}</span>
        <span className="chip">{ctx.tsumo ? 'ツモ' : 'ロン'}</span>
        {ctx.riichi && <span className="chip">リーチ</span>}
        <span className="chip chip-tiles">
          ドラ表示牌 <Tile tile={ctx.doraIndicators[0]} small />
        </span>
      </div>

      <div className="hand-with-win">
        <div className="tile-row">
          {rest.map((t, i) => (
            <Tile key={i} tile={t} />
          ))}
        </div>
        <div className="win-tile">
          <Tile tile={ctx.winTile} />
          <span className="note">{ctx.tsumo ? 'ツモ' : 'ロン'}</span>
        </div>
      </div>
      <p className="muted small-text">裏ドラ・一発・本場・赤ドラはなしで考えます。</p>

      <div className="choices">
        {question.choices.map((c) => (
          <button
            key={c}
            type="button"
            className={
              'choice' +
              (answered && c === result.label ? ' good' : '') +
              (answered && c === choice && c !== result.label ? ' bad' : '')
            }
            onClick={() => choose(c)}
            disabled={answered}
          >
            {c}
          </button>
        ))}
      </div>

      {answered && (
        <div className="explain">
          <h3>
            正解：{result.label}（{result.limitName ? result.limitName : `${result.fu}符${result.han}翻`}）
          </h3>
          <table className="options">
            <tbody>
              {result.yaku.map((y) => (
                <tr key={y.name}>
                  <td>{y.name}</td>
                  <td>{y.han}翻</td>
                </tr>
              ))}
              {result.dora > 0 && (
                <tr>
                  <td>
                    ドラ（<Tile tile={doraFromIndicator(ctx.doraIndicators[0])} small />）
                  </td>
                  <td>{result.dora}翻</td>
                </tr>
              )}
              <tr className="sum">
                <td>合計</td>
                <td>{result.han}翻</td>
              </tr>
            </tbody>
          </table>

          <h4>符の内訳{result.waitType ? `（${WAIT_NAMES[result.waitType]}として計算）` : ''}</h4>
          <table className="options">
            <tbody>
              {result.fuItems.map((f, i) => (
                <tr key={i}>
                  <td>{f.label}</td>
                  <td>{f.fu}符</td>
                </tr>
              ))}
              <tr className="sum">
                <td>合計（10符単位に切り上げ）</td>
                <td>{result.fu}符</td>
              </tr>
            </tbody>
          </table>
          {result.limitName && result.han >= 5 && <p className="muted">5翻以上は符に関係なく{result.limitName}です。</p>}
          <p className="muted">
            {dealer ? '親' : '子'}の{ctx.tsumo ? 'ツモ' : 'ロン'}：{result.label}
            {ctx.tsumo && !dealer && '（子の支払い/親の支払い）'}
          </p>
        </div>
      )}
    </div>
  );
}
