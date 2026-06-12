'use client';

import { useEffect, useRef } from 'react';

export default function BackgroundAnimations() {
  const layerRef = useRef(null);

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion || !layerRef.current) return undefined;

    const onMove = (e) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 24;
      const y = (e.clientY / window.innerHeight - 0.5) * 24;
      layerRef.current?.style.setProperty('--parallax-x', `${x}px`);
      layerRef.current?.style.setProperty('--parallax-y', `${y}px`);
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  return (
    <div
      ref={layerRef}
      className="bg-animations"
      aria-hidden="true"
    >
      <div className="bg-animations__mesh" />
      <div className="bg-animations__orbs">
        <span className="bg-animations__orb bg-animations__orb--1" />
        <span className="bg-animations__orb bg-animations__orb--2" />
        <span className="bg-animations__orb bg-animations__orb--3" />
        <span className="bg-animations__orb bg-animations__orb--4" />
      </div>
      <div className="bg-animations__shapes">
        <span className="bg-animations__shape bg-animations__shape--ring" />
        <span className="bg-animations__shape bg-animations__shape--plus" />
        <span className="bg-animations__shape bg-animations__shape--tri" />
        <span className="bg-animations__shape bg-animations__shape--dot" />
      </div>
      <div className="bg-animations__sparkles">
        {Array.from({ length: 12 }).map((_, i) => (
          <span
            key={i}
            className="bg-animations__sparkle"
            style={{ '--i': i }}
          />
        ))}
      </div>
    </div>
  );
}
