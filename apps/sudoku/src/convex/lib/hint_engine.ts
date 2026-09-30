/** Pure Sudoku deductions. Detectors know nothing about UI text or the solution. */
import { PEERS } from "./sudoku";

export type CandidateChange = { cell: number; digits: number[] };
export type HintAction =
  | { kind: "place"; cell: number; value: number }
  | { kind: "eliminate"; changes: CandidateChange[] };
export type Unit = {
  kind: "row" | "column" | "box";
  index: number;
  cells: number[];
};
export type Technique =
  | "naked-single"
  | "hidden-single"
  | "pointing"
  | "claiming"
  | "naked-pair"
  | "hidden-pair";
export type Deduction = {
  technique: Technique;
  sources: number[];
  digits: number[];
  unit: Unit;
  relatedUnit?: Unit;
  action: HintAction;
};
export type HintContext = {
  board: string;
  candidates: number[][];
  open: readonly number[];
};

export const UNITS: Unit[] = ["row", "column", "box"].flatMap((kind) =>
  Array.from({ length: 9 }, (_, index) => ({
    kind: kind as Unit["kind"],
    index,
    cells: Array.from({ length: 9 }, (_, k) =>
      kind === "row"
        ? index * 9 + k
        : kind === "column"
          ? k * 9 + index
          : (Math.floor(index / 3) * 3 + Math.floor(k / 3)) * 9 +
            (index % 3) * 3 +
            (k % 3),
    ),
  })),
);

