export type CharacterMood =
  | 'idle'
  | 'wave'
  | 'peek'
  | 'happy'
  | 'error'
  | 'thinking'
  | 'encouraging'
  | 'excited'
  | 'searching'
  | 'celebrating'
  | 'loading';

export type CharacterPose = 'idle' | 'happy' | 'thinking' | 'celebrating' | 'peek';
export type CharacterProp = 'travel' | 'exam' | 'work' | 'home' | 'fun';

export interface CharacterEffect {
  load: () => Promise<{ default: Record<string, unknown> }>;
  loop: boolean;
  className: string;
}

export interface CharacterDefinition {
  pose: CharacterPose;
  motion: 'breathe' | 'wave' | 'hop' | 'wobble' | 'nod' | 'bounce' | 'scan' | 'celebrate' | 'still';
  effect?: CharacterEffect;
}

/**
 * Central character registry. Swap a placeholder animation by changing only the
 * matching `load` function; every route consuming that mood updates with it.
 */
export const CHARACTER_REGISTRY: Record<CharacterMood, CharacterDefinition> = {
  idle: { pose: 'idle', motion: 'breathe' },
  wave: { pose: 'happy', motion: 'wave' },
  peek: { pose: 'peek', motion: 'still' },
  happy: { pose: 'happy', motion: 'hop' },
  error: { pose: 'thinking', motion: 'wobble' },
  thinking: { pose: 'thinking', motion: 'nod' },
  encouraging: { pose: 'happy', motion: 'nod' },
  excited: { pose: 'happy', motion: 'bounce' },
  searching: {
    pose: 'thinking',
    motion: 'scan',
    effect: { load: () => import('../../assets/lottie/search-orbit.json'), loop: true, className: 'inset-1 opacity-30' },
  },
  celebrating: {
    pose: 'celebrating',
    motion: 'celebrate',
    effect: { load: () => import('../../assets/lottie/celebration-star.json'), loop: false, className: '-inset-3 opacity-25' },
  },
  loading: {
    pose: 'thinking',
    motion: 'breathe',
    effect: { load: () => import('../../assets/lottie/loading-color.json'), loop: true, className: 'inset-2 rounded-full opacity-10' },
  },
};
