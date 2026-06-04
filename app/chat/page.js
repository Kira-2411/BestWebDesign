'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import Link from 'next/link';

export default function ChatPage() {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const messagesEndRef = useRef(null);

  // Tự động cuộn xuống tin nhắn mới nhất
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 1. Kiểm tra & lắng nghe trạng thái đăng nhập
  useEffect(() => {
    // Lấy session hiện tại khi vào trang
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setCurrentUser(session.user);
      }
      setAuthLoading(false);
    });

    // Lắng nghe thay đổi đăng nhập/đăng xuất
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setCurrentUser(session.user);
      } else {
        setCurrentUser(null);
      }
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 2. Tải tin nhắn cũ & Đăng ký Realtime tin nhắn mới
  useEffect(() => {
    // Tải 50 tin nhắn cũ nhất
    const fetchMessages = async () => {
      const { data, error } = await supabase
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

    // Đăng ký lắng nghe sự kiện INSERT (tin nhắn mới) từ Supabase Realtime
    const channel = supabase
      .channel('community-chat-room')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'community_messages' },
        (payload) => {
          setMessages((prev) => [...prev, payload.new]);
          setTimeout(scrollToBottom, 50);
        }
      )
      .subscribe();

    // Hủy kết nối realtime khi rời khỏi trang
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // 3. Xử lý gửi tin nhắn mới
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || !currentUser) return;

    const { error } = await supabase
      .from('community_messages')
      .insert([
        {
          sender_id: currentUser.id,
          sender_email: currentUser.email,
          content: inputText.trim()
        }
      ]);

    if (!error) {
      setInputText('');
    } else {
      alert('Không thể gửi tin nhắn: ' + error.message);
    }
  };

  return (
    <main className="container" style={{ padding: '40px 0', minHeight: 'calc(100vh - 160px)' }}>
      <div className="brutal-card" style={{ background: 'var(--white)', padding: '30px', maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <span className="section-badge">Cộng đồng</span>
            <h1 style={{ margin: 0, fontSize: '2rem', textTransform: 'uppercase' }}>Chat Cộng Đồng</h1>
          </div>
          <Link href="/" className="mini-btn">← Về trang chủ</Link>
        </div>

        {/* Khung tin nhắn */}
        <div 
          className="chat-messages-container"
          data-lenis-prevent
          style={{
            height: '400px',
            overflowY: 'auto',
            border: '3px solid #000',
            borderRadius: '8px',
            padding: '16px',
            background: '#fafafa',
            boxShadow: 'inset 3px 3px 0 rgba(0,0,0,0.05)',
            marginBottom: '20px'
          }}
        >
          {messages.map((msg) => {
            const isMe = currentUser && msg.sender_id === currentUser.id;
            return (
              <div 
                key={msg.id} 
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: isMe ? 'flex-end' : 'flex-start', 
                  marginBottom: '14px' 
                }}
              >
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#555', marginBottom: '4px' }}>
                  {isMe ? 'Bạn' : msg.sender_email.split('@')[0]}
                </span>
                <div 
                  style={{
                    background: isMe ? 'var(--scholar-blue)' : '#fff',
                    color: isMe ? '#fff' : '#000',
                    border: '2px solid #000',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    maxWidth: '70%',
                    wordBreak: 'break-word',
                    boxShadow: '3px 3px 0 #000',
                    fontFamily: 'var(--font-body)'
                  }}
                >
                  {msg.content}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Khung nhập tin nhắn */}
        {authLoading ? (
          <div style={{ textAlign: 'center', padding: '10px' }}>Đang kiểm tra tài khoản...</div>
        ) : currentUser ? (
          <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Chia sẻ suy nghĩ của bạn với cộng đồng..."
              style={{
                flex: 1,
                padding: '12px 16px',
                border: '3px solid #000',
                borderRadius: '8px',
                fontFamily: 'var(--font-body)',
                fontSize: '1rem'
              }}
            />
            <button type="submit" className="btn-primary" style={{ padding: '12px 24px' }}>Gửi</button>
          </form>
        ) : (
          <div 
            style={{ 
              textAlign: 'center', 
              padding: '16px', 
              border: '3px dashed #ef4444', 
              borderRadius: '8px', 
              background: '#fef2f2', 
              color: '#ef4444', 
              fontWeight: '700' 
            }}
          >
            🔒 Bạn cần đăng nhập để tham gia trò chuyện.
          </div>
        )}
      </div>
    </main>
  );
}
