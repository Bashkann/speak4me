import { motion, useReducedMotion, type TargetAndTransition } from 'framer-motion';

export type KineticMascotId = 'eko' | 'orbi' | 'kip';
export type MascotMotionState = 'hello' | 'account' | 'password' | 'goals' | 'level' | 'interests' | 'success' | 'error' | 'loading';

const mascotProfiles: Array<{ id: KineticMascotId; number: string; name: string; character: string }> = [
  { id: 'eko', number: '01', name: 'Eko', character: 'Sound-born · confident' },
  { id: 'orbi', number: '02', name: 'Orbi', character: 'Curious · social' },
  { id: 'kip', number: '03', name: 'Kip', character: 'Bold · editorial' },
];

const registrationStates: Array<{ state: MascotMotionState; label: string }> = [
  { state: 'account', label: 'Account' },
  { state: 'password', label: 'Password' },
  { state: 'goals', label: 'Goals' },
  { state: 'level', label: 'Level' },
  { state: 'interests', label: 'Interests' },
  { state: 'success', label: 'Done' },
];

const stateCopy: Record<MascotMotionState, string> = {
  hello: 'Waves when the screen opens.',
  account: 'Follows along while account details are typed.',
  password: 'Covers its eyes while the password is entered.',
  goals: 'Pauses and thinks through the learner’s goal.',
  level: 'Charges up as the English level is selected.',
  interests: 'Collects little signals around shared interests.',
  success: 'Bursts into a short, confident celebration.',
  error: 'Reacts gently, without blaming the learner.',
  loading: 'Keeps a quiet pulse while the account is prepared.',
};

interface KineticMascotLabProps {
  selected: KineticMascotId;
  state: MascotMotionState;
  onSelect: (mascot: KineticMascotId) => void;
  onStateChange: (state: MascotMotionState) => void;
}

export function KineticMascotLab({ selected, state, onSelect, onStateChange }: KineticMascotLabProps) {
  const profile = mascotProfiles.find((item) => item.id === selected) ?? mascotProfiles[0];

  return (
    <section className="kinetic-mascot-lab" aria-labelledby="kinetic-mascot-title">
      <div className="kinetic-mascot-lab-heading">
        <div>
          <p>Original character study</p>
          <h2 id="kinetic-mascot-title">Choose B’s voice.</h2>
        </div>
        <span>3 original directions</span>
      </div>

      <div className="kinetic-mascot-options" role="group" aria-label="Mascot candidates">
        {mascotProfiles.map((mascot) => (
          <button
            key={mascot.id}
            type="button"
            aria-pressed={selected === mascot.id}
            onClick={() => onSelect(mascot.id)}
          >
            <span className="kinetic-mascot-option-number">{mascot.number}</span>
            <KineticMascot id={mascot.id} state="hello" size="sm" animated={false} />
            <span className="kinetic-mascot-option-copy"><strong>{mascot.name}</strong><small>{mascot.character}</small></span>
          </button>
        ))}
      </div>

      <div className="kinetic-mascot-rehearsal">
        <div className="kinetic-mascot-stage">
          <KineticMascot id={selected} state={state} size="lg" testId="selected-kinetic-mascot" />
          <div>
            <p>Mascot {profile?.number} · {profile?.name}</p>
            <strong>{stateCopy[state]}</strong>
            <span>Try the registration moments or focus the login fields.</span>
          </div>
        </div>
        <div className="kinetic-registration-states" role="group" aria-label="Registration animation moments">
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

function KineticMascot({ id, state, size, animated = true, testId }: { id: KineticMascotId; state: MascotMotionState; size: 'sm' | 'lg'; animated?: boolean; testId?: string }) {
  const reducedMotion = useReducedMotion();
  const motionDisabled = Boolean(reducedMotion) || !animated;

  return (
    <motion.div
      className={`kinetic-original-mascot kinetic-original-mascot--${id} kinetic-original-mascot--${size} is-${state}`}
      data-mascot-id={id}
      data-motion-state={state}
      data-motion={motionDisabled ? 'static' : 'animated'}
      data-testid={testId}
      aria-hidden="true"
      initial={false}
      animate={motionDisabled ? { opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 } : mascotMotion(state)}
      transition={motionDisabled ? { duration: 0 } : mascotTransition(state)}
    >
      <div className="kinetic-original-mascot-canvas">
        <i className="kinetic-mascot-antenna"><b /></i>
        <i className="kinetic-mascot-ring" />
        <i className="kinetic-mascot-ear kinetic-mascot-ear--left" />
        <i className="kinetic-mascot-ear kinetic-mascot-ear--right" />
        <div className="kinetic-mascot-body">
          <span className="kinetic-mascot-eye kinetic-mascot-eye--left"><i /></span>
          <span className="kinetic-mascot-eye kinetic-mascot-eye--right"><i /></span>
          <span className="kinetic-mascot-mouth"><i /><i /><i /></span>
          <span className="kinetic-mascot-sigil">S4</span>
        </div>
        <i className="kinetic-mascot-hand kinetic-mascot-hand--left" />
        <i className="kinetic-mascot-hand kinetic-mascot-hand--right" />
        <i className="kinetic-mascot-foot kinetic-mascot-foot--left" />
        <i className="kinetic-mascot-foot kinetic-mascot-foot--right" />
        <i className="kinetic-mascot-particle kinetic-mascot-particle--one" />
        <i className="kinetic-mascot-particle kinetic-mascot-particle--two" />
        <i className="kinetic-mascot-particle kinetic-mascot-particle--three" />
      </div>
    </motion.div>
  );
}

function mascotMotion(state: MascotMotionState): TargetAndTransition {
  if (state === 'password') return { y: [0, -2, 0], scale: [1, 0.985, 1] };
  if (state === 'goals') return { rotate: [0, -4, 3, 0], y: [0, -3, 0] };
  if (state === 'level') return { y: [0, -10, 0], scale: [1, 1.06, 1] };
  if (state === 'interests') return { rotate: [0, 4, -4, 0], scale: [1, 1.035, 1] };
  if (state === 'success') return { y: [0, -14, 0], rotate: [0, -5, 5, 0], scale: [1, 1.09, 1] };
  if (state === 'error') return { x: [0, -5, 4, -3, 0], rotate: [0, -2, 2, 0] };
  if (state === 'loading') return { scale: [1, 1.035, 1], opacity: [1, 0.82, 1] };
  if (state === 'account') return { x: [0, 3, -2, 0], y: [0, -4, 0] };
  return { y: [0, -5, 0], rotate: [0, -1.5, 0] };
}

function mascotTransition(state: MascotMotionState) {
  if (state === 'error') return { duration: 0.48 };
  if (state === 'success' || state === 'level') return { duration: 0.9, repeat: Infinity, repeatDelay: 1.1, ease: 'easeInOut' as const };
  if (state === 'password' || state === 'loading') return { duration: 1.5, repeat: Infinity, ease: 'easeInOut' as const };
  return { duration: 2.6, repeat: Infinity, ease: 'easeInOut' as const };
}
