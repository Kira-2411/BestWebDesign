(function () {
  "use strict";

  // 1. Khởi tạo Supabase Client từ Cấu hình Tĩnh
  if (!window.SUPABASE_CONFIG) {
    console.error("Thiếu cấu hình Supabase in window.SUPABASE_CONFIG!");
    return;
  }
  const { createClient } = supabase;
  const client = createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey);

  // 2. State quản lý ứng dụng
  let currentUser = null;
  let messages = [];
  let onlineUsers = {};
  let typingUsers = {};
  let replyingTo = null;
  let editingMessage = null;
  let lastSentTime = 0;
  let isSending = false;
  let isUploading = false;
  let idleTimer = null;
  let channels = {
    chat: null,
    presence: null
  };

  // Các loại emoji thả cảm xúc
  const EMOJI_MAP = {
    like: '👍',
    love: '❤️',
    haha: '😂',
    wow: '😮',
    sad: '😢'
  };

  // Từ cấm lọc tục tĩu
  const BAD_WORDS = ['đm', 'đmm', 'đéo', 'vcl', 'cl', 'clgt', 'lồn', 'chó', 'dcm', 'cc', 'cặc', 'đựt', 'đụ', 'buồi', 'mẹ kiếp', 'khốn nạn'];

  // 3. Lấy các DOM Elements
  const DOM = {
    chatMessages: document.getElementById("chatMessages"),
    chatForm: document.getElementById("chatForm"),
    chatInput: document.getElementById("chatInput"),
    authPrompt: document.getElementById("authPrompt"),
    headerAuthZone: document.getElementById("headerAuthZone"),
    onlineUsersList: document.getElementById("onlineUsersList"),
    onlineCountText: document.getElementById("onlineCountText"),
    typingIndicatorBar: document.getElementById("typingIndicatorBar"),
    replyPreviewBar: document.getElementById("replyPreviewBar"),
    replyPreviewText: document.getElementById("replyPreviewText"),
    closeReplyPreviewBtn: document.getElementById("closeReplyPreviewBtn"),
    editPreviewBar: document.getElementById("editPreviewBar"),
    closeEditPreviewBtn: document.getElementById("closeEditPreviewBtn"),
    emojiPickerBtn: document.getElementById("emojiPickerBtn"),
    emojiPopover: document.getElementById("emojiPopover"),
    imageAttachBtn: document.getElementById("imageAttachBtn"),
    fileInput: document.getElementById("fileInput"),
    imageUrlPopover: document.getElementById("imageUrlPopover"),
    imageUrlInput: document.getElementById("imageUrlInput"),
    imageUrlSubmitBtn: document.getElementById("imageUrlSubmitBtn"),
    logoutOverlay: document.getElementById("logoutOverlay"),
    loginBtn: document.getElementById("loginBtn")
  };

  // Helper hiển thị thông báo Toast nhanh
  function showToast(msg) {
    const old = document.querySelector(".chat-toast");
    if (old) old.remove();

    const el = document.createElement("div");
    el.className = "toast show chat-toast";
    el.style.position = "fixed";
    el.style.bottom = "20px";
    el.style.right = "20px";
    el.style.zIndex = "9999";
    el.textContent = msg;
    document.body.appendChild(el);

    setTimeout(() => {
      el.classList.remove("show");
      setTimeout(() => el.remove(), 300);
    }, 3000);
  }

  // Cuộn hộp thoại chat xuống cuối cùng
  function scrollToBottom(smooth = true) {
    if (DOM.chatMessages) {
      DOM.chatMessages.scrollTo({
        top: DOM.chatMessages.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
      });
    }
  }

  // 4. Quản lý Đăng nhập & Auth State
  async function initAuth() {
    // Lấy session hiện tại
    const { data: { session } } = await client.auth.getSession();
    handleUserChange(session?.user || null);

    // Lắng nghe thay đổi trạng thái auth
    client.auth.onAuthStateChange((event, session) => {
      handleUserChange(session?.user || null);
      if (event === 'SIGNED_OUT') {
        // Clear local storage drafts nếu có
        const keysToRemove = [
          'unimatch_strategy_plan',
          'unimatch_form_draft',
          'unimatch_bookmarked_unis',
          'unimatch_compare_list',
          'unimatch_recent_searches_uni',
          'unimatch_uni_filters',
          'unimatch_bookmarked_majors',
          'unimatch_compare_majors',
          'unimatch_recent_searches_major',
          'unimatch_major_filters'
        ];
        keysToRemove.forEach(k => localStorage.removeItem(k));
      }
    });

    // Event logins
    DOM.loginBtn?.addEventListener("click", handleLogin);
  }

  async function handleLogin() {
    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.href
      }
    });
    if (error) {
      showToast("❌ Lỗi đăng nhập Google: " + error.message);
    }
  }

  async function handleLogout() {
    DOM.logoutOverlay.style.display = "flex";
    
    // Play sound logout (như trong Header.js)
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        const ctx = new AudioContextClass();
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(150, now + 0.6);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.6);
      }
    } catch (e) {}

    setTimeout(async () => {
      const { error } = await client.auth.signOut();
      DOM.logoutOverlay.style.display = "none";
      if (error) {
        showToast("❌ Lỗi đăng xuất: " + error.message);
      } else {
        window.location.reload();
      }
    }, 1200);
  }

  function handleUserChange(user) {
    currentUser = user;
    updateAuthUI();
    
    // Đăng ký lại Presence & Realtime khi user thay đổi
    setupPresence();
    loadMessages();
  }

  function updateAuthUI() {
    if (currentUser) {
      // Ẩn prompt, hiện form nhập tin nhắn
      DOM.authPrompt.style.display = "none";
      DOM.chatForm.style.display = "flex";

      // Render góc avatar ở Site Header
      const displayName = currentUser.user_metadata?.full_name?.split(' ').pop() || 'User';
      const displayAvatar = currentUser.user_metadata?.avatar_url || 'https://www.gravatar.com/avatar?d=mp';

      DOM.headerAuthZone.innerHTML = `
        <div class="user-profile-widget" style="display: flex; align-items: center; gap: 8px;">
          <img src="${displayAvatar}" alt="Avatar" style="width: 32px; height: 32px; borderRadius: 50%; border: 2px solid var(--ink); border-radius: 50%;" />
          <span class="user-name" style="font-family: var(--font-display); fontWeight: 800; font-size: 0.85rem; color: var(--white); font-weight: 800;">
            ${displayName}
          </span>
          <button id="headerLogoutBtn" class="mini-btn auth-btn" style="padding: 4px 8px; fontSize: 0.7rem; background: #ff6b6b; cursor: pointer; font-size: 0.75rem;">
            Thoát
          </button>
        </div>
      `;

      document.getElementById("headerLogoutBtn")?.addEventListener("click", handleLogout);
    } else {
      // Hiện prompt đăng nhập, ẩn form nhập tin nhắn
      DOM.authPrompt.style.display = "flex";
      DOM.chatForm.style.display = "none";

      DOM.headerAuthZone.innerHTML = `
        <button id="headerLoginBtn" class="mini-btn auth-btn" style="background: #FFD23F; cursor: pointer; padding: 6px 12px; font-weight: 700;">
          Đăng nhập Google
        </button>
      `;
      document.getElementById("headerLoginBtn")?.addEventListener("click", handleLogin);
    }
  }

  // 5. Lấy dữ liệu tin nhắn (Messages & Reactions) từ Supabase
  async function loadMessages() {
    DOM.chatMessages.innerHTML = `<div id="chatLoading" style="text-align: center; padding: 40px; color: #888;">🤖 Đang tải lịch sử tin nhắn...</div>`;
    
    try {
      // 1. Tải 100 tin nhắn mới nhất
      const { data: msgData, error: msgErr } = await client
        .from('community_messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(100);

      if (msgErr) throw msgErr;

      // 2. Tải tất cả cảm xúc
      const { data: reactData, error: reactErr } = await client
        .from('community_reactions')
        .select('*');

      if (reactErr) throw reactErr;

      // Map reactions vào từng tin nhắn
      const reactionsMap = {};
      if (reactData) {
        reactData.forEach(r => {
          if (!reactionsMap[r.message_id]) {
            reactionsMap[r.message_id] = [];
          }
          reactionsMap[r.message_id].push(r);
        });
      }

      if (msgData) {
        messages = msgData.map(m => ({
          ...m,
          reactions: reactionsMap[m.id] || []
        }));
        renderMessages();
        setTimeout(() => scrollToBottom(false), 200);
      }
    } catch (err) {
      console.error("Lỗi fetch dữ liệu chat:", err.message);
      DOM.chatMessages.innerHTML = `<div style="text-align: center; padding: 40px; color: red;">❌ Lỗi kết nối dữ liệu: ${err.message}</div>`;
    }
  }

  // 6. Xử lý Realtime & Subscriptions
  function setupRealtime() {
    if (channels.chat) {
      client.removeChannel(channels.chat);
    }

    channels.chat = client
      .channel('community-chat-main')
      // Lắng nghe thêm tin nhắn
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'community_messages' },
        (payload) => {
          const exists = messages.some(m => m.id === payload.new.id);
          if (!exists) {
            messages.push({ ...payload.new, reactions: [] });
            renderMessages();
            scrollToBottom();
          }
        }
      )
      // Lắng nghe sửa/xóa tin nhắn
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'community_messages' },
        (payload) => {
          messages = messages.map(msg => msg.id === payload.new.id ? { ...msg, ...payload.new } : msg);
          renderMessages();
        }
      )
      // Lắng nghe thêm cảm xúc
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'community_reactions' },
        (payload) => {
          messages = messages.map(msg => {
            if (msg.id === payload.new.message_id) {
              const reactions = msg.reactions || [];
              const exists = reactions.some(r => r.id === payload.new.id);
              if (exists) return msg;
              return { ...msg, reactions: [...reactions, payload.new] };
            }
            return msg;
          });
          renderMessages();
        }
      )
      // Lắng nghe xóa cảm xúc
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'community_reactions' },
        (payload) => {
          messages = messages.map(msg => {
            const reactions = msg.reactions || [];
            if (reactions.some(r => r.id === payload.old.id)) {
              return { ...msg, reactions: reactions.filter(r => r.id !== payload.old.id) };
            }
            return msg;
          });
          renderMessages();
        }
      )
      // Lắng nghe Broadcast "Đang nhập" (typing)
      .on('broadcast', { event: 'typing' }, (payload) => {
        const { userId, name, typing } = payload.payload;
        if (typing) {
          typingUsers[userId] = { name, timestamp: Date.now() };
        } else {
          delete typingUsers[userId];
        }
        updateTypingIndicator();
      })
      .subscribe((status, err) => {
        console.log("Kênh community-chat-main status:", status);
        if (err) console.error("Lỗi Realtime:", err);
      });
  }

  // 7. Quản lý trạng thái Online (Presence)
  function setupPresence() {
    if (channels.presence) {
      client.removeChannel(channels.presence);
    }

    if (!currentUser) {
      onlineUsers = {};
      renderOnlineUsers();
      return;
    }

    channels.presence = client.channel('community-chat-presence', {
      config: {
        presence: {
          key: currentUser.id
        }
      }
    });

    channels.presence
      .on('presence', { event: 'sync' }, () => {
        const state = channels.presence.presenceState();
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
        onlineUsers = formatted;
        renderOnlineUsers();
      });

    channels.presence.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        const name = currentUser.user_metadata?.full_name || currentUser.email.split('@')[0];
        const avatar = currentUser.user_metadata?.avatar_url || 'https://www.gravatar.com/avatar?d=mp';
        await channels.presence.track({
          name,
          avatar,
          status: 'online',
          lastSeen: new Date().toISOString()
        });
      }
    });

    // Theo dõi trạng thái Away sau 5 phút không hoạt động
    setupIdleTracker();
  }

  function setupIdleTracker() {
    if (idleTimer) clearTimeout(idleTimer);

    const resetIdle = () => {
      clearTimeout(idleTimer);

      const currentPresence = channels.presence?.presenceState()?.[currentUser.id]?.[0];
      if (currentPresence && currentPresence.status !== 'online') {
        updatePresenceStatus('online');
      }

      idleTimer = setTimeout(() => {
        updatePresenceStatus('away');
      }, 5 * 60 * 1000); // 5 phút
    };

    const updatePresenceStatus = async (status) => {
      if (!currentUser || !channels.presence) return;
      const name = currentUser.user_metadata?.full_name || currentUser.email.split('@')[0];
      const avatar = currentUser.user_metadata?.avatar_url || 'https://www.gravatar.com/avatar?d=mp';
      await channels.presence.track({
        name,
        avatar,
        status,
        lastSeen: new Date().toISOString()
      });
    };

    window.addEventListener('mousemove', resetIdle);
    window.addEventListener('keydown', resetIdle);
    resetIdle();
  }

  // Lọc định kỳ các chỉ báo "đang nhập" quá hạn (sau 4 giây)
  setInterval(() => {
    let changed = false;
    const now = Date.now();
    Object.keys(typingUsers).forEach((key) => {
      if (now - typingUsers[key].timestamp > 4000) {
        delete typingUsers[key];
        changed = true;
      }
    });
    if (changed) {
      updateTypingIndicator();
    }
  }, 1000);

  function updateTypingIndicator() {
    const users = Object.values(typingUsers).map(u => u.name);
    if (users.length > 0) {
      DOM.typingIndicatorBar.style.visibility = "visible";
      DOM.typingIndicatorBar.innerHTML = `
        <span>${users.join(', ')} đang nhập</span>
        <span style="display: inline-flex; gap: 2px; margin-left: 4px;">
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
        </span>
      `;
    } else {
      DOM.typingIndicatorBar.style.visibility = "hidden";
      DOM.typingIndicatorBar.innerHTML = "";
    }
  }

  // 8. Render Danh sách Tin nhắn và Online users lên DOM
  function renderMessages() {
    if (messages.length === 0) {
      DOM.chatMessages.innerHTML = `
        <div style="text-align: center; padding: 60px 20px; color: #888;">
          Không có tin nhắn nào. Hãy mở đầu cuộc trò chuyện nhé!
        </div>
      `;
      return;
    }

    DOM.chatMessages.innerHTML = "";
    messages.forEach((msg) => {
      const isMe = currentUser && msg.sender_id === currentUser.id;
      const displayName = msg.sender_name || msg.sender_email.split('@')[0];
      const displayAvatar = msg.sender_avatar || 'https://www.gravatar.com/avatar?d=mp';
      
      const createdTime = new Date(msg.created_at);
      const diffTimeMinutes = (Date.now() - createdTime.getTime()) / (1000 * 60);
      const canEdit = isMe && !msg.is_deleted && diffTimeMinutes < 5;
      const canRecall = isMe && !msg.is_deleted;

      const formattedTime = createdTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      
      // Tạo container tin nhắn
      const msgItem = document.createElement("div");
      msgItem.id = `msg-${msg.id}`;
      msgItem.className = `chat-message-item ${isMe ? 'me' : 'other'}`;

      // Tạo cấu trúc HTML cho bong bóng chat
      let parentMsgHtml = "";
      if (msg.reply_to_id) {
        const parentMsg = messages.find(m => m.id === msg.reply_to_id);
        if (parentMsg) {
          const parentName = parentMsg.sender_name || parentMsg.sender_email.split('@')[0];
          const parentContent = parentMsg.is_deleted ? 'Tin nhắn đã được thu hồi' : parentMsg.content.substring(0, 50);
          parentMsgHtml = `
            <div class="chat-reply-quote" onclick="document.getElementById('msg-${parentMsg.id}')?.scrollIntoView({ behavior: 'smooth', block: 'center' })">
              <div class="chat-reply-quote-user">@${parentName}</div>
              <div class="chat-reply-quote-content">${parentContent}</div>
            </div>
          `;
        }
      }

      // Render nội dung (xử lý hiển thị ảnh nếu là cú pháp markdown của ảnh)
      let bubbleContent = "";
      if (msg.is_deleted) {
        bubbleContent = "Tin nhắn đã được thu hồi";
      } else {
        const imgRegex = /!\[.*?\]\((https?:\/\/.*?)\)/g;
        const match = imgRegex.exec(msg.content);
        if (match) {
          const imageUrl = match[1];
          const cleanText = msg.content.replace(imgRegex, '');
          bubbleContent = `
            ${cleanText ? `<div style="margin-bottom: 6px;">${cleanText}</div>` : ''}
            <img src="${imageUrl}" alt="Đính kèm" class="chat-attachment-img" />
          `;
        } else {
          // Thoát HTML để tránh XSS
          const safeText = msg.content.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
          bubbleContent = `<div>${safeText}</div>`;
        }
      }

      // Tạo Toolbar action khi hover
      let actionsHtml = "";
      if (!msg.is_deleted && currentUser) {
        actionsHtml = `
          <div class="chat-bubble-action-trigger">
            <div class="chat-reaction-picker">
              ${Object.keys(EMOJI_MAP).map(type => `
                <button type="button" class="chat-reaction-picker-btn" data-reaction="${type}" title="${type}">
                  ${EMOJI_MAP[type]}
                </button>
              `).join('')}
            </div>
            <button type="button" class="chat-bubble-action-btn action-reply-btn">Reply</button>
            ${canEdit ? `<button type="button" class="chat-bubble-action-btn action-edit-btn">Sửa</button>` : ''}
            ${canRecall ? `<button type="button" class="chat-bubble-action-btn delete-btn action-recall-btn">Xóa</button>` : ''}
          </div>
        `;
      }

      // Hiển thị reactions đã được thả
      let reactionsListHtml = "";
      const rCounts = {};
      const msgReactions = msg.reactions || [];
      msgReactions.forEach(r => {
        rCounts[r.reaction_type] = (rCounts[r.reaction_type] || 0) + 1;
      });

      if (Object.keys(rCounts).length > 0) {
        reactionsListHtml = `
          <div class="chat-reactions-list">
            ${Object.keys(rCounts).map(type => {
              const userReacted = msgReactions.some(r => r.user_id === currentUser?.id && r.reaction_type === type);
              return `
                <span class="chat-reaction-badge ${userReacted ? 'active' : ''}" data-type="${type}">
                  ${EMOJI_MAP[type]} ${rCounts[type]}
                </span>
              `;
            }).join('')}
          </div>
        `;
      }

      msgItem.innerHTML = `
        <div class="chat-avatar-wrapper">
          <img src="${displayAvatar}" alt="Avatar" class="chat-avatar" />
        </div>
        <div class="chat-bubble-wrapper">
          <div class="chat-message-meta">
            <span class="username">${displayName}</span>
            <span class="time">${formattedTime}</span>
            ${msg.is_edited && !msg.is_deleted ? `<span class="chat-edited-label">(đã chỉnh sửa)</span>` : ''}
          </div>
          <div class="chat-bubble ${msg.is_deleted ? 'recalled' : ''}">
            ${parentMsgHtml}
            ${bubbleContent}
            ${actionsHtml}
          </div>
          ${reactionsListHtml}
        </div>
      `;

      // 9. Đăng ký events cụ thể cho từng Message Card
      if (currentUser && !msg.is_deleted) {
        // Event thả emoji từ picker
        msgItem.querySelectorAll(".chat-reaction-picker-btn").forEach(btn => {
          btn.addEventListener("click", () => {
            const type = btn.getAttribute("data-reaction");
            handleToggleReaction(msg.id, type);
          });
        });

        // Event click vào badge reaction đã có sẵn
        msgItem.querySelectorAll(".chat-reaction-badge").forEach(badge => {
          badge.addEventListener("click", () => {
            const type = badge.getAttribute("data-type");
            handleToggleReaction(msg.id, type);
          });
        });

        // Event Reply
        msgItem.querySelector(".action-reply-btn")?.addEventListener("click", () => {
          editingMessage = null;
          replyingTo = msg;
          DOM.replyPreviewText.innerHTML = `Đang trả lời <strong>@${displayName}</strong>: "${msg.content.substring(0, 40)}"`;
          DOM.replyPreviewBar.style.display = "flex";
          DOM.editPreviewBar.style.display = "none";
          DOM.chatInput.focus();
        });

        // Event Sửa tin nhắn
        msgItem.querySelector(".action-edit-btn")?.addEventListener("click", () => {
          replyingTo = null;
          editingMessage = msg;
          DOM.chatInput.value = msg.content;
          DOM.editPreviewBar.style.display = "flex";
          DOM.replyPreviewBar.style.display = "none";
          DOM.chatInput.focus();
        });

        // Event Thu hồi
        msgItem.querySelector(".action-recall-btn")?.addEventListener("click", () => {
          if (confirm("Bạn có chắc chắn muốn thu hồi tin nhắn này?")) {
            handleRecallMessage(msg.id);
          }
        });
      }

      DOM.chatMessages.appendChild(msgItem);
    });
  }

  function renderOnlineUsers() {
    DOM.onlineUsersList.innerHTML = "";
    const users = Object.values(onlineUsers);
    
    // Cập nhật số lượng đếm
    DOM.onlineCountText.textContent = `${users.length} người đang online`;

    if (users.length === 0) {
      DOM.onlineUsersList.innerHTML = `<div style="padding: 10px; color:#888; text-align:center;">Trống</div>`;
      return;
    }

    users.forEach(u => {
      const item = document.createElement("div");
      item.className = "chat-online-user";
      
      const statusText = u.status === 'away' ? 'Tạm vắng' : 'Đang hoạt động';
      const statusDotClass = u.status === 'away' ? 'away' : 'online';

      item.innerHTML = `
        <img src="${u.avatar}" alt="Avatar" class="chat-online-avatar" />
        <div class="chat-online-name-col">
          <span class="chat-online-username">${u.name}</span>
          <span class="chat-online-status-text">
            <span class="chat-online-dot ${statusDotClass}"></span>
            ${statusText}
          </span>
        </div>
      `;
      DOM.onlineUsersList.appendChild(item);
    });
  }

  // 10. Các tác vụ Thao tác tin nhắn (Gửi, Sửa, Thu hồi, Thả emoji)
  async function handleSendMessage(e) {
    if (e) e.preventDefault();
    const text = DOM.chatInput.value.trim();
    if (!text || !currentUser || isSending) return;

    // Chống Spam: Giới hạn 1 tin/giây
    const now = Date.now();
    if (now - lastSentTime < 1000) {
      showToast("⚠️ Vui lòng đợi 1 giây trước khi nhắn tiếp.");
      return;
    }
    lastSentTime = now;
    isSending = true;

    // Lọc từ cấm
    const filteredText = filterBadWords(text);

    if (editingMessage) {
      // 10.1 Cập nhật tin nhắn
      const { data, error } = await client
        .from('community_messages')
        .update({
          content: filteredText,
          is_edited: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingMessage.id)
        .select();

      if (error) {
        showToast("❌ Lỗi sửa tin nhắn: " + error.message);
      } else {
        DOM.chatInput.value = "";
        editingMessage = null;
        DOM.editPreviewBar.style.display = "none";
        if (data && data[0]) {
          messages = messages.map(m => m.id === data[0].id ? { ...m, ...data[0] } : m);
          renderMessages();
        }
      }
    } else {
      // 10.2 Gửi tin nhắn mới
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

      // Optimistic UI update
      const tempId = 'temp-' + Date.now();
      const tempMsg = {
        id: tempId,
        ...messageBody,
        reactions: [],
        created_at: new Date().toISOString()
      };
      messages.push(tempMsg);
      renderMessages();
      scrollToBottom();

      const { data, error } = await client
        .from('community_messages')
        .insert([messageBody])
        .select();

      if (error) {
        showToast("❌ Không thể gửi tin nhắn: " + error.message);
        // Xóa message tạm ra nếu lỗi
        messages = messages.filter(m => m.id !== tempId);
        renderMessages();
      } else {
        DOM.chatInput.value = "";
        replyingTo = null;
        DOM.replyPreviewBar.style.display = "none";
        
        // Cập nhật tin nhắn chính thức thay thế tin nhắn tạm
        if (data && data[0]) {
          messages = messages.map(m => m.id === tempId ? { ...m, ...data[0] } : m);
          renderMessages();
        }
      }
    }

    isSending = false;

    // Tắt trạng thái đang nhập
    sendTypingBroadcast(false);
  }

  async function handleRecallMessage(msgId) {
    const { data, error } = await client
      .from('community_messages')
      .update({
        is_deleted: true,
        content: 'Tin nhắn đã được thu hồi'
      })
      .eq('id', msgId)
      .select();

    if (error) {
      showToast("❌ Lỗi thu hồi: " + error.message);
    } else {
      showToast("🧹 Đã thu hồi tin nhắn.");
      if (data && data[0]) {
        messages = messages.map(m => m.id === data[0].id ? { ...m, ...data[0] } : m);
        renderMessages();
      }
    }
  }

  async function handleToggleReaction(messageId, reactionType) {
    if (!currentUser) {
      showToast("🔒 Hãy đăng nhập để thả cảm xúc.");
      return;
    }

    const message = messages.find(m => m.id === messageId);
    if (!message) return;

    const existingReaction = message.reactions?.find(
      r => r.user_id === currentUser.id && r.reaction_type === reactionType
    );

    if (existingReaction) {
      // Optimistic UI - Bỏ cảm xúc local trước
      messages = messages.map(m => {
        if (m.id === messageId) {
          return {
            ...m,
            reactions: m.reactions.filter(r => r.id !== existingReaction.id)
          };
        }
        return m;
      });
      renderMessages();

      const { error } = await client
        .from('community_reactions')
        .delete()
        .eq('id', existingReaction.id);

      if (error) {
        console.error("Lỗi bỏ cảm xúc:", error.message);
        loadMessages(); // reload lại nếu lỗi để đồng bộ
      }
    } else {
      // Optimistic UI - Tạo ID tạm
      const tempReactId = 'temp-react-' + Date.now();
      const newReactObj = {
        id: tempReactId,
        message_id: messageId,
        user_id: currentUser.id,
        reaction_type: reactionType,
        created_at: new Date().toISOString()
      };

      messages = messages.map(m => {
        if (m.id === messageId) {
          return {
            ...m,
            reactions: [...(m.reactions || []), newReactObj]
          };
        }
        return m;
      });
      renderMessages();

      const { data, error } = await client
        .from('community_reactions')
        .insert({
          message_id: messageId,
          user_id: currentUser.id,
          reaction_type: reactionType
        })
        .select();

      if (error) {
        console.error("Lỗi thả cảm xúc:", error.message);
        loadMessages(); // reload lại nếu lỗi để đồng bộ
      } else if (data && data[0]) {
        // Thay thế ID tạm bằng dữ liệu thật
        messages = messages.map(m => {
          if (m.id === messageId) {
            return {
              ...m,
              reactions: m.reactions.map(r => r.id === tempReactId ? data[0] : r)
            };
          }
          return m;
        });
        renderMessages();
      }
    }
  }

  // 11. Các chức năng bổ trợ (Upload File & Paste Clipboard)
  async function uploadFile(file) {
    if (!file || !currentUser || isUploading) return;

    if (!file.type.startsWith('image/')) {
      showToast('❌ Chỉ cho phép tải lên file ảnh.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('⚠️ Dung lượng ảnh tối đa là 5MB.');
      return;
    }

    isUploading = true;
    showToast('⏳ Đang tải ảnh lên Supabase...');

    try {
      const fileExt = file.name.split('.').pop() || 'png';
      const fileName = `${currentUser.id}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { data, error: uploadError } = await client.storage
        .from('chat-attachments')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = client.storage
        .from('chat-attachments')
        .getPublicUrl(filePath);

      // Gửi tin nhắn chứa cú pháp ảnh markdown
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

      const { data: insertData, error: insertError } = await client
        .from('community_messages')
        .insert([messageBody])
        .select();

      if (insertError) {
        showToast('❌ Lỗi gửi ảnh: ' + insertError.message);
      } else {
        replyingTo = null;
        DOM.replyPreviewBar.style.display = "none";
        if (insertData && insertData[0]) {
          messages.push({ ...insertData[0], reactions: [] });
          renderMessages();
          scrollToBottom();
        }
        showToast('✅ Đã gửi ảnh thành công.');
      }
    } catch (err) {
      console.error('Lỗi upload:', err);
      showToast('❌ Lỗi tải ảnh lên: ' + err.message);
    } finally {
      isUploading = false;
    }
  }

  // 12. Gửi tín hiệu Đang gõ qua Broadcast
  let typingTimeout = null;
  function sendTypingBroadcast(typing) {
    if (!currentUser || !channels.chat) return;

    channels.chat.send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        userId: currentUser.id,
        name: currentUser.user_metadata?.full_name || currentUser.email.split('@')[0],
        typing: typing
      }
    });
  }

  function handleTypingEvent() {
    sendTypingBroadcast(true);

    if (typingTimeout) clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      sendTypingBroadcast(false);
    }, 3000);
  }

  // Helper lọc từ tục tĩu
  function filterBadWords(text) {
    let cleaned = text;
    BAD_WORDS.forEach((word) => {
      const escapedWord = word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`\\b${escapedWord}\\b|${escapedWord}`, 'gi');
      cleaned = cleaned.replace(regex, '****');
    });
    return cleaned;
  }

  // 13. Khởi tạo & Cài đặt Event Listeners
  function initEventListeners() {
    // Submit form chat
    DOM.chatForm.addEventListener("submit", handleSendMessage);

    // Enter để gửi tin nhắn (Shift+Enter xuống dòng)
    DOM.chatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    });

    // Lắng nghe gõ phím để gửi typing signal
    DOM.chatInput.addEventListener("input", handleTypingEvent);

    // Nhấn đóng các ô preview (Reply/Edit)
    DOM.closeReplyPreviewBtn.addEventListener("click", () => {
      replyingTo = null;
      DOM.replyPreviewBar.style.display = "none";
    });

    DOM.closeEditPreviewBtn.addEventListener("click", () => {
      editingMessage = null;
      DOM.chatInput.value = "";
      DOM.editPreviewBar.style.display = "none";
    });

    // Popover Emoji
    DOM.emojiPickerBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      DOM.imageUrlPopover.style.display = "none";
      DOM.emojiPopover.style.display = DOM.emojiPopover.style.display === "none" ? "block" : "none";
    });

    // Click chọn emoji trong popover
    DOM.emojiPopover.querySelectorAll(".emoji-grid-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const emoji = btn.getAttribute("data-emoji");
        DOM.chatInput.value += emoji;
        DOM.emojiPopover.style.display = "none";
        DOM.chatInput.focus();
      });
    });

    // Popover Link ảnh hoặc chọn file
    DOM.imageAttachBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      DOM.emojiPopover.style.display = "none";
      DOM.imageUrlPopover.style.display = DOM.imageUrlPopover.style.display === "none" ? "block" : "none";
    });

    // Gửi link ảnh từ popover
    DOM.imageUrlSubmitBtn.addEventListener("click", (e) => {
      const url = DOM.imageUrlInput.value.trim();
      if (url) {
        DOM.chatInput.value += ` ![ảnh](${url})`;
        DOM.imageUrlInput.value = "";
        DOM.imageUrlPopover.style.display = "none";
        DOM.chatInput.focus();
      }
    });

    // Double click / Click kẹp giấy mở chọn file local
    DOM.imageAttachBtn.addEventListener("dblclick", () => {
      DOM.fileInput.click();
    });

    DOM.fileInput.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (file) {
        uploadFile(file);
      }
    });

    // Lắng nghe dán Clipboard (Ctrl+V) để gửi ảnh nhanh
    DOM.chatInput.addEventListener("paste", (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            uploadFile(file);
            break;
          }
        }
      }
    });

    // Đóng các popover khi click ra ngoài
    document.addEventListener("click", () => {
      DOM.emojiPopover.style.display = "none";
      DOM.imageUrlPopover.style.display = "none";
    });

    DOM.emojiPopover.addEventListener("click", (e) => e.stopPropagation());
    DOM.imageUrlPopover.addEventListener("click", (e) => e.stopPropagation());
  }

  // Khởi động trang trò chuyện
  function init() {
    initAuth();
    initEventListeners();
    setupRealtime();
  }

  // Chạy khi trang load
  document.addEventListener("DOMContentLoaded", init);

})();
