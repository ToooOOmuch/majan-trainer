import { HONOR_NAMES, SUIT_NAMES, Tile as TileId, isHonor, numberOf, suitOf, tileName } from '../logic/tiles';

type Props = {
  tile: TileId;
  onClick?: () => void;
  selected?: boolean;
  /** 正解・不正解などの強調 */
  mark?: 'good' | 'bad' | 'dim';
  sideways?: boolean;
  small?: boolean;
};

export function Tile({ tile, onClick, selected, mark, sideways, small }: Props) {
  const suit = suitOf(tile);
  const classes = ['tile', `tile-${suit}`];
  if (isHonor(tile)) classes.push(`tile-z${tile - 26}`);
  if (onClick) classes.push('clickable');
  if (selected) classes.push('selected');
  if (mark) classes.push(`mark-${mark}`);
  if (sideways) classes.push('sideways');
  if (small) classes.push('small');

  const face = isHonor(tile) ? (
    <span className="tile-honor">{tile === 31 ? '' : HONOR_NAMES[tile - 27]}</span>
  ) : (
    <>
      <span className="tile-num">{numberOf(tile)}</span>
      <span className="tile-suit">{SUIT_NAMES[suit]}</span>
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={classes.join(' ')} onClick={onClick} aria-label={tileName(tile)} aria-pressed={selected}>
        {face}
      </button>
    );
  }
  return (
    <span className={classes.join(' ')} role="img" aria-label={tileName(tile)}>
      {face}
    </span>
  );
}

export function TileRow({ tiles, small }: { tiles: TileId[]; small?: boolean }) {
  return (
    <div className="tile-row">
      {tiles.map((t, i) => (
        <Tile key={i} tile={t} small={small} />
      ))}
    </div>
  );
}
