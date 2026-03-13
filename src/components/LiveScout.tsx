import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, Upload, Loader2, Mic, Video, Square, MessageSquare, Volume2, Send, Image as ImageIcon } from 'lucide-react';
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
  const [messages, setMessages] = useState<{role: string, text: string, image?: string}[]>([
    { role: 'ai', text: 'Jambo! I am Mkulima AI. Upload an image or video, turn on your camera, or start a Live Voice session to begin.' }
  ]);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const uploadedVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);

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
      setMessages(prev => [...prev, { role: 'system', text: 'Error connecting to Mkulima AI. Check that your API key is configured.' }]);
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
          systemInstruction: "You are Mkulima AI, a farm supervisor in Tanzania. You are looking at a live camera feed of a tomato and onion farm. Help the farmer identify pests like Tuta Absoluta, check irrigation, and answer questions. Speak in English and Kiswahili.",
        },
        callbacks: {
          onopen: () => {
            console.log("Live API Connected");
            setMessages(prev => [...prev, { role: 'system', text: 'Live Voice Session Started' }]);

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
            console.log("Live API Closed");
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
    setMessages(prev => [...prev, { role: 'system', text: 'Live Voice Session Ended' }]);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-10rem)] max-h-[800px]">
      <div className="w-full lg:w-1/2 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col shadow-sm">
         <div className="p-4 border-b border-slate-800 bg-slate-950 flex justify-between items-center">
            <h3 className="font-bold text-slate-100 flex items-center gap-2">
              <Video className="w-5 h-5 text-[#035925]"/>
              Vision Feed
            </h3>
            <div className="flex gap-2">
               <button
                 onClick={toggleCamera}
                 className={`px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${isCameraActive ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'}`}
               >
                 {isCameraActive ? <Square className="w-4 h-4"/> : <Camera className="w-4 h-4"/>}
                 {isCameraActive ? 'STOP CAM' : 'CAMERA'}
               </button>
               <button
                 onClick={() => fileInputRef.current?.click()}
                 className="px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700 transition-all"
               >
                 <Upload className="w-4 h-4"/>
                 UPLOAD
               </button>
               <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" onChange={handleFileUpload} />
            </div>
         </div>

         <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
            {isCameraActive ? (
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            ) : uploadedMedia && uploadedMediaType === 'video' ? (
              <video ref={uploadedVideoRef} src={uploadedMedia} controls className="w-full h-full object-contain" />
            ) : uploadedMedia && uploadedMediaType === 'image' ? (
              <img src={uploadedMedia} className="w-full h-full object-contain" />
            ) : (
              <div className="text-center text-[#5d6c7b]">
                <Camera className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p className="font-medium">Start camera or upload an image/video to begin</p>
              </div>
            )}

            {isLiveVoice && (
              <div className="absolute top-4 right-4 bg-red-500/20 border border-red-500/50 text-red-400 px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 animate-pulse shadow-lg backdrop-blur-sm">
                <Mic className="w-4 h-4" /> LIVE AUDIO ACTIVE
              </div>
            )}
         </div>
      </div>

      <div className="w-full lg:w-1/2 bg-white border border-[#002c11]/5 rounded-2xl flex flex-col shadow-sm">
         <div className="p-4 border-b border-[#002c11]/5 bg-[#f9f6f1] flex justify-between items-center rounded-t-2xl">
            <h3 className="font-bold text-[#002c11] flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-[#035925]"/>
              Mkulima AI
            </h3>
            <button
              onClick={isLiveVoice ? stopLiveVoice : startLiveVoice}
              className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-sm ${isLiveVoice ? 'bg-red-50 hover:bg-red-100 text-red-600 border border-red-200' : 'bg-[#035925] hover:bg-[#002c11] text-white'}`}
            >
              {isLiveVoice ? <Square className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              {isLiveVoice ? 'END LIVE TALK' : 'START LIVE TALK'}
            </button>
         </div>

         <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl p-4 ${
                  msg.role === 'user'
                    ? 'bg-[#035925] text-white rounded-br-sm shadow-sm'
                    : msg.role === 'system'
                    ? 'bg-[#f9f6f1] text-[#5d6c7b] border border-[#002c11]/10 text-center w-full text-xs font-bold uppercase tracking-wider'
                    : 'bg-[#f9f6f1] text-slate-800 border border-[#002c11]/10 rounded-bl-sm shadow-sm'
                }`}>
                  {msg.image && (
                    <img src={msg.image} alt="Uploaded" className="w-full rounded-xl mb-3 border border-[#002c11]/10" />
                  )}
                  <div className={`prose prose-sm max-w-none ${msg.role === 'user' ? 'prose-invert' : 'text-[#002c11]/80'}`}>
                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                  </div>
                </div>
              </div>
            ))}
            {isProcessing && (
              <div className="flex justify-start">
                <div className="bg-[#f9f6f1] border border-[#002c11]/10 rounded-2xl rounded-bl-sm p-4 flex items-center gap-2 shadow-sm">
                  <Loader2 className="w-4 h-4 text-[#035925] animate-spin" />
                  <span className="text-sm text-[#5d6c7b]">Analyzing...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
         </div>

         <div className="p-4 border-t border-[#002c11]/5 bg-white rounded-b-2xl">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendText()}
                placeholder={isCameraActive ? "Ask about the camera feed..." : "Ask Mkulima AI..."}
                className="flex-1 bg-white border border-[#002c11]/10 text-[#002c11] rounded-xl px-4 py-3 focus:outline-none focus:border-[#035925] focus:ring-1 focus:ring-[#035925] placeholder-[#5d6c7b]/60 shadow-sm"
                disabled={isLiveVoice || isProcessing}
              />
              <button
                onClick={handleSendText}
                disabled={isLiveVoice || isProcessing || (!inputText.trim() && !uploadedMedia && !isCameraActive)}
                className="p-3 bg-[#035925] text-white rounded-xl hover:bg-[#002c11] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                <Send className="w-5 h-5"/>
              </button>
            </div>
         </div>
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
