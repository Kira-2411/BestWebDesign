'use client';

import { ReactLenis } from 'lenis/react';

export default function SmoothScrollProvider({ children }) {
  return (
    <ReactLenis 
      root 
      options={{ 
        duration: 1.2, 
        lerp: 0.1, 
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), 
        orientation: 'vertical',
        gestureOrientation: 'vertical',
        smoothWheel: true,
        smoothTouch: false, 
        wheelMultiplier: 1,
        touchMultiplier: 2,
        normalizeWheel: true,
      }}
    >
      {children}
    </ReactLenis>
  );
}
