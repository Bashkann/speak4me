import { lazy, Suspense, useEffect, useState } from 'react';
import type { CharacterEffect } from './character-registry';

const Lottie = lazy(() => import('lottie-react').then((module) => ({ default: module.default })));

export function LazyLottieEffect({ effect, disabled }: { effect: CharacterEffect; disabled: boolean }) {
  const [animationData, setAnimationData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (disabled) return;
    let current = true;
    void effect.load().then((module) => { if (current) setAnimationData(module.default); });
    return () => { current = false; };
  }, [disabled, effect]);

  if (disabled || !animationData) return null;
  return (
    <span className={`pointer-events-none absolute ${effect.className}`}>
      <Suspense fallback={null}>
        <Lottie animationData={animationData} autoplay loop={effect.loop} rendererSettings={{ preserveAspectRatio: 'xMidYMid meet' }} />
      </Suspense>
    </span>
  );
}
