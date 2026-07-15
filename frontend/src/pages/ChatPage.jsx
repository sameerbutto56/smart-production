import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import socket from '../socket';

const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN'];

const getRoleColor = (role) => {
  const r = (role || '').toUpperCase();
  if (r === 'ADMIN' || r === 'SUPER_ADMIN') return 'from-purple-500 to-pink-500';
  if (r === 'OUTLET') return 'from-emerald-500 to-teal-500';
  if (r === 'FAISAL') return 'from-orange-500 to-amber-500';
  if (r === 'STORE') return 'from-blue-500 to-cyan-500';
  if (r === 'PRODUCTION') return 'from-yellow-500 to-orange-500';
  if (r === 'LOGO_DESIGN') return 'from-violet-500 to-purple-500';
  if (r === 'DISPATCH') return 'from-rose-500 to-red-500';
  if (r === 'ORDER_ENTRY') return 'from-indigo-500 to-blue-500';
  if (r === 'DELIVERY_BOY') return 'from-cyan-500 to-teal-500';
  return 'from-gray-500 to-slate-500';
};

const StatusIcon = ({ msg, currentUserId }) => {
  const isOwn = msg.senderId === currentUserId;
  if (!isOwn) return null;

  if (msg.readAt) {
    return <span className="text-blue-400 text-[11px] leading-none" title="Read">✓✓</span>;
  }
  if (msg.deliveredAt) {
    return <span className="text-gray-400 text-[11px] leading-none" title="Delivered">✓✓</span>;
  }
  return <span className="text-gray-500 text-[11px] leading-none" title="Sent">✓</span>;
};

const formatTime = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatDateLabel = (dateStr) => {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
};

const formatFullDateTime = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const groupMessagesByDate = (messages) => {
  const groups = [];
  let currentDate = null;
  for (const msg of messages) {
    const d = formatDateLabel(msg.createdAt);
    if (d !== currentDate) {
      groups.push({ type: 'date', label: d });
      currentDate = d;
    }
    groups.push({ type: 'message', msg });
  }
  return groups;
};

