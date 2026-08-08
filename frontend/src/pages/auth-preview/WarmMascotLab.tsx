import { motion, useReducedMotion, type TargetAndTransition } from 'framer-motion';

export type WarmMascotId = 'mimo' | 'pufi' | 'lumi';
export type WarmMascotMotionState = 'hello' | 'account' | 'password' | 'goals' | 'level' | 'interests' | 'success' | 'error' | 'loading';

const mascotProfiles: Array<{ id: WarmMascotId; number: string; name: string; character: string }> = [
  { id: 'mimo', number: 'C1', name: 'Mimo', character: 'Grounded · encouraging' },
  { id: 'pufi', number: 'C2', name: 'Pufi', character: 'Soft · playful' },
  { id: 'lumi', number: 'C3', name: 'Lumi', character: 'Bright · reassuring' },
];

const registrationStates: Array<{ state: WarmMascotMotionState; label: string }> = [
  { state: 'account', label: 'Account' },
  { state: 'password', label: 'Password' },
  { state: 'goals', label: 'Goals' },
  { state: 'level', label: 'Level' },
  { state: 'interests', label: 'Interests' },
  { state: 'success', label: 'Done' },
];

const stateCopy: Record<WarmMascotMotionState, string> = {
  hello: 'A small hello before the first word.',
  account: 'Leans in while the learner introduces themselves.',
  password: 'Politely hides its eyes for private moments.',
  goals: 'Stops to imagine the learner’s next brave step.',
  level: 'Glows a little brighter as confidence grows.',
  interests: 'Finds tiny sparks around shared interests.',
  success: 'Celebrates warmly — never too loudly.',
  error: 'Offers a gentle reset instead of a red alarm.',
  loading: 'Breathes slowly while the room gets ready.',
};

interface WarmMascotLabProps {
  selected: WarmMascotId;
  state: WarmMascotMotionState;
  onSelect: (mascot: WarmMascotId) => void;
  onStateChange: (state: WarmMascotMotionState) => void;
}

export function WarmMascotLab({ selected, state, onSelect, onStateChange }: WarmMascotLabProps) {
  const profile = mascotProfiles.find((item) => item.id === selected) ?? mascotProfiles[0]!;

  return (
    <section className="warm-mascot-lab" aria-labelledby="warm-mascot-title">
      <div className="warm-mascot-lab-heading">
        <div>
          <p>Original warm character study</p>
          <h2 id="warm-mascot-title">Choose C’s companion.</h2>
        </div>
        <span>3 friendly directions</span>
      </div>

      <div className="warm-mascot-options" role="group" aria-label="Warm mascot candidates">
        {mascotProfiles.map((mascot) => (
          <button
            key={mascot.id}
            type="button"
            aria-pressed={selected === mascot.id}
            onClick={() => onSelect(mascot.id)}
          >
            <span className="warm-mascot-option-number">{mascot.number}</span>
            <WarmMascot id={mascot.id} state="hello" size="sm" animated={false} />
            <span className="warm-mascot-option-copy">
              <strong>{mascot.name}</strong>
              <small>{mascot.character}</small>
            </span>
          </button>
        ))}
      </div>

      <div className="warm-mascot-rehearsal">
        <div className="warm-mascot-stage">
          <div className="warm-mascot-bubble">You’ve got this.</div>
          <WarmMascot id={selected} state={state} size="lg" testId="selected-warm-mascot" />
          <div className="warm-mascot-stage-copy">
            <p>{profile.number} · {profile.name}</p>
            <strong>{stateCopy[state]}</strong>
            <span>Try a registration moment or focus the login fields.</span>
          </div>
        </div>

        <div className="warm-registration-states" role="group" aria-label="Warm registration animation moments">
          {registrationStates.map((item) => (
            <button
              key={item.state}
              type="button"
              className={state === item.state ? 'is-active' : undefined}
              aria-pressed={state === item.state}
              onClick={() => onStateChange(item.state)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function WarmMascot({ id, state, size, animated = true, testId }: { id: WarmMascotId; state: WarmMascotMotionState; size: 'sm' | 'lg'; animated?: boolean; testId?: string }) {
  const reducedMotion = useReducedMotion();
  const motionDisabled = Boolean(reducedMotion) || !animated;

  return (
    <motion.div
      className={`warm-original-mascot warm-original-mascot--${id} warm-original-mascot--${size} is-${state}`}
      data-mascot-id={id}
      data-motion-state={state}
      data-motion={motionDisabled ? 'static' : 'animated'}
      data-testid={testId}
      aria-hidden="true"
      initial={false}
      animate={motionDisabled ? { opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 } : mascotMotion(state)}
      transition={motionDisabled ? { duration: 0 } : mascotTransition(state)}
    >
      <div className="warm-original-mascot-canvas">
        <i className="warm-mascot-aura" />
        <i className="warm-mascot-cap"><b /></i>
        <i className="warm-mascot-ear warm-mascot-ear--left" />
        <i className="warm-mascot-ear warm-mascot-ear--right" />
        <div className="warm-mascot-body">
          <span className="warm-mascot-eye warm-mascot-eye--left"><i /></span>
          <span className="warm-mascot-eye warm-mascot-eye--right"><i /></span>
          <span className="warm-mascot-blush warm-mascot-blush--left" />
          <span className="warm-mascot-blush warm-mascot-blush--right" />
          <span className="warm-mascot-mouth" />
          <span className="warm-mascot-heart">s4</span>
        </div>
        <i className="warm-mascot-hand warm-mascot-hand--left" />
        <i className="warm-mascot-hand warm-mascot-hand--right" />
        <i className="warm-mascot-foot warm-mascot-foot--left" />
        <i className="warm-mascot-foot warm-mascot-foot--right" />
        <i className="warm-mascot-spark warm-mascot-spark--one" />
        <i className="warm-mascot-spark warm-mascot-spark--two" />
        <i className="warm-mascot-spark warm-mascot-spark--three" />
      </div>
    </motion.div>
  );
}

function mascotMotion(state: WarmMascotMotionState): TargetAndTransition {
  if (state === 'password') return { y: [0, -2, 0], scale: [1, 0.985, 1] };
  if (state === 'goals') return { rotate: [0, -4, 2.5, 0], y: [0, -3, 0] };
  if (state === 'level') return { y: [0, -8, 0], scale: [1, 1.055, 1] };
  if (state === 'interests') return { rotate: [0, 3, -3, 0], scale: [1, 1.025, 1] };
  if (state === 'success') return { y: [0, -12, 0], rotate: [0, -4, 4, 0], scale: [1, 1.075, 1] };
  if (state === 'error') return { x: [0, -4, 3, -2, 0], rotate: [0, -2, 2, 0] };
  if (state === 'loading') return { scale: [1, 1.025, 1], opacity: [1, 0.84, 1] };
  if (state === 'account') return { x: [0, 2, -1, 0], y: [0, -3, 0] };
  return { y: [0, -4, 0], rotate: [0, -1, 0] };
}

function mascotTransition(state: WarmMascotMotionState) {
  if (state === 'error') return { duration: 0.48 };
  if (state === 'success' || state === 'level') return { duration: 0.95, repeat: Infinity, repeatDelay: 1.35, ease: 'easeInOut' as const };
  if (state === 'password' || state === 'loading') return { duration: 1.7, repeat: Infinity, ease: 'easeInOut' as const };
  return { duration: 3, repeat: Infinity, ease: 'easeInOut' as const };
}
