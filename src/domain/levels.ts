import type { EnglishLevel } from '@prisma/client';

export const LEVELS: EnglishLevel[] = ['A2', 'B1', 'B2', 'C1'];

export function levelDistance(first: EnglishLevel, second: EnglishLevel): number {
  return Math.abs(LEVELS.indexOf(first) - LEVELS.indexOf(second));
}

export function levelRange(levels: EnglishLevel[]): number {
  const indexes = levels.map((level) => LEVELS.indexOf(level));
  return indexes.length ? Math.max(...indexes) - Math.min(...indexes) : 0;
}
