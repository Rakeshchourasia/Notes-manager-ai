import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';

/**
 * Gamification system for NoteAI.
 * Tracks: XP, Level, Streaks, Achievements — all stored in localStorage.
 *
 * XP Events:
 *   note_generated     +10 XP
 *   topic_completed    +20 XP
 *   quiz_passed        +30 XP (score >= 70%)
 *   daily_login        +15 XP (once per day)
 *   flashcard_session  +10 XP
 *
 * Level thresholds: 100 XP per level
 */

const STORAGE_KEY = 'noteai_gamification';
const XP_PER_LEVEL = 100;

const ACHIEVEMENTS = [
    { id: 'first_note',   title: 'First Note!',       desc: 'Generated your first note',        xp: 10,   icon: '📝' },
    { id: 'note_10',      title: 'Note Taker',        desc: '10 notes generated',               xp: 50,   icon: '📚' },
    { id: 'note_50',      title: 'Knowledge Base',    desc: '50 notes generated',               xp: 100,  icon: '🧠' },
    { id: 'quiz_first',   title: 'First Quiz',        desc: 'Completed your first quiz',        xp: 30,   icon: '🎯' },
    { id: 'quiz_perfect', title: 'Perfect Score!',    desc: 'Got 100% on a quiz',               xp: 75,   icon: '🏆' },
    { id: 'streak_3',     title: 'On a Roll!',        desc: '3-day study streak',               xp: 30,   icon: '🔥' },
    { id: 'streak_7',     title: 'Week Warrior',      desc: '7-day study streak',               xp: 100,  icon: '⚡' },
    { id: 'streak_30',    title: 'Study Machine',     desc: '30-day study streak',              xp: 500,  icon: '💎' },
    { id: 'topic_done',   title: 'Topic Master',      desc: 'Completed a full topic',           xp: 20,   icon: '✅' },
    { id: 'flashcards',   title: 'Card Sharp',        desc: 'Completed a flashcard session',    xp: 10,   icon: '🃏' },
    { id: 'level_5',      title: 'Rising Star',       desc: 'Reached Level 5',                  xp: 50,   icon: '⭐' },
    { id: 'level_10',     title: 'Expert',            desc: 'Reached Level 10',                 xp: 100,  icon: '🌟' },
];

const defaultState = {
    xp: 0,
    totalXp: 0,
    level: 1,
    streak: 0,
    lastActiveDay: null,
    achievements: [],
    stats: {
        notesGenerated: 0,
        topicsCompleted: 0,
        quizzesTaken: 0,
        flashcardSessions: 0,
        perfectQuizzes: 0,
    },
};

function loadState() {
    try { return { ...defaultState, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }; }
    catch { return defaultState; }
}
function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

const GamificationContext = createContext();

