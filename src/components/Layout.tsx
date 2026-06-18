import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { LayoutDashboard, MessageSquare, Map as MapIcon, Settings, LogOut, BarChart2, X, Layers, CheckSquare, Send, Maximize2, Paperclip, CalendarDays } from 'lucide-react';
import { type Language, t } from '../lib/i18n';

interface AuthUser {
  id: number;
  email: string | null;
  phone_number?: string | null;
  first_name: string | null;
  last_name: string | null;
  role: string;
  language?: string;
}

interface LayoutProps {
  children: React.ReactNode;
  currentView: string;
  onNavigate: (view: string) => void;
  user: AuthUser;
  onLogout: () => void;
}

type MiniMode = 'chat' | 'voice' | 'camera';

interface ChatMsg {
  role: 'user' | 'ai';
  text: string;
  image?: string;
  streaming?: boolean;
}

// ── Mini Chat Panel ────────────────────────────────────────────────────────────
function MiniChatPanel({
  lang,
  initialMode,
  onExpand,
  onClose,
}: {
  lang: Language;
  initialMode: MiniMode;
  onExpand: () => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<MiniMode>(initialMode);
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: 'ai', text: lang === 'sw' ? 'Habari! 🌱 Niulize chochote kuhusu shamba lako.' : 'Habari! 🌱 Ask me anything about your farm.' },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const conversationIdRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync mode when the strip buttons switch between chat/voice/camera
  useEffect(() => { setMode(initialMode); }, [initialMode]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const compressImage = (dataUrl: string): Promise<string> =>
    new Promise((resolve) => {
      let settled = false;
      const done = (r: string) => { if (!settled) { settled = true; resolve(r); } };
      setTimeout(() => done(dataUrl), 8000);
      const img = new Image();
      img.onload = () => {
        try {
          const MAX = 1024;
          let { width, height } = img;
          if (width > MAX || height > MAX) {
            if (width > height) { height = Math.round((height / width) * MAX); width = MAX; }
            else { width = Math.round((width / height) * MAX); height = MAX; }
          }
          const c = document.createElement('canvas');
          c.width = width; c.height = height;
          const ctx = c.getContext('2d');
          if (!ctx) { done(dataUrl); return; }
          ctx.drawImage(img, 0, 0, width, height);
          done(c.toDataURL('image/jpeg', 0.8));
        } catch { done(dataUrl); }
      };
      img.onerror = () => done(dataUrl);
      img.src = dataUrl;
    });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onloadend = () => setAttachedImage(reader.result as string);
    reader.readAsDataURL(file);
    if (e.target) e.target.value = '';
  };

  const send = async () => {
    const msg = input.trim();
    if (!msg && !attachedImage || sending) return;
    const imageSnapshot = attachedImage;
    const messageText = msg || (imageSnapshot ? (lang === 'sw' ? 'Chambua picha hii.' : 'Analyze this image.') : '');
    setInput('');
    setAttachedImage(null);
    setMessages(prev => [...prev, { role: 'user', text: messageText, image: imageSnapshot || undefined }]);
    setSending(true);
    try {
      const body: Record<string, unknown> = { message: messageText, stream: true };
      if (conversationId) body.conversationId = conversationId;
      if (imageSnapshot) {
        const compressed = await compressImage(imageSnapshot);
        body.image = compressed.split(',')[1];
        body.mimeType = 'image/jpeg';
      }

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      const rememberConversation = (id: unknown) => {
        if (!id) return;
        setConversationId(id as number);
        conversationIdRef.current = id as number;
        sessionStorage.setItem('bwana_mini_conv_id', String(id));
      };

      const contentType = res.headers.get('content-type') || '';

      // Non-stream response (older server or error) — fall back to all-at-once.
      if (!contentType.includes('text/event-stream') || !res.body) {
        const data = await res.json().catch(() => ({}));
        rememberConversation(data.conversationId);
        setMessages(prev => [...prev, { role: 'ai', text: data.reply || '...' }]);
        return;
      }

      // Streaming path — type the reply out token-by-token as it arrives.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulated = '';
      let started = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const parsed = JSON.parse(line.slice(6));
            if (parsed.type === 'text' && parsed.content) {
              accumulated += parsed.content;
              if (!started) {
                started = true;
                // Keep `sending` true so the input stays locked until the stream
                // ends; the dots hide on their own once this streaming message
                // appears, and the caret signals ongoing activity.
                setMessages(prev => [...prev, { role: 'ai', text: accumulated, streaming: true }]);
              } else {
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: 'ai', text: accumulated, streaming: true };
                  return updated;
                });
              }
            } else if (parsed.type === 'error' && !started) {
              started = true;
              setMessages(prev => [...prev, { role: 'ai', text: parsed.message || (lang === 'sw' ? 'Samahani, jaribu tena.' : 'Sorry, please try again.') }]);
            } else if ((parsed.type === 'start' || parsed.type === 'done') && parsed.conversationId) {
              rememberConversation(parsed.conversationId);
            }
          } catch { /* ignore malformed SSE lines */ }
        }
      }

      if (started) {
        // Drop the streaming flag so the message renders as formatted markdown.
        setMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === 'ai') updated[updated.length - 1] = { role: 'ai', text: last.text };
          return updated;
        });
      } else {
        setMessages(prev => [...prev, { role: 'ai', text: '...' }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: 'ai', text: lang === 'sw' ? 'Samahani, jaribu tena.' : 'Sorry, please try again.' }]);
    }
    setSending(false);
  };

  const modes: { id: MiniMode; label: string; icon: string }[] = [
    { id: 'chat',   label: lang === 'sw' ? 'Maandishi' : 'Chat',  icon: '💬' },
    { id: 'voice',  label: lang === 'sw' ? 'Sauti'     : 'Voice', icon: '🎤' },
    { id: 'camera', label: lang === 'sw' ? 'Kamera'    : 'Camera',icon: '📷' },
  ];

  return (
    <div
      style={{
        background: 'rgba(0,15,6,0.97)',
        backdropFilter: 'blur(20px)',
        borderRadius: '20px 20px 0 0',
        border: '1px solid rgba(255,232,107,0.12)',
        borderBottom: 'none',
        display: 'flex',
        flexDirection: 'column',
        height: 380,
        overflow: 'hidden',
        boxShadow: '0 -12px 40px rgba(0,0,0,0.5)',
      }}
    >
      <style>{`
        @keyframes cursorBlink { 0%,100% { opacity:1; } 50% { opacity:0; } }
        .mini-md > :first-child { margin-top: 0; }
        .mini-md > :last-child { margin-bottom: 0; }
        .mini-md p { margin: 0 0 6px; }
        .mini-md ul, .mini-md ol { margin: 4px 0 6px; padding-left: 18px; }
        .mini-md li { margin: 2px 0; }
        .mini-md li::marker { color: rgba(255,255,255,0.55); }
        .mini-md strong { font-weight: 700; color: #fff; }
        .mini-md em { font-style: italic; }
        .mini-md a { color: #ffe86b; text-decoration: underline; }
        .mini-md h1, .mini-md h2, .mini-md h3, .mini-md h4 { font-size: 12px; font-weight: 700; margin: 8px 0 4px; color: #fff; }
        .mini-md code { background: rgba(255,255,255,0.14); padding: 1px 4px; border-radius: 4px; }
        .mini-md pre { background: rgba(0,0,0,0.3); padding: 8px; border-radius: 8px; overflow-x: auto; margin: 4px 0 6px; }
        .mini-md pre code { background: none; padding: 0; }
      `}</style>
      {/* Header */}
      <div style={{
        padding: '12px 14px 0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: 4, background: '#ffe86b', display: 'inline-block', animation: 'pulse 2s infinite' }} />
          <span style={{ color: 'white', fontFamily: "'Instrument Sans',sans-serif", fontWeight: 800, fontSize: 13 }}>
            BwanaShamba AI
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {/* Expand to full screen */}
          <button
            onClick={() => {
              if (conversationIdRef.current) {
                sessionStorage.setItem('bwana_mini_conv_id', String(conversationIdRef.current));
              }
              onExpand();
            }}
            title="Open full screen"
            style={{
              background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 8,
              width: 30, height: 30, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.6)',
            }}
          >
            <Maximize2 size={13} />
          </button>
          {/* Close */}
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 8,
              width: 30, height: 30, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.6)',
            }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Mode tabs */}
      <div style={{ display: 'flex', gap: 6, padding: '10px 14px 0', flexShrink: 0 }}>
        {modes.map(m => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            style={{
              flex: 1, padding: '7px 0', borderRadius: 10, cursor: 'pointer',
              background: mode === m.id ? 'rgba(255,232,107,0.15)' : 'rgba(255,255,255,0.05)',
              border: mode === m.id ? '1px solid rgba(255,232,107,0.3)' : '1px solid rgba(255,255,255,0.06)',
              color: mode === m.id ? '#ffe86b' : 'rgba(255,255,255,0.4)',
              fontFamily: "'Instrument Sans',sans-serif", fontWeight: 700, fontSize: 11,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              transition: 'all 0.15s',
            }}
          >
            <span style={{ fontSize: 15 }}>{m.icon}</span>
            {m.label}
          </button>
        ))}
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '10px 0 0', flexShrink: 0 }} />

      {/* ── CHAT mode ── */}
      {mode === 'chat' && (
        <>
          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', gap: 7, alignItems: 'flex-end' }}>
                {m.role === 'ai' && (
                  <div style={{ width: 24, height: 24, borderRadius: 8, background: '#002c11', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginBottom: 2 }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ffe86b" strokeWidth="2.5"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                  </div>
                )}
                <div style={{ maxWidth: '80%', display: 'flex', flexDirection: 'column', gap: 4, alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  {m.image && (
                    <img
                      src={m.image}
                      alt="Attached"
                      style={{ maxWidth: 180, borderRadius: 10, display: 'block', border: '1px solid rgba(255,255,255,0.1)' }}
                    />
                  )}
                  {m.text && (
                    <div style={{
                      padding: '8px 11px',
                      borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                      background: m.role === 'user' ? '#002c11' : 'rgba(255,255,255,0.07)',
                      color: m.role === 'user' ? 'white' : 'rgba(255,255,255,0.88)',
                      fontSize: 12, lineHeight: 1.5,
                      border: m.role === 'ai' ? '1px solid rgba(255,255,255,0.07)' : 'none',
                      whiteSpace: m.role === 'ai' && !m.streaming ? 'normal' : 'pre-wrap',
                    }}>
                      {m.role === 'ai' && !m.streaming ? (
                        <div className="mini-md">
                          <ReactMarkdown>{m.text}</ReactMarkdown>
                        </div>
                      ) : (
                        <>
                          {m.text}
                          {m.streaming && (
                            <span
                              aria-hidden="true"
                              style={{
                                display: 'inline-block',
                                width: 6, height: 12, marginLeft: 2,
                                verticalAlign: 'text-bottom',
                                background: 'currentColor',
                                animation: 'cursorBlink 1s steps(2) infinite',
                              }}
                            />
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {sending && !(messages[messages.length - 1]?.role === 'ai' && messages[messages.length - 1]?.streaming) && (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 7 }}>
                <div style={{ width: 24, height: 24, borderRadius: 8, background: '#002c11', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ffe86b" strokeWidth="2.5"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px 14px 14px 4px', padding: '10px 14px', display: 'flex', gap: 4 }}>
                  {[0, 150, 300].map(d => (
                    <span key={d} style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(255,255,255,0.35)', display: 'inline-block', animation: `pulse ${1.2}s ${d}ms infinite` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '8px 12px 14px', flexShrink: 0, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            {/* Attachment preview chip */}
            {attachedImage && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '5px 8px' }}>
                  <img src={attachedImage} alt="" style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                  <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontFamily: "'Lato',sans-serif" }}>
                    {lang === 'sw' ? 'Picha imeambatishwa' : 'Image attached'}
                  </span>
                  <button
                    onClick={() => setAttachedImage(null)}
                    style={{ width: 16, height: 16, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'rgba(255,255,255,0.6)' }}
                  >
                    <X size={9} />
                  </button>
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
            {/* Attach button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: 38, height: 38, borderRadius: 12, flexShrink: 0,
                background: attachedImage ? 'rgba(255,232,107,0.2)' : 'rgba(255,255,255,0.07)',
                border: attachedImage ? '1px solid rgba(255,232,107,0.4)' : '1px solid rgba(255,255,255,0.1)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: attachedImage ? '#ffe86b' : 'rgba(255,255,255,0.4)',
              }}
            >
              <Paperclip size={14} />
            </button>
            <input type="file" ref={fileInputRef} accept="image/*" style={{ display: 'none' }} onChange={handleFileSelect} />
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              disabled={sending}
              placeholder={attachedImage ? (lang === 'sw' ? 'Ongeza ujumbe (hiari)...' : 'Add a message (optional)…') : (lang === 'sw' ? 'Uliza kuhusu shamba lako...' : 'Ask about your farm…')}
              style={{
                flex: 1, height: 38, borderRadius: 12,
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'white', padding: '0 12px', fontSize: 16,
                outline: 'none', fontFamily: "'Lato',sans-serif",
                opacity: sending ? 0.55 : 1,
              }}
            />
            <button
              onClick={send}
              disabled={(!input.trim() && !attachedImage) || sending}
              style={{
                width: 38, height: 38, borderRadius: 12,
                background: (input.trim() || attachedImage) ? '#ffe86b' : 'rgba(255,232,107,0.15)',
                border: 'none', cursor: (input.trim() || attachedImage) ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                transition: 'background 0.15s',
              }}
            >
              <Send size={14} color={(input.trim() || attachedImage) ? '#002c11' : 'rgba(255,232,107,0.4)'} />
            </button>
            </div>
          </div>
        </>
      )}

      {/* ── VOICE mode ── */}
      {mode === 'voice' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,232,107,0.1)', border: '1px solid rgba(255,232,107,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ffe86b" strokeWidth="2" strokeLinecap="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: 'white', fontFamily: "'Instrument Sans',sans-serif", fontWeight: 800, fontSize: 14, marginBottom: 6 }}>
              {lang === 'sw' ? 'Mazungumzo ya Sauti' : 'Live Voice'}
            </p>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, lineHeight: 1.5 }}>
              {lang === 'sw' ? 'Fungua skrini kamili kwa mazungumzo ya sauti na BwanaShamba.' : 'Open the full screen for live voice conversation with BwanaShamba.'}
            </p>
          </div>
          <button
            onClick={onExpand}
            style={{
              padding: '10px 24px', borderRadius: 12,
              background: '#ffe86b', border: 'none', cursor: 'pointer',
              fontFamily: "'Instrument Sans',sans-serif", fontWeight: 800, fontSize: 13, color: '#002c11',
              display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            <Maximize2 size={14} />
            {lang === 'sw' ? 'Fungua Kamili' : 'Open Full Screen'}
          </button>
        </div>
      )}

      {/* ── CAMERA mode ── */}
      {mode === 'camera' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,232,107,0.1)', border: '1px solid rgba(255,232,107,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ffe86b" strokeWidth="2" strokeLinecap="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: 'white', fontFamily: "'Instrument Sans',sans-serif", fontWeight: 800, fontSize: 14, marginBottom: 6 }}>
              {lang === 'sw' ? 'Skanning ya Kamera' : 'Live Camera Scout'}
            </p>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, lineHeight: 1.5 }}>
              {lang === 'sw' ? 'Piga picha ya mmea wako kwa uchambuzi wa AI. Fungua skrini kamili.' : 'Photo-identify pests, diseases or crop conditions with AI. Open full screen to use.'}
            </p>
          </div>
          <button
            onClick={onExpand}
            style={{
              padding: '10px 24px', borderRadius: 12,
              background: '#ffe86b', border: 'none', cursor: 'pointer',
              fontFamily: "'Instrument Sans',sans-serif", fontWeight: 800, fontSize: 13, color: '#002c11',
              display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            <Maximize2 size={14} />
            {lang === 'sw' ? 'Fungua Kamili' : 'Open Full Screen'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Layout ─────────────────────────────────────────────────────────────────────
export default function Layout({ children, currentView, onNavigate, user, onLogout }: LayoutProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isMiniOpen, setIsMiniOpen] = useState(false);
  const [miniMode, setMiniMode] = useState<MiniMode>('chat');
  const lang: Language = (user.language as Language) || 'en';

  const openMini = (mode: MiniMode) => {
    setMiniMode(mode);
    setIsMiniOpen(true);
  };

  const navItems = [
    { icon: <LayoutDashboard />, label: lang === 'sw' ? 'Muhtasari' : 'Overview', view: 'dashboard' },
    { icon: <Layers />, label: lang === 'sw' ? 'Maeneo' : 'Zones', view: 'zones-detail' },
    { icon: <CheckSquare />, label: lang === 'sw' ? 'Kazi' : 'Tasks', view: 'tasks-detail' },
    { icon: <MessageSquare />, label: lang === 'sw' ? 'Ongea na BwanaShamba' : 'Chat with BwanaShamba', view: 'assistant' },
    { icon: <MapIcon />, label: lang === 'sw' ? 'Ramani' : 'The Farm', view: 'map' },
    { icon: <BarChart2 />,    label: t(lang, 'reports'),                                     view: 'reports'   },
    { icon: <CalendarDays />, label: lang === 'sw' ? 'Mipango ya Mazao' : 'Planning',       view: 'planning'  },
    { icon: <Settings />,    label: t(lang, 'settings'),                                    view: 'settings'  },
  ];

  const displayName = user.first_name
    ? `${user.first_name}${user.last_name ? ' ' + user.last_name : ''}`
    : user.email || user.phone_number || '?';

  const displayEmail = user.email || user.phone_number || '';

  return (
    <div className="min-h-screen bg-[#f9f6f1] flex" style={{ fontFamily: "'Lato', system-ui, sans-serif" }}>

      {/* ══════════════════════════════════════
          MOBILE — Cream top bar + slide-down drawer
      ══════════════════════════════════════ */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-[50]">
        {/* Header bar */}
        <div
          className="flex items-center justify-between px-4"
          style={{ height: 52, background: '#f9f6f1', borderBottom: '1px solid rgba(0,44,17,0.07)' }}
        >
          {/* Logo */}
          <button
            onClick={() => { onNavigate('dashboard'); setIsDrawerOpen(false); }}
            className="flex items-center gap-2"
          >
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#002c11' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffe86b" strokeWidth="2.5">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="font-black text-[15px] text-[#002c11]" style={{ fontFamily: "'Instrument Sans', sans-serif", letterSpacing: '-0.02em' }}>
              BwanaShamba
            </span>
          </button>

          {/* Hamburger / X */}
          <button
            onClick={() => setIsDrawerOpen(o => !o)}
            className="w-11 h-11 rounded-xl flex items-center justify-center transition-colors touch-manipulation"
            style={{ border: '1px solid rgba(0,44,17,0.12)', background: 'transparent' }}
          >
            {isDrawerOpen ? (
              <X className="w-4 h-4 text-[#002c11]" />
            ) : (
              <div className="flex flex-col gap-[5px]">
                <span className="block w-4 h-0.5 bg-[#002c11] rounded-full" />
                <span className="block w-4 h-0.5 bg-[#002c11] rounded-full" />
                <span className="block w-4 h-0.5 bg-[#002c11] rounded-full" />
              </div>
            )}
          </button>
        </div>

        {/* Slide-down drawer nav */}
        <div
          style={{
            background: '#002c11',
            borderRadius: '0 0 20px 20px',
            boxShadow: isDrawerOpen ? '0 12px 32px rgba(0,0,0,0.25)' : 'none',
            maxHeight: isDrawerOpen ? '520px' : '0',
            overflow: 'hidden',
            transition: 'max-height 0.28s cubic-bezier(0.4,0,0.2,1), box-shadow 0.28s ease',
          }}
        >
          <nav className="flex flex-col gap-0.5 p-3 pb-4">
            {navItems.map(item => {
              const active = currentView === item.view;
              return (
                <button
                  key={item.view}
                  onClick={() => { onNavigate(item.view); setIsDrawerOpen(false); }}
                  className="flex items-center gap-3 px-3.5 rounded-xl text-left w-full transition-all"
                  style={{
                    minHeight: 46,
                    background: active ? 'rgba(255,232,107,0.12)' : 'transparent',
                    border: active ? '1px solid rgba(255,232,107,0.2)' : '1px solid transparent',
                    color: active ? '#ffe86b' : 'rgba(255,255,255,0.5)',
                    cursor: 'pointer',
                  }}
                >
                  {React.cloneElement(item.icon as React.ReactElement<{ size?: number; color?: string }>, {
                    size: 18,
                    color: active ? '#ffe86b' : 'rgba(255,255,255,0.4)',
                  })}
                  <span className="font-bold text-sm" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
                    {item.label}
                  </span>
                  {active && <div className="ml-auto w-1.5 h-1.5 rounded-full" style={{ background: '#ffe86b', opacity: 0.7 }} />}
                </button>
              );
            })}

            {/* Divider + user + logout */}
            <div className="mt-1 pt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex items-center gap-2.5 px-3.5 py-2.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black flex-shrink-0" style={{ background: '#035925', color: 'white' }}>
                  {(user.first_name || displayEmail || '?')[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-white truncate">{displayName}</p>
                  <p className="text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.3)' }}>{displayEmail}</p>
                </div>
              </div>
              <button
                onClick={() => { onLogout(); setIsDrawerOpen(false); }}
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl w-full text-left"
                style={{ color: 'rgba(248,113,113,0.7)', border: '1px solid transparent', cursor: 'pointer' }}
              >
                <LogOut size={18} />
                <span className="font-bold text-sm" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
                  {lang === 'sw' ? 'Toka' : 'Log Out'}
                </span>
              </button>
            </div>
          </nav>
        </div>
      </div>

      {/* Overlay — dims content when drawer open */}
      {isDrawerOpen && (
        <div
          className="lg:hidden fixed inset-0 z-[45]"
          style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(2px)', top: 52 }}
          onClick={() => setIsDrawerOpen(false)}
        />
      )}

      {/* ══════════════════════════════════════
          DESKTOP — Persistent dark sidebar
      ══════════════════════════════════════ */}
      <aside className="hidden lg:flex flex-col w-[240px] flex-shrink-0 bg-[#002c11] sticky top-0 h-screen">
        <button
          onClick={() => onNavigate('dashboard')}
          className="w-full p-5 flex items-center gap-3 text-left transition-colors hover:bg-white/[0.04]"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
        >
          <div className="w-9 h-9 bg-[#035925] rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="#ffe86b" strokeWidth={2}>
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <div>
            <span className="text-sm font-bold text-white block" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>BwanaShamba</span>
            <span className="text-[9px] text-[#fc8e44] font-bold tracking-[0.15em] uppercase">Dashboard</span>
          </div>
        </button>

        <nav className="flex-1 px-3 pt-4 space-y-0.5">
          {navItems.map(item => {
            const active = currentView === item.view;
            return (
              <button
                key={item.view}
                onClick={() => onNavigate(item.view)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all ${
                  active ? 'bg-[#035925] text-white' : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'
                }`}
              >
                {React.cloneElement(item.icon as React.ReactElement<{ size?: number }>, { size: 17 })}
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-3 space-y-2" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-2.5 p-2">
            <div className="w-8 h-8 rounded-lg bg-[#035925] flex items-center justify-center text-white text-[10px] font-black flex-shrink-0">
              {(user.first_name || displayEmail || '?')[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-white truncate">{displayName}</p>
              <p className="text-[10px] text-white/30 truncate">{displayEmail}</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-medium text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-all"
          >
            <LogOut size={14} />
            {lang === 'sw' ? 'Toka' : 'Log Out'}
          </button>
        </div>
      </aside>

      {/* ══════════════════════════════════════
          MAIN CONTENT
      ══════════════════════════════════════ */}
      <main className={`flex-1 pt-[52px] lg:pt-0 ${currentView === 'assistant' ? 'overflow-hidden' : 'overflow-auto'}`}>
        {children}
      </main>

      {/* ══════════════════════════════════════
          FLOATING AI STRIP + MINI PANEL
          Hidden on assistant view
      ══════════════════════════════════════ */}
      {currentView !== 'assistant' && (
        <div
          className="fixed z-50 lg:left-[252px] left-3 right-3"
          style={{ bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))' }}
        >
          {/* ── Mini Chat Panel (slides up above the strip) ── */}
          <div
            style={{
              marginBottom: isMiniOpen ? 8 : 0,
              maxHeight: isMiniOpen ? '420px' : '0',
              overflow: 'hidden',
              transition: 'max-height 0.3s cubic-bezier(0.4,0,0.2,1), margin-bottom 0.3s ease',
            }}
          >
            <MiniChatPanel
              lang={lang}
              initialMode={miniMode}
              onExpand={() => { setIsMiniOpen(false); onNavigate('assistant'); }}
              onClose={() => setIsMiniOpen(false)}
            />
          </div>

          {/* ── The strip itself ── */}
          <div
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl"
            style={{
              background: 'linear-gradient(135deg, #002c11, #035925)',
              boxShadow: '0 8px 24px rgba(0,44,17,0.38)',
              border: '1px solid rgba(255,232,107,0.15)',
            }}
          >
            {/* Label — tapping opens chat mode */}
            <button
              onClick={() => isMiniOpen && miniMode === 'chat' ? setIsMiniOpen(false) : openMini('chat')}
              className="flex-1 text-left"
            >
              <p className="text-white text-[13px] font-black" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
                {lang === 'sw' ? 'Ongea na BwanaShamba' : 'Chat with BwanaShamba'}
              </p>
            </button>

            {/* Camera */}
            <button
              onClick={() => isMiniOpen && miniMode === 'camera' ? setIsMiniOpen(false) : openMini('camera')}
              title="Camera scout"
              className="w-11 h-11 rounded-xl flex items-center justify-center transition-colors hover:bg-white/20 touch-manipulation"
              style={{
                background: isMiniOpen && miniMode === 'camera' ? 'rgba(255,232,107,0.3)' : 'rgba(255,232,107,0.13)',
                border: '1px solid rgba(255,232,107,0.2)',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffe86b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </button>

            {/* Microphone */}
            <button
              onClick={() => isMiniOpen && miniMode === 'voice' ? setIsMiniOpen(false) : openMini('voice')}
              title="Voice assistant"
              className="w-11 h-11 rounded-xl flex items-center justify-center transition-colors hover:bg-white/20 touch-manipulation"
              style={{
                background: isMiniOpen && miniMode === 'voice' ? 'rgba(255,232,107,0.3)' : 'rgba(255,232,107,0.13)',
                border: '1px solid rgba(255,232,107,0.2)',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffe86b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
            </button>

            {/* Chat bubble */}
            <button
              onClick={() => isMiniOpen && miniMode === 'chat' ? setIsMiniOpen(false) : openMini('chat')}
              title="Text chat"
              className="w-11 h-11 rounded-xl flex items-center justify-center transition-colors hover:bg-white/20 touch-manipulation"
              style={{
                background: isMiniOpen && miniMode === 'chat' ? 'rgba(255,232,107,0.3)' : 'rgba(255,232,107,0.13)',
                border: '1px solid rgba(255,232,107,0.2)',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffe86b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
