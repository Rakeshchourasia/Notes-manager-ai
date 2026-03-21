import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    Brain, Upload, BookOpen, Sparkles, ArrowRight, Zap, Target, BarChart3,
    LogIn, UserPlus, FileText, FlipHorizontal, CheckCircle2, Star,
    Award, Clock, ChevronDown, MessageCircle, Bot
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ChatAssistant from '../components/ChatAssistant';

const features = [
    {
        icon: Brain, title: 'AI-Powered Notes',
        desc: 'Upload any syllabus and watch AI generate comprehensive, structured notes with definitions, key terms, examples, and real-world applications.',
        color: 'from-violet-600 to-purple-700', glow: 'rgba(124,58,237,0.3)'
    },
    {
        icon: Zap, title: 'Visual Flowcharts',
        desc: 'Every topic gets automatic Mermaid.js diagrams that visualize concept relationships and logical flow beautifully.',
        color: 'from-cyan-600 to-blue-700', glow: 'rgba(6,182,212,0.3)'
    },
    {
        icon: Target, title: 'Smart Quizzes & Flashcards',
        desc: 'AI generates tailored quizzes and flashcards with spaced repetition scheduling using the SM-2 algorithm.',
        color: 'from-pink-600 to-rose-700', glow: 'rgba(236,72,153,0.3)'
    },
    {
        icon: BarChart3, title: 'Progress Dashboard',
        desc: 'Track completion across topics, quiz scores, daily streaks, and XP levels with a gamified study experience.',
        color: 'from-emerald-600 to-teal-700', glow: 'rgba(16,185,129,0.3)'
    },
];

const howItWorks = [
    { step: '01', title: 'Upload Your Syllabus', desc: 'Drop a PDF or paste your syllabus text — we handle the rest', icon: Upload },
    { step: '02', title: 'AI Extracts Topics', desc: 'Topics are intelligently extracted and organized in order', icon: FileText },
    { step: '03', title: 'Generate Rich Notes', desc: 'Each topic gets AI-generated notes with diagrams, Q&A, and flashcards', icon: Brain },
    { step: '04', title: 'Study & Track Progress', desc: 'Use quizzes, flashcards, and progress tracking to ace your exams', icon: Award },
];

const testimonials = [
    { name: 'Alex P.', role: 'CS Student', quote: 'NoteAI turned my 200-page textbook into perfectly structured notes in minutes. Game changer for exam prep.', avatar: 'A' },
    { name: 'Priya S.', role: 'Medical Student', quote: 'The flashcards with spaced repetition helped me retain anatomy terms 3x better than traditional methods.', avatar: 'P' },
    { name: 'Marcus R.', role: 'Engineering Student', quote: 'Being able to generate quizzes from my own syllabus is incredible. My grades improved significantly.', avatar: 'M' },
];

