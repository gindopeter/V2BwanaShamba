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

export default function LiveScout() {
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
      if (isLiveVoiceRef.current) {
        if (processorRef.current) { processorRef.current.disconnect(); processorRef.current = null; }
        if (audioStreamRef.current) { audioStreamRef.current.getTracks().forEach(t => t.stop()); audioStreamRef.current = null; }
        if (frameIntervalRef.current) { clearInterval(frameIntervalRef.current); frameIntervalRef.current = null; }
        if (liveWsRef.current) { try { liveWsRef.current.close(); } catch {} liveWsRef.current = null; }
      }
      if (mediaStreamRef.current) { mediaStreamRef.current.getTracks().forEach(t => t.stop()); }
    };
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [inputText]);

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      const res = await fetch('/api/chat/conversations');
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
      const res = await fetch(`/api/chat/conversations/${convId}/messages`);
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
        setActiveConversationId(convId);
      }
    } catch (err) {
      console.error('Failed to load conversation:', err);
    }
  };

  const startNewConversation = () => {
    setActiveConversationId(null);
    setMessages([]);
    setInputText('');
    setUploadedMedia(null);
  };

  const deleteConversation = async (convId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/chat/conversations/${convId}`, { method: 'DELETE' });
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

  const handleSendText = async (overrideText?: string) => {
    const textToSend = overrideText || inputText;

    let imageData = uploadedMedia ? uploadedMedia.split(',')[1] : undefined;
    let mimeType = 'image/jpeg';

    if (uploadedMedia && uploadedMediaType === 'image') {
      const match = uploadedMedia.match(/^data:([^;]+);/);
      if (match) mimeType = match[1];
    }

    if (uploadedMedia && uploadedMediaType === 'video') {
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

    if (!textToSend.trim() && !imageData && !isCameraActive) return;

    const messageText = textToSend.trim()
      || (imageData ? 'Analyze this image and tell me what you see. Check for pests, diseases, or any issues.' : '');

    const userMsg = {
      role: 'user',
      text: messageText,
      image: uploadedMedia && uploadedMediaType === 'image'
        ? uploadedMedia
        : (imageData ? `data:image/jpeg;base64,${imageData}` : undefined)
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setUploadedMedia(null);
    setIsProcessing(true);

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
                  } else if (parsed.type === 'start' && parsed.conversationId && !activeConversationId) {
                    setActiveConversationId(parsed.conversationId);
                  } else if (parsed.type === 'done' && parsed.conversationId && !activeConversationId) {
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
        if (data.conversationId && !activeConversationId) {
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
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in your browser. Please use Chrome or Edge.');
      return;
    }

    setIsLiveVoice(true);
    isLiveVoiceRef.current = true;
    sessionReadyRef.current = false;
    voiceMessagesRef.current = [];

    setMessages(prev => [...prev, { role: 'system', text: 'Live voice session started. Speak to your AI assistant in English or Kiswahili.' }]);

    let voiceConvId: number | null = activeConversationId;

    const listenAndRespond = () => {
      if (!isLiveVoiceRef.current) return;

      const recognition = new SpeechRecognition();
      // sw-TZ supports Swahili and English in Chrome; fall back to en-US if unsupported
      recognition.lang = 'sw-TZ';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      speechRecognitionRef.current = recognition;
      let langFallback = false;

      let handled = false;

      recognition.onresult = async (event: any) => {
        const transcript = event.results[0]?.[0]?.transcript?.trim();
        if (!transcript || !isLiveVoiceRef.current) return;
        handled = true;
        try { recognition.stop(); } catch {}

        setMessages(prev => [...prev, { role: 'user', text: transcript }]);
        voiceMessagesRef.current.push({ role: 'user', text: transcript });

        try {
          const chatRes = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: transcript, conversationId: voiceConvId, stream: false })
          });
          if (!chatRes.ok) throw new Error(`Server ${chatRes.status}`);
          const data = await chatRes.json();
          if (data.conversationId) {
            voiceConvId = data.conversationId;
            setActiveConversationId(data.conversationId);
          }
          const reply: string = data.reply || data.message || '';
          if (reply && isLiveVoiceRef.current) {
            setMessages(prev => [...prev, { role: 'ai', text: reply }]);
            voiceMessagesRef.current.push({ role: 'ai', text: reply });
            loadConversations();
            speakVoiceText(reply, () => {
              if (isLiveVoiceRef.current) setTimeout(listenAndRespond, 400);
            });
          } else if (isLiveVoiceRef.current) {
            listenAndRespond();
          }
        } catch (err: any) {
          console.error('[LiveVoice] Chat error:', err);
          if (isLiveVoiceRef.current) {
            setMessages(prev => [...prev, { role: 'system', text: `Error: ${err.message}` }]);
            setTimeout(listenAndRespond, 1500);
          }
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'no-speech' || event.error === 'aborted') {
          if (isLiveVoiceRef.current && !handled) setTimeout(listenAndRespond, 300);
          return;
        }
        // If Swahili isn't supported, retry once with English
        if ((event.error === 'language-not-supported' || event.error === 'network') && !langFallback) {
          langFallback = true;
          try { recognition.stop(); } catch {}
          const fallbackRec = new SpeechRecognition();
          fallbackRec.lang = 'en-US';
          fallbackRec.interimResults = false;
          fallbackRec.maxAlternatives = 1;
          speechRecognitionRef.current = fallbackRec;
          fallbackRec.onresult = recognition.onresult;
          fallbackRec.onerror = () => { if (isLiveVoiceRef.current && !handled) setTimeout(listenAndRespond, 1000); };
          fallbackRec.onend = () => {};
          try { fallbackRec.start(); } catch {}
          return;
        }
        console.error('[LiveVoice] Recognition error:', event.error);
        if (isLiveVoiceRef.current && !handled) setTimeout(listenAndRespond, 1000);
      };

      recognition.onend = () => {};

      try { recognition.start(); } catch (err) {
        console.error('[LiveVoice] Could not start recognition:', err);
        if (isLiveVoiceRef.current) setTimeout(listenAndRespond, 1000);
      }
    };

    listenAndRespond();
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
    try { window.speechSynthesis?.cancel(); } catch {}
    if (speechRecognitionRef.current) {
      try { speechRecognitionRef.current.stop(); } catch {}
      speechRecognitionRef.current = null;
    }
    if (liveWsRef.current) {
      try { liveWsRef.current.close(); } catch {}
      liveWsRef.current = null;
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
    <div className="flex h-[calc(100vh-5rem)] max-h-[900px]">
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-30 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <div className={`${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 fixed lg:relative z-40 lg:z-auto w-64 h-full bg-white border-r border-[#002c11]/8 flex flex-col transition-transform duration-200`}>
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

        <div className="flex items-center gap-2 px-4 py-2 lg:hidden">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 text-[#5d6c7b]/60 hover:text-[#002c11] hover:bg-[#002c11]/5 rounded-lg transition-colors"
          >
            {isSidebarOpen ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </button>
          <span className="text-xs text-[#5d6c7b]/50">History</span>
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

        {uploadedMedia && !isCameraActive && (
          <div className="relative w-full max-h-48 bg-black rounded-xl overflow-hidden mb-4 mx-4 shrink-0" style={{ width: 'calc(100% - 2rem)' }}>
            {uploadedMediaType === 'video' ? (
              <video ref={uploadedVideoRef} src={uploadedMedia} controls className="w-full max-h-48 object-contain" />
            ) : (
              <img src={uploadedMedia} className="w-full max-h-48 object-contain" alt="Upload preview" />
            )}
            <button
              onClick={() => setUploadedMedia(null)}
              className="absolute top-3 right-3 p-1.5 bg-black/50 hover:bg-black/70 text-white rounded-lg backdrop-blur-sm transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
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

              <div className="grid grid-cols-2 gap-3 mt-8 w-full max-w-md">
                {[
                  { text: 'Check irrigation schedule for Zone A', icon: '💧' },
                  { text: 'When should I harvest my tomatoes?', icon: '🍅' },
                  { text: 'Angalia hali ya maji Zone B', icon: '🌊' },
                  { text: 'Wadudu gani naweze kutarajia?', icon: '🐛' },
                ].map((suggestion) => (
                  <button
                    key={suggestion.text}
                    onClick={() => handleSendText(suggestion.text)}
                    className="text-left p-3 rounded-xl border border-[#002c11]/8 bg-white hover:bg-[#035925]/5 hover:border-[#035925]/20 transition-all text-[12px] text-[#002c11]/70 leading-snug group"
                  >
                    <span className="text-base mb-1 block">{suggestion.icon}</span>
                    {suggestion.text}
                  </button>
                ))}
              </div>
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
              {isProcessing && (
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

        <div className="shrink-0 px-4 pb-4 pt-2">
          <div className="max-w-2xl mx-auto">
            <div className="bg-white border border-[#002c11]/10 rounded-2xl shadow-sm focus-within:border-[#035925]/30 focus-within:shadow-md transition-all">
              <div className="flex items-end gap-2 p-3">
                <div className="flex items-center gap-1 shrink-0 pb-0.5">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 text-[#5d6c7b]/60 hover:text-[#002c11] hover:bg-[#002c11]/5 rounded-lg transition-colors"
                    title="Upload image or video"
                    type="button"
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>
                  <button
                    onClick={toggleCamera}
                    className={`p-2 rounded-lg transition-colors ${isCameraActive ? 'text-red-500 bg-red-50' : 'text-[#5d6c7b]/60 hover:text-[#002c11] hover:bg-[#002c11]/5'}`}
                    title={isCameraActive ? 'Stop camera' : 'Start camera'}
                    type="button"
                  >
                    <Camera className="w-5 h-5" />
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*,video/*"
                    onChange={handleFileUpload}
                  />
                </div>

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
                  placeholder="Ask BwanaShamba anything..."
                  rows={1}
                  className="flex-1 resize-none bg-transparent text-[#002c11] text-[14px] leading-relaxed placeholder-[#5d6c7b]/40 focus:outline-none py-2 max-h-[200px]"
                  disabled={isLiveVoice || isProcessing}
                />

                <div className="flex items-center gap-1 shrink-0 pb-0.5">
                  <button
                    onClick={isLiveVoice ? stopLiveVoice : startLiveVoice}
                    className={`p-2 rounded-lg transition-colors ${isLiveVoice ? 'text-red-500 bg-red-50 animate-pulse' : 'text-[#5d6c7b]/60 hover:text-[#002c11] hover:bg-[#002c11]/5'}`}
                    title={isLiveVoice ? 'End live voice' : 'Start live voice'}
                    type="button"
                  >
                    {isLiveVoice ? <Square className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </button>
                  <button
                    onClick={() => handleSendText()}
                    disabled={isLiveVoice || isProcessing || (!inputText.trim() && !uploadedMedia && !isCameraActive)}
                    className="p-2 bg-[#035925] text-white rounded-lg hover:bg-[#002c11] disabled:opacity-30 disabled:hover:bg-[#035925] transition-colors"
                    type="button"
                  >
                    <ArrowUp className="w-5 h-5" />
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
