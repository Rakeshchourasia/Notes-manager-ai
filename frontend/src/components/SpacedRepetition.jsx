import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, ChevronLeft, ChevronRight, Check, X, RefreshCw, Trophy, Clock } from 'lucide-react';

/**
 * SM-2 Spaced Repetition flashcard viewer.
 * Stores review data per card in localStorage, keyed by topicId + card index.
 * 
 * SM-2 formula:
 *   quality: 0-5 (0-2 = fail, 3-5 = pass)
 *   EaseFactor: starts at 2.5, adjusted each review
 *   Interval: days until next review
 */

const STORAGE_KEY = 'noteai_sr_cards';

function loadSRData() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
    catch { return {}; }
}
function saveSRData(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function getCardKey(topicId, idx) {
    return `${topicId}_${idx}`;
}

function applyReview(card, quality) {
    // quality: 0=Again, 1=Hard, 3=Good, 5=Easy
    const ef = Math.max(1.3, (card.ef || 2.5) + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    let interval;
    if (quality < 3) {
        interval = 1; // relearn
    } else if (!card.interval || card.interval === 0) {
        interval = 1;
    } else if (card.interval === 1) {
        interval = 6;
    } else {
        interval = Math.round((card.interval || 1) * ef);
    }
    const nextReview = Date.now() + interval * 24 * 60 * 60 * 1000;
    return { ef, interval, nextReview, lastReview: Date.now() };
}

function isDue(card) {
    if (!card?.nextReview) return true;
    return Date.now() >= card.nextReview;
}

export default function SpacedRepetition({ flashcards = [], topicId, topicName }) {
    const [srData, setSrData] = useState(loadSRData);
    const [current, setCurrent] = useState(0);
    const [flipped, setFlipped] = useState(false);
    const [sessionDone, setSessionDone] = useState(false);

    // Filter cards due for review
    const dueCards = flashcards
        .map((card, idx) => ({ ...card, idx }))
        .filter(card => isDue(srData[getCardKey(topicId, card.idx)]));

    const [queue, setQueue] = useState(() =>
        flashcards
            .map((card, idx) => ({ ...card, idx }))
            .filter(card => isDue(loadSRData()[getCardKey(topicId, card.idx)]))
    );

    const currentCard = queue[current];

    const handleRate = useCallback((quality) => {
        if (!currentCard) return;
        const key = getCardKey(topicId, currentCard.idx);
        const existing = srData[key];
        const updated = applyReview(existing || {}, quality);
        const newSrData = { ...srData, [key]: updated };
        setSrData(newSrData);
        saveSRData(newSrData);
        setFlipped(false);
        if (current + 1 >= queue.length) {
            setSessionDone(true);
        } else {
            setCurrent(c => c + 1);
        }
    }, [currentCard, srData, topicId, current, queue]);

    const restart = () => {
        const newQueue = flashcards.map((card, idx) => ({ ...card, idx }));
        setQueue(newQueue);
        setCurrent(0);
        setFlipped(false);
        setSessionDone(false);
    };

    const dueCount = flashcards.filter((_, idx) =>
        isDue(srData[getCardKey(topicId, idx)])
    ).length;

    if (flashcards.length === 0) {
        return (
            <div className="text-center py-8 text-slate-500 text-sm">
                No flashcards available for this topic.
            </div>
        );
    }

    if (sessionDone || queue.length === 0) {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-10 space-y-4"
            >
                <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/20 flex items-center justify-center">
                    <Trophy size={28} className="text-emerald-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">Session Complete!</h3>
                <p className="text-slate-500 text-sm">
                    {queue.length === 0
                        ? `All ${flashcards.length} cards are reviewed. ${dueCount === 0 ? 'Nothing due yet — check back later!' : ''}`
                        : `Reviewed ${queue.length} cards.`}
                </p>
                <button
                    onClick={restart}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600/20 text-violet-300 hover:bg-violet-600/30 text-sm transition-all border border-violet-500/30"
                >
                    <RefreshCw size={14} /> Review All Again
                </button>
            </motion.div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between text-xs text-slate-500">
                <div className="flex items-center gap-1.5">
                    <Brain size={13} className="text-violet-400" />
                    <span>Spaced Repetition · {topicName}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <Clock size={12} />
                    <span>{current + 1} / {queue.length} due</span>
                </div>
            </div>

            {/* Card */}
            <div
                className={`flip-card w-full cursor-pointer ${flipped ? 'flipped' : ''}`}
                style={{ height: 200 }}
                onClick={() => setFlipped(f => !f)}
            >
                <div className="flip-card-inner w-full h-full relative">
                    {/* Front */}
                    <div className="flip-card-front absolute inset-0 glass rounded-2xl border border-white/[0.07] flex flex-col items-center justify-center p-6 text-center">
                        <span className="text-[10px] text-violet-400 uppercase tracking-widest mb-3 font-medium">Question</span>
                        <p className="text-white text-base font-medium leading-relaxed">{currentCard.question}</p>
                        <p className="mt-4 text-xs text-slate-600">Click to reveal answer</p>
                    </div>
                    {/* Back */}
                    <div className="flip-card-back absolute inset-0 glass rounded-2xl border border-violet-500/20 bg-violet-600/5 flex flex-col items-center justify-center p-6 text-center">
                        <span className="text-[10px] text-emerald-400 uppercase tracking-widest mb-3 font-medium">Answer</span>
                        <p className="text-slate-200 text-sm leading-relaxed">{currentCard.answer}</p>
                    </div>
                </div>
            </div>

            {/* Rating buttons — shown only when flipped */}
            <AnimatePresence>
                {flipped && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="grid grid-cols-4 gap-2"
                    >
                        {[
                            { label: 'Again', q: 0, color: 'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30', icon: X },
                            { label: 'Hard', q: 1, color: 'bg-orange-500/20 text-orange-400 border-orange-500/30 hover:bg-orange-500/30', icon: ChevronLeft },
                            { label: 'Good', q: 3, color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30', icon: ChevronRight },
                            { label: 'Easy', q: 5, color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/30', icon: Check },
                        ].map(({ label, q, color, icon: Icon }) => (
                            <button
                                key={label}
                                onClick={() => handleRate(q)}
                                className={`flex flex-col items-center gap-1 py-2 rounded-xl border text-xs font-medium transition-all ${color}`}
                            >
                                <Icon size={14} />
                                {label}
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Progress bar */}
            <div className="h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                <div
                    className="h-full bg-gradient-to-r from-violet-600 to-purple-500 rounded-full transition-all duration-300"
                    style={{ width: `${((current) / queue.length) * 100}%` }}
                />
            </div>
        </div>
    );
}
