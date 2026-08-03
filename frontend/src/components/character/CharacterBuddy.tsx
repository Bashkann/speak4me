import { motion, useReducedMotion, type TargetAndTransition } from 'framer-motion';
import { CHARACTER_REGISTRY, type CharacterMood, type CharacterPose, type CharacterProp } from './character-registry';
import { LazyLottieEffect } from './LazyLottieEffect';

const sizes = { xs: 'h-14 w-14', sm: 'h-20 w-20', md: 'h-28 w-28', lg: 'h-36 w-36' } as const;

export function CharacterBuddy({ mood = 'idle', prop, size = 'md', className = '', animated = true }: { mood?: CharacterMood; prop?: CharacterProp; size?: keyof typeof sizes; className?: string; animated?: boolean }) {
  const prefersReducedMotion = useReducedMotion();
  const definition = CHARACTER_REGISTRY[mood];
  const motionDisabled = Boolean(prefersReducedMotion) || !animated;

  return (
    <motion.div
      aria-hidden="true"
      data-testid="character-buddy"
      data-character-mood={mood}
      data-motion={motionDisabled ? 'static' : 'animated'}
      className={`character-buddy relative isolate shrink-0 ${sizes[size]} ${className}`}
      initial={false}
      animate={motionDisabled ? { opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 } : characterMotion(definition.motion)}
      transition={motionDisabled ? { duration: 0 } : characterTransition(definition.motion)}
    >
      {definition.effect && <LazyLottieEffect effect={definition.effect} disabled={motionDisabled} />}
      <BuddySvg pose={definition.pose} prop={prop} animate={!motionDisabled} wave={definition.motion === 'wave'} scan={definition.motion === 'scan'} />
    </motion.div>
  );
}

function BuddySvg({ pose, prop, animate, wave, scan }: { pose: CharacterPose; prop?: CharacterProp; animate: boolean; wave: boolean; scan: boolean }) {
  const happy = pose === 'happy' || pose === 'celebrating';
  return (
    <motion.svg className="relative z-10 h-full w-full overflow-visible" viewBox="0 0 160 160" fill="none" focusable="false" initial={false}>
      <motion.ellipse cx="80" cy="140" rx="38" ry="8" fill="var(--buddy-shadow)" opacity="0.16" animate={animate ? { opacity: [0.13, 0.2, 0.13], scaleX: [1, 0.9, 1] } : { opacity: 0.16, scaleX: 1 }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }} />
      <motion.g animate={scan && animate ? { x: [-3, 3, -3] } : { x: 0 }} transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}>
        <path d="M46 54c-11-6-17-1-15 9 1 7 7 11 15 10" fill="var(--buddy-accent)" />
        <path d="M114 54c11-6 17-1 15 9-1 7-7 11-15 10" fill="var(--buddy-accent)" />
        <rect x="37" y="31" width="86" height="103" rx="39" fill="var(--buddy-body)" />
        <ellipse cx="80" cy="105" rx="29" ry="22" fill="var(--buddy-belly)" opacity="0.88" />
        {pose === 'peek' ? <PeekFace /> : <Face pose={pose} animate={animate} />}
      </motion.g>
      <motion.path d="M43 87c-13 2-18 11-15 21" stroke="var(--buddy-body)" strokeWidth="13" strokeLinecap="round" animate={wave && animate ? { rotate: [0, -20, 15, -18, 0], y: [0, -4, 0] } : { rotate: 0, y: 0 }} style={{ transformOrigin: '43px 87px' }} transition={{ duration: 1.1, repeat: Infinity, repeatDelay: 1.8 }} />
      <motion.path d="M117 87c13 2 18 11 15 21" stroke="var(--buddy-body)" strokeWidth="13" strokeLinecap="round" animate={pose === 'celebrating' && animate ? { rotate: [0, 18, -12, 15, 0], y: [0, -5, 0] } : { rotate: 0, y: 0 }} style={{ transformOrigin: '117px 87px' }} transition={{ duration: 0.9, repeat: Infinity, repeatDelay: 1.2 }} />
      <path d="M58 129v10M102 129v10" stroke="var(--buddy-body)" strokeWidth="12" strokeLinecap="round" />
      {happy && <motion.g animate={animate ? { opacity: [0.45, 1, 0.45], scale: [0.92, 1.08, 0.92] } : { opacity: 0.8, scale: 1 }} transition={{ duration: 1.8, repeat: Infinity }}><path d="M31 38l3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z" fill="var(--buddy-spark)" /><path d="M131 24l2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5Z" fill="var(--buddy-spark)" /></motion.g>}
      {prop && <BuddyPropIcon prop={prop} />}
    </motion.svg>
  );
}

