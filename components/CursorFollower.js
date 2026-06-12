'use client';

import { useEffect, useRef } from 'react';

const INTERACTIVE_SELECTOR = [
  'a',
  'button',
  'input',
  'select',
  'textarea',
  '[role="button"]',
  '.chip',
  '.tool-card',
  '.combo-chip',
  '.mini-btn',
  '.btn-primary',
  '.btn-secondary',
  '.btn-ghost',
  '.step-tab',
  '.bento-card',
  '.uni-card',
].join(', ');

export default function CursorFollower() {
  const dotRef = useRef(null);
  const ringRef = useRef(null);
  const pos = useRef({ x: -100, y: -100 });
  const ringPos = useRef({ x: -100, y: -100 });
  const rafRef = useRef(null);
  const activeRef = useRef(false);

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (reducedMotion || !finePointer) return undefined;

    const setVisible = (visible) => {
      activeRef.current = visible;
      const opacity = visible ? '1' : '0';
      if (dotRef.current) dotRef.current.style.opacity = opacity;
      if (ringRef.current) ringRef.current.style.opacity = opacity;
    };

    const onMove = (e) => {
      const isTextField = e.target.closest(
        'input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]), textarea, select'
      );

      if (isTextField) {
        setVisible(false);
        document.body.classList.add('has-cursor-follower--text');
        return;
      }

      document.body.classList.remove('has-cursor-follower--text');
      setVisible(true);
      pos.current = { x: e.clientX, y: e.clientY };

      const target = e.target.closest(INTERACTIVE_SELECTOR);
      if (ringRef.current) {
        ringRef.current.classList.toggle('cursor-ring--hover', Boolean(target));
      }
    };

    const onLeave = () => setVisible(false);

    const animate = () => {
      if (activeRef.current) {
        ringPos.current.x += (pos.current.x - ringPos.current.x) * 0.15;
        ringPos.current.y += (pos.current.y - ringPos.current.y) * 0.15;

        if (dotRef.current) {
          dotRef.current.style.transform = `translate3d(${pos.current.x}px, ${pos.current.y}px, 0)`;
        }
        if (ringRef.current) {
          ringRef.current.style.transform = `translate3d(${ringPos.current.x}px, ${ringPos.current.y}px, 0)`;
        }
      }
      rafRef.current = requestAnimationFrame(animate);
    };

    document.body.classList.add('has-cursor-follower');
    window.addEventListener('mousemove', onMove, { passive: true });
    document.documentElement.addEventListener('mouseleave', onLeave);
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      document.body.classList.remove('has-cursor-follower');
      window.removeEventListener('mousemove', onMove);
      document.documentElement.removeEventListener('mouseleave', onLeave);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <>
      <div ref={dotRef} className="cursor-dot" aria-hidden="true" />
      <div ref={ringRef} className="cursor-ring" aria-hidden="true" />
    </>
  );
}
