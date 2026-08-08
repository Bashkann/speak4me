import { motion, useReducedMotion } from 'framer-motion';
import { PreviewLoginForm, PreviewToolbar } from './AuthPreviewShared';

export function LiquidAuthPreviewPage() {
  const reducedMotion = useReducedMotion();

  return (
    <main className="art-preview art-preview--liquid">
      <motion.div
        aria-hidden="true"
        className="liquid-orb liquid-orb--one"
        animate={reducedMotion ? undefined : { x: [0, 28, -10, 0], y: [0, -20, 16, 0], rotate: [0, 10, -7, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden="true"
        className="liquid-orb liquid-orb--two"
        animate={reducedMotion ? undefined : { x: [0, -24, 12, 0], y: [0, 18, -8, 0], scale: [1, 1.08, 0.96, 1] }}
        transition={{ duration: 24, repeat: Infinity, ease: 'easeInOut' }}
      />
      <PreviewToolbar current="liquid" />
      <div className="liquid-layout">
        <section className="liquid-statement" aria-labelledby="liquid-statement-title">
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: reducedMotion ? 0 : 0.4 }}>Direction A · liquid glass</motion.p>
          <h1 id="liquid-statement-title" aria-label="Speak clearly">
            {['SPEAK', 'CLEARLY.'].map((line, index) => (
              <motion.span
                key={line}
                initial={{ opacity: 0, y: reducedMotion ? 0 : 38 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reducedMotion ? 0 : 0.68, delay: reducedMotion ? 0 : 0.08 + index * 0.1, ease: [0.22, 1, 0.36, 1] }}
              >
                {line}
              </motion.span>
            ))}
          </h1>
          <p className="liquid-deck">Focused live conversation, distilled to its essentials.</p>
          <div className="liquid-proof" aria-label="Product facts">
            <span><strong>4</strong> matched voices</span>
            <span><strong>2</strong> focused rooms</span>
            <span><strong>1</strong> clear ritual</span>
          </div>
        </section>

        <PreviewLoginForm
          direction="liquid"
          eyebrow="Private practice room"
          title="Step into the signal."
          description="Sign in to join a focused English conversation."
          footer={<p className="preview-direction-note">Cold, minimal, and deliberately mascot-free.</p>}
        />
      </div>
    </main>
  );
}
