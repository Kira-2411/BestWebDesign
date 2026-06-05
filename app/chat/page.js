'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import Link from 'next/link';

export default function ChatPage() {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [onlineUsers, setOnlineUsers] = useState({});
  const [typingUsers, setTypingUsers] = useState({});
  
  // Trạng thái thao tác tin nhắn
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  
  // UI Popovers
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);
  const [isImageOpen, setIsImageOpen] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState('');
  
  // File Upload Ref & State
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // Chống Spam & Toast
  const [lastSentTime, setLastSentTime] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const chatInputRef = useRef(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  // 1. Kiểm tra trạng thái đăng nhập
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setCurrentUser(session.user);
      }
      setAuthLoading(false);
    });

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

  // 2. Tải tin nhắn mẫu, tin nhắn cũ và đăng ký Realtime
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const { data: msgData, error: msgErr } = await supabase
          .from('community_messages')
          .select('*')
          .order('created_at', { ascending: true })
          .limit(100);

        if (msgErr) throw msgErr;

        const { data: reactData, error: reactErr } = await supabase
          .from('community_reactions')
          .select('*');

        if (reactErr) throw reactErr;

        const reactionsMap = {};
        if (reactData) {
          reactData.forEach((r) => {
            if (!reactionsMap[r.message_id]) {
              reactionsMap[r.message_id] = [];
            }
            reactionsMap[r.message_id].push(r);
          });
        }

        if (msgData) {
          const combined = msgData.map((m) => ({
            ...m,
            reactions: reactionsMap[m.id] || []
          }));
          setMessages(combined);
          setTimeout(scrollToBottom, 150);
        }
      } catch (err) {
        console.error("Lỗi fetch dữ liệu chat:", err.message);
      }
    };

    fetchMessages();

    // Đăng ký các thay đổi của tin nhắn
    const chatChannel = supabase
      .channel('community-chat-main')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'community_messages' },
        (payload) => {
          setMessages((prev) => {
            if (prev.some((m) => m.id === payload.new.id)) return prev;
            return [...prev, { ...payload.new, reactions: [] }];
          });
          setTimeout(scrollToBottom, 50);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'community_messages' },
        (payload) => {
          setMessages((prev) =>
            prev.map((msg) => (msg.id === payload.new.id ? { ...msg, ...payload.new } : msg))
          );
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'community_reactions' },
        (payload) => {
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id === payload.new.message_id) {
                const existing = msg.reactions || [];
                if (existing.some((r) => r.id === payload.new.id)) return msg;
                return { ...msg, reactions: [...existing, payload.new] };
              }
              return msg;
            })
          );
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'community_reactions' },
        (payload) => {
          setMessages((prev) =>
            prev.map((msg) => {
              const reactions = msg.reactions || [];
              if (reactions.some((r) => r.id === payload.old.id)) {
                return { ...msg, reactions: reactions.filter((r) => r.id !== payload.old.id) };
              }
              return msg;
            })
          );
        }
      )
      // Lắng nghe tín hiệu Đang gõ (Broadcast)
      .on('broadcast', { event: 'typing' }, (payload) => {
        const { userId, name, typing } = payload.payload;
        setTypingUsers((prev) => {
          const copy = { ...prev };
          if (typing) {
            copy[userId] = { name, timestamp: Date.now() };
          } else {
            delete copy[userId];
          }
          return copy;
        });
      })
      .subscribe((status, err) => {
        console.log("Kênh community-chat-main status:", status);
        if (err) console.error("Lỗi Realtime:", err);
      });

    return () => {
      supabase.removeChannel(chatChannel);
    };
  }, []);

  // 3. Trạng thái Online & Active của người dùng (Supabase Presence)
  useEffect(() => {
    if (!currentUser) {
      setOnlineUsers({});
      return;
    }

    const presenceChannel = supabase.channel('community-chat-presence', {
      config: {
        presence: {
          key: currentUser.id
        }
      }
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const formatted = {};
        Object.keys(state).forEach((key) => {
          const userPresence = state[key]?.[0];
          if (userPresence) {
            formatted[key] = {
              userId: key,
              name: userPresence.name,
              avatar: userPresence.avatar,
              status: userPresence.status || 'online',
              lastSeen: userPresence.lastSeen
            };
          }
        });
        setOnlineUsers(formatted);
      });

    presenceChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await presenceChannel.track({
          name: currentUser.user_metadata?.full_name || currentUser.email.split('@')[0],
          avatar: currentUser.user_metadata?.avatar_url || 'https://www.gravatar.com/avatar?d=mp',
          status: 'online',
          lastSeen: new Date().toISOString()
        });
      }
    });

    // Theo dõi trạng thái Away sau 5 phút không tương tác
    let idleTimer;
    const resetIdleTimer = () => {
      clearTimeout(idleTimer);

      // Nếu đang ở trạng thái khác 'online', cập nhật lại thành online
      const currentPresence = presenceChannel.presenceState()[currentUser.id]?.[0];
      if (currentPresence && currentPresence.status !== 'online') {
        presenceChannel.track({
          name: currentUser.user_metadata?.full_name || currentUser.email.split('@')[0],
          avatar: currentUser.user_metadata?.avatar_url || 'https://www.gravatar.com/avatar?d=mp',
          status: 'online',
          lastSeen: new Date().toISOString()
        });
      }

      idleTimer = setTimeout(async () => {
        await presenceChannel.track({
          name: currentUser.user_metadata?.full_name || currentUser.email.split('@')[0],
          avatar: currentUser.user_metadata?.avatar_url || 'https://www.gravatar.com/avatar?d=mp',
          status: 'away',
          lastSeen: new Date().toISOString()
        });
      }, 5 * 60 * 1000);
    };

    window.addEventListener('mousemove', resetIdleTimer);
    window.addEventListener('keydown', resetIdleTimer);
    resetIdleTimer();

    return () => {
      supabase.removeChannel(presenceChannel);
      window.removeEventListener('mousemove', resetIdleTimer);
      window.removeEventListener('keydown', resetIdleTimer);
      clearTimeout(idleTimer);
    };
  }, [currentUser]);

  // 4. Định kỳ dọn các chỉ báo Đang gõ quá hạn (4 giây không có hoạt động mới)
  useEffect(() => {
    const interval = setInterval(() => {
      setTypingUsers((prev) => {
        const copy = { ...prev };
        let changed = false;
        Object.keys(copy).forEach((key) => {
          if (Date.now() - copy[key].timestamp > 4000) {
            delete copy[key];
            changed = true;
          }
        });
        return changed ? copy : prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // 5. Gửi trạng thái đang gõ tới những người khác
  const handleTypingEvent = () => {
    if (!currentUser) return;
    const channel = supabase.channel('community-chat-main');
    channel.send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        userId: currentUser.id,
        name: currentUser.user_metadata?.full_name || currentUser.email.split('@')[0],
        typing: true
      }
    });
  };

  // 6. Lọc từ cấm (Profanity Filter)
  const BAD_WORDS = ['đm', 'đmm', 'đéo', 'vcl', 'cl', 'clgt', 'lồn', 'chó', 'dcm', 'cc', 'cặc', 'đựt', 'đụ', 'buồi', 'mẹ kiếp', 'khốn nạn'];
  const filterBadWords = (text) => {
    let cleaned = text;
    BAD_WORDS.forEach((word) => {
      const escapedWord = word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`\\b${escapedWord}\\b|${escapedWord}`, 'gi');
      cleaned = cleaned.replace(regex, '****');
    });
    return cleaned;
  };

  // 7. Gửi hoặc Cập nhật tin nhắn
  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !currentUser || isSending) return;

    // Chống Spam: Giới hạn 1 tin nhắn / giây
    const now = Date.now();
    if (now - lastSentTime < 1000) {
      showToast('⚠️ Vui lòng đợi 1 giây trước khi gửi tin nhắn tiếp theo.');
      return;
    }

    setLastSentTime(now);
    setIsSending(true);

    const filteredText = filterBadWords(inputText.trim());

    if (editingMessage) {
      // Logic Chỉnh sửa tin nhắn
      const { data, error } = await supabase
        .from('community_messages')
        .update({
          content: filteredText,
          is_edited: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingMessage.id)
        .select();

      if (error) {
        showToast('❌ Lỗi cập nhật tin nhắn: ' + error.message);
      } else {
        setEditingMessage(null);
        setInputText('');
        if (data && data[0]) {
          setMessages((prev) =>
            prev.map((msg) => (msg.id === data[0].id ? { ...msg, ...data[0] } : msg))
          );
        }
      }
    } else {
      // Logic Gửi tin nhắn mới
      const messageBody = {
        sender_id: currentUser.id,
        sender_email: currentUser.email,
        sender_name: currentUser.user_metadata?.full_name || currentUser.email.split('@')[0],
        sender_avatar: currentUser.user_metadata?.avatar_url || 'https://www.gravatar.com/avatar?d=mp',
        content: filteredText
      };

      if (replyingTo) {
        messageBody.reply_to_id = replyingTo.id;
      }

      const { data, error } = await supabase
        .from('community_messages')
        .insert([messageBody])
        .select();

      if (error) {
        showToast('❌ Không thể gửi tin nhắn: ' + error.message);
      } else {
        setInputText('');
        setReplyingTo(null);
        if (data && data[0]) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === data[0].id)) return prev;
            return [...prev, { ...data[0], reactions: [] }];
          });
          setTimeout(scrollToBottom, 50);
        }
      }
    }

    setIsSending(false);
    
    // Tắt trạng thái đang nhập
    const mainChannel = supabase.channel('community-chat-main');
    mainChannel.send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        userId: currentUser.id,
        typing: false
      }
    });
  };

  // 8. Thu hồi tin nhắn (Recall)
  const handleRecallMessage = async (msgId) => {
    const { data, error } = await supabase
      .from('community_messages')
      .update({
        is_deleted: true,
        content: 'Tin nhắn đã được thu hồi'
      })
      .eq('id', msgId)
      .select();

    if (error) {
      showToast('❌ Không thể thu hồi tin nhắn: ' + error.message);
    } else {
      showToast('🧹 Đã thu hồi tin nhắn.');
      if (data && data[0]) {
        setMessages((prev) =>
          prev.map((msg) => (msg.id === data[0].id ? { ...msg, ...data[0] } : msg))
        );
      }
    }
  };

  // 9. Thả cảm xúc (Reaction)
  const handleToggleReaction = async (messageId, reactionType) => {
    if (!currentUser) {
      showToast('🔒 Hãy đăng nhập để thả cảm xúc.');
      return;
    }

    const message = messages.find((m) => m.id === messageId);
    if (!message) return;

    const existingReaction = message.reactions?.find(
      (r) => r.user_id === currentUser.id && r.reaction_type === reactionType
    );

    if (existingReaction) {
      // Cập nhật giao diện local ngay lập tức (bỏ cảm xúc)
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === messageId) {
            return {
              ...msg,
              reactions: (msg.reactions || []).filter((r) => r.id !== existingReaction.id)
            };
          }
          return msg;
        })
      );

      // Bỏ cảm xúc trên Database
      const { error } = await supabase
        .from('community_reactions')
        .delete()
        .eq('id', existingReaction.id);

      if (error) console.error("Lỗi bỏ cảm xúc:", error.message);
    } else {
      // Thêm cảm xúc trên Database
      const { data, error } = await supabase
        .from('community_reactions')
        .insert({
          message_id: messageId,
          user_id: currentUser.id,
          reaction_type: reactionType
        })
        .select();

      if (error) {
        console.error("Lỗi thêm cảm xúc:", error.message);
      } else if (data && data[0]) {
        // Cập nhật giao diện local ngay lập tức (thêm cảm xúc)
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.id === messageId) {
              const existing = msg.reactions || [];
              if (existing.some((r) => r.id === data[0].id)) return msg;
              return { ...msg, reactions: [...existing, data[0]] };
            }
            return msg;
          })
        );
      }
    }
  };

  // 10. Xử lý sự kiện bàn phím nhập liệu
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // 11. Các helper UI
  const handleAddEmoji = (emoji) => {
    setInputText((prev) => prev + emoji);
    setIsEmojiOpen(false);
    chatInputRef.current?.focus();
  };

  const handleAddImage = (e) => {
    e.preventDefault();
    if (imageUrlInput.trim()) {
      setInputText((prev) => prev + ` ![ảnh](${imageUrlInput.trim()})`);
      setImageUrlInput('');
      setIsImageOpen(false);
      chatInputRef.current?.focus();
    }
  };

  const handleFileUpload = async (file) => {
    if (!file || !currentUser) return;

    if (!file.type.startsWith('image/')) {
      showToast('❌ Chỉ cho phép tải lên tệp hình ảnh.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('⚠️ Dung lượng ảnh tối đa là 5MB.');
      return;
    }

    setIsUploading(true);
    showToast('⏳ Đang tải ảnh lên...');

    try {
      const fileExt = file.name.split('.').pop() || 'png';
      const fileName = `${currentUser.id}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { data, error: uploadError } = await supabase.storage
        .from('chat-attachments')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('chat-attachments')
        .getPublicUrl(filePath);

      const messageBody = {
        sender_id: currentUser.id,
        sender_email: currentUser.email,
        sender_name: currentUser.user_metadata?.full_name || currentUser.email.split('@')[0],
        sender_avatar: currentUser.user_metadata?.avatar_url || 'https://www.gravatar.com/avatar?d=mp',
        content: `![ảnh](${publicUrl})`
      };

      if (replyingTo) {
        messageBody.reply_to_id = replyingTo.id;
      }

      const { data: insertData, error: insertError } = await supabase
        .from('community_messages')
        .insert([messageBody])
        .select();

      if (insertError) {
        showToast('❌ Lỗi gửi ảnh: ' + insertError.message);
      } else {
        setReplyingTo(null);
        if (insertData && insertData[0]) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === insertData[0].id)) return prev;
            return [...prev, { ...insertData[0], reactions: [] }];
          });
          setTimeout(scrollToBottom, 50);
        }
        showToast('✅ Đã gửi ảnh thành công.');
      }
    } catch (err) {
      console.error('Lỗi upload:', err);
      showToast('❌ Lỗi tải ảnh lên: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          handleFileUpload(file);
          break;
        }
      }
    }
  };

  const renderMessageContent = (text) => {
    const imgRegex = /!\[.*?\]\((https?:\/\/.*?)\)/g;
    const match = imgRegex.exec(text);
    if (match) {
      const imageUrl = match[1];
      const cleanText = text.replace(imgRegex, '');
      return (
        <>
          {cleanText && <div style={{ marginBottom: '6px' }}>{cleanText}</div>}
          <img src={imageUrl} alt="Đính kèm" className="chat-attachment-img" />
        </>
      );
    }
    return <div>{text}</div>;
  };

  const formatSentTime = (isoString) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  // Group các cảm xúc
  const getReactionCounts = (reactions = []) => {
    const counts = {};
    reactions.forEach((r) => {
      counts[r.reaction_type] = (counts[r.reaction_type] || 0) + 1;
    });
    return counts;
  };

  const EMOJI_MAP = {
    like: '👍',
    love: '❤️',
    haha: '😂',
    wow: '😮',
    sad: '😢'
  };

  return (
    <main className="container" style={{ padding: '40px 0', minHeight: 'calc(100vh - 160px)' }}>
      {toastMessage && <div className="toast show" style={{ zIndex: 1100 }}>{toastMessage}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <span className="section-badge">Kết nối</span>
          <h1 style={{ margin: 0, fontSize: '2.5rem', textTransform: 'uppercase' }}>Trò chuyện nhóm</h1>
        </div>
        <Link href="/" className="mini-btn">← Về trang chủ</Link>
      </div>

      <div className="chat-page-layout">
        {/* Cột Trái: Trò chuyện chính */}
        <div className="chat-main-card">
          <div className="chat-header-bar">
            <span className="chat-header-title">💬 Phòng trò chuyện cộng đồng</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 'bold' }}>
              <span className="chat-online-dot online" style={{ width: '8px', height: '8px' }}></span>
              <span>{Object.keys(onlineUsers).length} người đang online</span>
            </div>
          </div>

          {/* Hộp cuộn tin nhắn */}
          <div ref={messagesContainerRef} className="chat-messages-container" data-lenis-prevent>
            {messages.length > 0 ? (
              messages.map((msg) => {
                const isMe = currentUser && msg.sender_id === currentUser.id;
                const displayName = msg.sender_name || msg.sender_email.split('@')[0];
                const displayAvatar = msg.sender_avatar || 'https://www.gravatar.com/avatar?d=mp';
                const parentMsg = msg.reply_to_id ? messages.find((m) => m.id === msg.reply_to_id) : null;
                
                // Kiểm tra xem tin nhắn có được sửa trong vòng 5 phút
                const diffTimeMinutes = (Date.now() - new Date(msg.created_at).getTime()) / (1000 * 60);
                const canEdit = isMe && !msg.is_deleted && diffTimeMinutes < 5;
                const canRecall = isMe && !msg.is_deleted;

                // Thống kê Reactions
                const rCounts = getReactionCounts(msg.reactions);

                return (
                  <div 
                    key={msg.id} 
                    id={`msg-${msg.id}`}
                    className={`chat-message-item ${isMe ? 'me' : 'other'}`}
                  >
                    <div className="chat-avatar-wrapper">
                      <img src={displayAvatar} alt="Avatar" className="chat-avatar" />
                    </div>

                    <div className="chat-bubble-wrapper">
                      <div className="chat-message-meta">
                        <span className="username">{displayName}</span>
                        <span className="time">{formatSentTime(msg.created_at)}</span>
                        {msg.is_edited && !msg.is_deleted && <span className="chat-edited-label">(đã chỉnh sửa)</span>}
                      </div>

                      {/* Bong bóng chat */}
                      <div className={`chat-bubble ${msg.is_deleted ? 'recalled' : ''}`}>
                        {/* Hiển thị Trích dẫn/Reply */}
                        {parentMsg && (
                          <div 
                            className="chat-reply-quote"
                            onClick={() => {
                              const el = document.getElementById(`msg-${parentMsg.id}`);
                              el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }}
                          >
                            <div className="chat-reply-quote-user">
                              @{parentMsg.sender_name || parentMsg.sender_email.split('@')[0]}
                            </div>
                            <div className="chat-reply-quote-content">
                              {parentMsg.is_deleted ? 'Tin nhắn đã được thu hồi' : parentMsg.content.substring(0, 50)}
                            </div>
                          </div>
                        )}

                        {/* Nội dung */}
                        {msg.is_deleted ? 'Tin nhắn đã được thu hồi' : renderMessageContent(msg.content)}

                        {/* Trình thả cảm xúc/thao tác tin nhắn khi hover */}
                        {!msg.is_deleted && currentUser && (
                          <div className="chat-bubble-action-trigger">
                            {/* Bảng thả emoji */}
                            <div className="chat-reaction-picker">
                              {Object.keys(EMOJI_MAP).map((type) => (
                                <button
                                  key={type}
                                  className="chat-reaction-picker-btn"
                                  onClick={() => handleToggleReaction(msg.id, type)}
                                  title={type}
                                >
                                  {EMOJI_MAP[type]}
                                </button>
                              ))}
                            </div>
                            
                            {/* Nút reply */}
                            <button 
                              className="chat-bubble-action-btn"
                              onClick={() => { setEditingMessage(null); setReplyingTo(msg); }}
                            >
                              Reply
                            </button>

                            {/* Nút sửa */}
                            {canEdit && (
                              <button 
                                className="chat-bubble-action-btn"
                                onClick={() => { setReplyingTo(null); setEditingMessage(msg); setInputText(msg.content); }}
                              >
                                Sửa
                              </button>
                            )}

                            {/* Nút thu hồi */}
                            {canRecall && (
                              <button 
                                className="chat-bubble-action-btn delete-btn"
                                onClick={() => handleRecallMessage(msg.id)}
                              >
                                Xóa
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Hiển thị các reactions đã thả */}
                      {Object.keys(rCounts).length > 0 && (
                        <div className="chat-reactions-list">
                          {Object.keys(rCounts).map((type) => {
                            const userReacted = msg.reactions?.some(
                              (r) => r.user_id === currentUser?.id && r.reaction_type === type
                            );
                            return (
                              <span
                                key={type}
                                className={`chat-reaction-badge ${userReacted ? 'active' : ''}`}
                                onClick={() => handleToggleReaction(msg.id, type)}
                              >
                                {EMOJI_MAP[type]} {rCounts[type]}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#888' }}>
                Không có tin nhắn nào. Hãy mở đầu cuộc trò chuyện nhé!
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chỉ báo đang gõ tin nhắn */}
          <div className="chat-typing-indicator-bar">
            {Object.keys(typingUsers).length > 0 && (
              <>
                <span>
                  {Object.values(typingUsers).map(u => u.name).join(', ')} đang nhập
                </span>
                <span style={{ display: 'inline-flex', gap: '2px', marginLeft: '4px' }}>
                  <span className="typing-dot"></span>
                  <span className="typing-dot"></span>
                  <span className="typing-dot"></span>
                </span>
              </>
            )}
          </div>

          {/* Khung Nhập tin nhắn */}
          <div className="chat-input-bar">
            {/* Thanh xem trước khi Phản hồi */}
            {replyingTo && (
              <div className="chat-reply-preview-bar">
                <span className="chat-reply-preview-text">
                  Đang trả lời <strong>@{replyingTo.sender_name || replyingTo.sender_email.split('@')[0]}</strong>: "{replyingTo.content.substring(0, 40)}..."
                </span>
                <button className="chat-reply-preview-close" onClick={() => setReplyingTo(null)}>✕</button>
              </div>
            )}

            {/* Thanh xem trước khi Chỉnh sửa */}
            {editingMessage && (
              <div className="chat-edit-preview-bar">
                <span className="chat-reply-preview-text">
                  Đang chỉnh sửa tin nhắn gửi lúc <strong>{formatSentTime(editingMessage.created_at)}</strong>
                </span>
                <button 
                  className="chat-reply-preview-close" 
                  onClick={() => { setEditingMessage(null); setInputText(''); }}
                >
                  Huỷ
                </button>
              </div>
            )}

            {/* Trình chọn Emoji (Popover) */}
            {isEmojiOpen && (
              <div className="emoji-picker-dropdown">
                <div className="emoji-grid">
                  {['😊','😂','❤️','👍','😮','😢','🔥','🎉','🚀','💯','🎓','✨','🤔','👏','🌟','💡','👀','✅'].map((emoji) => (
                    <button key={emoji} className="emoji-grid-btn" onClick={() => handleAddEmoji(emoji)}>
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Trình đính kèm Ảnh URL (Popover) */}
            {isImageOpen && (
              <form onSubmit={handleAddImage} className="image-upload-popover">
                <strong style={{ fontSize: '0.8rem', display: 'block' }}>Đính kèm ảnh từ link URL:</strong>
                <input 
                  type="url"
                  placeholder="https://example.com/image.png"
                  value={imageUrlInput}
                  onChange={(e) => setImageUrlInput(e.target.value)}
                  required
                />
                <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', marginTop: '4px' }}>
                  <button type="button" className="mini-btn" style={{ padding: '3px 8px' }} onClick={() => setIsImageOpen(false)}>Huỷ</button>
                  <button type="submit" className="mini-btn" style={{ padding: '3px 8px', background: 'var(--sage-green)' }}>Gửi ảnh</button>
                </div>
              </form>
            )}

            <div className="chat-input-row">
              {currentUser && (
                <div className="chat-input-actions">
                  <input 
                    type="file" 
                    accept="image/*" 
                    style={{ display: 'none' }} 
                    ref={fileInputRef} 
                    onChange={handleFileChange}
                    disabled={isUploading}
                  />
                  <button 
                    type="button" 
                    className="chat-action-btn" 
                    title="Thêm Emoji" 
                    onClick={() => { setIsImageOpen(false); setIsEmojiOpen(!isEmojiOpen); }}
                    disabled={isUploading}
                  >
                    😊
                  </button>
                  <button 
                    type="button" 
                    className="chat-action-btn" 
                    title="Đính kèm ảnh từ thiết bị" 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                  >
                    {isUploading ? '⌛' : '📎'}
                  </button>
                </div>
              )}

              {authLoading ? (
                <div style={{ flex: 1, textAlign: 'center', padding: '10px' }}>Đang tải trạng thái tài khoản...</div>
              ) : currentUser ? (
                <>
                  <textarea
                    ref={chatInputRef}
                    rows="1"
                    className="chat-input-textarea"
                    placeholder="Nhập tin nhắn... (Dán ảnh từ clipboard hoặc Enter để gửi)"
                    value={inputText}
                    onChange={(e) => { setInputText(e.target.value); handleTypingEvent(); }}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                    disabled={isSending || isUploading}
                  />
                  <button 
                    onClick={() => handleSendMessage()}
                    className="btn-primary" 
                    style={{ padding: '8px 20px', borderRadius: '10px', height: '42px' }}
                    disabled={isSending || isUploading || !inputText.trim()}
                  >
                    {isSending || isUploading ? '...' : 'Gửi'}
                  </button>
                </>
              ) : (
                <div 
                  className="brutal-card" 
                  style={{ 
                    flex: 1,
                    textAlign: 'center', 
                    padding: '12px', 
                    border: '3px dashed #ef4444', 
                    borderRadius: '8px', 
                    background: '#fef2f2', 
                    color: '#ef4444', 
                    fontWeight: '700',
                    margin: 0
                  }}
                >
                  🔒 Hãy đăng nhập từ góc phải màn hình để trò chuyện cùng mọi người.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Cột Phải: Danh sách User Online */}
        <div className="chat-online-panel">
          <h3>👥 Thành viên ({Object.keys(onlineUsers).length})</h3>
          <div className="chat-online-list">
            {Object.keys(onlineUsers).length > 0 ? (
              Object.values(onlineUsers).map((user) => (
                <div key={user.userId} className="chat-online-user">
                  <img src={user.avatar} alt="Avatar" className="chat-online-avatar" />
                  <div className="chat-online-name-col">
                    <span className="chat-online-username">{user.name}</span>
                    <span className="chat-online-status-text">
                      <span className={`chat-online-dot ${user.status}`}></span>
                      {user.status === 'online' ? 'Online' : user.status === 'away' ? 'Tạm vắng' : 'Ngoại tuyến'}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ color: '#888', fontSize: '0.8rem', fontStyle: 'italic', padding: '10px 0' }}>
                Không có ai online
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
