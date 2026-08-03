import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CharacterBuddy } from './CharacterBuddy';
import { CHARACTER_REGISTRY } from './character-registry';

describe('CharacterBuddy', () => {
  it('is decorative and exposes the selected registry mood', () => {
    render(<CharacterBuddy mood="searching" prop="travel" animated={false} />);
    const buddy = screen.getByTestId('character-buddy');
    expect(buddy).toHaveAttribute('aria-hidden', 'true');
    expect(buddy).toHaveAttribute('data-character-mood', 'searching');
    expect(buddy).toHaveAttribute('data-motion', 'static');
  });

  it('keeps every mood in the central registry', () => {
    expect(Object.keys(CHARACTER_REGISTRY)).toEqual(expect.arrayContaining(['idle', 'peek', 'error', 'searching', 'celebrating', 'loading']));
  });
});
