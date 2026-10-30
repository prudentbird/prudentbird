import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTimeAgo(input: Date | string | number): string {
  const date = input instanceof Date ? input : new Date(input);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (!isFinite(seconds)) return "";
  if (seconds < 0) return "just now";
  if (seconds < 60) {
    const n = seconds;
    return `${n} ${n === 1 ? "second" : "seconds"} ago`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    const n = minutes;
    return `${n} ${n === 1 ? "min" : "mins"} ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const n = hours;
    return `${n} ${n === 1 ? "hour" : "hours"} ago`;
  }

  const days = Math.floor(hours / 24);
  if (days < 30) {
    const n = days;
    return `${n} ${n === 1 ? "day" : "days"} ago`;
  }

  const months = Math.floor(days / 30);
  if (months < 12) {
    const n = months;
    return `${n} ${n === 1 ? "month" : "months"} ago`;
  }

  const years = Math.floor(days / 365);
  const n = years;
  return `${n} ${n === 1 ? "year" : "years"} ago`;
}
