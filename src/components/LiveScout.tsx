import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, Upload, Loader2, Mic, Square, Send, ArrowUp, Paperclip, X, Volume2, Image as ImageIcon } from 'lucide-react';
import { GoogleGenAI, Modality } from '@google/genai';
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

export default function LiveScout() {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isLiveVoice, setIsLiveVoice] = useState(false);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [uploadedMedia, setUploadedMedia] = useState<string | null>(null);
  const [uploadedMediaType, setUploadedMediaType] = useState<'image' | 'video'>('image');
  const [messages, setMessages] = useState<{role: string, text: string, image?: string}[]>([]);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const uploadedVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const aiRef = useRef<any>(null);
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const frameIntervalRef = useRef<any>(null);

  const isLiveVoiceRef = useRef(false);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const isCameraActiveRef = useRef(false);

  useEffect(() => { isLiveVoiceRef.current = isLiveVoice; }, [isLiveVoice]);
  useEffect(() => { mediaStreamRef.current = mediaStream; }, [mediaStream]);
  useEffect(() => { isCameraActiveRef.current = isCameraActive; }, [isCameraActive]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    return () => {
      if (isLiveVoiceRef.current) {
        if (processorRef.current) { processorRef.current.disconnect(); processorRef.current = null; }
        if (audioStreamRef.current) { audioStreamRef.current.getTracks().forEach(t => t.stop()); audioStreamRef.current = null; }
        if (frameIntervalRef.current) { clearInterval(frameIntervalRef.current); frameIntervalRef.current = null; }
        if (sessionRef.current) { sessionRef.current.then((s: any) => s.close()).catch(() => {}); sessionRef.current = null; }
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

  const toggleCamera = async () => {
    if (isCameraActive) {
      if (mediaStream) {
        mediaStream.getTracks().forEach(t => t.stop());
        setMediaStream(null);
      }
      if (videoRef.current) videoRef.current.srcObject = null;
      setIsCameraActive(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        setMediaStream(stream);
        if (videoRef.current) videoRef.current.srcObject = stream;
        setIsCameraActive(true);
        setUploadedMedia(null);
      } catch (err: any) {
        console.error(err);
        alert(`Camera access error: ${err.message || 'Denied or unavailable.'}`);
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (isCameraActive) toggleCamera();
      const isVideo = file.type.startsWith('video/');
      setUploadedMediaType(isVideo ? 'video' : 'image');
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedMedia(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
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

  const handleSendText = async () => {
    if (!inputText.trim() && !uploadedMedia && !isCameraActive) return;

    let imageData = uploadedMedia ? uploadedMedia.split(',')[1] : undefined;
    let mimeType = 'image/jpeg';

    if (uploadedMedia && uploadedMediaType === 'video') {
      imageData = extractVideoFrame();
      mimeType = 'image/jpeg';
    }

    if (isCameraActive && videoRef.current && canvasRef.current && !imageData) {
      const ctx = canvasRef.current.getContext('2d');
      canvasRef.current.width = 640;
      canvasRef.current.height = 480;
      ctx?.drawImage(videoRef.current, 0, 0, 640, 480);
      imageData = canvasRef.current.toDataURL('image/jpeg', 0.8).split(',')[1];
    }

    const userMsg = {
      role: 'user',
      text: inputText || (imageData ? 'Analyze this image.' : ''),
      image: uploadedMedia && uploadedMediaType === 'image'
        ? uploadedMedia
        : (imageData ? `data:image/jpeg;base64,${imageData}` : undefined)
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setUploadedMedia(null);
    setIsProcessing(true);

    try {
      const body: any = { message: userMsg.text };
      if (imageData) {
        body.image = imageData;
        body.mimeType = mimeType;
      }

      const chatRes = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await chatRes.json();

      setMessages(prev => [...prev, { role: 'ai', text: data.reply || '' }]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'system', text: 'Error connecting to BwanaShamba. Check that your API key is configured.' }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const startLiveVoice = async () => {
    try {
      setIsLiveVoice(true);
      const sessionRes = await fetch('/api/gemini-session');
      const sessionData = await sessionRes.json();
      if (!sessionRes.ok || !sessionData.apiKey) {
        throw new Error(sessionData.error || 'Failed to get API session');
      }
      const ai = new GoogleGenAI({ apiKey: sessionData.apiKey });
      aiRef.current = ai;

      let currentAudioStream: MediaStream;
      try {
        currentAudioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioStreamRef.current = currentAudioStream;
      } catch (err: any) {
        console.error("Live API Error:", err);
        alert(`Microphone access error: ${err.message || 'Denied or unavailable.'}`);
        setIsLiveVoice(false);
        return;
      }

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = audioCtx;
      nextPlayTimeRef.current = audioCtx.currentTime;

      const source = audioCtx.createMediaStreamSource(currentAudioStream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      source.connect(processor);
      processor.connect(audioCtx.destination);

      const sessionPromise = ai.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-12-2025",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } } },
          systemInstruction: "You are BwanaShamba, a farm supervisor in Tanzania. You are looking at a live camera feed of a tomato and onion farm. Help the farmer identify pests like Tuta Absoluta, check irrigation, and answer questions. Speak in English and Kiswahili.",
        },
        callbacks: {
          onopen: () => {
            setMessages(prev => [...prev, { role: 'system', text: 'Live voice session started. Speak to your AI assistant.' }]);

            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const downsampled = downsample(inputData, audioCtx.sampleRate, 16000);
              const base64 = float32ToBase64(downsampled);
              sessionPromise.then(session => {
                session.sendRealtimeInput({ media: { data: base64, mimeType: 'audio/pcm;rate=16000' } });
              });
            };

            frameIntervalRef.current = setInterval(() => {
              if (videoRef.current && canvasRef.current && isCameraActiveRef.current) {
                const ctx = canvasRef.current.getContext('2d');
                if (ctx) {
                  canvasRef.current.width = 640;
                  canvasRef.current.height = 480;
                  ctx.drawImage(videoRef.current, 0, 0, 640, 480);
                  const base64Image = canvasRef.current.toDataURL('image/jpeg', 0.5).split(',')[1];
                  sessionPromise.then(session => {
                    session.sendRealtimeInput({ media: { data: base64Image, mimeType: 'image/jpeg' } });
                  });
                }
              }
            }, 2000);
          },
          onmessage: (message: any) => {
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
              const float32Data = base64ToFloat32(base64Audio);
              const buffer = audioCtx.createBuffer(1, float32Data.length, 24000);
              buffer.getChannelData(0).set(float32Data);
              const playSource = audioCtx.createBufferSource();
              playSource.buffer = buffer;
              playSource.connect(audioCtx.destination);

              const startTime = Math.max(audioCtx.currentTime, nextPlayTimeRef.current);
              playSource.start(startTime);
              nextPlayTimeRef.current = startTime + buffer.duration;
            }

            const text = message.serverContent?.modelTurn?.parts?.[0]?.text;
            if (text) {
              setMessages(prev => [...prev, { role: 'ai', text }]);
            }
          },
          onclose: () => {
            stopLiveVoice();
          }
        }
      });
      sessionRef.current = sessionPromise;

    } catch (err: any) {
      console.error("Live API Error:", err);
      alert(`Failed to start Live Session: ${err.message || 'Unknown error'}`);
      stopLiveVoice();
    }
  };

  const stopLiveVoice = () => {
    setIsLiveVoice(false);
    if (processorRef.current) {
      processorRef.current.disconnect();
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
    if (sessionRef.current) {
      sessionRef.current.then((session: any) => session.close()).catch(() => {});
      sessionRef.current = null;
    }
    setMessages(prev => [...prev, { role: 'system', text: 'Live voice session ended.' }]);
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] max-h-[900px]">
      {/* Hidden video element for camera capture when not showing preview */}
      <video ref={videoRef} autoPlay playsInline muted className={isCameraActive ? 'hidden' : 'hidden'} style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }} />

      {/* Camera preview strip - only when camera is active */}
      {isCameraActive && (
        <div className="relative w-full h-40 bg-black rounded-xl overflow-hidden mb-4 shrink-0">
          <video autoPlay playsInline muted className="w-full h-full object-cover" ref={(el) => { if (el && mediaStream) el.srcObject = mediaStream; }} />
          <button
            onClick={toggleCamera}
            className="absolute top-3 right-3 p-1.5 bg-black/50 hover:bg-black/70 text-white rounded-lg backdrop-blur-sm transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          {isLiveVoice && (
            <div className="absolute top-3 left-3 bg-red-500/80 text-white px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 animate-pulse backdrop-blur-sm">
              <Mic className="w-3 h-3" /> LIVE
            </div>
          )}
        </div>
      )}

      {/* Uploaded media preview */}
      {uploadedMedia && !isCameraActive && (
        <div className="relative w-full max-h-48 bg-black rounded-xl overflow-hidden mb-4 shrink-0">
          {uploadedMediaType === 'video' ? (
            <video ref={uploadedVideoRef} src={uploadedMedia} controls className="w-full max-h-48 object-contain" />
          ) : (
            <img src={uploadedMedia} className="w-full max-h-48 object-contain" />
          )}
          <button
            onClick={() => setUploadedMedia(null)}
            className="absolute top-3 right-3 p-1.5 bg-black/50 hover:bg-black/70 text-white rounded-lg backdrop-blur-sm transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Messages area */}
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
                { text: 'What pests should I watch for?', icon: '🐛' },
                { text: 'Analyze soil moisture levels', icon: '🌱' },
              ].map((suggestion) => (
                <button
                  key={suggestion.text}
                  onClick={() => {
                    setInputText(suggestion.text);
                    textareaRef.current?.focus();
                  }}
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

      {/* Input area — centered, clean */}
      <div className="shrink-0 px-4 pb-4 pt-2">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white border border-[#002c11]/10 rounded-2xl shadow-sm focus-within:border-[#035925]/30 focus-within:shadow-md transition-all">
            <div className="flex items-end gap-2 p-3">
              <div className="flex items-center gap-1 shrink-0 pb-0.5">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 text-[#5d6c7b]/60 hover:text-[#002c11] hover:bg-[#002c11]/5 rounded-lg transition-colors"
                  title="Upload image or video"
                >
                  <Paperclip className="w-5 h-5" />
                </button>
                <button
                  onClick={toggleCamera}
                  className={`p-2 rounded-lg transition-colors ${isCameraActive ? 'text-red-500 bg-red-50' : 'text-[#5d6c7b]/60 hover:text-[#002c11] hover:bg-[#002c11]/5'}`}
                  title={isCameraActive ? 'Stop camera' : 'Start camera'}
                >
                  <Camera className="w-5 h-5" />
                </button>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" onChange={handleFileUpload} />
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
                >
                  {isLiveVoice ? <Square className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>
                <button
                  onClick={handleSendText}
                  disabled={isLiveVoice || isProcessing || (!inputText.trim() && !uploadedMedia && !isCameraActive)}
                  className="p-2 bg-[#035925] text-white rounded-lg hover:bg-[#002c11] disabled:opacity-30 disabled:hover:bg-[#035925] transition-colors"
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
  );
}
