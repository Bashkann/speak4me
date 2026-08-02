import { useEffect, useState } from 'react';

export function useAbsoluteCountdown(deadline: string | null): number | null {
  const calculate = () => deadline ? Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / 1000)) : null;
  const [remainingSec, setRemainingSec] = useState<number | null>(calculate);

  useEffect(() => {
    setRemainingSec(calculate());
    if (!deadline) return;
    const timer = window.setInterval(() => setRemainingSec(calculate()), 250);
    return () => window.clearInterval(timer);
  }, [deadline]);

  return remainingSec;
}