export default function Landing() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [activeFeature, setActiveFeature] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => setActiveFeature(p => (p + 1) % features.length), 4000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="min-h-screen gradient-bg overflow-x-hidden">
            {/* Animated background elements */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-48 -left-48 w-[500px] h-[500px] bg-violet-600/20 rounded-full blur-[150px]" />
                <div className="absolute -bottom-48 -right-48 w-[500px] h-[500px] bg-cyan-600/15 rounded-full blur-[150px]" />
                <div className="absolute top-1/3 right-1/4 w-72 h-72 bg-pink-600/10 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '6s' }} />

                {/* Subtle grid */}
                <div className="absolute inset-0 opacity-[0.03]" style={{
                    backgroundImage: 'linear-gradient(rgba(167,139,250,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(167,139,250,0.4) 1px, transparent 1px)',
                    backgroundSize: '64px 64px'
                }} />
            </div>

            {/* Nav */}
            <nav className="relative z-10 flex items-center justify-between px-6 md:px-12 py-5">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-purple-800 flex items-center justify-center glow-brand shadow-lg">
                        <Brain size={20} className="text-white" />
                    </div>
                    <span className="font-bold text-white text-xl tracking-tight">NoteAI</span>
                    <span className="hidden sm:inline text-[10px] text-violet-400 bg-violet-600/15 border border-violet-500/30 rounded-full px-2 py-0.5 font-medium ml-1">BETA</span>
                </div>
                <div className="flex items-center gap-3">
                    {user ? (
                        <motion.button
                            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                            onClick={() => navigate('/dashboard')}
                            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-semibold px-5 py-2.5 rounded-xl transition-all glow-brand text-sm"
                        >
                            Dashboard <ArrowRight size={14} />
                        </motion.button>
                    ) : (
                        <>
                            <button
                                onClick={() => navigate('/login')}
                                className="hidden sm:flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors text-sm font-medium px-4 py-2.5"
                            >
                                <LogIn size={14} /> Sign In
                            </button>
                            <motion.button
                                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                                onClick={() => navigate('/signup')}
                                className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-semibold px-5 py-2.5 rounded-xl transition-all glow-brand text-sm"
                            >
                                <UserPlus size={14} /> Get Started
                            </motion.button>
                        </>
                    )}
                </div>
            </nav>

            {/* ═══════════ HERO SECTION ═══════════ */}
            <section className="relative z-10 flex flex-col items-center justify-center px-6 pt-16 md:pt-24 pb-16 text-center">
                <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
                    {/* Badge */}
                    <div className="inline-flex items-center gap-2 bg-violet-600/10 border border-violet-500/20 rounded-full px-4 py-1.5 mb-8 backdrop-blur-sm">
                        <Sparkles size={13} className="text-violet-400" />
                        <span className="text-xs text-violet-300 font-medium">Powered by LLaMA 3.3 · 70B</span>
                    </div>

                    {/* Headline */}
                    <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black text-white mb-6 leading-[1.05] tracking-tight">
                        Study Smarter with<br />
                        <span className="gradient-text">AI-Generated Notes</span>
                    </h1>

                    {/* Subheadline */}
                    <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-12 leading-relaxed">
                        Upload your syllabus. Get instant structured notes, visual flowcharts,
                        smart quizzes, and spaced-repetition flashcards — all in one place.
                    </p>

                    {/* CTA Buttons */}
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <motion.button
                            whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.96 }}
                            onClick={() => navigate(user ? '/upload' : '/signup')}
                            className="flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-purple-700 text-white font-bold px-8 py-4 rounded-2xl text-lg shadow-[0_0_40px_rgba(124,58,237,0.4)] hover:shadow-[0_0_60px_rgba(124,58,237,0.6)] transition-all"
                        >
                            <Upload size={20} /> {user ? 'Upload Syllabus' : 'Start for Free'}
                        </motion.button>
                        <motion.button
                            whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.96 }}
                            onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                            className="flex items-center justify-center gap-2 glass border border-white/[0.1] text-slate-300 font-semibold px-8 py-4 rounded-2xl text-lg hover:bg-white/[0.08] hover:text-white transition-all"
                        >
                            See How It Works <ChevronDown size={18} />
                        </motion.button>
                    </div>
                </motion.div>
            </section>

            {/* ═══════════ STATS BAR ═══════════ */}
            <motion.div
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.6 }}
                className="relative z-10 max-w-4xl mx-auto mb-20 px-6"
            >
                <div className="glass rounded-2xl border border-white/[0.08] grid grid-cols-2 md:grid-cols-4 divide-x divide-white/[0.06] py-6">
                    {[
                        ['10x', 'Faster Studying'],
                        ['AI', 'Powered Diagrams'],
                        ['SM-2', 'Spaced Repetition'],
                        ['∞', 'Topic Coverage']
                    ].map(([val, label]) => (
                        <div key={label} className="text-center px-4">
                            <p className="text-3xl font-black gradient-text">{val}</p>
                            <p className="text-xs text-slate-500 mt-1 font-medium">{label}</p>
                        </div>
                    ))}
                </div>
            </motion.div>

            {/* ═══════════ FEATURES SECTION ═══════════ */}
            <section id="features" className="relative z-10 max-w-6xl mx-auto px-6 pb-24">
                <motion.div
                    initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
                    viewport={{ once: true }} transition={{ duration: 0.5 }}
                    className="text-center mb-16"
                >
                    <span className="text-xs text-violet-400 uppercase tracking-widest font-semibold">Features</span>
                    <h2 className="text-3xl md:text-4xl font-bold text-white mt-3">
                        Everything you need to study <span className="gradient-text">smarter</span>
                    </h2>
                    <p className="text-slate-500 mt-3 max-w-lg mx-auto">AI-powered tools that transform how you learn, retain, and master any subject.</p>
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {features.map(({ icon: Icon, title, desc, color, glow }, i) => (
                        <motion.div
                            key={title}
                            initial={{ opacity: 0, y: 25 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.1 }}
                            whileHover={{ y: -6, scale: 1.01 }}
                            onMouseEnter={() => setActiveFeature(i)}
                            className={`glass rounded-2xl p-6 border transition-all duration-300 cursor-default ${activeFeature === i
                                ? 'border-violet-500/30 shadow-[0_0_30px_' + glow + ']'
                                : 'border-white/[0.06] hover:border-white/[0.12]'
                                }`}
                        >
                            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center mb-4 shadow-lg`}>
                                <Icon size={22} className="text-white" />
                            </div>
                            <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
                            <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* ═══════════ HOW IT WORKS ═══════════ */}
            <section className="relative z-10 max-w-5xl mx-auto px-6 pb-24">
                <motion.div
                    initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
                    viewport={{ once: true }} transition={{ duration: 0.5 }}
                    className="text-center mb-14"
                >
                    <span className="text-xs text-cyan-400 uppercase tracking-widest font-semibold">How it works</span>
                    <h2 className="text-3xl md:text-4xl font-bold text-white mt-3">
                        From syllabus to study-ready in <span className="text-cyan-400">4 steps</span>
                    </h2>
                </motion.div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    {howItWorks.map(({ step, title, desc, icon: Icon }, i) => (
                        <motion.div
                            key={step}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.12 }}
                            className="glass rounded-2xl p-5 border border-white/[0.06] relative overflow-hidden group"
                        >
                            <span className="absolute top-3 right-3 text-4xl font-black text-white/[0.04] group-hover:text-violet-500/10 transition-colors">{step}</span>
                            <div className="w-10 h-10 rounded-xl bg-white/[0.06] flex items-center justify-center mb-3">
                                <Icon size={18} className="text-violet-400" />
                            </div>
                            <h4 className="text-sm font-bold text-white mb-1">{title}</h4>
                            <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* ═══════════ TESTIMONIALS ═══════════ */}
            <section className="relative z-10 max-w-5xl mx-auto px-6 pb-24">
                <motion.div
                    initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
                    viewport={{ once: true }} transition={{ duration: 0.5 }}
                    className="text-center mb-14"
                >
                    <span className="text-xs text-pink-400 uppercase tracking-widest font-semibold">Testimonials</span>
                    <h2 className="text-3xl md:text-4xl font-bold text-white mt-3">
                        Loved by <span className="text-pink-400">students</span> everywhere
                    </h2>
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {testimonials.map(({ name, role, quote, avatar }, i) => (
                        <motion.div
                            key={name}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.1 }}
                            className="glass rounded-2xl p-6 border border-white/[0.06]"
                        >
                            <div className="flex gap-1 mb-3">
                                {Array.from({ length: 5 }).map((_, j) => (
                                    <Star key={j} size={13} className="text-amber-400 fill-amber-400" />
                                ))}
                            </div>
                            <p className="text-slate-300 text-sm leading-relaxed mb-4 italic">"{quote}"</p>
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center">
                                    <span className="text-xs font-bold text-white">{avatar}</span>
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-white">{name}</p>
                                    <p className="text-[10px] text-slate-500">{role}</p>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* ═══════════ FINAL CTA ═══════════ */}
            <section className="relative z-10 px-6 pb-20">
                <div className="max-w-3xl mx-auto glass rounded-3xl p-10 md:p-14 border border-violet-500/20 text-center relative overflow-hidden">
                    {/* CTA glow */}
                    <div className="absolute inset-0 bg-gradient-to-r from-violet-900/20 via-purple-900/10 to-violet-900/20 rounded-3xl" />
                    <div className="relative z-10">
                        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center mb-6 glow-brand shadow-xl">
                            <Brain size={28} className="text-white" />
                        </div>
                        <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">Ready to study smarter?</h2>
                        <p className="text-slate-400 mb-8 max-w-md mx-auto">Join students who are already using AI to transform their study materials into powerful learning tools.</p>
                        <motion.button
                            whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.96 }}
                            onClick={() => navigate(user ? '/upload' : '/signup')}
                            className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-600 to-purple-700 text-white font-bold px-10 py-4 rounded-2xl text-lg shadow-[0_0_40px_rgba(124,58,237,0.4)] hover:shadow-[0_0_60px_rgba(124,58,237,0.6)] transition-all"
                        >
                            {user ? 'Upload Syllabus' : 'Get Started Free'} <ArrowRight size={18} />
                        </motion.button>
                        {!user && <p className="text-slate-600 text-xs mt-4">No credit card required · Free forever for basic use</p>}
                    </div>
                </div>
            </section>

            {/* ═══════════ FOOTER ═══════════ */}
            <footer className="relative z-10 border-t border-white/[0.05] px-6 py-8">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <Brain size={16} className="text-violet-400" />
                        <span className="text-sm font-semibold text-white">NoteAI</span>
                        <span className="text-xs text-slate-600">— AI Study Notes Generator</span>
                    </div>
                    <p className="text-xs text-slate-700">© {new Date().getFullYear()} NoteAI. Built with ❤️ for students.</p>
                </div>
            </footer>

            {/* Chat Assistant on Landing page */}
            <ChatAssistant />
        </div>
    );
}
