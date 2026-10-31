export const weeksInYear = (year: number) => {
  const start = new Date(Date.UTC(year, 0, 1));
  const days = (Date.UTC(year + 1, 0, 1) - start.getTime()) / 86400000;
  return Math.ceil((start.getUTCDay() + days) / 7);
};
