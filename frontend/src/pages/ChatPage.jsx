import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import socket from '../socket';

const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN'];

const getUserBranch = (user) => {
  const role = String(user?.role || '').toUpperCase();
  const name = String(user?.name || '');
  if (role === 'OUTLET') {
    const n = name.toLowerCase();
    if (n.includes('johar') || name.includes('1')) return 'Johar Town';
    if (n.includes('jail') || name.includes('2')) return 'Jail Road';
    if (n.includes('abbottabad') || name.includes('3')) return 'Abbottabad';
    return name;
  }
  if (['STORE', 'PRODUCTION', 'LOGO_DESIGN', 'DISPATCH', 'OUT_FOR_DELIVERY', 'DELIVERY_BOY'].includes(role)) return 'Factory';
  if (role === 'FAISAL') return 'Online Orders';
  if (['ORDER_ENTRY', 'ADMIN', 'SUPER_ADMIN'].includes(role)) return 'Head Office';
  return '';
};

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

const ChatPage = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [audioDuration, setAudioDuration] = useState(0);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);

  const isAdmin = ADMIN_ROLES.includes((user?.role || '').toUpperCase());

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
  }, []);

  useEffect(() => {
    fetchMessages();
    sessionStorage.setItem('chatUnread', '0');
  }, []);

  useEffect(() => {
    const handleNewMessage = (msg) => {
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev;
        const updated = [...prev, msg];
        updated.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        return updated;
      });
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      });
    };

    const handlePinUpdate = (msg) => {
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, isPinned: msg.isPinned } : m));
    };

    const handleDelete = ({ id }) => {
      setMessages(prev => prev.filter(m => m.id !== id));
    };

    socket.on('chat:new-message', handleNewMessage);
    socket.on('chat:message-pinned', handlePinUpdate);
    socket.on('chat:message-deleted', handleDelete);

    return () => {
      socket.off('chat:new-message', handleNewMessage);
      socket.off('chat:message-pinned', handlePinUpdate);
      socket.off('chat:message-deleted', handleDelete);
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const fetchMessages = async () => {
    try {
      const res = await api.get('/api/chat/messages?limit=100');
      setMessages(res.data.messages || []);
    } catch (err) {
      console.error('Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const sendTextMessage = async () => {
    if (!input.trim()) return;
    const text = input.trim();
    setInput('');
    setSending(true);
    try {
      await api.post('/api/chat/messages', { message: text });
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
      const recorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4' });
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
          const uploadRes = await api.post('/api/chat/voice', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
          await api.post('/api/chat/messages', { voiceUrl: uploadRes.data.url });
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

  const togglePin = async (msg) => {
    try {
      await api.patch(`/api/chat/messages/${msg.id}/pin`);
    } catch (err) {
      console.error('Failed to toggle pin');
    }
  };

  const deleteMsg = async (msg) => {
    if (!window.confirm('Delete this message?')) return;
    try {
      await api.delete(`/api/chat/messages/${msg.id}`);
    } catch (err) {
      console.error('Failed to delete message');
    }
  };

  const formatTime = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const pinnedMessages = messages.filter(m => m.isPinned);
  const regularMessages = messages.filter(m => !m.isPinned);

  const isOwnMessage = (msg) => msg.senderId === user?.id;

  const renderMessage = (msg) => {
    const own = isOwnMessage(msg);
    return (
      <div key={msg.id} className={`flex ${own ? 'justify-end' : 'justify-start'} group`}>
        <div className={`max-w-[75%] min-w-[180px] ${own ? 'order-1' : 'order-1'}`}>
          {!own && (
            <div className="flex items-center gap-2 mb-1 px-1">
              <span className={`text-xs font-black text-transparent bg-clip-text bg-gradient-to-r ${getRoleColor(msg.senderRole)}`}>
                {msg.senderName}
              </span>
              <span className="text-[10px] font-bold text-gray-500">({msg.senderRole?.replace('_', ' ')})</span>
              {msg.senderBranch && <span className="text-[10px] text-gray-600">{msg.senderBranch}</span>}
            </div>
          )}
          <div className={`relative rounded-2xl px-4 py-2.5 shadow-lg ${
            own ? 'bg-blue-600 text-white rounded-br-md' : 'bg-gray-800 text-gray-200 rounded-bl-md border border-gray-700/50'
          }`}>
            {own && (
              <div className="flex items-center gap-2 mb-1 justify-end">
                <span className="text-[10px] font-bold text-blue-200">({msg.senderRole?.replace('_', ' ')})</span>
                {msg.senderBranch && <span className="text-[10px] text-blue-300">{msg.senderBranch}</span>}
              </div>
            )}
            {msg.message && <div className="text-sm whitespace-pre-wrap break-words">{msg.message}</div>}
            {msg.voiceUrl && (
              <audio controls src={msg.voiceUrl} className="w-full max-w-[240px] h-10 mt-1" style={{ filter: 'invert(0.85)' }} />
            )}
            <div className={`flex items-center gap-2 mt-1 ${own ? 'justify-end' : 'justify-start'}`}>
              <span className={`text-[10px] ${own ? 'text-blue-200' : 'text-gray-500'}`}>{formatTime(msg.createdAt)}</span>
              {msg.isPinned && <span className="text-[10px]">📌</span>}
            </div>
            {isAdmin && !own && (
              <div className="absolute -top-2 -right-2 hidden group-hover:flex gap-1">
                <button onClick={() => togglePin(msg)} className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shadow-lg transition-all ${msg.isPinned ? 'bg-yellow-500 text-white' : 'bg-gray-600 text-gray-300 hover:bg-yellow-500 hover:text-white'}`} title={msg.isPinned ? 'Unpin' : 'Pin'}>
                  📌
                </button>
                <button onClick={() => deleteMsg(msg)} className="w-6 h-6 rounded-full bg-red-500/80 flex items-center justify-center text-[10px] font-bold text-white shadow-lg hover:bg-red-500 transition-all" title="Delete">
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
      <div className="flex items-center gap-3 px-6 py-4 border-b flex-shrink-0" style={{ borderColor: 'var(--glass-border)', background: 'var(--nav-bg)' }}>
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <div>
          <h1 className="text-lg font-black text-white">Team Chat</h1>
          <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
            {messages.length} messages · {pinnedMessages.length} pinned
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={fetchMessages} className="text-xs font-bold px-3 py-1.5 rounded-xl bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition-all">
            Refresh
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-4 md:px-6 py-4 space-y-4">
        {pinnedMessages.length > 0 && (
          <div className="mb-4 p-3 rounded-2xl border border-yellow-500/30" style={{ background: 'rgba(234,179,8,0.06)' }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-yellow-500 text-xs">📌</span>
              <span className="text-[10px] font-bold text-yellow-500 uppercase tracking-wider">Pinned Messages</span>
            </div>
            <div className="space-y-2">
              {pinnedMessages.map(renderMessage)}
            </div>
          </div>
        )}

        {regularMessages.map(renderMessage)}

        {regularMessages.length === 0 && pinnedMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-gray-600">
            <svg className="w-16 h-16 mb-4 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-sm font-bold">No messages yet</p>
            <p className="text-xs text-gray-600 mt-1">Send the first message to start the conversation</p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t flex-shrink-0 px-4 md:px-6 py-4" style={{ borderColor: 'var(--glass-border)', background: 'var(--nav-bg)' }}>
        {recording ? (
          <div className="flex items-center gap-3">
            <div className="flex-1 flex items-center gap-3 px-4 py-3 rounded-2xl bg-red-500/10 border border-red-500/30">
              <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
              <span className="text-red-400 font-bold text-sm">Recording... {audioDuration}s</span>
              <div className="flex-1 h-1 rounded-full bg-red-500/20 overflow-hidden">
                <div className="h-full bg-red-500 rounded-full animate-pulse" style={{ width: `${Math.min(100, (audioDuration / 60) * 100)}%` }} />
              </div>
            </div>
            <button onClick={stopRecording} className="px-6 py-3 rounded-2xl bg-red-500 text-white font-bold text-sm hover:bg-red-600 transition-all shadow-lg">
              Stop
            </button>
          </div>
        ) : (
          <div className="flex items-end gap-3">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message..."
                rows={1}
                className="w-full bg-gray-900/70 border border-gray-700 rounded-2xl py-3 px-4 pr-12 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 resize-none transition-all"
                style={{ minHeight: '44px', maxHeight: '120px' }}
              />
            </div>
            <button
              onClick={startRecording}
              className="w-11 h-11 rounded-2xl flex items-center justify-center bg-gray-800 text-gray-400 hover:text-rose-400 hover:bg-gray-700 transition-all border border-gray-700/50"
              title="Record voice"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>
            <button
              onClick={sendTextMessage}
              disabled={!input.trim() || sending}
              className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all ${
                input.trim() && !sending
                  ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-600/20'
                  : 'bg-gray-800 text-gray-600 cursor-not-allowed'
              }`}
            >
              {sending ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m0 0l-7 7m7-7l7 7" />
                </svg>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatPage;
