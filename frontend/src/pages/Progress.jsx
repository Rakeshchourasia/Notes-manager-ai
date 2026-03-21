import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, Brain, CheckCircle, Star, Loader2, ArrowLeft, ChevronRight, X, Check, RefreshCw, Calendar } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

// Flashcard component
function FlashCard({ term, definition }) {
    const [flipped, setFlipped] = useState(false);
    return (
        <div className="flip-card w-full h-44 cursor-pointer" onClick={() => setFlipped(f => !f)}>
            <div className={`flip-card-inner relative w-full h-full ${flipped ? 'flipped' : ''}`}>
                {/* Front */}
                <div className="flip-card-front absolute inset-0 glass rounded-2xl border border-white/[0.08] flex flex-col items-center justify-center p-6 text-center">
                    <span className="text-xs text-violet-400 mb-2 font-medium uppercase tracking-wider">Term</span>
                    <p className="text-white font-bold text-lg">{term}</p>
                    <span className="text-xs text-slate-600 mt-3">Click to reveal</span>
                </div>
                {/* Back */}
                <div className="flip-card-back absolute inset-0 glass-strong rounded-2xl border border-violet-500/30 flex flex-col items-center justify-center p-6 text-center">
                    <span className="text-xs text-violet-400 mb-2 font-medium uppercase tracking-wider">Definition</span>
                    <p className="text-slate-300 text-sm leading-relaxed">{definition}</p>
                </div>
            </div>
        </div>
    );
}

