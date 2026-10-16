import { PieceIcon } from '../components/GamePanels';
import { BOARD_SIZES, PIECE_COUNTS } from '../engine/types';
import { SIZE_LABELS } from '../render/iso';

export function RulesPage() {
  return (
    <div className="rules">
      <h1>How to play Tak</h1>
      <p>
        Tak is a two-player game of roads. <strong>Win by connecting two opposite edges of the board</strong> with an unbroken,
        orthogonally connected line of your flat stones and capstones. If nobody builds a road before the board fills up or a player
        runs out of pieces, the player with more flat stones on top of stacks wins (a tie is a draw).
      </p>

      <h2>Pieces</h2>
      <div className="piece-table">
        <div>
          <PieceIcon color="white" type="flat" size={48} />
          <h3>Flat stone</h3>
          <p>Lies flat. Counts for roads and for the flat count. Can be stacked on.</p>
        </div>
        <div>
          <PieceIcon color="white" type="wall" size={48} />
          <h3>Standing stone (wall)</h3>
          <p>The same stone stood on edge. Nothing can be stacked on it and it does not count for roads or flats.</p>
        </div>
        <div>
          <PieceIcon color="white" type="cap" size={48} />
          <h3>Capstone</h3>
          <p>Counts for roads. Cannot be covered. Moving alone onto a wall, it flattens the wall into a flat stone.</p>
        </div>
      </div>

      <h2>Board sizes</h2>
      <table className="table table--compact">
        <thead>
          <tr>
            <th>Board</th>
            <th>Stones each</th>
            <th>Capstones each</th>
            <th>Carry limit</th>
          </tr>
        </thead>
        <tbody>
          {BOARD_SIZES.map((s) => (
            <tr key={s}>
              <td>{SIZE_LABELS[s]}</td>
              <td>{PIECE_COUNTS[s].flats}</td>
              <td>{PIECE_COUNTS[s].caps}</td>
              <td>{s}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>A turn</h2>
      <ul>
        <li>
          <strong>Opening:</strong> on each player's very first turn, they place one of their <em>opponent's</em> flat stones on any empty
          square.
        </li>
        <li>
          <strong>Place:</strong> put a flat stone, a wall, or a capstone from your reserve on any empty square.
        </li>
        <li>
          <strong>Move:</strong> pick up to the carry limit of pieces from a stack whose top piece is yours, then move in a straight line,
          dropping at least one piece on each square you pass. You may not move onto a wall or a capstone, except a lone capstone
          flattening a wall as its final drop.
        </li>
      </ul>

      <h2>Ending the game</h2>
      <ul>
        <li>A road wins immediately. If one move completes roads for both players, the player who moved wins.</li>
        <li>
          When the board is full, or either player has placed their last piece, count flat stones on top of stacks. More flats wins;
          equal is a draw.
        </li>
      </ul>

      <h2>Ratings</h2>
      <p>
        Every rated game updates an Elo rating for that board size only. New players start at 1500 and move quickly for their first 20
        games, then settle down.
      </p>
    </div>
  );
}
