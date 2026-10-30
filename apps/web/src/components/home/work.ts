export type Work = {
  name: string;
  link: string;
  github?: string;
  tagline: string;
};

export const work: Work[] = [
  {
    name: "Voxx",
    link: "https://voxx.prudentbird.com",
    github: "https://github.com/prudentbird/voxx",
    tagline: "A zero-friction CMS for you and your agents.",
  },
  {
    name: "Beakcrypt",
    link: "https://beakcrypt.com",
    github: "https://github.com/prudentbird/beakcrypt",
    tagline: "Environment variables, shared without the Slack paste.",
  },
  {
    name: "Sudoku",
    link: "https://sudoku.prudentbird.com",
    github: "https://github.com/prudentbird/prudentbird",
    tagline: "Sudoku with friends, in real time.",
  },
];
