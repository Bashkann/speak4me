import { candidatesForSeats, groupQueueEntries, type QueueCandidate } from '../../src/domain/matchmaking';

const now = new Date('2026-08-02T12:00:00.000Z');
const entry = (id: string, englishLevel: QueueCandidate['englishLevel'], ageSec: number): QueueCandidate => ({
  id,
  userId: `user-${id}`,
  englishLevel,
  enqueuedAt: new Date(now.getTime() - ageSec * 1000),
});

describe('matchmaking grouping', () => {
  it('forms FIFO groups whose level range is at most one step', () => {
    const result = groupQueueEntries([
      entry('1', 'A2', 30), entry('2', 'B1', 29), entry('3', 'A2', 28), entry('4', 'B1', 27),
      entry('5', 'C1', 26),
    ], now, 120);

    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.map((item) => item.id)).toEqual(['1', '2', '3', '4']);
    expect(result.unmatched.map((item) => item.id)).toEqual(['5']);
  });

  it('does not mix A2 and B2 before widening', () => {
    const result = groupQueueEntries([
      entry('1', 'A2', 30), entry('2', 'B2', 29), entry('3', 'A2', 28), entry('4', 'B2', 27),
    ], now, 120);
    expect(result.groups).toEqual([]);
    expect(result.unmatched).toHaveLength(4);
  });

  it('widens the oldest candidate tolerance after 120 seconds', () => {
    const result = groupQueueEntries([
      entry('1', 'A2', 121), entry('2', 'B2', 30), entry('3', 'A2', 29), entry('4', 'B1', 28),
    ], now, 120);
    expect(result.groups[0]?.map((item) => item.id)).toEqual(['1', '2', '3', '4']);
  });

  it('selects compatible users to top up an incomplete room', () => {
    const selected = candidatesForSeats([
      entry('1', 'C1', 30), entry('2', 'B1', 29), entry('3', 'B2', 28),
    ], ['B1', 'B2'], 2, now, 120);
    expect(selected.map((item) => item.id)).toEqual(['2', '3']);
  });
});
