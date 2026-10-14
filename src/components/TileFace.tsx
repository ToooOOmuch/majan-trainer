import { Tile as TileId, isHonor, numberOf, suitOf } from '../logic/tiles';

// 実物の牌に近い絵柄を SVG で描く。座標は 60×80 の枠の中で指定する

const BLUE = '#1c4f9c';
const GREEN = '#1b7a3d';
const RED = '#c4262e';
const INK = '#1a1a1a';

const MAN_KANJI = ['一', '二', '三', '四', '伍', '六', '七', '八', '九'];

type Dot = [x: number, y: number, r: number, color: string];

const PIN_LAYOUTS: Dot[][] = [
  [[30, 40, 21, RED]],
  [
    [30, 21, 13, GREEN],
    [30, 59, 13, BLUE],
  ],
  [
    [15, 15, 10.5, BLUE],
    [30, 40, 10.5, RED],
    [45, 65, 10.5, GREEN],
  ],
  [
    [17, 20, 11, BLUE],
    [43, 20, 11, GREEN],
    [17, 60, 11, GREEN],
    [43, 60, 11, BLUE],
  ],
  [
    [16, 17, 10, BLUE],
    [44, 17, 10, GREEN],
    [30, 40, 10, RED],
    [16, 63, 10, GREEN],
    [44, 63, 10, BLUE],
  ],
  [
    [19, 14, 9.5, GREEN],
    [41, 14, 9.5, GREEN],
    [19, 43, 9.5, RED],
    [41, 43, 9.5, RED],
    [19, 65, 9.5, RED],
    [41, 65, 9.5, RED],
  ],
  [
    [14, 11, 7.5, GREEN],
    [30, 18, 7.5, GREEN],
    [46, 25, 7.5, GREEN],
    [19, 46, 9, RED],
    [41, 46, 9, RED],
    [19, 67, 9, RED],
    [41, 67, 9, RED],
  ],
  [11, 30, 50, 69].flatMap((y) => [
    [18, y, 9.3, BLUE] as Dot,
    [42, y, 9.3, BLUE] as Dot,
  ]),
  [15, 40, 65].flatMap((y, row) =>
    [13, 30, 47].map((x) => [x, y, 8.6, [BLUE, RED, GREEN][row]] as Dot),
  ),
];

type Stick = [x: number, y: number, h: number, color: string, angle?: number];

const SOU_LAYOUTS: Stick[][] = [
  [],
  [
    [30, 22, 31, GREEN],
    [30, 58, 31, GREEN],
  ],
  [
    [30, 22, 31, GREEN],
    [18, 58, 31, GREEN],
    [42, 58, 31, GREEN],
  ],
  [
    [19, 22, 31, GREEN],
    [41, 22, 31, GREEN],
    [19, 58, 31, GREEN],
    [41, 58, 31, GREEN],
  ],
  [
    [15, 22, 31, GREEN],
    [45, 22, 31, GREEN],
    [30, 40, 31, RED],
    [15, 58, 31, GREEN],
    [45, 58, 31, GREEN],
  ],
  [14, 30, 46].flatMap((x) => [
    [x, 22, 31, GREEN] as Stick,
    [x, 58, 31, GREEN] as Stick,
  ]),
  [
    [30, 14, 22, RED],
    ...[14, 30, 46].flatMap((x) => [[x, 41, 22, GREEN] as Stick, [x, 66, 22, GREEN] as Stick]),
  ],
  [
    // 八索は上下が「M」と「W」の形
    [8, 22, 30, GREEN],
    [22, 22, 30, GREEN, 25],
    [38, 22, 30, GREEN, -25],
    [52, 22, 30, GREEN],
    [8, 58, 30, GREEN],
    [22, 58, 30, GREEN, -25],
    [38, 58, 30, GREEN, 25],
    [52, 58, 30, GREEN],
  ],
  [15, 40, 65].flatMap((y) =>
    [14, 30, 46].map((x, col) => [x, y, 22, col === 1 ? RED : GREEN] as Stick),
  ),
];

function PinDot({ dot: [x, y, r, color] }: { dot: Dot }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={color} />
      <circle cx={x} cy={y} r={r * 0.72} fill="#fffdf4" />
      <circle cx={x} cy={y} r={r * 0.52} fill="none" stroke={color} strokeWidth={r * 0.14} />
      <circle cx={x} cy={y} r={r * 0.22} fill={color} />
    </g>
  );
}

