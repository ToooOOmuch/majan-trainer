import type { Question } from './logic/generate';

export type ModeId = 'wait' | 'nanikiru' | 'danger' | 'score';

export const MODE_NAMES: Record<ModeId, string> = {
  wait: '待ち当て',
  nanikiru: '何切る',
  danger: '危険牌クイズ',
  score: '点数計算',
};

export type Stats = Record<ModeId, { correct: number; total: number }>;

export type Mistake = {
  id: string;
  mode: ModeId;
  question: Question;
  at: number;
};

const STATS_KEY = 'majan-trainer:stats';
const MISTAKES_KEY = 'majan-trainer:mistakes';
const MAX_MISTAKES = 100;

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 保存できない環境（プライベートモードなど）では記録をあきらめる
  }
}

export function emptyStats(): Stats {
  return {
    wait: { correct: 0, total: 0 },
    nanikiru: { correct: 0, total: 0 },
    danger: { correct: 0, total: 0 },
    score: { correct: 0, total: 0 },
  };
}

export function loadStats(): Stats {
  return { ...emptyStats(), ...load<Partial<Stats>>(STATS_KEY, {}) };
}

export function recordResult(mode: ModeId, correct: boolean): Stats {
  const stats = loadStats();
  stats[mode] = { correct: stats[mode].correct + (correct ? 1 : 0), total: stats[mode].total + 1 };
  save(STATS_KEY, stats);
  return stats;
}

export function loadMistakes(): Mistake[] {
  return load<Mistake[]>(MISTAKES_KEY, []);
}

export function addMistake(mode: ModeId, question: Question) {
  const list = loadMistakes();
  list.unshift({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, mode, question, at: Date.now() });
  save(MISTAKES_KEY, list.slice(0, MAX_MISTAKES));
}

export function removeMistake(id: string) {
  save(
    MISTAKES_KEY,
    loadMistakes().filter((m) => m.id !== id),
  );
}

export function resetAll() {
  save(STATS_KEY, emptyStats());
  save(MISTAKES_KEY, []);
}
