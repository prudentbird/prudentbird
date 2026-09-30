import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

// Load pure TypeScript modules and their local imports without a build or test framework.
const moduleUrls = new Map();
async function loadModule(file) {
  const url = new URL(file, import.meta.url);
  if (moduleUrls.has(url.href)) return moduleUrls.get(url.href);
  let source = stripTypeScriptTypes(await readFile(url, "utf8"));
  for (const match of [...source.matchAll(/from "(\.[^"]+)"/g)]) {
    const dependency = await loadModule(new URL(`${match[1]}.ts`, url));
    source = source.replace(match[0], `from ${JSON.stringify(dependency)}`);
  }
  const encoded = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
  moduleUrls.set(url.href, encoded);
  return encoded;
}
const { PEERS, generatePuzzle, setCell } = await import(
  await loadModule("../src/convex/lib/sudoku.ts")
);
const { buildHint, hintAction } = await import(
  await loadModule("../src/convex/lib/hint.ts")
);
const {
  candidateGrid,
  applyEliminations,
  findDeduction,
  nakedSingle,
  hiddenSingle,
  pointing,
  claiming,
  nakedPair,
  hiddenPair,
} = await import(await loadModule("../src/convex/lib/hint_engine.ts"));
const { walkthrough } = await import(
  await loadModule("../src/convex/lib/hint_walkthrough.ts")
);
const solution =
  "534678912672195348198342567859761423426853791713924856961537284287419635345286179";
const openCells = (board, solved = solution) =>
  [...board].flatMap((value, cell) => (value !== solved[cell] ? [cell] : []));
