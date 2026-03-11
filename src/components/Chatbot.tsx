import { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, Image as ImageIcon, X, Loader2 } from 'lucide-react';
import { sendChatMessage } from '../lib/api';
import { cn } from '../lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  image?: string;
}

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'assistant', text: 'Hello! I am your AI Farm Assistant. Ask me anything about your crops, soil, or pest control.' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        // Remove data URL prefix for API
        const base64Data = base64String.split(',')[1];
        setSelectedImage(base64Data);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && !selectedImage) || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      image: selectedImage ? `data:image/jpeg;base64,${selectedImage}` : undefined
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    const imageToSend = selectedImage; // Capture for API call
    setSelectedImage(null);
    setIsLoading(true);

    try {
      const response = await sendChatMessage(userMsg.text, imageToSend || undefined);
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: response.reply
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', text: 'Sorry, I encountered an error. Please try again.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 w-14 h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all z-50",
          isOpen && "hidden"
        )}
      >
        <MessageSquare className="w-7 h-7" />
      </button>

      {/* Chat Window */}
      <div className={cn(
        "fixed bottom-6 right-6 w-96 h-[600px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col z-50 transition-all transform origin-bottom-right",
        !isOpen && "scale-0 opacity-0 pointer-events-none"
      )}>
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-emerald-600 text-white rounded-t-2xl">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <MessageSquare className="w-5 h-5" />
            </div>
            <h3 className="font-bold">Farm Assistant</h3>
          </div>
          <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex flex-col max-w-[80%]",
                msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
              )}
            >
              <div
                className={cn(
                  "p-3 rounded-2xl text-sm",
                  msg.role === 'user'
                    ? "bg-emerald-600 text-white rounded-tr-none"
                    : "bg-white border border-slate-200 text-slate-800 rounded-tl-none shadow-sm"
                )}
              >
                {msg.image && (
                  <img src={msg.image} alt="Uploaded" className="w-full h-32 object-cover rounded-lg mb-2" />
                )}
                <p>{msg.text}</p>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white border border-slate-200 p-3 rounded-2xl rounded-tl-none shadow-sm">
                <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 bg-white border-t border-slate-100">
          {selectedImage && (
             <div className="mb-2 flex items-center gap-2 bg-slate-100 p-2 rounded-lg w-fit">
                <span className="text-xs text-slate-500">Image attached</span>
                <button onClick={() => setSelectedImage(null)} className="text-slate-400 hover:text-red-500">
                    <X className="w-3 h-3" />
                </button>
             </div>
          )}
          <div className="flex gap-2">
            <button 
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-slate-50 rounded-lg"
            >
              <ImageIcon className="w-5 h-5" />
            </button>
            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*"
                onChange={handleImageSelect}
            />
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask about crops..."
              className="flex-1 border-0 focus:ring-0 text-sm bg-transparent"
            />
            <button 
                onClick={handleSend}
                disabled={isLoading || (!input && !selectedImage)}
                className="p-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
