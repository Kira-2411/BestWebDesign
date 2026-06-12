'use client';

import { useEffect, useRef } from 'react';

export default function VantaBirdsBackground() {
  const vantaRef = useRef(null);
  const effectRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    const initVanta = async () => {
      if (!vantaRef.current) return;

      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reducedMotion) return;

      try {
        const THREE = await import('three');
        const birdsModule = await import('vanta/dist/vanta.birds.min.js');
        const BIRDS = birdsModule.default;

        if (!mounted || !vantaRef.current) return;

        effectRef.current = BIRDS({
          el: vantaRef.current,
          THREE,
          mouseControls: true,
          touchControls: true,
          gyroControls: false,
          minHeight: 200.0,
          minWidth: 200.0,
          scale: 1.0,
          scaleMobile: 1.0,
          backgroundColor: 0xf2f6ff,
          color1: 0x018abe,
          color2: 0x97cadb,
          birdSize: 1.4,
          wingSpan: 23.0,
          separation: 32.0,
          alignment: 37.0,
          quantity: 4,
        });

        requestAnimationFrame(() => {
          effectRef.current?.resize?.();
        });
      } catch (err) {
        console.error('Vanta Birds init failed:', err);
      }
    };

    const timer = window.setTimeout(initVanta, 0);

    const handleResize = () => {
      effectRef.current?.resize?.();
    };

    window.addEventListener('resize', handleResize, { passive: true });

    return () => {
      mounted = false;
      window.clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
      if (effectRef.current) {
        effectRef.current.destroy();
        effectRef.current = null;
      }
    };
  }, []);

  return <div ref={vantaRef} className="vanta-birds-bg" aria-hidden="true" />;
}