// Quiz component
function QuizModal({ questions, onClose, syllabusId }) {
    const [current, setCurrent] = useState(0);
    const [selected, setSelected] = useState(null);
    const [answered, setAnswered] = useState(false);
    const [score, setScore] = useState(0);
    const [done, setDone] = useState(false);

    const submitScore = async (finalScore) => {
        try {
            await api.post(`/progress/${syllabusId}/quiz-score`, { score: finalScore, total: questions.length });
        } catch { }
    };

    const handleAnswer = (idx) => {
        if (answered) return;
        setSelected(idx);
        setAnswered(true);
        const correct = idx === questions[current].correctIndex;
        if (correct) setScore(s => s + 1);
    };

    const next = () => {
        if (current < questions.length - 1) {
            setCurrent(c => c + 1);
            setSelected(null);
            setAnswered(false);
        } else {
            setDone(true);
            submitScore(score + (selected === questions[current].correctIndex ? 1 : 0));
        }
    };

    const q = questions[current];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass-strong rounded-2xl border border-violet-500/20 w-full max-w-lg p-6 shadow-[0_0_60px_rgba(124,58,237,0.2)]"
            >
                <div className="flex items-center justify-between mb-5">
                    <h3 className="font-bold text-white flex items-center gap-2"><Brain size={18} className="text-violet-400" /> Quiz Time</h3>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors"><X size={18} /></button>
                </div>

                {!done ? (
                    <>
                        {/* Progress */}
                        <div className="flex items-center gap-2 mb-5">
                            <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                                <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${((current) / questions.length) * 100}%` }} />
                            </div>
                            <span className="text-xs text-slate-500">{current + 1}/{questions.length}</span>
                        </div>

                        <p className="text-white font-semibold mb-4 text-base">{q.question}</p>

                        <div className="space-y-2 mb-4">
                            {q.options.map((opt, i) => {
                                let cls = 'border-white/[0.08] text-slate-300 hover:border-violet-500/40';
                                if (answered) {
                                    if (i === q.correctIndex) cls = 'border-emerald-500/60 bg-emerald-600/10 text-emerald-300';
                                    else if (i === selected && i !== q.correctIndex) cls = 'border-red-500/60 bg-red-600/10 text-red-300';
                                    else cls = 'border-white/[0.04] text-slate-600';
                                }
                                return (
                                    <button key={i} onClick={() => handleAnswer(i)}
                                        className={`w-full text-left p-3 rounded-xl border glass text-sm transition-all ${cls}`}>
                                        <span className="font-medium mr-2 text-slate-500">{String.fromCharCode(65 + i)}.</span> {opt}
                                    </button>
                                );
                            })}
                        </div>

                        {answered && (
                            <div className="mb-4 p-3 bg-white/[0.03] rounded-xl border border-white/[0.06]">
                                <p className="text-xs text-slate-500">{q.explanation}</p>
                            </div>
                        )}

                        {answered && (
                            <button onClick={next} className="w-full bg-violet-600 hover:bg-violet-500 text-white font-semibold py-2.5 rounded-xl transition-all text-sm flex items-center justify-center gap-1">
                                {current < questions.length - 1 ? 'Next Question' : 'See Results'}
                                <ChevronRight size={15} />
                            </button>
                        )}
                    </>
                ) : (
                    <div className="text-center py-4">
                        <div className="w-16 h-16 bg-violet-600/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <Star size={28} className="text-violet-400" />
                        </div>
                        <p className="text-3xl font-black text-white mb-1">{score}/{questions.length}</p>
                        <p className="text-slate-500 mb-2">
                            {score / questions.length >= 0.8 ? '🎉 Excellent!' : score / questions.length >= 0.6 ? '👍 Good job!' : '📚 Keep practicing!'}
                        </p>
                        <button onClick={onClose} className="mt-4 bg-violet-600 text-white font-semibold px-5 py-2.5 rounded-xl">Done</button>
                    </div>
                )}
            </motion.div>
        </div>
    );
}

export default function Progress() {
    const { syllabusId } = useParams();
    const [quizQuestions, setQuizQuestions] = useState(null);
    const [quizLoading, setQuizLoading] = useState(false);

    const { data: syllabusData } = useQuery({
        queryKey: ['syllabus', syllabusId],
        queryFn: () => api.get(`/syllabus/${syllabusId}`).then(r => r.data.data),
    });

    const { data: progressData } = useQuery({
        queryKey: ['progress', syllabusId],
        queryFn: () => api.get(`/progress/${syllabusId}`).then(r => r.data.data),
    });

    const { data: notesData } = useQuery({
        queryKey: ['all-notes', syllabusId],
        queryFn: () => api.get(`/notes/syllabus/${syllabusId}`).then(r => r.data.data),
    });

    const syllabus = syllabusData;
    const topics = syllabus?.topics || [];
    const completedTopics = progressData?.completedTopics || [];
    const quizScores = progressData?.quizScores || [];
    const allNotes = notesData || [];

    const progressPercent = topics.length ? Math.round((completedTopics.length / topics.length) * 100) : 0;

    // Study Planner calculations
    let daysLeft = null;
    let topicsLeft = topics.length - completedTopics.length;
    let topicsPerDay = 0;

    if (syllabus?.examDate) {
        const diff = new Date(syllabus.examDate) - new Date();
        daysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24));
        if (daysLeft > 0 && topicsLeft > 0) {
            topicsPerDay = Math.ceil(topicsLeft / daysLeft);
        }
    }

    // Collect all flashcard terms from notes
    const allTerms = allNotes.flatMap(n => n.keyTerms || []).filter(t => t.term && t.definition);

    const startQuiz = async () => {
        setQuizLoading(true);
        try {
            const { data } = await api.post(`/chat/quiz/${syllabusId}`);
            setQuizQuestions(data.data);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Could not generate quiz. Generate some notes first!');
        } finally {
            setQuizLoading(false);
        }
    };

    return (
        <div className="min-h-screen gradient-bg p-8">
            {quizQuestions && (
                <QuizModal questions={quizQuestions} onClose={() => setQuizQuestions(null)} syllabusId={syllabusId} />
            )}

            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
                {/* Header */}
                <div className="flex items-center gap-3 mb-8">
                    <Link to={`/notes/${syllabusId}`} className="p-2 rounded-xl glass border border-white/[0.06] text-slate-500 hover:text-white transition-colors">
                        <ArrowLeft size={16} />
                    </Link>
                    <div>
                        <h1 className="text-3xl font-black text-white">Study Progress</h1>
                        <p className="text-slate-500 text-sm">{syllabus?.title}</p>
                    </div>
                </div>

                {/* Automated Study Planner Alert */}
                {syllabus?.examDate && topicsLeft > 0 && daysLeft !== null && (
                    <div className="mb-8 glass-strong rounded-2xl p-6 border border-amber-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                                <Calendar size={24} className="text-amber-400" />
                            </div>
                            <div>
                                <h3 className="text-amber-400 font-bold flex items-center gap-2">Study Planner Active</h3>
                                {daysLeft > 0 ? (
                                    <p className="text-slate-300 text-sm mt-1">
                                        Your exam is in <strong className="text-white">{daysLeft} days</strong>. You have <strong className="text-white">{topicsLeft} topics</strong> left to study.
                                    </p>
                                ) : (
                                    <p className="text-red-400 text-sm mt-1 font-semibold">
                                        Exam is today or past due! Finish your remaining {topicsLeft} topics immediately.
                                    </p>
                                )}
                            </div>
                        </div>
                        {daysLeft > 0 && (
                            <div className="bg-black/20 px-5 py-3 rounded-xl border border-white/[0.06] text-center md:text-right">
                                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Recommended Pace</p>
                                <p className="text-2xl font-black text-white">{topicsPerDay} <span className="text-sm font-normal text-slate-400">topics / day</span></p>
                            </div>
                        )}
                    </div>
                )}

                {/* Stats Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    {[
                        { label: 'Completed', value: completedTopics.length, total: topics.length, color: 'text-emerald-400' },
                        { label: 'Progress', value: `${progressPercent}%`, color: 'text-violet-400' },
                        { label: 'Flashcards', value: allTerms.length, color: 'text-cyan-400' },
                        { label: 'Quizzes Taken', value: quizScores.length, color: 'text-pink-400' },
                    ].map(({ label, value, total, color }) => (
                        <div key={label} className="glass rounded-2xl p-5 border border-white/[0.06]">
                            <p className="text-slate-500 text-xs mb-1">{label}</p>
                            <p className={`text-3xl font-black ${color}`}>{value}</p>
                            {total !== undefined && <p className="text-slate-700 text-xs">of {total}</p>}
                        </div>
                    ))}
                </div>

                {/* Progress Ring and Topic List */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    {/* Progress Overview */}
                    <div className="glass rounded-2xl p-6 border border-white/[0.06]">
                        <h3 className="font-bold text-white mb-4 flex items-center gap-2"><TrendingUp size={16} className="text-violet-400" /> Topic Progress</h3>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                            {topics.map((t, i) => {
                                const done = completedTopics.includes(t._id);
                                return (
                                    <div key={t._id} className="flex items-center gap-3 py-1.5">
                                        {done ? <CheckCircle size={14} className="text-emerald-400 flex-shrink-0" /> : <div className="w-3.5 h-3.5 rounded-full border border-slate-700 flex-shrink-0" />}
                                        <span className={`text-sm ${done ? 'text-slate-400 line-through decoration-slate-600' : 'text-slate-300'}`}>{t.name}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Quiz Section */}
                    <div className="glass rounded-2xl p-6 border border-white/[0.06]">
                        <h3 className="font-bold text-white mb-2 flex items-center gap-2"><Brain size={16} className="text-violet-400" /> AI Quiz</h3>
                        <p className="text-slate-500 text-sm mb-4">Test your knowledge with AI-generated questions from your generated notes</p>
                        <button
                            onClick={startQuiz}
                            disabled={quizLoading}
                            className="w-full bg-gradient-to-r from-violet-600 to-purple-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-60 transition-all hover:from-violet-500"
                        >
                            {quizLoading ? <><Loader2 size={16} className="animate-spin" /> Generating...</> : <><Brain size={16} /> Start Quiz</>}
                        </button>

                        {quizScores.length > 0 && (
                            <div className="mt-4">
                                <p className="text-xs text-slate-600 mb-2">Recent scores</p>
                                <div className="space-y-1.5">
                                    {quizScores.slice(-3).reverse().map((s, i) => (
                                        <div key={i} className="flex justify-between text-xs text-slate-500">
                                            <span>Quiz {quizScores.length - i}</span>
                                            <span className="text-violet-400 font-medium">{s.score}/{s.total} ({Math.round((s.score / s.total) * 100)}%)</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Flashcards */}
                {allTerms.length > 0 && (
                    <div>
                        <h3 className="font-bold text-white text-lg mb-4 flex items-center gap-2">
                            <Star size={18} className="text-violet-400" />
                            Flashcards <span className="text-slate-600 text-sm font-normal">({allTerms.length} cards)</span>
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {allTerms.map((t, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.04 }}
                                >
                                    <FlashCard term={t.term} definition={t.definition} />
                                </motion.div>
                            ))}
                        </div>
                    </div>
                )}

                {allTerms.length === 0 && allNotes.length === 0 && (
                    <div className="text-center glass rounded-2xl p-12 border border-white/[0.06]">
                        <p className="text-slate-500">Generate notes for your topics to unlock flashcards and quizzes</p>
                        <Link to={`/notes/${syllabusId}`} className="inline-flex items-center gap-2 mt-4 text-violet-400 hover:text-violet-300 text-sm">
                            Go to Notes <ChevronRight size={14} />
                        </Link>
                    </div>
                )}
            </motion.div>
        </div>
    );
}
