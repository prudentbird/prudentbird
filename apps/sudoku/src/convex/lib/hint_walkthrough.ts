/** Turns structured evidence into steps. Technique detectors contain no UI copy. */
import { PEERS } from "./sudoku";
import { UNITS, candidateGrid, type Deduction } from "./hint_engine";
import type { Hint, HintHighlight, HintStep } from "./hint";

const NAMES = {
  "naked-single": "Naked Single",
  "hidden-single": "Hidden Single",
  pointing: "Locked Candidates · Pointing",
  claiming: "Locked Candidates · Claiming",
  "naked-pair": "Naked Pair",
  "hidden-pair": "Hidden Pair",
};
const unitName = (unit: Deduction["unit"]) => `${unit.kind} ${unit.index + 1}`;
const step = (text: string, highlight: HintHighlight): HintStep => ({
  text: [{ text }],
  highlight,
});

function singleSteps(
  board: string,
  candidates: number[][],
  deduction: Deduction,
): HintStep[] {
  if (deduction.action.kind !== "place") return [];
  const { cell, value } = deduction.action;
  const base = {
    sources: [],
    sweeps: [],
    unit: [],
    target: cell,
  } satisfies HintHighlight;
  if (deduction.technique === "naked-single") {
    const legal = candidateGrid(board)[cell]!;
    // An earlier applied technique can leave a single even though peer digits alone cannot.
    if (legal.length !== 1)
      return [
        step(
          "Look at the candidates left in this cell after the earlier deductions.",
          {
            ...base,
            marks: [
              {
                cell,
                digits: legal,
                eliminated: legal.filter(
                  (digit) => !candidates[cell]!.includes(digit),
                ),
              },
            ],
          },
        ),
        step(
          `Those eliminations leave only ${value}. This cell must be ${value}.`,
          { ...base, digit: value },
        ),
      ];
    const excluded = new Set<number>();
    const allSources: number[] = [];
    const steps = [
      step("Let's check which numbers can go in this cell.", {
        ...base,
        candidates: { cell, excluded: [] },
      }),
    ];
    for (const unit of UNITS.filter((unit) => unit.cells.includes(cell))) {
      const sources: number[] = [];
      const digits: number[] = [];
      for (const peer of unit.cells) {
        if (peer === cell) continue;
        const digit = Number(board[peer]);
        if (!digit || excluded.has(digit)) continue;
        excluded.add(digit);
        sources.push(peer);
        digits.push(digit);
      }
      if (!digits.length) continue;
      allSources.push(...sources);
      steps.push(
        step(
          `${digits.join(", ")} ${digits.length === 1 ? "is" : "are"} already in this ${unit.kind}, so cross ${digits.length === 1 ? "it" : "them"} out for this cell.`,
          {
            ...base,
            sources,
            unit: unit.cells,
            sweeps: unit.cells.filter((peer) => peer !== cell),
            candidates: {
              cell,
              excluded: [...excluded],
              newlyExcluded: digits,
            },
          },
        ),
      );
    }
    steps.push(
      step(`All other numbers are ruled out. Only ${value} can go here.`, {
        ...base,
        sources: allSources,
        digit: value,
      }),
    );
    return steps;
  }

  const { unit } = deduction;
  const empty = unit.cells.filter((peer) => board[peer] === "0");
  const highlight = { ...base, unit: unit.cells, digit: value };
  const steps = [
    step(
      `${unitName(unit)} needs the number ${value}. Let's check its empty cells.`,
      { ...highlight, target: null },
    ),
  ];
  const eliminated = new Set<number>();
  const groups = new Map<
    string,
    { source: number; blocked: number[]; area: string }
  >();
  const earlier: number[] = [];
  for (const peer of empty) {
    if (peer === cell) continue;
    const source = PEERS[peer]!.find(
      (source) => Number(board[source]) === value,
    );
    if (source === undefined) {
      earlier.push(peer);
      continue;
    }
    const area =
      Math.floor(source / 9) === Math.floor(peer / 9)
        ? "row"
        : source % 9 === peer % 9
          ? "column"
          : "box";
    const key = `${source}:${area}`;
    const group = groups.get(key) ?? { source, blocked: [], area };
    group.blocked.push(peer);
    groups.set(key, group);
  }
  if (earlier.length) {
    earlier.forEach((peer) => eliminated.add(peer));
    steps.push(
      step(
        `Earlier deductions have already ruled out ${value} in these cells.`,
        {
          ...highlight,
          target: null,
          sweeps: [...eliminated],
          eliminations: earlier,
        },
      ),
    );
  }
  for (const { source, blocked, area } of groups.values()) {
    blocked.forEach((peer) => eliminated.add(peer));
    steps.push(
      step(
        `This ${value} is already in the same ${area} as the newly crossed-out cells, so ${value} cannot go there.`,
        {
          ...highlight,
          target: null,
          sources: [source],
          sweeps: [...eliminated],
          eliminations: blocked,
        },
      ),
    );
  }
  steps.push(
    step(
      `Every other empty cell is ruled out. This is the only place for ${value} in ${unitName(unit)}.`,
      {
        ...highlight,
        sources: [
          ...new Set([...groups.values()].map((group) => group.source)),
        ],
        sweeps: [...eliminated],
      },
    ),
  );
  return steps;
}

