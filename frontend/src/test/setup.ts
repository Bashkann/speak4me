import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// lottie-web touches canvas during module initialization; route tests run in
// JSDOM, so the visual-only player is replaced with a no-op there.
vi.mock('lottie-react', () => ({ default: () => null }));
