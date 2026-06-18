import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, Upload, Loader2, Mic, Square, Send, ArrowUp, Paperclip, X, Volume2, Image as ImageIcon, Plus, MessageSquare, Trash2, ChevronLeft, ChevronRight, SwitchCamera } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

function base64ToFloat32(base64: string): Float32Array {
  const binaryString = window.atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) { bytes[i] = binaryString.charCodeAt(i); }
  const int16Array = new Int16Array(bytes.buffer);
  const float32Array = new Float32Array(int16Array.length);
  for (let i = 0; i < int16Array.length; i++) { float32Array[i] = int16Array[i] / 32768.0; }
  return float32Array;
}

function float32ToBase64(float32Array: Float32Array): string {
  const int16Array = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  const bytes = new Uint8Array(int16Array.buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) { binary += String.fromCharCode(bytes[i]); }
  return window.btoa(binary);
}

function downsample(buffer: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return buffer;
  const ratio = fromRate / toRate;
  const newLength = Math.round(buffer.length / ratio);
  const result = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) { result[i] = buffer[Math.round(i * ratio)]; }
  return result;
}

interface Conversation {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
}

export default function LiveScout({
  initialMessage,
  onInitialMessageConsumed,
}: {
  initialMessage?: string;
  onInitialMessageConsumed?: () => void;
} = {}) {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isLiveVoice, setIsLiveVoice] = useState(false);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [uploadedMedia, setUploadedMedia] = useState<string | null>(null);
  const [uploadedMediaType, setUploadedMediaType] = useState<'image' | 'video'>('image');
  const [messages, setMessages] = useState<{role: string, text: string, image?: string}[]>([]);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const activeConversationIdRef = useRef<number | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const uploadedVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const liveWsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const frameIntervalRef = useRef<any>(null);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const isAiSpeakingRef = useRef(false);
  const sessionReadyRef = useRef(false);

  const isLiveVoiceRef = useRef(false);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const isCameraActiveRef = useRef(false);
  const speechRecognitionRef = useRef<any>(null);
  const aiJustFinishedRef = useRef(false);
  const keepaliveIntervalRef = useRef<any>(null);
  const audioWorkletNodeRef = useRef<AudioWorkletNode | null>(null);
  const reconnectAttemptsRef = useRef(0);

  useEffect(() => { isLiveVoiceRef.current = isLiveVoice; }, [isLiveVoice]);
  useEffect(() => { mediaStreamRef.current = mediaStream; }, [mediaStream]);
  useEffect(() => { isCameraActiveRef.current = isCameraActive; }, [isCameraActive]);

  useEffect(() => {
    if (videoRef.current && mediaStream) {
      videoRef.current.srcObject = mediaStream;
    }
  }, [mediaStream]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    return () => {
      if (keepaliveIntervalRef.current) { clearInterval(keepaliveIntervalRef.current); keepaliveIntervalRef.current = null; }
      if (isLiveVoiceRef.current) {
        if (audioWorkletNodeRef.current) { try { audioWorkletNodeRef.current.disconnect(); } catch {} audioWorkletNodeRef.current = null; }
        if (processorRef.current) { processorRef.current.disconnect(); processorRef.current = null; }
        if (audioStreamRef.current) { audioStreamRef.current.getTracks().forEach(t => t.stop()); audioStreamRef.current = null; }
        if (frameIntervalRef.current) { clearInterval(frameIntervalRef.current); frameIntervalRef.current = null; }
        if (liveWsRef.current) { try { liveWsRef.current.close(); } catch {} liveWsRef.current = null; }
      }
      if (mediaStreamRef.current) { mediaStreamRef.current.getTracks().forEach(t => t.stop()); }
    };
  }, []);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    if (!inputText) {
      // Empty — slim single line, hide overflow so placeholder doesn't wrap visibly
      ta.style.height = '36px';
      ta.style.overflowY = 'hidden';
    } else {
      // Has content — grow to fit, enable scroll at max height
      ta.style.overflowY = 'hidden';
      ta.style.height = 'auto';
      const next = Math.min(ta.scrollHeight, 160);
      ta.style.height = next + 'px';
      ta.style.overflowY = next >= 160 ? 'auto' : 'hidden';
    }
  }, [inputText]);

  useEffect(() => {
    const miniConvId = sessionStorage.getItem('bwana_mini_conv_id');
    if (miniConvId) {
      sessionStorage.removeItem('bwana_mini_conv_id');
      loadConversation(Number(miniConvId));
    }
    loadConversations();
  }, []);

  // Auto-send a pre-filled message (e.g. from "Learn more" on a recommendation)
  useEffect(() => {
    if (!initialMessage) return;
    const timer = setTimeout(() => {
      handleSendTextRef.current(initialMessage);
      onInitialMessageConsumed?.();
    }, 400);
    return () => clearTimeout(timer);
  }, [initialMessage]);

  const loadConversations = async () => {
    try {
      const res = await fetch('/api/chat/conversations', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  };

  const loadConversation = async (convId: number) => {
    try {
      const res = await fetch(`/api/chat/conversations/${convId}/messages`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const loadedMessages = data
          .filter((m: any) => m.role !== 'system')
          .map((m: any) => ({
            role: m.role,
            text: m.text,
            image: m.image_url || undefined
          }));
        setMessages(loadedMessages);
        activeConversationIdRef.current = convId;
        setActiveConversationId(convId);
      }
    } catch (err) {
      console.error('Failed to load conversation:', err);
    }
  };

  const startNewConversation = () => {
    activeConversationIdRef.current = null;
    setActiveConversationId(null);
    setMessages([]);
    setInputText('');
    setUploadedMedia(null);
    setIsSidebarOpen(false);
    loadConversations();
  };

  const deleteConversation = async (convId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/chat/conversations/${convId}`, { method: 'DELETE', credentials: 'include' });
      if (activeConversationId === convId) {
        startNewConversation();
      }
      loadConversations();
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  };

  const stopAiAudio = () => {
    activeSourcesRef.current.forEach(source => {
      try { source.stop(); } catch {}
    });
    activeSourcesRef.current = [];
    isAiSpeakingRef.current = false;
    if (audioContextRef.current) {
      nextPlayTimeRef.current = audioContextRef.current.currentTime;
    }
  };

  const startCameraWithMode = async (mode: 'environment' | 'user') => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: mode } }
      });
      setMediaStream(stream);
      setIsCameraActive(true);
      setUploadedMedia(null);
      setFacingMode(mode);
    } catch {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        setMediaStream(stream);
        setIsCameraActive(true);
        setUploadedMedia(null);
      } catch (err: any) {
        console.error(err);
        alert(`Camera access error: ${err.message || 'Denied or unavailable.'}`);
      }
    }
  };

  const toggleCamera = async () => {
    if (isCameraActive) {
      if (mediaStream) {
        mediaStream.getTracks().forEach(t => t.stop());
        setMediaStream(null);
      }
      if (videoRef.current) videoRef.current.srcObject = null;
      setIsCameraActive(false);
    } else {
      await startCameraWithMode(facingMode);
    }
  };

  const flipCamera = async () => {
    if (mediaStream) {
      mediaStream.getTracks().forEach(t => t.stop());
    }
    const newMode = facingMode === 'environment' ? 'user' : 'environment';
    await startCameraWithMode(newMode);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (isCameraActive) toggleCamera();
      const isVideo = file.type.startsWith('video/');
      setUploadedMediaType(isVideo ? 'video' : 'image');
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        setUploadedMedia(dataUrl);
      };
      reader.readAsDataURL(file);
    }
    if (e.target) e.target.value = '';
  };

  const extractVideoFrame = useCallback((): string | undefined => {
    if (uploadedVideoRef.current && canvasRef.current) {
      const video = uploadedVideoRef.current;
      const ctx = canvasRef.current.getContext('2d');
      if (ctx && video.videoWidth > 0) {
        canvasRef.current.width = 640;
        canvasRef.current.height = Math.round((video.videoHeight / video.videoWidth) * 640);
        ctx.drawImage(video, 0, 0, canvasRef.current.width, canvasRef.current.height);
        return canvasRef.current.toDataURL('image/jpeg', 0.8).split(',')[1];
      }
    }
    return undefined;
  }, []);

  const captureFrameFromCamera = async (): Promise<string | undefined> => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return undefined;

    if (video.videoWidth > 0) {
      const ctx = canvas.getContext('2d');
      if (!ctx) return undefined;
      canvas.width = 640;
      canvas.height = Math.round((video.videoHeight / video.videoWidth) * 640);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
    }

    return new Promise((resolve) => {
      const check = () => {
        if (video.videoWidth > 0) {
          const ctx = canvas.getContext('2d');
          if (!ctx) { resolve(undefined); return; }
          canvas.width = 640;
          canvas.height = Math.round((video.videoHeight / video.videoWidth) * 640);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.8).split(',')[1]);
        } else {
          resolve(undefined);
        }
      };
      video.addEventListener('loadeddata', check, { once: true });
      setTimeout(() => resolve(undefined), 2000);
    });
  };

  // Compress an image data-URL to JPEG, max 1024px on the longest side, 80% quality.
  // Resolves with the compressed data URL, or the original as fallback.
  // Never hangs: errors inside onload are caught, and a 10 s timeout is the final guard.
  const compressImage = (dataUrl: string): Promise<string> =>
    new Promise((resolve) => {
      let settled = false;
      const done = (result: string) => { if (!settled) { settled = true; resolve(result); } };

      // Safety net: resolve with original after 10 s to prevent infinite hang
      const timer = setTimeout(() => done(dataUrl), 10_000);

      const img = new Image();
      img.onload = () => {
        clearTimeout(timer);
        try {
          const MAX = 1024;
          let { width, height } = img;
          if (width > MAX || height > MAX) {
            if (width > height) { height = Math.round((height / width) * MAX); width = MAX; }
            else { width = Math.round((width / height) * MAX); height = MAX; }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) { done(dataUrl); return; }
          ctx.drawImage(img, 0, 0, width, height);
          done(canvas.toDataURL('image/jpeg', 0.8));
        } catch {
          done(dataUrl); // fallback: use original
        }
      };
      img.onerror = () => { clearTimeout(timer); done(dataUrl); };
      img.src = dataUrl;
    });

  const handleSendText = async (overrideText?: string) => {
    const textToSend = overrideText || inputText;

    // Snapshot state NOW before any async work or state mutations
    const mediaAtSend = uploadedMedia;
    const mediaTypeAtSend = uploadedMediaType;

    if (!textToSend.trim() && !mediaAtSend && !isCameraActive) return;

    const messageText = textToSend.trim()
      || (mediaAtSend ? 'Analyze this image and tell me what you see. Check for pests, diseases, or any issues.' : '');

    const userMsg = {
      role: 'user',
      text: messageText,
      image: mediaAtSend && mediaTypeAtSend === 'image' ? mediaAtSend : undefined,
    };

    // ── Show user message in UI immediately — before any async work ──────────
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setUploadedMedia(null);
    setIsProcessing(true);

    // ── Now resolve image data (async, but UI already updated) ──────────────
    let imageData: string | undefined;
    let mimeType = 'image/jpeg';

    if (mediaAtSend && mediaTypeAtSend === 'image') {
      try {
        const compressed = await compressImage(mediaAtSend);
        imageData = compressed.split(',')[1];
        mimeType = 'image/jpeg';
      } catch {
        // Last-resort: strip the data URL prefix and send raw
        const comma = mediaAtSend.indexOf(',');
        if (comma !== -1) {
          imageData = mediaAtSend.slice(comma + 1);
          mimeType = mediaAtSend.slice(5, mediaAtSend.indexOf(';')) || 'image/jpeg';
        }
      }
    }

    if (mediaAtSend && mediaTypeAtSend === 'video') {
      imageData = extractVideoFrame();
      mimeType = 'image/jpeg';
    }

    if (isCameraActive && !imageData) {
      const capturedFrame = await captureFrameFromCamera();
      if (capturedFrame) {
        imageData = capturedFrame;
        mimeType = 'image/jpeg';
      }
    }

    try {
      const body: any = {
        message: messageText,
        conversationId: activeConversationId,
        stream: true
      };
      if (imageData) {
        body.image = imageData;
        body.mimeType = mimeType;
      }

      const chatRes = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!chatRes.ok) {
        throw new Error(`Server error ${chatRes.status}`);
      }

      const contentType = chatRes.headers.get('content-type') || '';
      if (contentType.includes('text/event-stream') && chatRes.body) {
        setMessages(prev => [...prev, { role: 'ai', text: '' }]);
        const reader = chatRes.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = '';
        let buffer = '';
        let hasError = false;

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const parsed = JSON.parse(line.slice(6));
                  if (parsed.type === 'text') {
                    accumulated += parsed.content;
                    const current = accumulated;
                    setMessages(prev => {
                      const updated = [...prev];
                      updated[updated.length - 1] = { role: 'ai', text: current };
                      return updated;
                    });
                  } else if (parsed.type === 'error') {
                    hasError = true;
                    const errMsg = parsed.message || 'An error occurred while processing your request.';
                    setMessages(prev => {
                      const updated = [...prev];
                      updated[updated.length - 1] = { role: 'system', text: errMsg };
                      return updated;
                    });
                  } else if (parsed.type === 'start' && parsed.conversationId && !activeConversationIdRef.current) {
                    activeConversationIdRef.current = parsed.conversationId;
                    setActiveConversationId(parsed.conversationId);
                  } else if (parsed.type === 'done' && parsed.conversationId && !activeConversationIdRef.current) {
                    activeConversationIdRef.current = parsed.conversationId;
                    setActiveConversationId(parsed.conversationId);
                  }
                } catch { }
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
        if (!hasError && !accumulated) {
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: 'system', text: 'No response received. Please try again.' };
            return updated;
          });
        }
        loadConversations();
      } else {
        const data = await chatRes.json();
        if (data.conversationId && !activeConversationIdRef.current) {
          activeConversationIdRef.current = data.conversationId;
          setActiveConversationId(data.conversationId);
        }
        setMessages(prev => [...prev, { role: 'ai', text: data.reply || '' }]);
        loadConversations();
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'system', text: 'Error connecting to BwanaShamba. Check that your API key is configured.' }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSendTextRef = useRef(handleSendText);
  handleSendTextRef.current = handleSendText;

  // Shared AudioContext — reuse across calls to avoid hitting browser limits
  const audioCtxRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const cleanSpeakText = (text: string) =>
    text
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/#{1,6}\s/g, '')
      .replace(/[-*+]\s/g, '')
      .replace(/\n\n+/g, '. ')
      .replace(/\n/g, ' ')
      .trim();

  // Fallback: browser SpeechSynthesis (robotic but universal)
  const speakWithBrowser = (clean: string, onEnd?: () => void) => {
    if (!window.speechSynthesis) { isAiSpeakingRef.current = false; onEnd?.(); return; }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(clean);
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      const chosen = voices.find(v => v.lang.toLowerCase().startsWith('sw')) ||
                     voices.find(v => v.lang.startsWith('en')) || voices[0];
      utter.voice = chosen;
      utter.lang = chosen.lang;
    }
    utter.rate = 1.0;
    utter.volume = 1.0;
    utter.onend = () => { isAiSpeakingRef.current = false; onEnd?.(); };
    utter.onerror = () => { isAiSpeakingRef.current = false; onEnd?.(); };
    window.speechSynthesis.speak(utter);
  };

  const speakVoiceText = (text: string, onEnd?: () => void) => {
    const clean = cleanSpeakText(text);
    if (!clean) { onEnd?.(); return; }

    // Stop any currently playing audio
    try { currentSourceRef.current?.stop(); } catch {}
    if (window.speechSynthesis) window.speechSynthesis.cancel();

    isAiSpeakingRef.current = true;

    // Use Gemini TTS for natural, human-like speech
    fetch('/api/chat/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: clean, voice: 'Aoede' })
    })
      .then(res => {
        if (!res.ok) throw new Error(`TTS HTTP ${res.status}`);
        return res.arrayBuffer();
      })
      .then(arrayBuf => {
        // Reuse or create AudioContext
        if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
          audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        const ctx = audioCtxRef.current;
        if (ctx.state === 'suspended') ctx.resume();
        return ctx.decodeAudioData(arrayBuf).then(decoded => {
          const source = ctx.createBufferSource();
          source.buffer = decoded;
          source.connect(ctx.destination);
          currentSourceRef.current = source;
          source.onended = () => {
            isAiSpeakingRef.current = false;
            onEnd?.();
          };
          source.start(0);
        });
      })
      .catch(err => {
        console.warn('[LiveVoice] Gemini TTS failed, falling back to browser TTS:', err.message);
        speakWithBrowser(clean, onEnd);
      });
  };

  const startLiveVoice = async () => {
    setIsLiveVoice(true);
    isLiveVoiceRef.current = true;
    sessionReadyRef.current = false;
    voiceMessagesRef.current = [];
    setMessages(prev => [...prev, { role: 'system', text: 'Connecting to live voice...' }]);

    // 1. Get a short-lived one-time token from the server
    let token: string;
    try {
      const res = await fetch('/api/chat/live-voice-token', { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status} — are you logged in?`);
      token = (await res.json()).token;
    } catch (err: any) {
      console.error('[LiveVoice] Token fetch failed:', err);
      setMessages(prev => [...prev, { role: 'system', text: `Could not start live voice: ${err.message}` }]);
      setIsLiveVoice(false);
      isLiveVoiceRef.current = false;
      return;
    }

    // 2. Open WebSocket to the server-side Gemini Live proxy (API key never reaches browser)
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${window.location.host}/api/live-voice-ws?token=${token}`);
    liveWsRef.current = ws;

    // 3. Schedule 24 kHz PCM chunks for gapless playback
    const playAudioChunk = (base64Data: string) => {
      let ctx = audioContextRef.current;
      if (!ctx || ctx.state === 'closed') {
        ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = ctx;
        nextPlayTimeRef.current = 0;
      }
      if (ctx.state === 'suspended') ctx.resume();
      const float32 = base64ToFloat32(base64Data);
      // Gemini Live returns 24 kHz mono PCM; browser resamples as needed
      const buffer = ctx.createBuffer(1, float32.length, 24000);
      buffer.copyToChannel(float32, 0);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      activeSourcesRef.current.push(source);
      source.onended = () => { activeSourcesRef.current = activeSourcesRef.current.filter(s => s !== source); };
      const now = ctx.currentTime;
      const startAt = Math.max(now + 0.04, nextPlayTimeRef.current);
      source.start(startAt);
      nextPlayTimeRef.current = startAt + buffer.duration;
    };

    // 4. Capture mic and stream 16 kHz PCM to proxy via AudioWorkletNode
    const startMicCapture = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: false,
        });
        audioStreamRef.current = stream;

        let ctx = audioContextRef.current;
        if (!ctx || ctx.state === 'closed') {
          ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          audioContextRef.current = ctx;
          nextPlayTimeRef.current = 0;
        }
        if (ctx.state === 'suspended') await ctx.resume();

        // Build the AudioWorklet processor as an inline Blob so no extra file is needed
        const workletCode = `
class PCMCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buf = [];
    this._target = 2048; // accumulate ~46 ms @ 44.1 kHz before posting
  }
  process(inputs) {
    const ch = inputs[0]?.[0];
    if (ch) {
      this._buf.push(new Float32Array(ch)); // copy — input arrays are recycled
      const total = this._buf.reduce((s, a) => s + a.length, 0);
      if (total >= this._target) {
        const merged = new Float32Array(total);
        let offset = 0;
        for (const a of this._buf) { merged.set(a, offset); offset += a.length; }
        this.port.postMessage(merged.buffer, [merged.buffer]);
        this._buf = [];
      }
    }
    return true;
  }
}
registerProcessor('pcm-capture-processor', PCMCaptureProcessor);
`;
        const blob = new Blob([workletCode], { type: 'application/javascript' });
        const workletUrl = URL.createObjectURL(blob);
        try {
          await ctx.audioWorklet.addModule(workletUrl);
        } finally {
          URL.revokeObjectURL(workletUrl);
        }

        const micSource = ctx.createMediaStreamSource(stream);
        const workletNode = new AudioWorkletNode(ctx, 'pcm-capture-processor');
        audioWorkletNodeRef.current = workletNode;

        workletNode.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
          if (!isLiveVoiceRef.current || !sessionReadyRef.current) return;
          const wsConn = liveWsRef.current;
          if (!wsConn || wsConn.readyState !== WebSocket.OPEN) return;
          const raw = new Float32Array(e.data);
          const pcm16k = downsample(raw, ctx!.sampleRate, 16000);
          wsConn.send(JSON.stringify({ type: 'audio', data: float32ToBase64(pcm16k) }));
        };

        // Muted gain node — keeps the graph active without feeding mic back to speakers
        const muteGain = ctx.createGain();
        muteGain.gain.value = 0;
        micSource.connect(workletNode);
        workletNode.connect(muteGain);
        muteGain.connect(ctx.destination);
      } catch (err: any) {
        console.error('[LiveVoice] Mic error:', err);
        setMessages(prev => [...prev, { role: 'system', text: `Microphone error: ${err.message || 'Access denied or unavailable.'}` }]);
        stopLiveVoice();
      }
    };

    // 5. Send a camera frame every 1.5 s when camera is active
    const startCameraFrames = () => {
      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = setInterval(() => {
        if (!isCameraActiveRef.current || !isLiveVoiceRef.current || !sessionReadyRef.current) return;
        const wsConn = liveWsRef.current;
        if (!wsConn || wsConn.readyState !== WebSocket.OPEN) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || video.readyState < 2) return;
        canvas.width = 320;
        canvas.height = 240;
        const ctx2d = canvas.getContext('2d');
        if (!ctx2d) return;
        ctx2d.drawImage(video, 0, 0, 320, 240);
        const data = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
        wsConn.send(JSON.stringify({ type: 'image', data }));
      }, 1500);
    };

    // 6. Handle messages from the proxy
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string);

        if (msg.type === 'ready') {
          sessionReadyRef.current = true;
          nextPlayTimeRef.current = 0;
          reconnectAttemptsRef.current = 0; // successful connection — reset counter
          setMessages(prev => [...prev, { role: 'system', text: 'Live voice active. Speak to BwanaShamba in English or Kiswahili.' }]);
          startMicCapture();
          if (isCameraActiveRef.current) startCameraFrames();
          // Keepalive: send a ping every 25 s to prevent Cloud Run from dropping the connection
          keepaliveIntervalRef.current = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              try { ws.send(JSON.stringify({ type: 'keepalive' })); } catch {}
            }
          }, 25_000);
          return;
        }

        if (msg.type === 'audio' && msg.data) {
          isAiSpeakingRef.current = true;
          playAudioChunk(msg.data);
          return;
        }

        if (msg.type === 'output_transcript' && msg.text) {
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last?.role === 'ai' && (last as any).incomplete) {
              const merged = { ...last, text: last.text + msg.text, incomplete: true };
              const vm = voiceMessagesRef.current;
              if (vm.length && vm[vm.length - 1].role === 'ai') vm[vm.length - 1].text = merged.text;
              return [...prev.slice(0, -1), merged];
            }
            voiceMessagesRef.current.push({ role: 'ai', text: msg.text });
            return [...prev, { role: 'ai', text: msg.text, incomplete: true } as any];
          });
          return;
        }

        if (msg.type === 'input_transcript' && msg.text) {
          voiceMessagesRef.current.push({ role: 'user', text: msg.text });
          setMessages(prev => [...prev, { role: 'user', text: msg.text }]);
          return;
        }

        if (msg.type === 'turn_complete') {
          isAiSpeakingRef.current = false;
          // Finalise the last AI message (remove incomplete flag)
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last?.role === 'ai') return [...prev.slice(0, -1), { role: 'ai', text: last.text }];
            return prev;
          });
          return;
        }

        if (msg.type === 'interrupted') {
          isAiSpeakingRef.current = false;
          for (const src of activeSourcesRef.current) { try { src.stop(); } catch {} }
          activeSourcesRef.current = [];
          nextPlayTimeRef.current = 0;
          return;
        }

        if (msg.type === 'error') {
          console.error('[LiveVoice] Proxy error:', msg.message);
          setMessages(prev => [...prev, { role: 'system', text: `Session error: ${msg.message}` }]);
        }
      } catch (err) {
        console.error('[LiveVoice] Message parse error:', err);
      }
    };

    ws.onerror = (ev) => {
      console.error('[LiveVoice] WebSocket error event', ev);
      if (isLiveVoiceRef.current) {
        // Don't show a duplicate message — the 'error' message from proxy or
        // the onclose handler will also fire and may already show something.
        // Only show if we have nothing else pending.
        stopLiveVoice();
      }
    };

    ws.onclose = (event) => {
      if (keepaliveIntervalRef.current) {
        clearInterval(keepaliveIntervalRef.current);
        keepaliveIntervalRef.current = null;
      }
      if (isLiveVoiceRef.current) {
        console.log('[LiveVoice] WebSocket closed, code:', event.code, 'reason:', event.reason, 'sessionReady:', sessionReadyRef.current);

        // code 1006 = abnormal TCP drop (Cloud Run timeout / instance restart / network).
        // Auto-reconnect up to 3 times so the user doesn't have to tap the button again.
        if (event.code === 1006 && reconnectAttemptsRef.current < 3) {
          reconnectAttemptsRef.current += 1;
          stopLiveVoice();
          setMessages(prev => [...prev, {
            role: 'system',
            text: `Connection dropped — reconnecting (${reconnectAttemptsRef.current}/3)…`,
          }]);
          setTimeout(() => { startLiveVoice(); }, 2000);
          return;
        }

        // Show an error banner unless:
        // (a) code 1000/1001 AND session was fully ready (normal end), or
        // (b) we already showed an error via msg.type === 'error' (proxy sends that before closing with 1011)
        const wasReady = sessionReadyRef.current;
        const normalClose = (event.code === 1000 || event.code === 1001) && wasReady;
        if (!normalClose && event.code !== 1011) {
          // 1011 closes are preceded by an error message from the proxy
          const reason = event.reason || `Connection closed (code ${event.code})`;
          setMessages(prev => [...prev, { role: 'system', text: `Session ended: ${reason}` }]);
        }
        stopLiveVoice();
      }
    };
  };

  const voiceMessagesRef = useRef<{role: string, text: string}[]>([]);

  const saveVoiceTranscript = async () => {
    const voiceMessages = [...voiceMessagesRef.current];
    voiceMessagesRef.current = [];
    console.log('[LiveVoice] Saving transcript, messages count:', voiceMessages.length);
    if (voiceMessages.length === 0) {
      console.log('[LiveVoice] No voice messages to save');
      return;
    }

    try {
      const res = await fetch('/api/chat/voice-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ messages: voiceMessages })
      });
      if (res.ok) {
        const data = await res.json();
        console.log('[LiveVoice] Transcript saved successfully, conversationId:', data.conversationId);
        loadConversations();
      } else {
        console.error('[LiveVoice] Failed to save transcript, status:', res.status);
      }
    } catch (err) {
      console.error('[LiveVoice] Failed to save transcript:', err);
    }
  };

  const stopLiveVoice = () => {
    const hasMessagesToSave = voiceMessagesRef.current.length > 0;
    if (!isLiveVoiceRef.current) {
      if (hasMessagesToSave) saveVoiceTranscript();
      return;
    }
    isLiveVoiceRef.current = false;
    sessionReadyRef.current = false;
    setIsLiveVoice(false);
    isAiSpeakingRef.current = false;
    // Stop any queued audio playback
    for (const src of activeSourcesRef.current) { try { src.stop(); } catch {} }
    activeSourcesRef.current = [];
    nextPlayTimeRef.current = 0;
    if (liveWsRef.current) {
      try { liveWsRef.current.close(); } catch {}
      liveWsRef.current = null;
    }
    if (keepaliveIntervalRef.current) {
      clearInterval(keepaliveIntervalRef.current);
      keepaliveIntervalRef.current = null;
    }
    if (audioWorkletNodeRef.current) {
      try { audioWorkletNodeRef.current.disconnect(); } catch {}
      audioWorkletNodeRef.current = null;
    }
    if (processorRef.current) {
      try { processorRef.current.disconnect(); } catch {}
      processorRef.current = null;
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(t => t.stop());
      audioStreamRef.current = null;
    }
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setMessages(prev => [...prev, { role: 'system', text: 'Live voice session ended.' }]);
    saveVoiceTranscript();
  };

  const hasMessages = messages.length > 0;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 86400000) return 'Today';
    if (diff < 172800000) return 'Yesterday';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="flex h-[calc(100dvh-52px)] lg:h-dvh overflow-hidden">
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-[60] lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <div className={`${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 fixed lg:relative z-[70] lg:z-auto w-64 h-full bg-white border-r border-[#002c11]/8 flex flex-col transition-transform duration-200`}>
        <div className="p-3 border-b border-[#002c11]/8">
          <button
            onClick={startNewConversation}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#035925] text-white text-sm font-medium hover:bg-[#002c11] transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {conversations.length === 0 ? (
            <p className="text-xs text-[#5d6c7b]/50 text-center py-6">No conversations yet</p>
          ) : (
            conversations.map(conv => (
              <div
                key={conv.id}
                role="button"
                tabIndex={0}
                onClick={() => loadConversation(conv.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') loadConversation(conv.id); }}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors group flex items-center gap-2 cursor-pointer ${
                  activeConversationId === conv.id
                    ? 'bg-[#035925]/10 text-[#002c11]'
                    : 'text-[#5d6c7b] hover:bg-[#002c11]/5 hover:text-[#002c11]'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-50" />
                <div className="flex-1 min-w-0">
                  <span className="block truncate text-[13px]">{conv.title}</span>
                  <span className="block text-[10px] opacity-50 mt-0.5">{formatDate(conv.updated_at)}</span>
                </div>
                <button
                  onClick={(e) => deleteConversation(conv.id, e)}
                  className="opacity-0 group-hover:opacity-60 hover:opacity-100 p-1 hover:bg-red-50 rounded transition-all shrink-0"
                >
                  <Trash2 className="w-3 h-3 text-red-400" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        {!isCameraActive && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ position: 'fixed', width: 1, height: 1, opacity: 0, pointerEvents: 'none', top: -9999, left: -9999 }}
          />
        )}

        <div className={`flex items-center justify-between px-4 py-2 lg:hidden border-b border-[#002c11]/[0.06] relative z-[40] transition-opacity duration-200 ${isSidebarOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="w-11 h-11 flex items-center justify-center text-[#5d6c7b]/60 hover:text-[#002c11] hover:bg-[#002c11]/5 rounded-lg transition-colors touch-manipulation"
            >
              {isSidebarOpen ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
            </button>
            <span className="text-xs font-bold text-[#5d6c7b]/60">History</span>
          </div>
        </div>

        {isCameraActive && (
          <div className="relative w-full h-40 bg-black rounded-xl overflow-hidden mb-4 mx-4 shrink-0" style={{ width: 'calc(100% - 2rem)' }}>
            <video autoPlay playsInline muted className="w-full h-full object-cover" ref={(el) => { videoRef.current = el; if (el && mediaStream) el.srcObject = mediaStream; }} />
            <div className="absolute top-3 right-3 flex items-center gap-1.5">
              <button
                onClick={flipCamera}
                className="p-1.5 bg-black/50 hover:bg-black/70 text-white rounded-lg backdrop-blur-sm transition-colors"
                title={facingMode === 'environment' ? 'Switch to front camera' : 'Switch to rear camera'}
              >
                <SwitchCamera className="w-4 h-4" />
              </button>
              <button
                onClick={toggleCamera}
                className="p-1.5 bg-black/50 hover:bg-black/70 text-white rounded-lg backdrop-blur-sm transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {isLiveVoice && (
              <div className="absolute top-3 left-3 bg-red-500/80 text-white px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 animate-pulse backdrop-blur-sm">
                <Mic className="w-3 h-3" /> LIVE
              </div>
            )}
            <div className="absolute bottom-3 left-3 bg-black/50 text-white px-2 py-0.5 rounded text-[10px] backdrop-blur-sm">
              {facingMode === 'environment' ? 'Rear' : 'Front'}
            </div>
            {!isLiveVoice && !isProcessing && (
              <button
                onClick={() => handleSendText('Analyze this image from my camera. Check for pests, diseases, or any crop issues.')}
                className="absolute bottom-3 left-1/2 -translate-x-1/2 px-4 py-2 bg-[#035925]/90 hover:bg-[#035925] text-white text-xs font-semibold rounded-lg backdrop-blur-sm transition-colors flex items-center gap-1.5"
              >
                <Camera className="w-3.5 h-3.5" /> Capture & Analyze
              </button>
            )}
          </div>
        )}


        <div className="flex-1 overflow-y-auto min-h-0">
          {!hasMessages ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-6">
              <div className="w-12 h-12 rounded-2xl bg-[#035925]/10 flex items-center justify-center mb-5">
                <svg className="w-6 h-6 text-[#035925]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
              </div>
              <h2 className="text-xl font-black text-[#002c11] mb-2" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
                What can I help you with?
              </h2>
              <p className="text-sm text-[#5d6c7b] max-w-md leading-relaxed">
                Ask me about your farm, upload a crop photo for analysis, or start a live voice conversation.
              </p>

            </div>
          ) : (
            <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
              {messages.map((msg, idx) => (
                <div key={idx}>
                  {msg.role === 'system' ? (
                    <div className="flex justify-center">
                      <span className="text-[11px] text-[#5d6c7b]/60 font-medium bg-[#002c11]/[0.03] px-3 py-1 rounded-full">
                        {msg.text}
                      </span>
                    </div>
                  ) : msg.role === 'user' ? (
                    <div className="flex justify-end">
                      <div className="max-w-[80%]">
                        {msg.image && (
                          <img src={msg.image} alt="Uploaded" className="max-w-xs rounded-xl mb-2 ml-auto" />
                        )}
                        <div className="bg-[#035925] text-white px-4 py-3 rounded-2xl rounded-br-md text-[14px] leading-relaxed">
                          {msg.text}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      <div className="w-7 h-7 rounded-lg bg-[#035925]/10 flex items-center justify-center shrink-0 mt-0.5">
                        <svg className="w-3.5 h-3.5 text-[#035925]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="prose prose-sm max-w-none text-[#002c11]/80 text-[14px] leading-relaxed [&_p]:mb-2 [&_ul]:mb-2 [&_ol]:mb-2 [&_h1]:text-[#002c11] [&_h2]:text-[#002c11] [&_h3]:text-[#002c11] [&_strong]:text-[#002c11] [&_code]:bg-[#002c11]/5 [&_code]:text-[#002c11] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded">
                          <ReactMarkdown>{msg.text}</ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {isProcessing && !(messages[messages.length - 1]?.role === 'ai' && messages[messages.length - 1]?.text.length > 0) && (
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-lg bg-[#035925]/10 flex items-center justify-center shrink-0 mt-0.5">
                    <svg className="w-3.5 h-3.5 text-[#035925]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                  </div>
                  <div className="flex items-center gap-2 py-2">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-[#035925]/30 rounded-full animate-bounce [animation-delay:0ms]"></span>
                      <span className="w-2 h-2 bg-[#035925]/30 rounded-full animate-bounce [animation-delay:150ms]"></span>
                      <span className="w-2 h-2 bg-[#035925]/30 rounded-full animate-bounce [animation-delay:300ms]"></span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <div className="shrink-0 px-4 pt-2" style={{ paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))' }}>
          <div className="max-w-2xl mx-auto">
            <div className="bg-white border border-[#002c11]/10 rounded-2xl shadow-sm focus-within:border-[#035925]/30 focus-within:shadow-md transition-all overflow-hidden">
              {/* Image attachment preview chip — inside the input box */}
              {uploadedMedia && uploadedMediaType === 'image' && !isCameraActive && (
                <div className="flex items-center gap-2 px-3 pt-2 pb-1">
                  <div className="relative inline-flex items-center gap-2 bg-[#f9f6f1] border border-[#002c11]/10 rounded-xl px-2 py-1.5 max-w-[200px]">
                    <img
                      src={uploadedMedia}
                      alt="Attached"
                      className="w-8 h-8 rounded-lg object-cover shrink-0"
                    />
                    <span className="text-[11px] text-[#5d6c7b] font-medium truncate">Image attached</span>
                    <button
                      type="button"
                      onClick={() => setUploadedMedia(null)}
                      className="shrink-0 w-4 h-4 flex items-center justify-center rounded-full bg-[#002c11]/10 hover:bg-red-100 text-[#5d6c7b] hover:text-red-500 transition-colors"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </div>
              )}
              {uploadedMedia && uploadedMediaType === 'video' && !isCameraActive && (
                <div className="flex items-center gap-2 px-3 pt-2 pb-1">
                  <div className="relative inline-flex items-center gap-2 bg-[#f9f6f1] border border-[#002c11]/10 rounded-xl px-2 py-1.5">
                    <span className="text-base">🎬</span>
                    <span className="text-[11px] text-[#5d6c7b] font-medium">Video attached</span>
                    <button
                      type="button"
                      onClick={() => setUploadedMedia(null)}
                      className="shrink-0 w-4 h-4 flex items-center justify-center rounded-full bg-[#002c11]/10 hover:bg-red-100 text-[#5d6c7b] hover:text-red-500 transition-colors"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-end gap-1.5 px-3 py-2">
                {/* Left: attach + camera */}
                <div className="flex items-center gap-0.5 shrink-0 mb-0.5">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors touch-manipulation ${uploadedMedia ? 'text-[#035925] bg-[#035925]/10' : 'text-[#5d6c7b]/50 hover:text-[#002c11] hover:bg-[#002c11]/5'}`}
                    title="Attach image"
                    type="button"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>
                  <button
                    onClick={toggleCamera}
                    className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors touch-manipulation ${isCameraActive ? 'text-red-500 bg-red-50' : 'text-[#5d6c7b]/50 hover:text-[#002c11] hover:bg-[#002c11]/5'}`}
                    title={isCameraActive ? 'Stop camera' : 'Start camera'}
                    type="button"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    capture={undefined}
                    onChange={handleFileUpload}
                  />
                </div>

                {/* Textarea — starts single-line, grows as user types */}
                <textarea
                  ref={textareaRef}
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendText();
                    }
                  }}
                  placeholder={uploadedMedia ? 'Add a message (optional)…' : 'Ask BwanaShamba…'}
                  rows={1}
                  style={{ height: 36, overflowY: 'hidden' }}
                  className="chat-input flex-1 resize-none bg-transparent text-[#002c11] text-[16px] leading-snug placeholder-[#5d6c7b]/40 focus:outline-none py-1.5 max-h-[160px]"
                  disabled={isLiveVoice || isProcessing}
                />

                {/* Right: mic + send */}
                <div className="flex items-center gap-0.5 shrink-0 mb-0.5">
                  <button
                    onClick={isLiveVoice ? stopLiveVoice : startLiveVoice}
                    className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors touch-manipulation ${isLiveVoice ? 'text-red-500 bg-red-50 animate-pulse' : 'text-[#5d6c7b]/50 hover:text-[#002c11] hover:bg-[#002c11]/5'}`}
                    title={isLiveVoice ? 'End live voice' : 'Start live voice'}
                    type="button"
                  >
                    {isLiveVoice ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => handleSendText()}
                    disabled={isLiveVoice || isProcessing || (!inputText.trim() && !uploadedMedia && !isCameraActive)}
                    className="w-9 h-9 flex items-center justify-center bg-[#035925] text-white rounded-xl hover:bg-[#002c11] disabled:opacity-30 disabled:hover:bg-[#035925] transition-colors touch-manipulation"
                    type="button"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
            <p className="text-[10px] text-[#5d6c7b]/40 text-center mt-2">
              BwanaShamba can make mistakes. Verify important farm decisions.
            </p>
          </div>
        </div>

        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}
