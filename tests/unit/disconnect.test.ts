import { disconnectAction } from '../../src/domain/disconnect';

describe('disconnect policy', () => {
  it.each(['waiting', 'ready'] as const)('frees a seat in %s', (status) => {
    expect(disconnectAction(status)).toBe('free_seat');
  });

  it.each(['round1', 'break', 'round2'] as const)('starts grace in %s', (status) => {
    expect(disconnectAction(status)).toBe('start_grace');
  });

  it.each(['finished', 'aborted'] as const)('ignores disconnect in %s', (status) => {
    expect(disconnectAction(status)).toBe('ignore');
  });
});
