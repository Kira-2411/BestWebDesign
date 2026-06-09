'use client';

import React, { useEffect } from 'react';

const STICKERS = [
  // Cánh tả (Bên trái)
  {
    id: 1,
    emoji: "🎓",
    label: "VKU Thẳng Tiến!",
    color: "#FFD23F",
    top: "15%",
    left: "6%",
    rotate: "-12deg",
    animationDelay: "0s"
  },
  {
    id: 2,
    emoji: "💻",
    label: "Lập Trình Viên Gen-Z",
    color: "#018ABE",
    top: "45%",
    left: "8%",
    rotate: "8deg",
    animationDelay: "0.5s"
  },
  {
    id: 3,
    emoji: "📚",
    label: "Học Tủ Đi Thi",
    color: "#FF6B6B",
    top: "70%",
    left: "5%",
    rotate: "-5deg",
    animationDelay: "1s"
  },
  {
    id: 4,
    emoji: "🎯",
    label: "Đỗ Nguyện Vọng 1",
    color: "#38B000",
    top: "28%",
    left: "3%",
    rotate: "15deg",
    animationDelay: "1.5s"
  },
  // Cánh hữu (Bên phải)
  {
    id: 5,
    emoji: "⭐",
    label: "May Mắn Nhân Đôi",
    color: "#FFD23F",
    top: "12%",
    right: "6%",
    rotate: "10deg",
    animationDelay: "0.2s"
  },
  {
    id: 6,
    emoji: "🥤",
    label: "Trà Sữa Tiếp Sức",
    color: "#F49097",
    top: "42%",
    right: "8%",
    rotate: "-8deg",
    animationDelay: "0.7s"
  },
  {
    id: 7,
    emoji: "🚀",
    label: "Cất Cánh Tương Lai",
    color: "#018ABE",
    top: "68%",
    right: "5%",
    rotate: "12deg",
    animationDelay: "1.2s"
  },
  {
    id: 8,
    emoji: "💡",
    label: "Sáng Tạo Công Nghệ",
    color: "#38B000",
    top: "26%",
    right: "3%",
    rotate: "-15deg",
    animationDelay: "1.7s"
  }
];

export default function NewsPage() {
  const cardRef = React.useRef(null);

  // Theo dõi vị trí con trỏ chuột toàn cục để khóa/mở cuộn trang chính
  useEffect(() => {
    const handleGlobalMouseMove = (e) => {
      if (cardRef.current) {
        const rect = cardRef.current.getBoundingClientRect();
        // Kiểm tra xem chuột có đang nằm trong phạm vi của hộp Fanpage hay không (kể cả khi ở trong iframe)
        const isInside = (
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom
        );
        if (isInside) {
          document.body.style.overflow = 'hidden';
        } else {
          document.body.style.overflow = 'unset';
        }
      }
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      document.body.style.overflow = 'unset';
    };
  }, []);

  return (
    <main 
      style={{ height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px', boxSizing: 'border-box', overflow: 'hidden', position: 'relative' }}
    >
      
      {/* Các Sticker Neo-Brutalism Gen-Z xung quanh */}
      {STICKERS.map((sticker) => (
        <div
          key={sticker.id}
          className="brutal-sticker"
          style={{
            position: 'absolute',
            top: sticker.top,
            left: sticker.left,
            right: sticker.right,
            zIndex: 5,
            animationDelay: sticker.animationDelay,
            '--bg-color': sticker.color,
            '--rotate-deg': sticker.rotate,
          }}
        >
          <span className="sticker-emoji">{sticker.emoji}</span>
          <span className="sticker-tooltip">{sticker.label}</span>
        </div>
      ))}

      <section 
        className="section news-page" 
        style={{ 
          width: '100%', 
          maxWidth: '680px', 
          height: '100%', 
          display: 'flex', 
          flexDirection: 'column', 
          margin: '0 auto', 
          padding: '0',
          justifyContent: 'center',
          zIndex: 10
        }}
      >
        
        {/* Header Trang */}
        <div className="section-header" style={{ marginBottom: '12px', textAlign: 'center', flexShrink: 0 }}>
          <div>
            <span className="section-badge" style={{ background: '#FFD23F', color: '#000', border: '2px solid #000', fontWeight: 'bold' }}>Social Feed</span>
            <h2 style={{ fontSize: '1.6rem', marginTop: '8px', marginBottom: '4px' }}>Fanpage Tin tức Tuyển sinh</h2>
            <p style={{ fontSize: '0.9rem', margin: '0' }}>Theo dõi tin tức tuyển sinh mới nhất từ Bộ Giáo dục & Đào tạo.</p>
          </div>
        </div>

        {/* Facebook Page Plugin Card */}
        <div 
          ref={cardRef}
          className="brutal-card" 
          style={{ 
            background: '#F9F6EE', 
            border: '3px solid #000', 
            borderRadius: '12px', 
            padding: '12px',
            boxShadow: '8px 8px 0 #000',
            width: '100%',
            height: 'calc(100% - 90px)',
            display: 'flex',
            flexDirection: 'column',
            boxSizing: 'border-box'
          }}
        >
          {/* Wrapper chứa iframe, cho phép cuộn toàn bộ iframe bao gồm cả Header */}
          <div 
            className="facebook-timeline-wrapper"
            style={{ 
              border: '3px solid #000', 
              borderRadius: '8px', 
              overflowY: 'auto', 
              overflowX: 'hidden',
              flex: 1, 
              background: '#fff',
              position: 'relative',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-start'
            }}
          >
            <div style={{ width: '500px', height: '1200px', transform: 'scale(1.2)', transformOrigin: 'top center' }}>
              <iframe 
                src="https://www.facebook.com/plugins/page.php?href=https%3A%2F%2Fwww.facebook.com%2Fthongtinbogiaoducvadaotao&tabs=timeline&width=500&height=1200&small_header=false&adapt_container_width=true&hide_cover=false&show_facepile=true" 
                width="500" 
                height="1200" 
                style={{ border: 'none', overflow: 'hidden', width: '100%', height: '100%' }} 
                scrolling="no" 
                frameBorder="0" 
                allowFullScreen={true} 
                allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
              ></iframe>
            </div>
          </div>
        </div>

      </section>
    </main>
  );
}
