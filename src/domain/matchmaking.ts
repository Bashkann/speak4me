import type { EnglishLevel } from '@prisma/client';
import { levelRange } from './levels';

export interface QueueCandidate {
  id: string;
  userId: string;
  englishLevel: EnglishLevel;
  enqueuedAt: Date;
}

export interface MatchmakingResult<T extends QueueCandidate> {
  groups: T[][];
  unmatched: T[];
}

/** FIFO-greedy grouping. The oldest candidate sets the group's wait tolerance. */
export function groupQueueEntries<T extends QueueCandidate>(
  entries: T[],
  now: Date,
  widenAfterSec: number,
): MatchmakingResult<T> {
  const remaining = [...entries].sort((a, b) => a.enqueuedAt.getTime() - b.enqueuedAt.getTime());
  const groups: T[][] = [];

  while (remaining.length >= 4) {
    const anchor = remaining[0]!;
    const waitedSec = (now.getTime() - anchor.enqueuedAt.getTime()) / 1000;
    const tolerance = waitedSec > widenAfterSec ? 2 : 1;
    let selected: [number, number, number] | undefined;

    outer: for (let first = 1; first < remaining.length - 2; first += 1) {
      for (let second = first + 1; second < remaining.length - 1; second += 1) {
        for (let third = second + 1; third < remaining.length; third += 1) {
          const indexes: [number, number, number] = [first, second, third];
          const candidates = [anchor, ...indexes.map((index) => remaining[index]!)];
          if (levelRange(candidates.map((entry) => entry.englishLevel)) <= tolerance) {
            selected = indexes;
            break outer;
          }
        }
      }
    }

    if (!selected) {
      // This FIFO anchor cannot form a group yet. Preserve it but try later anchors.
      const skipped = remaining.shift()!;
      const tail = groupQueueEntries(remaining, now, widenAfterSec);
      return { groups: [...groups, ...tail.groups], unmatched: [skipped, ...tail.unmatched] };
    }

    const selectedSet = new Set([0, ...selected]);
    groups.push(remaining.filter((_entry, index) => selectedSet.has(index)));
    for (const index of [...selected].sort((a, b) => b - a)) remaining.splice(index, 1);
    remaining.shift();
  }

  return { groups, unmatched: remaining };
}

export function candidatesForSeats<T extends QueueCandidate>(
  entries: T[],
  existingLevels: EnglishLevel[],
  seatsNeeded: number,
  now: Date,
  widenAfterSec: number,
): T[] {
  const sorted = [...entries].sort((a, b) => a.enqueuedAt.getTime() - b.enqueuedAt.getTime());
  const selected: T[] = [];
  for (const candidate of sorted) {
    const waitedSec = (now.getTime() - candidate.enqueuedAt.getTime()) / 1000;
    const tolerance = waitedSec > widenAfterSec ? 2 : 1;
    if (levelRange([...existingLevels, ...selected.map((item) => item.englishLevel), candidate.englishLevel]) <= tolerance) {
      selected.push(candidate);
      if (selected.length === seatsNeeded) break;
    }
  }
  return selected.length === seatsNeeded ? selected : [];
}
