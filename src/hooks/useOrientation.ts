import { useEffect, useState } from 'react';

// Определяет ориентацию устройства по соотношению сторон (портрет/ландшафт).
// Для портретной ориентации возвращает true (как на смартфонах в вертикальном положении).
export function useOrientation() {
  const getIsPortrait = () => {
    if (typeof window === 'undefined') return false;
    const mql = window.matchMedia('(orientation: portrait)');
    if (mql && typeof mql.matches === 'boolean') return mql.matches;
    return window.innerHeight > window.innerWidth;
  };

  const [isPortrait, setIsPortrait] = useState(getIsPortrait);

  useEffect(() => {
    const update = () => setIsPortrait(getIsPortrait());
    const mql = window.matchMedia('(orientation: portrait)');
    update();
    mql.addEventListener('change', update);
    window.addEventListener('resize', update);
    return () => {
      mql.removeEventListener('change', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return isPortrait;
}
