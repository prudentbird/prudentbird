export const AVATAR_PALETTE = [
  "#0f1a38",
  "#c5cfcb",
  "#ebede8",
  "#69a72b",
  "#7c9796",
  "#1b2642",
  "#f3eee9",
  "#f24949",
  "#3585ba",
  "#e67533",
  "#1a2c37",
  "#334950",
];

export const AVATAR_ROWS = [
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  ".........aaaaaaa........",
  "........abcddddda.......",
  ".......abcecddddda......",
  "......abcccecdddda......",
  "....aaaeeeeccdddda......",
  "...adddccccccdddda......",
  "...aaaaaaaaaaaaaaa......",
  "......cccccccccccc......",
  ".......afgchhcciic......",
  ".......afgchhcciic......",
  ".......afggccggcca......",
  ".......afgggggjjjjj.....",
  "........agggggjjjj......",
  "........aagggggga.......",
  ".......ekeaaaaaa........",
  "......ekekeeaeke........",
  ".....akllelecellae......",
  "....akllllllelallla.....",
  "...akllllllaellallla....",
];

export const AVATAR_UNIT = 0.2;
export const AVATAR_DEPTH = AVATAR_UNIT * 1.6;
export const AVATAR_CAMERA = {
  position: [0, 0, 8.6] as [number, number, number],
  fov: 30,
};

export const TAG_ROWS = [
  ".............................",
  "..#.#...#..###.###.###...###.",
  ".#####.##..#.#.#.#.#.#....##.",
  "..#.#...#..###.###.#.#...#.#.",
  ".#####..#....#...#.#.#..#....",
  "..#.#..###.###.###.###.#.....",
  ".............................",
];
export const TAG_UNIT = 0.055;
export const TAG_CENTER_XYZ = [1.05, -1.62, 0.26] as const;
