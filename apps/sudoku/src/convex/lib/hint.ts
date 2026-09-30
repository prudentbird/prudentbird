/** Coordinates a logical deduction and its presentation. No answer-reveal fallback. */
import { candidateGrid, findDeduction, type HintAction } from "./hint_engine";
import { walkthrough } from "./hint_walkthrough";

export type HintSpan = { text: string; tone?: "source" | "unit" };
export type HintHighlight = {
  sources: number[];
  sweeps: number[];
  unit: number[];
  target: number | null;
  digit?: number;
  eliminations?: number[];
  candidates?: { cell: number; excluded: number[]; newlyExcluded?: number[] };
  /** Shared candidate display for any technique, including pairs. */
  marks?: {
    cell: number;
    digits: number[];
    eliminated?: number[];
    emphasis?: number[];
  }[];
};
export type HintStep = { text: HintSpan[]; highlight: HintHighlight };
export type Hint = {
  /** Cell to focus, which may be a pattern cell rather than a placement. */
  cell: number;
  /** Older deployments returned a placement value without an action. */
  value?: number;
  action?: HintAction;
  board?: string;
  candidateGrid?: number[][];
  technique: string;
  steps: HintStep[];
};

export function hintAction(hint: Hint): HintAction | null {
  return (
    hint.action ??
    (hint.value !== undefined
      ? { kind: "place", cell: hint.cell, value: hint.value }
      : null)
  );
}

export function buildHint(
  board: string,
  solution: string,
  open: readonly number[],
  preferred: number | null,
  excluded: readonly number[] = [],
): Hint | null {
  const eligible = [...new Set(open)].filter(
    (cell) =>
      Number.isInteger(cell) &&
      cell >= 0 &&
      cell < 81 &&
      board[cell] !== solution[cell],
  );
  if (!eligible.length) return null;
  // Incorrect entries cannot be used as premises for a deduction. Repair one first.
  const wrong = eligible.filter((cell) => board[cell] !== "0");
  if (wrong.length) {
    const cell =
      preferred !== null && wrong.includes(preferred) ? preferred : wrong[0]!;
    const value = Number(solution[cell]);
    const highlight = { sources: [], sweeps: [], unit: [], target: cell };
    return {
      cell,
      value,
      board,
      action: { kind: "place", cell, value },
      technique: "Correct an Entry",
      steps: [
        {
          text: [
            {
              text: `The ${board[cell]} in this cell is incorrect. Fix it before making deductions from this board.`,
            },
          ],
          highlight,
        },
        {
          text: [
            {
              text: `The solution has ${value} here. Replacing this entry will not add a mistake.`,
            },
          ],
          highlight,
        },
      ],
    };
  }
  const candidates = candidateGrid(board, excluded);
  const deduction = findDeduction(
    { board, candidates, open: eligible },
    preferred,
  );
  if (!deduction) return null;
  // The solution is a safety check, never a premise in technique detection.
  if (
    deduction.action.kind === "place" &&
    Number(solution[deduction.action.cell]) !== deduction.action.value
  )
    return null;
  if (
    deduction.action.kind === "eliminate" &&
    deduction.action.changes.some(({ cell, digits }) =>
      digits.includes(Number(solution[cell])),
    )
  )
    return null;
  return walkthrough(board, candidates, deduction);
}
