'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';

export default function CommunityChatBox({ user }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);

  // Tự động cuộn xuống dưới cùng
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 1. Tải 50 tin nhắn gần nhất
  useEffect(() => {
    const fetchMessages = async () => {
      const { data } = await supabase
        .from('community_messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(50);
      if (data) {
        setMessages(data);
        setTimeout(scrollToBottom, 100);
      }
    };
    fetchMessages();

    // 2. Đăng ký Realtime
    const channel = supabase
      .channel('public-chat-sidebar')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'community_messages' },
        (payload) => {
          setMessages((prev) => {
            // Tránh trùng lặp do race condition
            if (prev.some(m => m.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          });
          setTimeout(scrollToBottom, 50);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'community_messages' },
        (payload) => {
          setMessages((prev) =>
            prev.map((msg) => (msg.id === payload.new.id ? payload.new : msg))
          );
        }
      )
      .subscribe((status, err) => {
        console.log("Kênh public-chat-sidebar status:", status);
        if (err) console.error("Lỗi Realtime sidebar:", err);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // 3. Gửi tin nhắn
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || !user) return;

    const { data, error } = await supabase
      .from('community_messages')
      .insert([
        {
          sender_id: user.id,
          sender_email: user.email,
          sender_name: user.user_metadata?.full_name || user.email.split('@')[0],
          sender_avatar: user.user_metadata?.avatar_url || 'https://www.gravatar.com/avatar?d=mp',
          content: inputText.trim()
        }
      ])
      .select();

    if (!error) {
      setInputText('');
      if (data && data[0]) {
        setMessages((prev) => {
          if (prev.some(m => m.id === data[0].id)) return prev;
          return [...prev, data[0]];
        });
        setTimeout(scrollToBottom, 50);
      }
    } else {
      alert('Lỗi gửi tin nhắn: ' + error.message);
    }
  };

  return (
    <aside className="insight-panel brutal-card" data-aos="fade-left" style={{ padding: '20px', display: 'flex', flexDirection: 'column', height: '100%', minHeight: '390px', background: 'var(--white)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <span className="strategy-dot safe" style={{ width: '10px', height: '10px', animation: 'pulse 2s infinite' }}></span>
        <strong style={{ fontFamily: 'var(--font-display)', textTransform: 'uppercase', fontSize: '0.9rem', letterSpacing: '0.5px' }}>
          💬 Chat Cộng Đồng Realtime
        </strong>
      </div>

      {/* Box hiển thị tin nhắn */}
      <div 
        className="chat-messages-scroll"
        data-lenis-prevent
        style={{
          flex: 1,
          overflowY: 'auto',
          border: '2.5px solid #000',
          borderRadius: '6px',
          padding: '10px',
          background: '#fcfcfc',
          marginBottom: '10px',
          maxHeight: '260px',
          minHeight: '200px'
        }}
      >
        {messages.map((msg) => {
          const isMe = user && msg.sender_id === user.id;
          const displayName = msg.sender_name || msg.sender_email.split('@')[0];
          return (
            <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', marginBottom: '8px' }}>
              <span style={{ fontSize: '10px', color: '#666', marginBottom: '2px', fontWeight: 600 }}>
                {isMe ? 'Bạn' : displayName}
              </span>
              <div style={{
                background: msg.is_deleted ? '#f1f1f1' : (isMe ? 'var(--scholar-blue)' : '#fff'),
                color: msg.is_deleted ? '#888' : (isMe ? '#fff' : '#000'),
                border: msg.is_deleted ? '2px dashed #888' : '2px solid #000',
                padding: '6px 10px',
                borderRadius: '6px',
                maxWidth: '85%',
                fontSize: '13px',
                fontStyle: msg.is_deleted ? 'italic' : 'normal',
                wordBreak: 'break-word',
                boxShadow: msg.is_deleted ? 'none' : '1.5px 1.5px 0 #000',
                lineHeight: '1.4'
              }}>
                {msg.is_deleted ? 'Tin nhắn đã được thu hồi' : msg.content}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Form nhập liệu */}
      {user ? (
        <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '6px' }}>
          <input 
            type="text" 
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Gửi tin nhắn..."
            style={{
              flex: 1,
              padding: '8px 12px',
              border: '2.5px solid #000',
              borderRadius: '6px',
              fontSize: '13px',
              fontFamily: 'var(--font-body)'
            }}
          />
          <button type="submit" className="mini-btn" style={{ padding: '6px 12px', whiteSpace: 'nowrap' }}>Gửi</button>
        </form>
      ) : (
        <div style={{
          textAlign: 'center',
          padding: '8px',
          border: '2px dashed #ef4444',
          borderRadius: '6px',
          background: '#fef2f2',
          color: '#ef4444',
          fontSize: '11px',
          fontWeight: '700'
        }}>
          🔒 Đăng nhập để nhắn tin
        </div>
      )}
    </aside>
  );
}
