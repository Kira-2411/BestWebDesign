'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

function useCountUp(target, active, duration = 1200) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active) return undefined;

    let start = null;
    let frameId;

    const step = (timestamp) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      setValue(Math.round(progress * target));
      if (progress < 1) {
        frameId = requestAnimationFrame(step);
      }
    };

    frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, [target, active, duration]);

  return value;
}

export default function HeroBento() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const uniCount = useCountUp(8, visible);
  const cutoffCount = useCountUp(54, visible);

  return (
    <div className="hero-bento" ref={ref} data-aos="fade-up">
      <article className="bento-card brutal-card">
        <span className="bento-card__label">Verified</span>
        <strong className="bento-card__value">{uniCount}</strong>
        <p className="bento-card__desc">trường đại học có nguồn</p>
      </article>

      <article className="bento-card brutal-card">
        <span className="bento-card__label">Điểm chuẩn</span>
        <strong className="bento-card__value">{cutoffCount}</strong>
        <p className="bento-card__desc">bản ghi theo tổ hợp</p>
      </article>

      <article className="bento-card brutal-card bento-card--matrix">
        <span className="bento-card__label">Ma trận</span>
        <div className="matrix-preview-3d" aria-hidden="true">
          <div className="matrix-preview-3d__block matrix-preview-3d__block--safe" title="30%">30%</div>
          <div className="matrix-preview-3d__block matrix-preview-3d__block--fit" title="50%">50%</div>
          <div className="matrix-preview-3d__block matrix-preview-3d__block--reach" title="20%">20%</div>
        </div>
        <p className="bento-card__desc">An toàn · Phù hợp · Thử thách</p>
      </article>

      <Link href="/map" className="bento-card brutal-card bento-card--link">
        <span className="bento-card__label">Bản đồ</span>
        <strong className="bento-card__value bento-card__value--icon">📍</strong>
        <p className="bento-card__desc">Xem trường trên VietMap →</p>
      </Link>
    </div>
  );
}