function Face({ pose, animate }: { pose: CharacterPose; animate: boolean }) {
  const thinking = pose === 'thinking';
  const celebrating = pose === 'celebrating';
  return <g>
    <motion.g animate={animate ? { scaleY: [1, 1, 0.12, 1, 1] } : { scaleY: 1 }} style={{ transformOrigin: '80px 67px' }} transition={{ duration: 3.8, times: [0, 0.46, 0.5, 0.54, 1], repeat: Infinity }}>
      <ellipse cx="64" cy="67" rx="6" ry={thinking ? 7 : 8} fill="var(--buddy-ink)" />
      <ellipse cx="96" cy="67" rx="6" ry={thinking ? 7 : 8} fill="var(--buddy-ink)" />
      <circle cx="66" cy="64" r="1.8" fill="white" /><circle cx="98" cy="64" r="1.8" fill="white" />
    </motion.g>
    {pose === 'idle' && <path d="M70 84c6 4 14 4 20 0" stroke="var(--buddy-ink)" strokeWidth="4" strokeLinecap="round" />}
    {pose === 'happy' && <path d="M66 82c8 12 20 12 28 0" stroke="var(--buddy-ink)" strokeWidth="4" strokeLinecap="round" />}
    {thinking && <><path d="M70 87c5-3 15-3 20 0" stroke="var(--buddy-ink)" strokeWidth="4" strokeLinecap="round" /><path d="M57 53c5-3 10-3 14-1" stroke="var(--buddy-ink)" strokeWidth="3" strokeLinecap="round" /></>}
    {celebrating && <ellipse cx="80" cy="86" rx="10" ry="8" fill="var(--buddy-ink)" />}
  </g>;
}

function PeekFace() {
  return <g><ellipse cx="64" cy="67" rx="6" ry="8" fill="var(--buddy-ink)" /><ellipse cx="96" cy="67" rx="6" ry="8" fill="var(--buddy-ink)" /><path d="M70 86c6 3 14 3 20 0" stroke="var(--buddy-ink)" strokeWidth="4" strokeLinecap="round" /><path d="M47 74c8-11 19-15 31-9M113 74c-8-11-19-15-31-9" stroke="var(--buddy-accent)" strokeWidth="12" strokeLinecap="round" /></g>;
}

function BuddyPropIcon({ prop }: { prop: CharacterProp }) {
  if (prop === 'travel') return <g transform="translate(107 102)"><rect width="30" height="25" rx="6" fill="var(--buddy-prop)" /><path d="M10 1v-5h10v5" stroke="var(--buddy-ink)" strokeWidth="3" /><path d="M15 5v15" stroke="white" strokeWidth="2" opacity=".7" /></g>;
  if (prop === 'exam') return <g transform="translate(51 18)"><path d="M0 10 29 0l29 10-29 10L0 10Z" fill="var(--buddy-prop)" /><path d="M47 13v12" stroke="var(--buddy-ink)" strokeWidth="3" /></g>;
  if (prop === 'work') return <g transform="translate(106 105)"><rect width="33" height="23" rx="5" fill="var(--buddy-prop)" /><path d="M11 1v-5h11v5M0 9h33" stroke="var(--buddy-ink)" strokeWidth="3" /></g>;
  if (prop === 'home') return <g transform="translate(108 104)"><path d="M1 12 16 0l15 12v16H1V12Z" fill="var(--buddy-prop)" /><rect x="12" y="17" width="8" height="11" rx="2" fill="var(--buddy-belly)" /></g>;
  return <g transform="translate(117 112)"><path d="M0 7c0-9 13-9 13 0 0-9 13-9 13 0 0 8-13 15-13 15S0 15 0 7Z" fill="var(--buddy-prop)" /></g>;
}

function characterMotion(motionName: CharacterDefinitionMotion): TargetAndTransition {
  if (motionName === 'wave') return { y: [0, -5, 0], rotate: [0, -2, 0], scale: [1, 1.025, 1] };
  if (motionName === 'hop') return { y: [0, -8, 0], scale: [1, 1.04, 1] };
  if (motionName === 'wobble') return { x: [0, -5, 5, -3, 3, 0], rotate: [0, -3, 3, -2, 2, 0] };
  if (motionName === 'nod') return { y: [0, 2, 0], rotate: [0, 2, 0] };
  if (motionName === 'bounce') return { y: [0, -7, 0], scale: [1, 1.06, 1] };
  if (motionName === 'scan') return { x: [-2, 2, -2], rotate: [-1.5, 1.5, -1.5] };
  if (motionName === 'celebrate') return { y: [0, -10, 0], rotate: [0, -4, 4, 0], scale: [1, 1.08, 1] };
  if (motionName === 'breathe') return { y: [0, -2, 0], scale: [1, 1.018, 1] };
  return { opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 };
}

type CharacterDefinitionMotion = (typeof CHARACTER_REGISTRY)[CharacterMood]['motion'];
function characterTransition(motionName: CharacterDefinitionMotion) {
  if (motionName === 'wobble') return { duration: 0.62 };
  if (motionName === 'hop' || motionName === 'celebrate') return { duration: 0.9, repeat: Infinity, repeatDelay: 1.1, ease: 'easeInOut' as const };
  if (motionName === 'wave') return { duration: 2.6, repeat: Infinity, ease: 'easeInOut' as const };
  if (motionName === 'nod' || motionName === 'bounce') return { duration: 1.1, repeat: Infinity, repeatDelay: 1.2, ease: 'easeInOut' as const };
  if (motionName === 'scan') return { duration: 2.4, repeat: Infinity, ease: 'easeInOut' as const };
  if (motionName === 'breathe') return { duration: 3, repeat: Infinity, ease: 'easeInOut' as const };
  return { duration: 0 };
}