const ChatPage = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [audioDuration, setAudioDuration] = useState(0);
  const [contextMsg, setContextMsg] = useState(null);
  const [contextPos, setContextPos] = useState({ x: 0, y: 0 });
  const [infoMsg, setInfoMsg] = useState(null);
  const [infoReceipts, setInfoReceipts] = useState([]);
  const [infoLoading, setInfoLoading] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const contextRef = useRef(null);
  const pendingStatusRef = useRef({});

  const currentUserId = user?.id;
  const isAdmin = ADMIN_ROLES.includes((user?.role || '').toUpperCase());
  const dispatchEmployee = sessionStorage.getItem('dispatchEmployee');
  const isDispatchMode = !!dispatchEmployee;

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
  }, []);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await api.get('/api/chat/messages?limit=100');
      setMessages(res.data.messages || []);
    } catch (err) {
      console.error('Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMessages();
    sessionStorage.setItem('chatUnread', '0');
  }, [fetchMessages]);

  useEffect(() => {
    const applyPendingStatus = (msgId) => {
      const pending = pendingStatusRef.current[msgId];
      if (!pending) return null;
      delete pendingStatusRef.current[msgId];
      return pending;
    };

    const handleNewMessage = (msg) => {
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev;
        const pending = applyPendingStatus(msg.id);
        const merged = pending
          ? { ...msg, deliveredAt: msg.deliveredAt || pending.deliveredAt, readAt: msg.readAt || pending.readAt, playedAt: msg.playedAt || pending.playedAt }
          : msg;
        const updated = [...prev, merged];
        updated.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        return updated;
      });
      scrollToBottom();

      if (msg.senderId !== currentUserId) {
        api.post(`/api/chat/messages/${msg.id}/delivered`).catch(() => {});
      }
    };

    const handleStatusUpdate = ({ messageId, status }) => {
      setMessages(prev => {
        const target = prev.find(m => m.id === messageId);
        if (!target) {
          const key = status === 'delivered' ? 'deliveredAt' : status === 'read' ? 'readAt' : 'playedAt';
          pendingStatusRef.current[messageId] = { ...pendingStatusRef.current[messageId], [key]: new Date().toISOString() };
          return prev;
        }
        return prev.map(m => {
          if (m.id !== messageId) return m;
          if (status === 'delivered' && !m.deliveredAt) return { ...m, deliveredAt: new Date().toISOString() };
          if (status === 'read' && !m.readAt) return { ...m, readAt: new Date().toISOString() };
          if (status === 'played' && !m.playedAt) return { ...m, playedAt: new Date().toISOString() };
          return m;
        });
      });
    };

    const handlePinUpdate = (msg) => {
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, isPinned: msg.isPinned } : m));
    };

    const handleDelete = ({ id }) => {
      setMessages(prev => prev.filter(m => m.id !== id));
    };

    socket.on('chat:new-message', handleNewMessage);
    socket.on('chat:status-update', handleStatusUpdate);
    socket.on('chat:message-pinned', handlePinUpdate);
    socket.on('chat:message-deleted', handleDelete);

    return () => {
      socket.off('chat:new-message', handleNewMessage);
      socket.off('chat:status-update', handleStatusUpdate);
      socket.off('chat:message-pinned', handlePinUpdate);
      socket.off('chat:message-deleted', handleDelete);
    };
  }, [currentUserId, scrollToBottom]);

  useEffect(() => {
    const unreadOthers = messages.filter(m => m.senderId !== currentUserId && !m.readAt);
    if (unreadOthers.length > 0) {
      unreadOthers.forEach(m => {
        api.post(`/api/chat/messages/${m.id}/read`).catch(() => {});
      });
    }
  }, [messages, currentUserId]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (contextRef.current && !contextRef.current.contains(e.target)) {
        setContextMsg(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const sendTextMessage = async () => {
    if (!input.trim()) return;
    let text = input.trim();
    if (isDispatchMode) {
      text = `[Dispatch - ${dispatchEmployee}] ${text}`;
    }
    setInput('');
    setSending(true);
    try {
      const res = await api.post('/api/chat/messages', { message: text });
      const newMsg = res.data;
      if (newMsg && newMsg.id) {
        setMessages(prev => {
          if (prev.some(m => m.id === newMsg.id)) return prev;
          const updated = [...prev, newMsg];
          updated.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
          return updated;
        });
        scrollToBottom();
      }
    } catch (err) {
      setInput(text);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendTextMessage();
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];
      mediaRecorderRef.current = recorder;
      setAudioDuration(0);

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        clearInterval(recordingTimerRef.current);
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType });
        if (blob.size < 100) return;

        const formData = new FormData();
        formData.append('audio', blob, `voice-${Date.now()}.webm`);
        try {
          const uploadRes = await api.post('/api/chat/voice', formData);
          const msgRes = await api.post('/api/chat/messages', { voiceUrl: uploadRes.data.url });
          const newVoiceMsg = msgRes.data;
          if (newVoiceMsg && newVoiceMsg.id) {
            setMessages(prev => {
              if (prev.some(m => m.id === newVoiceMsg.id)) return prev;
              const updated = [...prev, newVoiceMsg];
              updated.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
              return updated;
            });
            scrollToBottom();
          }
        } catch (err) {
          console.error('Voice upload failed');
        }
      };

      recorder.start();
      setRecording(true);
      const startTime = Date.now();
      recordingTimerRef.current = setInterval(() => {
        setAudioDuration(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    } catch (err) {
      console.error('Microphone access denied');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const handleVoicePlay = (msg) => {
    if (msg.senderId !== currentUserId) {
      api.post(`/api/chat/messages/${msg.id}/played`).catch(() => {});
    }
  };

  const handleContextMenu = (e, msg) => {
    e.preventDefault();
    setContextPos({ x: e.clientX, y: e.clientY });
    setContextMsg(msg);
  };

  const openMessageInfo = async (msg) => {
    setContextMsg(null);
    setInfoMsg(msg);
    setInfoLoading(true);
    try {
      const res = await api.get(`/api/chat/messages/${msg.id}/receipts`);
      setInfoReceipts(res.data || []);
    } catch {
      setInfoReceipts([]);
    } finally {
      setInfoLoading(false);
    }
  };

  const togglePin = async (msg) => {
    setContextMsg(null);
    try {
      await api.patch(`/api/chat/messages/${msg.id}/pin`);
    } catch (err) {
      console.error('Failed to toggle pin');
    }
  };

  const deleteMsg = async (msg) => {
    setContextMsg(null);
    if (!window.confirm('Delete this message?')) return;
    try {
      await api.delete(`/api/chat/messages/${msg.id}`);
    } catch (err) {
      console.error('Failed to delete message');
    }
  };

  const isOwnMessage = (msg) => msg.senderId === currentUserId;

  const pinnedMessages = messages.filter(m => m.isPinned);
  const regularMessages = messages.filter(m => !m.isPinned);
  const groupedRegular = groupMessagesByDate(regularMessages);

  const renderVoiceNote = (msg) => (
    <audio
      controls
      src={msg.voiceUrl}
      className="w-full max-w-[220px] h-9"
      style={{ filter: 'invert(0.85)' }}
      onPlay={() => handleVoicePlay(msg)}
    />
  );

  const renderMessageBubble = (msg) => {
    const own = isOwnMessage(msg);
    return (
      <div
        key={msg.id}
        onContextMenu={(e) => handleContextMenu(e, msg)}
        className={`flex ${own ? 'justify-end' : 'justify-start'} group px-1`}
      >
        <div className={`max-w-[78%] min-w-[120px] ${own ? 'order-1' : 'order-1'}`}>
          {!own && (
            <div className="flex items-center gap-1.5 mb-0.5 px-1">
              <span className={`text-[11px] font-black text-transparent bg-clip-text bg-gradient-to-r ${getRoleColor(msg.senderRole)}`}>
                {msg.senderName}
              </span>
              <span className="text-[9px] font-bold text-gray-500 truncate">
                {msg.senderRole?.replace(/_/g, ' ')}{msg.senderBranch ? ` · ${msg.senderBranch}` : ''}
              </span>
            </div>
          )}
          <div className={`relative rounded-2xl px-3.5 py-2.5 shadow-lg ${
            own
              ? 'bg-blue-600 text-white rounded-br-sm'
              : 'bg-gray-800/90 text-gray-200 rounded-bl-sm border border-gray-700/40'
          }`}>
            {msg.message && (
              <div className="text-sm whitespace-pre-wrap break-words leading-relaxed">{msg.message}</div>
            )}
            {msg.voiceUrl && renderVoiceNote(msg)}
            <div className={`flex items-center gap-1.5 mt-1 ${own ? 'justify-end' : 'justify-start'}`}>
              <span className={`text-[9px] ${own ? 'text-blue-200' : 'text-gray-500'}`}>
                {formatTime(msg.createdAt)}
              </span>
              {own && <StatusIcon msg={msg} currentUserId={currentUserId} />}
              {own && msg.voiceUrl && msg.playedAt && (
                <span className="text-[9px] text-blue-300 ml-0.5" title="Played">♪</span>
              )}
              {msg.isPinned && <span className="text-[9px]">📌</span>}
            </div>
            {isAdmin && !own && (
              <div className="absolute -top-1.5 -right-1.5 hidden group-hover:flex gap-0.5">
                <button onClick={(e) => { e.stopPropagation(); togglePin(msg); }} className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold shadow-lg transition-all ${msg.isPinned ? 'bg-yellow-500 text-white' : 'bg-gray-600 text-gray-300 hover:bg-yellow-500 hover:text-white'}`} title={msg.isPinned ? 'Unpin' : 'Pin'}>
                  📌
                </button>
                <button onClick={(e) => { e.stopPropagation(); deleteMsg(msg); }} className="w-5 h-5 rounded-full bg-red-500/80 flex items-center justify-center text-[8px] font-bold text-white shadow-lg hover:bg-red-500 transition-all" title="Delete">
                  ✕
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--background)' }}>
      <div className="flex items-center gap-3 px-5 py-3 border-b flex-shrink-0" style={{ borderColor: 'var(--glass-border)', background: 'var(--nav-bg)' }}>
        <div className={`w-9 h-9 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-lg ${isDispatchMode ? 'from-rose-500 to-red-500 shadow-red-500/20' : 'from-blue-500 to-emerald-500 shadow-blue-500/20'}`}>
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-black text-white flex items-center gap-2">
            {isDispatchMode ? `Dispatch — ${dispatchEmployee}` : 'Team Chat'}
            {isDispatchMode && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 uppercase tracking-wider">Dispatch</span>
            )}
          </h1>
          <p className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider truncate">
            {messages.length} messages · {pinnedMessages.length} pinned
          </p>
        </div>
        <button onClick={fetchMessages} className="text-xs font-bold px-3 py-1.5 rounded-xl bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition-all flex-shrink-0">
          Refresh
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-3 md:px-4 py-3 space-y-1">
        {pinnedMessages.length > 0 && (
          <div className="mb-3 p-2.5 rounded-xl border border-yellow-500/25" style={{ background: 'rgba(234,179,8,0.05)' }}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-yellow-500 text-[10px]">📌</span>
              <span className="text-[9px] font-bold text-yellow-500 uppercase tracking-wider">Pinned</span>
            </div>
            <div className="space-y-1.5">
              {pinnedMessages.map(renderMessageBubble)}
            </div>
          </div>
        )}

        {groupedRegular.map((item, idx) => {
          if (item.type === 'date') {
            return (
              <div key={`date-${idx}`} className="flex justify-center my-3">
                <span className="text-[10px] font-bold text-gray-500 bg-gray-900/60 px-3 py-1 rounded-full border border-gray-800/50">
                  {item.label}
                </span>
              </div>
            );
          }
          return renderMessageBubble(item.msg);
        })}

        {regularMessages.length === 0 && pinnedMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-gray-600">
            <svg className="w-14 h-14 mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-sm font-bold">No messages yet</p>
            <p className="text-xs text-gray-600 mt-0.5">Send the first message to start the conversation</p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t flex-shrink-0 px-3 md:px-4 py-3" style={{ borderColor: 'var(--glass-border)', background: 'var(--nav-bg)' }}>
        {recording ? (
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-red-400 font-bold text-xs">Recording... {audioDuration}s</span>
              <div className="flex-1 h-1 rounded-full bg-red-500/20 overflow-hidden max-w-[120px]">
                <div className="h-full bg-red-500 rounded-full animate-pulse" style={{ width: `${Math.min(100, (audioDuration / 60) * 100)}%` }} />
              </div>
            </div>
            <button onClick={stopRecording} className="px-5 py-2.5 rounded-xl bg-red-500 text-white font-bold text-xs hover:bg-red-600 transition-all shadow-lg">
              Stop
            </button>
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                rows={1}
                className="w-full bg-gray-900/70 border border-gray-700 rounded-xl py-2.5 px-3.5 pr-10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 resize-none transition-all"
                style={{ minHeight: '40px', maxHeight: '100px' }}
              />
            </div>
            <button
              onClick={startRecording}
              className="w-10 h-10 rounded-xl flex items-center justify-center bg-gray-800 text-gray-400 hover:text-rose-400 hover:bg-gray-700 transition-all border border-gray-700/50 flex-shrink-0"
              title="Record voice"
            >
              <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>
            <button
              onClick={sendTextMessage}
              disabled={!input.trim() || sending}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all flex-shrink-0 ${
                input.trim() && !sending
                  ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-600/20'
                  : 'bg-gray-800 text-gray-600 cursor-not-allowed'
              }`}
            >
              {sending ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m0 0l-7 7m7-7l7 7" />
                </svg>
              )}
            </button>
          </div>
        )}
      </div>

      {contextMsg && (
        <div
          ref={contextRef}
          className="fixed z-50 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl py-1 min-w-[160px]"
          style={{ left: contextPos.x, top: contextPos.y }}
        >
          <button
            onClick={() => openMessageInfo(contextMsg)}
            className="w-full text-left px-4 py-2 text-xs font-bold text-gray-300 hover:bg-gray-800 hover:text-white transition-colors flex items-center gap-2"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Message Info
          </button>
          {isAdmin && !isOwnMessage(contextMsg) && (
            <>
              <button onClick={() => togglePin(contextMsg)} className="w-full text-left px-4 py-2 text-xs font-bold text-gray-300 hover:bg-gray-800 hover:text-white transition-colors flex items-center gap-2">
                <span className="text-xs">📌</span>
                {contextMsg.isPinned ? 'Unpin Message' : 'Pin Message'}
              </button>
              <button onClick={() => deleteMsg(contextMsg)} className="w-full text-left px-4 py-2 text-xs font-bold text-red-400 hover:bg-gray-800 hover:text-red-300 transition-colors flex items-center gap-2">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete Message
              </button>
            </>
          )}
        </div>
      )}

      {infoMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setInfoMsg(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <h2 className="text-sm font-black text-white">Message Info</h2>
              <button onClick={() => setInfoMsg(null)} className="text-gray-500 hover:text-white text-lg leading-none">&times;</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-black text-transparent bg-clip-text bg-gradient-to-r ${getRoleColor(infoMsg.senderRole)}`}>
                    {infoMsg.senderName}
                  </span>
                  <span className="text-[10px] text-gray-500">{infoMsg.senderRole?.replace(/_/g, ' ')}</span>
                  {infoMsg.senderBranch && <span className="text-[10px] text-gray-600">· {infoMsg.senderBranch}</span>}
                </div>
                {infoMsg.message && (
                  <div className="text-sm text-gray-300 bg-gray-800/50 rounded-xl px-3 py-2">{infoMsg.message}</div>
                )}
                {infoMsg.voiceUrl && (
                  <audio controls src={infoMsg.voiceUrl} className="w-full h-9" style={{ filter: 'invert(0.85)' }} />
                )}
              </div>

              <div className="border-t border-gray-800 pt-3 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-bold text-gray-400">Sent</span>
                  <span className="text-[11px] text-gray-500">{formatFullDateTime(infoMsg.createdAt)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-bold text-gray-400">Delivered</span>
                  <span className="text-[11px] text-gray-500">{infoMsg.deliveredAt ? formatFullDateTime(infoMsg.deliveredAt) : '—'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-bold text-gray-400">Read</span>
                  <span className="text-[11px] text-gray-500">{infoMsg.readAt ? formatFullDateTime(infoMsg.readAt) : '—'}</span>
                </div>
                {infoMsg.voiceUrl && (
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-bold text-gray-400">Played</span>
                    <span className="text-[11px] text-gray-500">{infoMsg.playedAt ? formatFullDateTime(infoMsg.playedAt) : '—'}</span>
                  </div>
                )}
              </div>

              <div className="border-t border-gray-800 pt-3">
                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Receipts ({infoReceipts.length})</h3>
                {infoLoading ? (
                  <div className="flex justify-center py-3">
                    <div className="w-4 h-4 border-2 border-gray-600 border-t-gray-300 rounded-full animate-spin" />
                  </div>
                ) : infoReceipts.length === 0 ? (
                  <p className="text-[11px] text-gray-600">No receipts yet</p>
                ) : (
                  <div className="space-y-1.5">
                    {infoReceipts.map(r => (
                      <div key={r.id} className="flex items-center justify-between bg-gray-800/40 rounded-lg px-3 py-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[11px] font-bold text-white truncate">{r.userName}</span>
                          <span className="text-[9px] text-gray-500 truncate">{r.userRole?.replace(/_/g, ' ')}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                            r.status === 'played' ? 'bg-green-500/20 text-green-400' :
                            r.status === 'read' ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-600/30 text-gray-400'
                          }`}>
                            {r.status === 'played' ? '♪ Played' : r.status === 'read' ? '✓✓ Read' : '✓ Delivered'}
                          </span>
                          <span className="text-[9px] text-gray-600">{formatTime(r.timestamp)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatPage;