const candidates = (board, cell) =>
  [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(
    (digit) => !PEERS[cell].some((peer) => Number(board[peer]) === digit),
  );

test("solved boards and ineligible cells do not consume a hint", () => {
  assert.equal(buildHint(solution, solution, [], null), null);
  assert.equal(buildHint(solution, solution, [0, -1, 81, 1.5], 0), null);
});

test("a single missing digit has a truthful naked-single proof", () => {
  const board = setCell(solution, 0, 0);
  const hint = buildHint(board, solution, [0], 0);
  assert.equal(hint.technique, "Naked Single");
  assert.equal(hint.value, 5);
  assert.equal(hint.board, board);
  assert.deepEqual(candidates(board, hint.cell), [hint.value]);
  assert.equal(hint.steps.at(-1).highlight.sources.length, 8);
});

test("incorrect entries are repaired before explaining another cell", () => {
  const board = setCell(setCell(solution, 0, 1), 1, 0);
  const hint = buildHint(board, solution, [0, 1], 1);
  assert.equal(hint.technique, "Correct an Entry");
  assert.equal(hint.cell, 0);
  assert.equal(hint.value, 5);
  assert.deepEqual(hint.steps[0].highlight.sources, []);
});

test("the selected incorrect entry is preferred among corrections", () => {
  const board = setCell(setCell(solution, 0, 1), 1, 2);
  assert.equal(buildHint(board, solution, [0, 1], 1).cell, 1);
});

test("unsupported deductions return no hint instead of revealing an answer", () => {
  const board = "0".repeat(81);
  assert.equal(buildHint(board, solution, openCells(board), 40), null);
});

test("automatic hints prefer a proof over a reveal and are deterministic", () => {
  const board =
    "530070000600195000098000060800060003400803001700020006060000280000419005000080079";
  const open = openCells(board);
  const first = buildHint(board, solution, open, null);
  assert.notEqual(first.technique, "Reveal a Cell");
  assert.deepEqual(buildHint(board, solution, open, null), first);
});

test("deductions preserve the solution and progress across applied eliminations", () => {
  let count = 0;
  for (const difficulty of ["easy", "medium", "hard", "expert"]) {
    for (let sample = 0; sample < 3; sample++) {
      const puzzle = generatePuzzle(difficulty);
      let board = puzzle.puzzle;
      let excluded = [];
      const seen = new Set();
      for (let turn = 0; turn < 200 && board !== puzzle.solution; turn++) {
        const hint = buildHint(
          board,
          puzzle.solution,
          openCells(board, puzzle.solution),
          null,
          excluded,
        );
        const deduction = findDeduction(
          {
            board,
            candidates: candidateGrid(board, excluded),
            open: openCells(board, puzzle.solution),
          },
          null,
        );
        if (!deduction) {
          assert.equal(hint, null);
          break;
        }
        assert.ok(hint, "a detector must never contradict the solution");
        count++;
        const action = hintAction(hint);
        const key = JSON.stringify([board, action]);
        assert.equal(
          seen.has(key),
          false,
          "applied deductions must not repeat",
        );
        seen.add(key);
        if (action.kind === "place") {
          assert.equal(action.value, Number(puzzle.solution[action.cell]));
          board = setCell(board, action.cell, action.value);
          excluded = []; // Matches the server's invalidation on any board edit.
        } else {
          assert.ok(action.changes.length);
          const before = candidateGrid(board, excluded);
          for (const { cell, digits } of action.changes) {
            assert.equal(board[cell], "0");
            assert.ok(digits.length);
            for (const digit of digits) {
              assert.ok(before[cell].includes(digit));
              assert.notEqual(digit, Number(puzzle.solution[cell]));
            }
          }
          excluded = applyEliminations(excluded, action.changes);
          const after = candidateGrid(board, excluded);
          for (let cell = 0; cell < 81; cell++)
            if (board[cell] === "0") {
              assert.ok(after[cell].includes(Number(puzzle.solution[cell])));
            }
        }
      }
    }
  }
  assert.ok(count > 100);
});

test("hidden-single explanations rule out every other empty cell in their unit", () => {
  const board =
    "530070000600195000098000060800060003400803001700020006060000280000419005000080079";
  const grid = candidateGrid(board);
  const hint = walkthrough(
    board,
    grid,
    hiddenSingle({ board, candidates: grid, open: [5] }),
  );
  assert.equal(hint.technique, "Hidden Single");
  const { unit } = hint.steps.at(-1).highlight;
  assert.deepEqual(
    unit.filter(
      (cell) =>
        board[cell] === "0" && candidates(board, cell).includes(hint.value),
    ),
    [hint.cell],
  );
});

const {
  clockElapsed,
  clockPaused,
  pauseForHint,
  finishHintClock,
  applyClock,
  wakeClock,
} = await import(await loadModule("../src/convex/lib/clock.ts"));

test("a hint freezes elapsed time across focus events and placement", () => {
  const running = { startedAt: 1000, activeMs: 2000, runningSince: 3000 };
  const hinted = { ...running, ...pauseForHint(running, 5000) };
  assert.equal(clockElapsed(hinted, 100000), 4000);
  assert.equal(clockPaused(hinted), true);
  for (const action of ["pause", "resume"]) {
    const next = { ...hinted, ...applyClock(hinted, action, 10000) };
    assert.equal(clockElapsed(next, 100000), 4000);
    assert.equal(next.hintPaused, true);
  }
  assert.equal(wakeClock(hinted, 10000).runningSince, undefined);
  const resumed = { ...hinted, ...finishHintClock(hinted, 12000) };
  assert.equal(resumed.hintPaused, false);
  assert.equal(clockElapsed(resumed, 13000), 5000);
});

test("closing a hint preserves a separate manual pause", () => {
  const held = { startedAt: 1000, activeMs: 2000, pausedByPlayer: true };
  const hinted = { ...held, ...pauseForHint(held, 5000) };
  const closed = { ...hinted, ...finishHintClock(hinted, 10000) };
  assert.equal(closed.hintPaused, false);
  assert.equal(closed.pausedByPlayer, true);
  assert.equal(clockPaused(closed), true);
});

test("reloading clears a lost walkthrough pause without billing its duration", () => {
  const hinted = { startedAt: 1000, activeMs: 4000, hintPaused: true };
  const reopened = { ...hinted, ...applyClock(hinted, "reopen", 100000) };
  assert.equal(reopened.hintPaused, false);
  assert.equal(clockElapsed(reopened, 101000), 5000);
});

test("hidden-single steps show real eliminations and leave exactly one cell", () => {
  const board =
    "530070000600195000098000060800060003400803001700020006060000280000419005000080079";
  const grid = candidateGrid(board);
  const hint = walkthrough(
    board,
    grid,
    hiddenSingle({ board, candidates: grid, open: [5] }),
  );
  let eliminated = new Set();
  for (const step of hint.steps.slice(1, -1)) {
    assert.equal(step.highlight.sources.length, 1);
    const source = step.highlight.sources[0];
    const added = step.highlight.sweeps.filter((cell) => !eliminated.has(cell));
    assert.ok(added.length > 0);
    for (const cell of added) {
      assert.equal(board[cell], "0");
      assert.ok(PEERS[cell].includes(source));
      assert.notEqual(cell, hint.cell);
    }
    eliminated = new Set(step.highlight.sweeps);
  }
  const last = hint.steps.at(-1).highlight;
  assert.equal(last.digit, hint.value);
  assert.deepEqual(
    last.unit.filter((cell) => board[cell] === "0" && !eliminated.has(cell)),
    [hint.cell],
  );
});

test("naked-single steps cross out exactly the digits shown by their sources", () => {
  const board = setCell(solution, 0, 0);
  const hint = buildHint(board, solution, [0], 0);
  const excluded = new Set();
  for (const step of hint.steps.slice(1, -1)) {
    const marks = step.highlight.candidates;
    assert.ok(marks);
    assert.deepEqual(
      marks.newlyExcluded.toSorted(),
      step.highlight.sources.map((cell) => Number(board[cell])).toSorted(),
    );
    marks.newlyExcluded.forEach((digit) => excluded.add(digit));
    assert.deepEqual(marks.excluded.toSorted(), [...excluded].toSorted());
    assert.equal(excluded.has(hint.value), false);
  }
  assert.equal(excluded.size, 8);
});

function blankContext() {
  const board = "0".repeat(81);
  return {
    board,
    candidates: candidateGrid(board),
    open: Array.from({ length: 81 }, (_, cell) => cell),
  };
}
const remove = (context, cells, digits) =>
  cells.forEach((cell) => {
    context.candidates[cell] = context.candidates[cell].filter(
      (digit) => !digits.includes(digit),
    );
  });

test("pointing removes a box's locked digit only outside that box in its line", () => {
  const context = blankContext();
  remove(context, [2, 9, 10, 11, 18, 19, 20], [1]);
  const deduction = pointing(context);
  assert.equal(deduction.technique, "pointing");
  assert.deepEqual(deduction.sources, [0, 1]);
  assert.deepEqual(
    deduction.action.changes,
    [3, 4, 5, 6, 7, 8].map((cell) => ({ cell, digits: [1] })),
  );
});

test("claiming removes a line's locked digit only elsewhere in the same box", () => {
  const context = blankContext();
  remove(context, [2, 3, 4, 5, 6, 7, 8], [1]);
  const deduction = claiming(context);
  assert.equal(deduction.technique, "claiming");
  assert.deepEqual(deduction.sources, [0, 1]);
  assert.deepEqual(
    deduction.action.changes,
    [9, 10, 11, 18, 19, 20].map((cell) => ({ cell, digits: [1] })),
  );
});

test("naked pairs remove their two digits from other cells in the unit", () => {
  const context = blankContext();
  context.candidates[0] = [1, 2];
  context.candidates[1] = [1, 2];
  const deduction = nakedPair(context);
  assert.equal(deduction.technique, "naked-pair");
  assert.deepEqual(
    deduction.action.changes,
    [2, 3, 4, 5, 6, 7, 8].map((cell) => ({ cell, digits: [1, 2] })),
  );
  context.candidates[2] = [1, 2];
  assert.equal(
    nakedPair(context),
    null,
    "three identical cells cannot be treated as a pair",
  );
});

test("hidden pairs remove other digits from the pair, never from outside cells", () => {
  const context = blankContext();
  context.candidates[0] = [1, 2, 3];
  context.candidates[1] = [1, 2, 4];
  remove(context, [2, 3, 4, 5, 6, 7, 8], [1, 2]);
  const deduction = hiddenPair(context);
  assert.equal(deduction.technique, "hidden-pair");
  assert.deepEqual(deduction.action.changes, [
    { cell: 0, digits: [3] },
    { cell: 1, digits: [4] },
  ]);
});

test("a selected unsolved cell cannot force a reveal or skip an easier deduction", () => {
  const board =
    "530070000600195000098000060800060003400803001700020006060000280000419005000080079";
  const hint = buildHint(board, solution, openCells(board), 5);
  assert.equal(hint.technique, "Naked Single");
});

test("an applied elimination leaves a single for the next hint without placing a digit", () => {
  const context = blankContext();
  context.candidates[0] = [1, 2];
  context.candidates[1] = [1, 2];
  context.candidates[2] = [1, 2, 3];
  const deduction = nakedPair(context);
  const excluded = applyEliminations([], deduction.action.changes);
  // Combine the context's earlier deductions with this pair's eliminations.
  for (let cell = 0; cell < 81; cell++)
    for (let digit = 1; digit <= 9; digit++) {
      if (!context.candidates[cell].includes(digit))
        excluded[cell] |= 1 << digit;
    }
  const next = {
    ...context,
    candidates: candidateGrid(context.board, excluded),
  };
  assert.equal(context.board, "0".repeat(81));
  assert.deepEqual(nakedSingle(next).action, {
    kind: "place",
    cell: 2,
    value: 3,
  });
});

test("elimination walkthroughs show candidates, sources and only proven crossings", () => {
  const context = blankContext();
  context.candidates[0] = [1, 2];
  context.candidates[1] = [1, 2];
  const deduction = nakedPair(context);
  const hint = walkthrough(context.board, context.candidates, deduction);
  assert.equal(hintAction(hint).kind, "eliminate");
  assert.equal(hint.value, undefined);
  const marks = hint.steps.at(-1).highlight.marks;
  const crossed = marks
    .filter((mark) => mark.eliminated.length)
    .map((mark) => ({ cell: mark.cell, digits: mark.eliminated }));
  assert.deepEqual(crossed, deduction.action.changes);
  assert.deepEqual(hint.steps[1].highlight.sources, deduction.sources);
});

test("unproductive patterns do not consume a hint", () => {
  assert.equal(findDeduction(blankContext(), null), null);
});
