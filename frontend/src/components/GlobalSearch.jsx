import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, BookOpen, Hash, FileText, Command } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const typeIcons = { syllabus: BookOpen, topic: Hash, note: FileText };

export default function GlobalSearch() {
    const { user } = useAuth();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState(0);
    const inputRef = useRef(null);
    const navigate = useNavigate();

    // Ctrl+K / Cmd+K to open
    useEffect(() => {
        const handler = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                if (user) setOpen(o => !o);
            }
            if (e.key === 'Escape') setOpen(false);
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [user]);

    useEffect(() => {
        if (open) {
            setTimeout(() => inputRef.current?.focus(), 100);
            setQuery('');
            setResults([]);
            setSelected(0);
        }
    }, [open]);

    useEffect(() => {
        if (!query || query.length < 2) { setResults([]); return; }
        const t = setTimeout(async () => {
            setLoading(true);
            try {
                const res = await api.get(`/search?q=${encodeURIComponent(query)}`);
                setResults(res.data.results || []);
                setSelected(0);
            } catch { setResults([]); }
            finally { setLoading(false); }
        }, 300);
        return () => clearTimeout(t);
    }, [query]);

    const go = (url) => {
        setOpen(false);
        navigate(url);
    };

    const handleKey = (e) => {
        if (e.key === 'ArrowDown') setSelected(s => Math.min(s + 1, results.length - 1));
        if (e.key === 'ArrowUp') setSelected(s => Math.max(s - 1, 0));
        if (e.key === 'Enter' && results[selected]) go(results[selected].url);
    };

    if (!user) return null;

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[9999] flex items-start justify-center pt-24 px-4"
                    style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
                    onClick={() => setOpen(false)}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -20 }}
                        transition={{ duration: 0.15 }}
                        className="w-full max-w-xl glass rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Search input */}
                        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.07]">
                            <Search size={16} className="text-slate-500 flex-shrink-0" />
                            <input
                                ref={inputRef}
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                onKeyDown={handleKey}
                                placeholder="Search syllabuses, topics, notes…"
                                className="flex-1 bg-transparent text-white placeholder-slate-500 text-sm outline-none"
                            />
                            {loading && <div className="w-4 h-4 border-2 border-violet-500/40 border-t-violet-400 rounded-full animate-spin" />}
                            <button onClick={() => setOpen(false)} className="text-slate-600 hover:text-white transition-colors">
                                <X size={14} />
                            </button>
                        </div>

                        {/* Results */}
                        <div className="max-h-80 overflow-y-auto py-2">
                            {results.length === 0 && query.length >= 2 && !loading && (
                                <p className="text-center text-slate-600 text-sm py-8">No results for "{query}"</p>
                            )}
                            {results.length === 0 && query.length < 2 && (
                                <p className="text-center text-slate-700 text-sm py-8">Type at least 2 characters to search</p>
                            )}
                            {results.map((r, i) => {
                                const Icon = typeIcons[r.type] || FileText;
                                return (
                                    <button
                                        key={r.id}
                                        onClick={() => go(r.url)}
                                        className={`w-full flex items-start gap-3 px-4 py-2.5 text-left transition-colors ${i === selected ? 'bg-violet-600/20' : 'hover:bg-white/[0.04]'}`}
                                    >
                                        <Icon size={15} className="text-violet-400 mt-0.5 flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-white truncate">{r.title}</p>
                                            <p className="text-xs text-slate-500 capitalize">{r.subtitle}</p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Footer hint */}
                        <div className="flex items-center gap-4 px-4 py-2.5 border-t border-white/[0.05] text-xs text-slate-700">
                            <span className="flex items-center gap-1"><Command size={10} /> K to toggle</span>
                            <span>↑↓ navigate</span>
                            <span>↵ open</span>
                            <span>Esc close</span>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
