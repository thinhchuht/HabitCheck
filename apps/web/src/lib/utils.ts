import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Returns the first "word" of a display name (used in short ticker texts). */
export function firstName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 0 ? parts[0] : name;
}

/** Rough check whether a string is an emoji/short symbol (for activity icons). */
export function isEmojiLike(value: string | null | undefined): boolean {
  if (!value) return false;
  return value.length <= 8;
}
