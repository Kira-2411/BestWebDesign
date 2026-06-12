'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { ADMISSION_TIMELINE, ADMISSION_TIMELINE_YEAR } from '../data/admission-timeline';

function parseDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`);
}

function getStatus(date, endDate) {
  const now = new Date();
  const start = parseDate(date);
  const end = parseDate(endDate || date);
  end.setHours(23, 59, 59, 999);
  if (now < start) return 'upcoming';
  if (now > end) return 'done';
  return 'current';
}

function getDefaultActiveIndex(items) {
  const currentIdx = items.findIndex((item) => getStatus(item.date, item.endDate) === 'current');
  if (currentIdx >= 0) return currentIdx;
  const upcomingIdx = items.findIndex((item) => getStatus(item.date, item.endDate) === 'upcoming');
  if (upcomingIdx >= 0) return upcomingIdx;
  return items.length - 1;
}

const ICON_PATHS = {
  calendar: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M4 9h16M8 3v3M16 3v3" />
      <path d="M8 13h2M12 13h2M8 16h2" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4.5l2.5 1.5" />
    </>
  ),
  clipboard: (
    <>
      <path d="M9 4h6a1 1 0 0 1 1 1v14H8V5a1 1 0 0 1 1-1z" />
      <path d="M10 4V3a2 2 0 0 1 4 0v1" />
      <path d="M9 10h6M9 13h6M9 16h4" />
    </>
  ),
  payment: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18" />
      <path d="M7 15h3M13 15h4" />
    </>
  ),
  megaphone: (
    <>
      <path d="M5 9v6l9 5V4L5 9z" />
      <path d="M17 9.5a2.5 2.5 0 0 1 0 5" />
      <path d="M5 9H3v6h2" />
    </>
  ),
  graduate: (
    <>
      <path d="M12 4 4 8.5 12 13l8-4.5L12 4z" />
      <path d="M6.5 10.5V15c0 1.8 2.5 3.5 5.5 3.5s5.5-1.7 5.5-3.5v-4.5" />
      <path d="M18 8.5V13" />
    </>
  ),
  university: (
    <>
      <path d="M12 3 4 7.5v2L12 14l8-4.5v-2L12 3z" />
      <path d="M6.5 10v8M17.5 10v8M4 18h16" />
      <path d="M10 18v-5h4v5" />
    </>
  ),
};

function TimelineIcon({ name, size = 22 }) {
  const paths = ICON_PATHS[name] || ICON_PATHS.university;
  return (
    <svg
      className="timeline-svg-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths}
    </svg>
  );
}

function renderDescription(text, highlight) {
  if (!highlight || !text.includes(highlight)) return text;
  const [before, after] = text.split(highlight);
  return (
    <>
      {before}
      <strong>{highlight}</strong>
      {after}
    </>
  );
}

export default function AdmissionTimeline() {
  const items = useMemo(
    () => [...ADMISSION_TIMELINE].sort((a, b) => a.step - b.step),
    []
  );

  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(getDefaultActiveIndex(items));
  }, [items]);

  const active = items[activeIndex];
  const activeStatus = active ? getStatus(active.date, active.endDate) : 'upcoming';
  const doneCount = items.filter((item) => getStatus(item.date, item.endDate) === 'done').length;
  const progressPct = items.length > 0 ? (doneCount / items.length) * 100 : 0;

  const goPrev = () => setActiveIndex((i) => Math.max(0, i - 1));
  const goNext = () => setActiveIndex((i) => Math.min(items.length - 1, i + 1));

  if (!active) return null;

  return (
    <section className="section admission-timeline-section" id="timeline">
      <div className="container">
        <div className="timeline-compact-header" data-aos="fade-up">
          <div>
            <span className="section-badge">Lịch tuyển sinh {ADMISSION_TIMELINE_YEAR}</span>
            <h2>Mốc thời gian xét tuyển Đại Học</h2>
          </div>
          <div className="timeline-compact-progress" aria-label="Tiến độ">
            <span className="timeline-compact-progress__bar">
              <span className="timeline-compact-progress__fill" style={{ width: `${progressPct}%` }} />
            </span>
            <span className="timeline-compact-progress__text">{doneCount}/{items.length}</span>
          </div>
        </div>

        <div className="timeline-compact-wrap" data-aos="fade-up" data-aos-delay="50">
          <div className="timeline-rail" role="tablist" aria-label="Các mốc thời gian">
            <div className="timeline-rail__line" aria-hidden="true" />
            <div className="timeline-rail__steps">
              {items.map((item, index) => {
                const status = getStatus(item.date, item.endDate);
                const isActive = index === activeIndex;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-label={`Bước ${item.step}: ${item.dateLabel}`}
                    className={`timeline-step timeline-step--${status} ${isActive ? 'is-active' : ''}`}
                    onClick={() => setActiveIndex(index)}
                  >
                    <span className="timeline-step__icon">
                      <TimelineIcon name={item.icon} size={22} />
                    </span>
                    <span className="timeline-step__num">{item.step}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="timeline-controls">
            <button
              type="button"
              className="timeline-strip-btn"
              onClick={goPrev}
              disabled={activeIndex === 0}
              aria-label="Mốc trước"
            >
              ←
            </button>
            <span className="timeline-controls__indicator">
              {active.step} / {items.length}
            </span>
            <button
              type="button"
              className="timeline-strip-btn"
              onClick={goNext}
              disabled={activeIndex === items.length - 1}
              aria-label="Mốc tiếp"
            >
              →
            </button>
          </div>

          <article
            key={active.id}
            className={`timeline-detail timeline-detail--${activeStatus}`}
          >
            <div className="timeline-detail__icon">
              <TimelineIcon name={active.icon} size={28} />
            </div>
            <div className="timeline-detail__body">
              <div className="timeline-detail__meta">
                <span className="timeline-detail__step">Bước {active.step}</span>
                {activeStatus === 'current' && (
                  <span className="timeline-detail__badge timeline-detail__badge--current">Đang diễn ra</span>
                )}
                {activeStatus === 'done' && (
                  <span className="timeline-detail__badge timeline-detail__badge--done">Đã qua</span>
                )}
                {activeStatus === 'upcoming' && (
                  <span className="timeline-detail__badge timeline-detail__badge--upcoming">Sắp tới</span>
                )}
              </div>
              <h3 className="timeline-detail__date">{active.dateLabel}</h3>
              <p className="timeline-detail__desc">
                {renderDescription(active.description, active.highlight)}
              </p>
            </div>
          </article>

          <p className="timeline-disclaimer">
            Theo lịch tuyển sinh {ADMISSION_TIMELINE_YEAR}. Bấm từng bước để xem chi tiết.
          </p>
        </div>
      </div>
    </section>
  );
}
