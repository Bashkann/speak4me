import { assertTransition, canTransition, nextTimedStatus } from '../../src/domain/room-state';

describe('room state machine', () => {
  it('allows only the declared happy-path transitions', () => {
    expect(canTransition('waiting', 'ready')).toBe(true);
    expect(canTransition('ready', 'round1')).toBe(true);
    expect(canTransition('round1', 'break')).toBe(true);
    expect(canTransition('break', 'round2')).toBe(true);
    expect(canTransition('round2', 'finished')).toBe(true);
    expect(nextTimedStatus('round1')).toBe('break');
  });

  it('keeps terminal rooms immutable', () => {
    expect(canTransition('finished', 'waiting')).toBe(false);
    expect(canTransition('aborted', 'waiting')).toBe(false);
    expect(() => assertTransition('finished', 'waiting')).toThrow('Illegal room transition');
  });
});
