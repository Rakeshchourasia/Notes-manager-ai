import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Bot, User, Loader2, Mic, MicOff } from 'lucide-react';
import api from '../services/api';

export default function ChatAssistant() {
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState([
        { role: 'assistant', content: "Hi! I'm your AI study assistant 🧠 Ask me anything about your study topics! (Tip: I remember our conversation context)" }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [listening, setListening] = useState(false);
    const bottomRef = useRef(null);
    const recognitionRef = useRef(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Build conversation history (last 6 messages, excluding the initial system greeting)
    const getHistory = useCallback(() => {
        return messages.slice(1).slice(-6).map(m => ({ role: m.role, content: m.content }));
    }, [messages]);

    const sendMessage = async (text) => {
        const question = (text || input).trim();
        if (!question || loading) return;
        setInput('');
        setMessages(m => [...m, { role: 'user', content: question }]);
        setLoading(true);
        try {
            const history = getHistory();
            const { data } = await api.post('/chat', { question, history });
            setMessages(m => [...m, { role: 'assistant', content: data.answer }]);
        } catch {
            setMessages(m => [...m, {
                role: 'assistant',
                content: "Sorry, I couldn't connect to the AI. Make sure the backend is running and your API key is configured."
            }]);
        } finally {
            setLoading(false);
        }
    };

    // Voice input using Web Speech API
    const toggleListening = useCallback(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert('Voice input is not supported in this browser. Try Chrome or Edge.');
            return;
        }

        if (listening) {
            recognitionRef.current?.stop();
            setListening(false);
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onresult = (e) => {
            const transcript = e.results[0][0].transcript;
            setInput(prev => prev + (prev ? ' ' : '') + transcript);
        };
        recognition.onend = () => setListening(false);
        recognition.onerror = () => setListening(false);

        recognitionRef.current = recognition;
        recognition.start();
        setListening(true);
    }, [listening]);

    return (
        <>
            {/* Floating Button */}
            <motion.button
                onClick={() => setOpen(o => !o)}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600 to-purple-700 text-white shadow-[0_0_30px_rgba(124,58,237,0.5)] flex items-center justify-center"
            >
                <AnimatePresence mode="wait">
                    {open ? (
                        <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
                            <X size={22} />
                        </motion.div>
                    ) : (
                        <motion.div key="open" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }}>
                            <MessageCircle size={22} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.button>

            {/* Chat Panel */}
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        transition={{ duration: 0.25 }}
                        className="fixed bottom-24 right-6 z-50 w-[360px] h-[480px] glass-strong rounded-2xl flex flex-col overflow-hidden border border-violet-500/20 shadow-[0_0_40px_rgba(124,58,237,0.2)]"
                    >
                        {/* Header */}
                        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.08] bg-violet-600/10">
                            <div className="w-8 h-8 rounded-xl bg-violet-600/30 flex items-center justify-center">
                                <Bot size={16} className="text-violet-300" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-white">AI Study Assistant</p>
                                <p className="text-[10px] text-violet-400">Remembers conversation context</p>
                            </div>
                            <div className="ml-auto w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                            {messages.map((msg, i) => (
                                <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${msg.role === 'user' ? 'bg-violet-600' : 'bg-slate-700'}`}>
                                        {msg.role === 'user' ? <User size={12} className="text-white" /> : <Bot size={12} className="text-violet-300" />}
                                    </div>
                                    <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm leading-relaxed whitespace-pre-wrap ${msg.role === 'user'
                                        ? 'bg-violet-600/30 text-white border border-violet-500/30 rounded-tr-sm'
                                        : 'bg-white/[0.04] text-slate-300 border border-white/[0.06] rounded-tl-sm'
                                    }`}>
                                        {msg.content}
                                    </div>
                                </div>
                            ))}
                            {loading && (
                                <div className="flex gap-2">
                                    <div className="w-7 h-7 rounded-lg bg-slate-700 flex items-center justify-center">
                                        <Bot size={12} className="text-violet-300" />
                                    </div>
                                    <div className="bg-white/[0.04] border border-white/[0.06] px-3 py-2 rounded-xl rounded-tl-sm flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </div>
                                </div>
                            )}
                            <div ref={bottomRef} />
                        </div>

                        {/* Input */}
                        <div className="px-3 py-3 border-t border-white/[0.08]">
                            {listening && (
                                <div className="flex items-center gap-2 mb-2 px-1">
                                    <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                                    <span className="text-xs text-red-400">Listening… speak now</span>
                                </div>
                            )}
                            <div className="flex gap-2">
                                <input
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && sendMessage()}
                                    placeholder="Ask anything about your notes…"
                                    className="flex-1 bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-violet-500/50 transition-colors"
                                />
                                {/* Voice input button */}
                                <button
                                    onClick={toggleListening}
                                    title={listening ? 'Stop listening' : 'Voice input'}
                                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${listening
                                        ? 'bg-red-500 text-white animate-pulse'
                                        : 'bg-white/[0.06] text-slate-400 hover:bg-violet-600/30 hover:text-violet-300'
                                    }`}
                                >
                                    {listening ? <MicOff size={14} /> : <Mic size={14} />}
                                </button>
                                <button
                                    onClick={() => sendMessage()}
                                    disabled={!input.trim() || loading}
                                    className="w-9 h-9 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all"
                                >
                                    <Send size={14} className="text-white" />
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