function OnePin() {
  // 一筒は大きな飾り丸
  return (
    <g>
      <circle cx={30} cy={40} r={24} fill={GREEN} />
      <circle cx={30} cy={40} r={20} fill="#fffdf4" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return <circle key={i} cx={30 + Math.cos(a) * 15} cy={40 + Math.sin(a) * 15} r={2.6} fill={BLUE} />;
      })}
      <circle cx={30} cy={40} r={10} fill={RED} />
      <circle cx={30} cy={40} r={6} fill="#fffdf4" />
      <circle cx={30} cy={40} r={3} fill={RED} />
    </g>
  );
}

function BambooStick({ stick: [x, y, h, color, angle = 0] }: { stick: Stick }) {
  const w = 9;
  const top = y - h / 2;
  return (
    <g transform={angle ? `rotate(${angle} ${x} ${y})` : undefined}>
      <rect x={x - w / 2} y={top} width={w} height={h} rx={3.2} fill={color} />
      <rect x={x - 1} y={top + 2} width={2} height={h - 4} rx={1} fill="#fffdf4" opacity={0.55} />
      <rect x={x - w / 2 - 0.6} y={y - 1.2} width={w + 1.2} height={2.4} rx={1} fill={color} />
      <line x1={x - w / 2} y1={y} x2={x + w / 2} y2={y} stroke="#fffdf4" strokeWidth={0.9} />
    </g>
  );
}

function OneSou() {
  // 一索は鳥の絵
  return (
    <g>
      <path d="M18 62 Q10 46 20 36 Q16 52 26 58 Z" fill={GREEN} />
      <path d="M22 66 Q16 54 24 44 Q24 58 32 62 Z" fill={BLUE} />
      <ellipse cx={34} cy={46} rx={11} ry={15} fill={GREEN} />
      <ellipse cx={36} cy={50} rx={6} ry={9} fill="#fffdf4" opacity={0.5} />
      <circle cx={40} cy={26} r={7} fill={GREEN} />
      <circle cx={42} cy={25} r={1.6} fill={INK} />
      <path d="M46 26 L52 28 L46 30 Z" fill={RED} />
      <path d="M38 19 Q40 12 44 14 Q41 16 41 20 Z" fill={RED} />
      <line x1={30} y1={60} x2={28} y2={70} stroke={RED} strokeWidth={2} strokeLinecap="round" />
      <line x1={37} y1={60} x2={38} y2={70} stroke={RED} strokeWidth={2} strokeLinecap="round" />
    </g>
  );
}

const SERIF = "'Hiragino Mincho ProN', 'Yu Mincho', 'Noto Serif JP', 'MS Mincho', serif";

function Kanji({ text, y, size, color }: { text: string; y: number; size: number; color: string }) {
  return (
    <text
      x={30}
      y={y}
      fontSize={size}
      fontFamily={SERIF}
      fontWeight={900}
      fill={color}
      textAnchor="middle"
      dominantBaseline="central"
    >
      {text}
    </text>
  );
}

function Honor({ tile }: { tile: TileId }) {
  const i = tile - 27;
  if (i === 4) {
    // 白は青い枠
    return <rect x={13} y={14} width={34} height={52} rx={3} fill="none" stroke={BLUE} strokeWidth={4} />;
  }
  const text = ['東', '南', '西', '北', '', '發', '中'][i];
  const color = i === 5 ? GREEN : i === 6 ? RED : INK;
  return <Kanji text={text} y={41} size={44} color={color} />;
}

export function TileFace({ tile }: { tile: TileId }) {
  let body;
  if (isHonor(tile)) {
    body = <Honor tile={tile} />;
  } else {
    const n = numberOf(tile);
    const suit = suitOf(tile);
    if (suit === 'm') {
      body = (
        <>
          <Kanji text={MAN_KANJI[n - 1]} y={21} size={32} color={INK} />
          <Kanji text="萬" y={58} size={34} color={RED} />
        </>
      );
    } else if (suit === 'p') {
      body = n === 1 ? <OnePin /> : PIN_LAYOUTS[n - 1].map((d, i) => <PinDot key={i} dot={d} />);
    } else {
      body = n === 1 ? <OneSou /> : SOU_LAYOUTS[n - 1].map((s, i) => <BambooStick key={i} stick={s} />);
    }
  }
  return (
    <svg className="tile-face" viewBox="0 0 60 80" aria-hidden="true">
      {body}
    </svg>
  );
}
