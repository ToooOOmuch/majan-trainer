import { useState } from 'react';
import { Tile, TileRow } from './components/Tile';
import {
  Question,
  WaitMode as WaitKind,
  generateDangerQuestion,
  generateNanikiruQuestion,
  generateScoreQuestion,
  generateWaitQuestion,
} from './logic/generate';
import { DangerMode } from './modes/DangerMode';
import { NanikiruMode } from './modes/NanikiruMode';
import { ScoreMode } from './modes/ScoreMode';
import { WaitMode } from './modes/WaitMode';
import {
  MODE_NAMES,
  Mistake,
  ModeId,
  Stats,
  addMistake,
  loadMistakes,
  loadStats,
  recordResult,
  removeMistake,
  resetAll,
} from './storage';

type Screen = { name: 'home' } | { name: 'play'; mode: ModeId; review?: Mistake } | { name: 'review' };

const MODE_DESCRIPTIONS: Record<ModeId, string> = {
  wait: 'テンパイの手を見て、待ちをすべて答える',
  nanikiru: '14枚から、受け入れが最も広くなる牌を切る',
  danger: 'リーチに対して、手牌でいちばん安全な牌を選ぶ',
  score: '和了の点数を4択で答える',
};

const MODES: ModeId[] = ['wait', 'nanikiru', 'danger', 'score'];

function generate(mode: ModeId, waitKind: WaitKind): Question {
  switch (mode) {
    case 'wait':
      return generateWaitQuestion(Math.random, waitKind);
    case 'nanikiru':
      return generateNanikiruQuestion(Math.random);
    case 'danger':
      return generateDangerQuestion(Math.random);
    case 'score':
      return generateScoreQuestion(Math.random);
  }
}

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [stats, setStats] = useState<Stats>(loadStats);

  return (
    <div className="app">
      <header className="app-header">
        <button type="button" className="title-button" onClick={() => setScreen({ name: 'home' })}>
          麻雀トレーナー
        </button>
        {screen.name !== 'home' && (
          <button type="button" className="link" onClick={() => setScreen({ name: 'home' })}>
            ← トップ
          </button>
        )}
      </header>
      <main>
        {screen.name === 'home' && (
          <Home
            stats={stats}
            onPlay={(mode) => setScreen({ name: 'play', mode })}
            onReview={() => setScreen({ name: 'review' })}
            onReset={() => {
              if (confirm('成績と間違えた問題の記録をすべて消します。よろしいですか？')) {
                resetAll();
                setStats(loadStats());
              }
            }}
          />
        )}
        {screen.name === 'play' && (
          <Play
            key={screen.review?.id ?? screen.mode}
            mode={screen.mode}
            review={screen.review}
            onStats={setStats}
            onBackToReview={() => setScreen({ name: 'review' })}
          />
        )}
        {screen.name === 'review' && <Review onRetry={(m) => setScreen({ name: 'play', mode: m.mode, review: m })} />}
      </main>
    </div>
  );
}

function Home({
  stats,
  onPlay,
  onReview,
  onReset,
}: {
  stats: Stats;
  onPlay: (m: ModeId) => void;
  onReview: () => void;
  onReset: () => void;
}) {
  const mistakes = loadMistakes().length;
  return (
    <div className="home">
      <div className="mode-grid">
        {MODES.map((m) => {
          const s = stats[m];
          return (
            <button key={m} type="button" className="mode-card" onClick={() => onPlay(m)}>
              <strong>{MODE_NAMES[m]}</strong>
              <span>{MODE_DESCRIPTIONS[m]}</span>
              <span className="muted">
                {s.total ? `正解率 ${Math.round((s.correct / s.total) * 100)}%（${s.correct}/${s.total}）` : 'まだ解いていません'}
              </span>
            </button>
          );
        })}
      </div>
      <button type="button" className="secondary wide" onClick={onReview}>
        間違えた問題を復習する（{mistakes}問）
      </button>
      <button type="button" className="link danger-text" onClick={onReset}>
        記録をリセット
      </button>
    </div>
  );
}

function Play({
  mode,
  review,
  onStats,
  onBackToReview,
}: {
  mode: ModeId;
  review?: Mistake;
  onStats: (s: Stats) => void;
  onBackToReview: () => void;
}) {
  const [waitKind, setWaitKind] = useState<WaitKind>('normal');
  const [question, setQuestion] = useState<Question>(() => review?.question ?? generate(mode, 'normal'));
  const [round, setRound] = useState(0);
  const [result, setResult] = useState<boolean | null>(null);

  const next = (kind = waitKind) => {
    setQuestion(generate(mode, kind));
    setResult(null);
    setRound((r) => r + 1);
  };

  const onAnswer = (correct: boolean) => {
    setResult(correct);
    onStats(recordResult(mode, correct));
    if (review) {
      if (correct) removeMistake(review.id);
    } else if (!correct) {
      addMistake(mode, question);
    }
  };

  return (
    <div className="play">
      <div className="play-head">
        <h2>
          {MODE_NAMES[mode]}
          {review && <span className="badge">復習</span>}
        </h2>
        {mode === 'wait' && !review && (
          <div className="segmented">
            {(['normal', 'chinitsu'] as const).map((k) => (
              <button
                key={k}
                type="button"
                className={waitKind === k ? 'active' : ''}
                onClick={() => {
                  setWaitKind(k);
                  next(k);
                }}
              >
                {k === 'normal' ? '通常' : '清一色'}
              </button>
            ))}
          </div>
        )}
      </div>

      {question.kind === 'wait' && <WaitMode key={round} question={question} onAnswer={onAnswer} />}
      {question.kind === 'nanikiru' && <NanikiruMode key={round} question={question} onAnswer={onAnswer} />}
      {question.kind === 'danger' && <DangerMode key={round} question={question} onAnswer={onAnswer} />}
      {question.kind === 'score' && <ScoreMode key={round} question={question} onAnswer={onAnswer} />}

      {result !== null && (
        <div className={`result-bar ${result ? 'ok' : 'ng'}`}>
          <span>{result ? '正解！' : review ? '不正解（復習リストに残ります）' : '不正解（復習リストに追加）'}</span>
          {review ? (
            <button type="button" className="primary" onClick={onBackToReview}>
              復習リストへ戻る
            </button>
          ) : (
            <button type="button" className="primary" onClick={() => next()}>
              次の問題
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function questionPreview(q: Question) {
  switch (q.kind) {
    case 'wait':
    case 'nanikiru':
    case 'danger':
      return <TileRow tiles={q.hand} small />;
    case 'score':
      return (
        <div className="tile-row">
          {q.ctx.hand.map((t, i) => (
            <Tile key={i} tile={t} small />
          ))}
        </div>
      );
  }
}

function Review({ onRetry }: { onRetry: (m: Mistake) => void }) {
  const [list, setList] = useState(loadMistakes);
  if (!list.length) {
    return <p className="empty">間違えた問題はありません。</p>;
  }
  return (
    <div className="review">
      <p className="muted">復習で正解すると、リストから消えます。</p>
      <ul className="review-list">
        {list.map((m) => (
          <li key={m.id}>
            <div className="review-head">
              <strong>{MODE_NAMES[m.mode]}</strong>
              <span className="muted">{new Date(m.at).toLocaleString('ja-JP')}</span>
            </div>
            {questionPreview(m.question)}
            <div className="review-actions">
              <button type="button" className="primary" onClick={() => onRetry(m)}>
                もう一度解く
              </button>
              <button
                type="button"
                className="link"
                onClick={() => {
                  removeMistake(m.id);
                  setList(loadMistakes());
                }}
              >
                削除
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
