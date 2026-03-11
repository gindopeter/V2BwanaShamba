import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, Loader2, Mic, Video, Square, MessageSquare, Volume2, Send, Image as ImageIcon } from 'lucide-react';
import { GoogleGenAI, Modality } from '@google/genai';
import ReactMarkdown from 'react-markdown';

// --- Audio Utils ---
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
// -------------------

export default function LiveScout() {
  // State
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isLiveVoice, setIsLiveVoice] = useState(false);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [messages, setMessages] = useState<{role: string, text: string, image?: string}[]>([
    { role: 'ai', text: 'Jambo! I am Mkulima AI. Upload an image, turn on your camera, or start a Live Voice session to begin.' }
  ]);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);

  // Live API Refs
  const aiRef = useRef<any>(null);
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const frameIntervalRef = useRef<any>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isLiveVoice) stopLiveVoice();
      if (mediaStream) mediaStream.getTracks().forEach(t => t.stop());
      if (audioStreamRef.current) audioStreamRef.current.getTracks().forEach(t => t.stop());
    };
  }, [isLiveVoice, mediaStream]);

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
        setUploadedImage(null);
      } catch (err: any) {
        console.error(err);
        alert(`Camera access error: ${err.message || 'Denied or unavailable.'}`);
      }
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (isCameraActive) toggleCamera(); // stop camera to show image
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSendText = async () => {
    if (!inputText.trim() && !uploadedImage && !isCameraActive) return;
    
    let imageData = uploadedImage ? uploadedImage.split(',')[1] : undefined;
    
    // Capture frame if camera is active and no image uploaded
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
      image: uploadedImage || (imageData ? `data:image/jpeg;base64,${imageData}` : undefined) 
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setUploadedImage(null);
    setIsProcessing(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      let parts: any[] = [{ text: userMsg.text }];
      if (imageData) {
        parts.unshift({
            inlineData: { mimeType: "image/jpeg", data: imageData }
        });
      }

      const systemInstruction = `You are 'Mkulima AI' (AI Farm Supervisor) for a 5-acre tomato and onion farm in Malivundo, Pwani, Tanzania.
      Core Objective: Manage irrigation and fertigation. Balance crop health with resource conservation (fuel for the 8kVA generator).
      
      Operational Rules:
      1. You speak English and Kiswahili. If the user speaks Kiswahili, respond in Kiswahili with a helpful, professional tone.
      2. The 10-Minute Buffer (STRICT): You CANNOT execute a physical hardware change (starting a pump) without a 10-minute warning.
         - Step 1: Call 'send_whatsapp_notification' with a clear message in English and Kiswahili.
         - Step 2: Tell the user you have logged the action as PENDING with a 10-minute countdown.
         - Step 3: Only after 10 minutes (simulated), if no CANCEL command is received, you would call 'toggle_pump'.
      3. Context: You know the farm uses an 8kVA generator. Be mindful of fuel.
      4. Pests: Be aware of local pests like Tuta Absoluta.
      
      Current Date: ${new Date().toISOString()}
      `;

      const tools = [{
        functionDeclarations: [
          {
            name: "send_whatsapp_notification",
            description: "Send a 10-minute warning message to the farmer in English and Kiswahili before starting the pump.",
            parameters: {
              type: "OBJECT",
              properties: {
                phone_number: { type: "STRING", description: "The farmer's phone number" },
                message: { type: "STRING", description: "The warning message in English and Kiswahili" }
              },
              required: ["phone_number", "message"]
            }
          },
          {
            name: "toggle_pump",
            description: "Physically turn the irrigation pump ON or OFF. MUST ONLY BE CALLED 10 minutes AFTER the whatsapp notification.",
            parameters: {
              type: "OBJECT",
              properties: {
                state: { type: "STRING", description: "'ON' or 'OFF'" }
              },
              required: ["state"]
            }
          }
        ]
      }];

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: [{ parts }],
        config: {
            systemInstruction: systemInstruction,
            tools: tools as any
        }
      });

      const candidate = response.candidates?.[0];
      const functionCalls = candidate?.content?.parts?.filter(p => p.functionCall).map(p => p.functionCall);

      if (functionCalls && functionCalls.length > 0) {
        const call = functionCalls[0];
        if (call.name === 'send_whatsapp_notification') {
           const args = call.args as any;
           // Log the pending action via backend
           await fetch('/api/tasks', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({
               zone_id: 1,
               task_type: 'Irrigation',
               scheduled_time: new Date(Date.now() + 10 * 60000).toISOString(),
               duration_minutes: 60,
               reasoning: `Pending 10-min buffer. WhatsApp sent: ${args.message}`
             })
           });
           
           setMessages(prev => [...prev, { role: 'ai', text: `[SYSTEM ACTION]: WhatsApp notification sent to ${args.phone_number}.\n\nMessage: "${args.message}"\n\nI have initiated the 10-minute countdown buffer. If you do not cancel, the irrigation pump will start.` }]);
           setIsProcessing(false);
           return;
        } else if (call.name === 'toggle_pump') {
           const args = call.args as any;
           setMessages(prev => [...prev, { role: 'ai', text: `[SYSTEM ACTION]: Irrigation pump toggled to ${args.state}. Generator load updated.` }]);
           setIsProcessing(false);
           return;
        }
      }

      setMessages(prev => [...prev, { role: 'ai', text: response.text || '' }]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'system', text: 'Error connecting to Mkulima AI.' }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const startLiveVoice = async () => {
    try {
      setIsLiveVoice(true);
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
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
        model: "gemini-2.5-flash-native-audio-preview-09-2025",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } } },
          systemInstruction: "You are Mkulima AI, a farm supervisor in Tanzania. You are looking at a live camera feed of a tomato and onion farm. Help the farmer identify pests like Tuta Absoluta, check irrigation, and answer questions. Speak in English and Kiswahili.",
        },
        callbacks: {
          onopen: () => {
            console.log("Live API Connected");
            setMessages(prev => [...prev, { role: 'system', text: '🟢 Live Voice Session Started' }]);

            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const downsampled = downsample(inputData, audioCtx.sampleRate, 16000);
              const base64 = float32ToBase64(downsampled);
              sessionPromise.then(session => {
                session.sendRealtimeInput({ media: { data: base64, mimeType: 'audio/pcm;rate=16000' } });
              });
            };

            frameIntervalRef.current = setInterval(() => {
              if (videoRef.current && canvasRef.current && isCameraActive) {
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
      sessionRef.current.then((session: any) => session.close());
      sessionRef.current = null;
    }
    setMessages(prev => [...prev, { role: 'system', text: '🔴 Live Voice Session Ended' }]);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-10rem)] max-h-[800px]">
      {/* Left: Media Area */}
      <div className="w-full lg:w-1/2 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col shadow-sm">
         {/* Header */}
         <div className="p-4 border-b border-slate-800 bg-slate-950 flex justify-between items-center">
            <h3 className="font-bold text-slate-100 flex items-center gap-2">
              <Video className="w-5 h-5 text-indigo-400"/> 
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
               <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
            </div>
         </div>
         
         {/* Content */}
         <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
            {isCameraActive ? (
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            ) : uploadedImage ? (
              <img src={uploadedImage} className="w-full h-full object-contain" />
            ) : (
              <div className="text-center text-slate-600">
                <Camera className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p className="font-medium">Start camera or upload an image to begin</p>
              </div>
            )}
            
            {isLiveVoice && (
              <div className="absolute top-4 right-4 bg-red-500/20 border border-red-500/50 text-red-400 px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 animate-pulse shadow-lg backdrop-blur-sm">
                <Mic className="w-4 h-4" /> LIVE AUDIO ACTIVE
              </div>
            )}
         </div>
      </div>

      {/* Right: Chat Area */}
      <div className="w-full lg:w-1/2 bg-white border border-slate-100 rounded-2xl flex flex-col shadow-sm">
         {/* Header */}
         <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center rounded-t-2xl">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-indigo-600"/> 
              Mkulima AI
            </h3>
            <button 
              onClick={isLiveVoice ? stopLiveVoice : startLiveVoice}
              className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-sm ${isLiveVoice ? 'bg-red-50 hover:bg-red-100 text-red-600 border border-red-200' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
            >
              {isLiveVoice ? <Square className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              {isLiveVoice ? 'END LIVE TALK' : 'START LIVE TALK'}
            </button>
         </div>
         
         {/* Messages */}
         <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl p-4 ${
                  msg.role === 'user' 
                    ? 'bg-indigo-600 text-white rounded-br-sm shadow-sm' 
                    : msg.role === 'system'
                    ? 'bg-slate-50 text-slate-500 border border-slate-200 text-center w-full text-xs font-bold uppercase tracking-wider'
                    : 'bg-slate-50 text-slate-800 border border-slate-200 rounded-bl-sm shadow-sm'
                }`}>
                  {msg.image && (
                    <img src={msg.image} alt="Uploaded" className="w-full rounded-xl mb-3 border border-slate-200" />
                  )}
                  <div className={`prose prose-sm max-w-none ${msg.role === 'user' ? 'prose-invert' : 'text-slate-700'}`}>
                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                  </div>
                </div>
              </div>
            ))}
            {isProcessing && (
              <div className="flex justify-start">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl rounded-bl-sm p-4 flex items-center gap-2 shadow-sm">
                  <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
                  <span className="text-sm text-slate-500">Analyzing...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
         </div>
         
         {/* Input */}
         <div className="p-4 border-t border-slate-100 bg-white rounded-b-2xl">
            <div className="flex items-center gap-2">
              <input 
                type="text" 
                value={inputText} 
                onChange={e => setInputText(e.target.value)} 
                onKeyDown={e => e.key === 'Enter' && handleSendText()} 
                placeholder={isCameraActive ? "Ask about the camera feed..." : "Ask Mkulima AI..."} 
                className="flex-1 bg-white border border-slate-200 text-slate-900 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 placeholder-slate-400 shadow-sm" 
                disabled={isLiveVoice || isProcessing}
              />
              <button 
                onClick={handleSendText} 
                disabled={isLiveVoice || isProcessing || (!inputText.trim() && !uploadedImage && !isCameraActive)}
                className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
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
