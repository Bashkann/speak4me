import { motion, useReducedMotion } from 'framer-motion';
import { Brand } from '../../components/Brand';
import { CharacterBuddy } from '../../components/character/CharacterBuddy';
import { PreviewLoginForm, PreviewToolbar } from './AuthPreviewShared';

export function WarmAuthPreviewPage() {
  const reducedMotion = useReducedMotion();

  return (
    <main className="art-preview art-preview--warm">
      <div className="warm-texture" aria-hidden="true" />
      <PreviewToolbar current="warm" />
      <div className="warm-layout">
        <section className="warm-statement" aria-labelledby="warm-title">
          <div className="warm-brand"><Brand linked={false} /><span>Direction C · warm hybrid</span></div>
          <div className="warm-character-stage">
            <motion.div
              className="warm-speech-bubble"
              initial={{ opacity: 0, scale: reducedMotion ? 1 : 0.9, y: reducedMotion ? 0 : 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: reducedMotion ? 0 : 0.34, delay: reducedMotion ? 0 : 0.45 }}
            >
              You’ve got this.
            </motion.div>
            <CharacterBuddy mood="wave" size="lg" />
          </div>
          <p className="warm-kicker">Friendly practice, real momentum.</p>
          <h1 id="warm-title">Come as you are.<br /><motion.span animate={reducedMotion ? undefined : { color: ['#16835a', '#e7923d', '#16835a'] }} transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}>Leave speaking braver.</motion.span></h1>
          <p className="warm-deck">A small, welcoming room where speaking and listening take equal turns.</p>
          <div className="warm-chips" aria-label="Product features">
            {['Level matched', 'Two-way practice', 'Gentle structure'].map((item, index) => (
              <motion.span key={item} initial={{ opacity: 0, x: reducedMotion ? 0 : -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: reducedMotion ? 0 : 0.32 + index * 0.07 }}>
                <i aria-hidden="true" />{item}
              </motion.span>
            ))}
          </div>
        </section>

        <PreviewLoginForm
          direction="warm"
          eyebrow="Welcome back, brave speaker"
          title="Your room is waiting."
          description="Sign in and take the next small step in English."
          footer={<p className="preview-direction-note">The current warmth, with glass and quieter motion craft.</p>}
        />
      </div>
    </main>
  );
}
