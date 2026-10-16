import { useMemo } from 'react';
import type { Highlight } from '../components/Board';
import { findRoad } from '../engine/rules';
import type { GameState } from '../engine/types';

/** Green highlights over the winning road once a game has ended by road. */
export function useRoadHighlights(state: GameState): Highlight[] {
  return useMemo(() => {
    if (!state.result || state.result.type !== 'road' || !state.result.winner) return [];
    const road = findRoad(state, state.result.winner) ?? [];
    return road.map((coord) => ({ coord, kind: 'road' as const }));
  }, [state]);
}