export function candidateGrid(
  board: string,
  excluded: readonly number[] = [],
): number[][] {
  return Array.from({ length: 81 }, (_, cell) =>
    board[cell] !== "0"
      ? []
      : [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(
          (digit) =>
            !((excluded[cell] ?? 0) & (1 << digit)) &&
            !PEERS[cell]!.some((peer) => Number(board[peer]) === digit),
        ),
  );
}

/** Exclusions are accumulated only after the player applies a proven deduction. */
export function applyEliminations(
  excluded: readonly number[] | undefined,
  changes: readonly CandidateChange[],
): number[] {
  const next = Array.from({ length: 81 }, (_, cell) => excluded?.[cell] ?? 0);
  for (const { cell, digits } of changes)
    for (const digit of digits) next[cell] |= 1 << digit;
  return next;
}

const unitsOf = (cell: number) =>
  UNITS.filter((unit) => unit.cells.includes(cell));
const positions = (context: HintContext, unit: Unit, digit: number) =>
  unit.cells.filter((cell) => context.candidates[cell]!.includes(digit));
const changesIn = (
  context: HintContext,
  cells: number[],
  digits: number[],
): CandidateChange[] =>
  cells
    .map((cell) => ({
      cell,
      digits: digits.filter((digit) =>
        context.candidates[cell]!.includes(digit),
      ),
    }))
    .filter((change) => change.digits.length > 0);

export function nakedSingle(context: HintContext): Deduction | null {
  for (const cell of context.open) {
    const digits = context.candidates[cell]!;
    if (digits.length === 1)
      return {
        technique: "naked-single",
        sources: [cell],
        digits,
        unit: unitsOf(cell)[0]!,
        action: { kind: "place", cell, value: digits[0]! },
      };
  }
  return null;
}

export function hiddenSingle(context: HintContext): Deduction | null {
  for (const unit of UNITS)
    for (let digit = 1; digit <= 9; digit++) {
      const cells = positions(context, unit, digit);
      if (cells.length === 1 && context.open.includes(cells[0]!))
        return {
          technique: "hidden-single",
          sources: cells,
          digits: [digit],
          unit,
          action: { kind: "place", cell: cells[0]!, value: digit },
        };
    }
  return null;
}

/** A box's candidates all lie in one line, removing that digit outside the box. */
export function pointing(context: HintContext): Deduction | null {
  for (const unit of UNITS.filter((unit) => unit.kind === "box"))
    for (let digit = 1; digit <= 9; digit++) {
      const sources = positions(context, unit, digit);
      if (sources.length < 2) continue;
      for (const relatedUnit of UNITS.filter(
        (line) =>
          line.kind !== "box" &&
          sources.every((cell) => line.cells.includes(cell)),
      )) {
        const changes = changesIn(
          context,
          relatedUnit.cells.filter((cell) => !unit.cells.includes(cell)),
          [digit],
        );
        if (changes.length)
          return {
            technique: "pointing",
            sources,
            digits: [digit],
            unit,
            relatedUnit,
            action: { kind: "eliminate", changes },
          };
      }
    }
  return null;
}

/** A line's candidates all lie in one box, removing that digit elsewhere in it. */
export function claiming(context: HintContext): Deduction | null {
  for (const unit of UNITS.filter((unit) => unit.kind !== "box"))
    for (let digit = 1; digit <= 9; digit++) {
      const sources = positions(context, unit, digit);
      if (sources.length < 2) continue;
      const relatedUnit = UNITS.find(
        (box) =>
          box.kind === "box" &&
          sources.every((cell) => box.cells.includes(cell)),
      );
      if (!relatedUnit) continue;
      const changes = changesIn(
        context,
        relatedUnit.cells.filter((cell) => !unit.cells.includes(cell)),
        [digit],
      );
      if (changes.length)
        return {
          technique: "claiming",
          sources,
          digits: [digit],
          unit,
          relatedUnit,
          action: { kind: "eliminate", changes },
        };
    }
  return null;
}

/** Two cells share the same two candidates; those digits belong to that pair. */
export function nakedPair(context: HintContext): Deduction | null {
  for (const unit of UNITS) {
    const pairs = unit.cells.filter(
      (cell) => context.candidates[cell]!.length === 2,
    );
    for (const cell of pairs) {
      const digits = context.candidates[cell]!;
      const sources = pairs.filter(
        (other) => context.candidates[other]!.join() === digits.join(),
      );
      if (sources.length !== 2) continue;
      const changes = changesIn(
        context,
        unit.cells.filter((other) => !sources.includes(other)),
        digits,
      );
      if (changes.length)
        return {
          technique: "naked-pair",
          sources,
          digits,
          unit,
          action: { kind: "eliminate", changes },
        };
    }
  }
  return null;
}

/** Two digits only occur in the same two cells; remove other candidates there. */
export function hiddenPair(context: HintContext): Deduction | null {
  for (const unit of UNITS)
    for (let first = 1; first <= 8; first++) {
      const sources = positions(context, unit, first);
      if (sources.length !== 2) continue;
      for (let second = first + 1; second <= 9; second++) {
        if (positions(context, unit, second).join() !== sources.join())
          continue;
        const digits = [first, second];
        const changes = sources
          .map((cell) => ({
            cell,
            digits: context.candidates[cell]!.filter(
              (digit) => !digits.includes(digit),
            ),
          }))
          .filter((change) => change.digits.length);
        if (changes.length)
          return {
            technique: "hidden-pair",
            sources,
            digits,
            unit,
            action: { kind: "eliminate", changes },
          };
      }
    }
  return null;
}

/** Ordered by teaching difficulty, independent of the cell's solution value. */
export const DETECTORS = [
  nakedSingle,
  hiddenSingle,
  pointing,
  claiming,
  nakedPair,
  hiddenPair,
];

export function findDeduction(
  context: HintContext,
  preferred: number | null,
): Deduction | null {
  for (const detect of DETECTORS) {
    // A selection is a preference within a technique, never a reason to reveal an answer.
    if (preferred !== null && context.open.includes(preferred)) {
      const selected = detect({ ...context, open: [preferred] });
      if (
        selected &&
        (selected.sources.includes(preferred) ||
          (selected.action.kind === "place" &&
            selected.action.cell === preferred) ||
          (selected.action.kind === "eliminate" &&
            selected.action.changes.some(
              (change) => change.cell === preferred,
            )))
      )
        return selected;
    }
    const deduction = detect(context);
    if (deduction) return deduction;
  }
  return null;
}
