import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

export function AnimatedNumber({ value }: { value: number }) {
  const reducedMotion = useReducedMotion();
  const [display, setDisplay] = useState(value === 0 ? 0 : reducedMotion ? value : 0);
  const animated = useRef(false);

  useEffect(() => {
    if (animated.current || value === 0 || reducedMotion) {
      setDisplay(value);
      if (value !== 0) animated.current = true;
      return;
    }
    animated.current = true;
    const startedAt = performance.now();
    const duration = 560;
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(value * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reducedMotion, value]);

  return <>{display.toLocaleString()}</>;
}