function eliminationSteps(
  board: string,
  candidates: number[][],
  deduction: Deduction,
): HintStep[] {
  if (deduction.action.kind !== "eliminate") return [];
  const { sources, digits, unit, relatedUnit, action } = deduction;
  const cells = [
    ...new Set([...unit.cells, ...(relatedUnit?.cells ?? [])]),
  ].filter((cell) => board[cell] === "0");
  const marks = (crossed: boolean, emphasize: boolean) =>
    cells.map((cell) => ({
      cell,
      digits: candidates[cell]!,
      eliminated: crossed
        ? (action.changes.find((change) => change.cell === cell)?.digits ?? [])
        : [],
      emphasis: emphasize && sources.includes(cell) ? digits : [],
    }));
  const base: HintHighlight = {
    sources: [],
    sweeps: [],
    unit: unit.cells,
    target: null,
    marks: marks(false, false),
  };
  const steps = [step(`Look at the candidates in ${unitName(unit)}.`, base)];
  const proof =
    deduction.technique === "pointing"
      ? `In this box, ${digits[0]} can only go in these cells. They all lie in ${unitName(relatedUnit!)}.`
      : deduction.technique === "claiming"
        ? `In this ${unit.kind}, ${digits[0]} can only go in these cells. They all lie in ${unitName(relatedUnit!)}.`
        : deduction.technique === "naked-pair"
          ? `These two cells both have only ${digits.join(" and ")}. Those two numbers must occupy this pair, in either order.`
          : `${digits.join(" and ")} can only go in these two cells in ${unitName(unit)}. Other candidates in the pair can be removed.`;
  steps.push(step(proof, { ...base, sources, marks: marks(false, true) }));
  const consequence =
    deduction.technique === "pointing"
      ? `${digits[0]} must be in this box's part of the ${relatedUnit!.kind}, so cross it out elsewhere in that ${relatedUnit!.kind}.`
      : deduction.technique === "claiming"
        ? `${digits[0]} must be in this ${unit.kind}'s part of the box, so cross it out elsewhere in that box.`
        : deduction.technique === "naked-pair"
          ? `Cross ${digits.join(" and ")} out of the other cells in ${unitName(unit)}.`
          : `Keep ${digits.join(" and ")} in the pair and cross out its other candidates.`;
  steps.push(
    step(consequence, {
      ...base,
      sources,
      sweeps: action.changes.map((change) => change.cell),
      eliminations: action.changes.map((change) => change.cell),
      marks: marks(true, true),
    }),
  );
  steps.push(
    step(
      "This deduction removes candidates; it doesn't place a number yet. Apply it to update the pencil marks.",
      {
        ...base,
        sources,
        sweeps: action.changes.map((change) => change.cell),
        marks: marks(true, true),
      },
    ),
  );
  return steps;
}

export function walkthrough(
  board: string,
  candidates: number[][],
  deduction: Deduction,
): Hint {
  const action = deduction.action;
  return {
    cell: action.kind === "place" ? action.cell : deduction.sources[0]!,
    ...(action.kind === "place" ? { value: action.value } : {}),
    action,
    board,
    candidateGrid: candidates,
    technique: NAMES[deduction.technique],
    steps:
      action.kind === "place"
        ? singleSteps(board, candidates, deduction)
        : eliminationSteps(board, candidates, deduction),
  };
}
