'use client';

import React from 'react';

const UNIVERSITIES = [
  'HUST', 'VNU', 'NEU', 'FTU', 'UEH', 'HCMUT', 'UMP', 'VKU',
];

export default function UniversityMarquee() {
  const items = [...UNIVERSITIES, ...UNIVERSITIES];

  return (
    <div className="university-marquee" aria-hidden="true">
      <div className="university-marquee__track">
        {items.map((name, i) => (
          <span className="university-marquee__item" key={`${name}-${i}`}>
            {name}
            <span className="university-marquee__dot" />
          </span>
        ))}
      </div>
    </div>
  );
}
