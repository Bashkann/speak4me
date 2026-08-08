import { motion, useReducedMotion } from 'framer-motion';
import { CharacterBuddy } from '../../components/character/CharacterBuddy';
import { PreviewLoginForm, PreviewToolbar } from './AuthPreviewShared';

const headline = ['Your voice', 'belongs', 'in the room.'];

export function KineticAuthPreviewPage() {
  const reducedMotion = useReducedMotion();

  return (
    <main className="art-preview art-preview--kinetic">
      <PreviewToolbar current="kinetic" />
      <div className="kinetic-marquee" aria-hidden="true">
        <motion.div animate={reducedMotion ? undefined : { x: ['0%', '-50%'] }} transition={{ duration: 24, repeat: Infinity, ease: 'linear' }}>
          SPEAK · LISTEN · SWITCH · GROW · SPEAK · LISTEN · SWITCH · GROW ·
        </motion.div>
      </div>
      <div className="kinetic-layout">
        <section className="kinetic-statement" aria-labelledby="kinetic-title">
          <p className="kinetic-kicker"><span /> Direction B · kinetic type</p>
          <h1 id="kinetic-title" aria-label="Your voice belongs in the room">
            {headline.map((line, index) => (
              <span className="kinetic-line-mask" key={line}>
                <motion.span
                  initial={{ y: reducedMotion ? 0 : '110%', opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: reducedMotion ? 0 : 0.62, delay: reducedMotion ? 0 : 0.08 + index * 0.09, ease: [0.16, 1, 0.3, 1] }}
                >
                  {line}
                </motion.span>
              </span>
            ))}
          </h1>
          <p className="kinetic-deck">No audience. No endless feed. Just a small room built to get you talking.</p>
          <div className="kinetic-buddy-note">
            <CharacterBuddy mood="wave" size="sm" />
            <span><strong>Warm-up ready</strong>Matched by English level</span>
          </div>
        </section>

        <motion.aside
          className="kinetic-stat kinetic-stat--people"
          aria-label="Four people per match"
          animate={reducedMotion ? undefined : { y: [0, -8, 0], rotate: [-2, 0.5, -2] }}
          transition={{ duration: 5.2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <strong>04</strong><span>people</span>
        </motion.aside>
        <motion.aside
          className="kinetic-stat kinetic-stat--rounds"
          aria-label="Seven minute rounds"
          animate={reducedMotion ? undefined : { y: [0, 7, 0], rotate: [2, -0.5, 2] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        >
          <strong>07</strong><span>min rounds</span>
        </motion.aside>

        <PreviewLoginForm
          direction="kinetic"
          eyebrow="Next room starts with you"
          title="Ready when you are."
          description="Bring your English. We’ll bring the structure."
          footer={<p className="preview-direction-note">Editorial energy, with the buddy in a supporting role.</p>}
        />
      </div>
    </main>
  );
}