export function GamificationProvider({ children }) {
    const [gState, setGState] = useState(loadState);

    // Check daily streak on mount
    useEffect(() => {
        const today = new Date().toDateString();
        setGState(prev => {
            const last = prev.lastActiveDay;
            const yesterday = new Date(Date.now() - 864e5).toDateString();
            let streak = prev.streak;
            if (last === today) return prev;
            if (last === yesterday) streak += 1;
            else if (last && last !== today) streak = 1;
            else streak = 1; // first visit
            const updated = { ...prev, streak, lastActiveDay: today };
            saveState(updated);
            return updated;
        });
    }, []);

    const showAchievementToast = useCallback((achievement) => {
        toast.custom(
            <div className="flex items-center gap-3 bg-[#18181f] border border-yellow-500/30 rounded-2xl px-4 py-3 shadow-xl min-w-64">
                <span className="text-2xl">{achievement.icon}</span>
                <div>
                    <p className="text-yellow-300 font-semibold text-sm">🎉 Achievement Unlocked!</p>
                    <p className="text-white font-bold">{achievement.title}</p>
                    <p className="text-slate-400 text-xs">{achievement.desc}</p>
                </div>
                <div className="ml-auto text-right">
                    <p className="text-emerald-400 text-xs font-semibold">+{achievement.xp} XP</p>
                </div>
            </div>,
            { duration: 4000 }
        );
    }, []);

    const showLevelUpToast = useCallback((level) => {
        toast.custom(
            <div className="flex items-center gap-3 bg-gradient-to-r from-violet-900/80 to-purple-900/80 border border-violet-400/40 rounded-2xl px-4 py-3 shadow-xl min-w-64">
                <span className="text-2xl">⬆️</span>
                <div>
                    <p className="text-violet-300 font-semibold text-sm">Level Up!</p>
                    <p className="text-white font-bold text-lg">Level {level}</p>
                </div>
            </div>,
            { duration: 4000 }
        );
    }, []);

    const awardXP = useCallback((amount, reason) => {
        setGState(prev => {
            const totalXp = prev.totalXp + amount;
            const currentXp = prev.xp + amount;
            const xpForCurrentLevel = currentXp % XP_PER_LEVEL;
            const newLevel = Math.floor(totalXp / XP_PER_LEVEL) + 1;
            const leveledUp = newLevel > prev.level;
            if (leveledUp) showLevelUpToast(newLevel);

            // Check level achievements
            const newAchievements = [...prev.achievements];
            if (newLevel >= 5 && !newAchievements.includes('level_5')) {
                newAchievements.push('level_5');
                showAchievementToast(ACHIEVEMENTS.find(a => a.id === 'level_5'));
            }
            if (newLevel >= 10 && !newAchievements.includes('level_10')) {
                newAchievements.push('level_10');
                showAchievementToast(ACHIEVEMENTS.find(a => a.id === 'level_10'));
            }

            const updated = { ...prev, xp: xpForCurrentLevel, totalXp, level: newLevel, achievements: newAchievements };
            saveState(updated);
            return updated;
        });
    }, [showLevelUpToast, showAchievementToast]);

    const trackEvent = useCallback((event, meta = {}) => {
        setGState(prev => {
            const stats = { ...prev.stats };
            const achievements = [...prev.achievements];
            let bonusXp = 0;

            const checkAchievement = (id) => {
                if (!achievements.includes(id)) {
                    achievements.push(id);
                    const ach = ACHIEVEMENTS.find(a => a.id === id);
                    if (ach) { showAchievementToast(ach); bonusXp += ach.xp; }
                }
            };

            if (event === 'note_generated') {
                stats.notesGenerated += 1;
                if (stats.notesGenerated === 1) checkAchievement('first_note');
                if (stats.notesGenerated === 10) checkAchievement('note_10');
                if (stats.notesGenerated === 50) checkAchievement('note_50');
            }
            if (event === 'topic_completed') {
                stats.topicsCompleted += 1;
                if (stats.topicsCompleted === 1) checkAchievement('topic_done');
            }
            if (event === 'quiz_taken') {
                stats.quizzesTaken += 1;
                if (stats.quizzesTaken === 1) checkAchievement('quiz_first');
                if (meta.score === 100) { stats.perfectQuizzes += 1; checkAchievement('quiz_perfect'); }
            }
            if (event === 'flashcard_session') {
                stats.flashcardSessions += 1;
                if (stats.flashcardSessions === 1) checkAchievement('flashcards');
            }

            // Streak achievements
            if (prev.streak >= 3 && !achievements.includes('streak_3')) checkAchievement('streak_3');
            if (prev.streak >= 7 && !achievements.includes('streak_7')) checkAchievement('streak_7');
            if (prev.streak >= 30 && !achievements.includes('streak_30')) checkAchievement('streak_30');

            const updated = { ...prev, stats, achievements };
            saveState(updated);
            return updated;
        });

        // Award base XP for the event
        const xpMap = { note_generated: 10, topic_completed: 20, quiz_taken: meta.score >= 70 ? 30 : 5, flashcard_session: 10, daily_login: 15 };
        const xp = xpMap[event] || 5;
        awardXP(xp, event);
    }, [awardXP, showAchievementToast]);

    const value = {
        ...gState,
        level: gState.level,
        streak: gState.streak,
        xp: gState.xp,
        totalXp: gState.totalXp,
        xpToNextLevel: XP_PER_LEVEL - (gState.xp % XP_PER_LEVEL),
        xpProgress: (gState.xp % XP_PER_LEVEL) / XP_PER_LEVEL,
        achievements: gState.achievements,
        stats: gState.stats,
        trackEvent,
        ACHIEVEMENTS,
    };

    return <GamificationContext.Provider value={value}>{children}</GamificationContext.Provider>;
}

export function useGamification() {
    return useContext(GamificationContext);
}
