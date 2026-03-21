/**
 * SharedViewer — public read-only syllabus viewer.
 *
 * Phase 5 refactoring: This was 468 lines of duplicated NotesViewer code.
 * Now it fetches the shared syllabus and notes using the public API
 * and reuses a minimal, read-only version of the notes display.
 */
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
    BookOpen, Loader2, AlertCircle, ChevronDown, ChevronUp,
    Search, CheckCircle, Circle, Volume2, Pause, Square
} from 'lucide-react';
import toast from 'react-hot-toast';
import MermaidChart from '../components/MermaidChart';
import api from '../services/api';

export default function SharedViewer() {
    const { syllabusId } = useParams();
    const [selectedTopicId, setSelectedTopicId] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedSections, setExpandedSections] = useState({
        definition: true, explanation: true, keyTerms: true, examples: true,
        points: true, questions: true, applications: true, flashcards: false
    });
    const [isPlayingAudio, setIsPlayingAudio] = useState(false);
    const [isPausedAudio, setIsPausedAudio] = useState(false);

    const toggleSection = (key) => setExpandedSections(p => ({ ...p, [key]: !p[key] }));

    // Fetch public syllabus
    const { data: syllabusData, isLoading: syllabusLoading, isError } = useQuery({
        queryKey: ['shared-syllabus', syllabusId],
        queryFn: () => api.get(`/shared/syllabus/${syllabusId}`).then(r => r.data.data),
    });

    const syllabus = syllabusData;
    const topics = syllabus?.topics || [];

    useEffect(() => {
        if (!selectedTopicId && topics.length > 0) setSelectedTopicId(topics[0]._id);
    }, [topics, selectedTopicId]);

    const filteredTopics = topics.filter(t =>
        t.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Fetch notes from public endpoint
    const { data: notesData, isLoading: notesLoading } = useQuery({
        queryKey: ['shared-notes', selectedTopicId],
        queryFn: async () => {
            try {
                const res = await api.get(`/shared/notes/${selectedTopicId}`);
                return res.data.data;
            } catch (err) {
                if (err.response?.status === 404) return null;
                throw err;
            }
        },
        enabled: !!selectedTopicId,
        retry: false,
    });

    const notes = notesData;

    // TTS
    const toggleAudio = () => {
        if (!notes) return;
        if (window.speechSynthesis.speaking) {
            if (window.speechSynthesis.paused) { window.speechSynthesis.resume(); setIsPausedAudio(false); }
            else { window.speechSynthesis.pause(); setIsPausedAudio(true); }
        } else {
            const textToRead = `Topic: ${topics.find(t => t._id === selectedTopicId)?.name}. Definition: ${notes.definition}. Summary: ${notes.summary}.`;
            const utterance = new SpeechSynthesisUtterance(textToRead);
            utterance.rate = 0.95;
            utterance.onend = () => { setIsPlayingAudio(false); setIsPausedAudio(false); };
            window.speechSynthesis.speak(utterance);
            setIsPlayingAudio(true);
            setIsPausedAudio(false);
        }
    };
    const stopAudio = () => { window.speechSynthesis.cancel(); setIsPlayingAudio(false); setIsPausedAudio(false); };

    useEffect(() => { return () => window.speechSynthesis.cancel(); }, [selectedTopicId]);

    const Section = ({ title, sectionKey, children }) => (
        <div className="glass rounded-2xl border border-white/[0.06] overflow-hidden mb-4">
            <button onClick={() => toggleSection(sectionKey)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors">
                <span className="font-semibold text-white">{title}</span>
                {expandedSections[sectionKey] ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
            </button>
            <AnimatePresence>
                {expandedSections[sectionKey] && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                        <div className="px-5 pb-5">{children}</div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );

    if (syllabusLoading) return (
        <div className="flex items-center justify-center h-screen gradient-bg">
            <Loader2 size={36} className="text-violet-400 animate-spin" />
        </div>
    );

    if (isError) return (
        <div className="flex items-center justify-center h-screen flex-col gap-4 gradient-bg">
            <AlertCircle size={48} className="text-red-400" />
            <h2 className="text-xl font-bold text-white">Syllabus not found or not public</h2>
            <Link to="/" className="px-4 py-2 bg-white/[0.1] rounded-lg hover:bg-white/[0.15] transition-colors text-white">← Home</Link>
        </div>
    );

    const selectedTopic = topics.find(t => t._id === selectedTopicId);

    return (
        <div className="flex h-screen gradient-bg">
            {/* Topic Sidebar */}
            <div className="w-64 flex-shrink-0 border-r border-white/[0.06] flex flex-col glass">
                {/* Banner */}
                <div className="p-4 border-b border-white/[0.06] bg-violet-600/10">
                    <div className="flex items-center gap-2 mb-1">
                        <BookOpen size={14} className="text-violet-400" />
                        <span className="text-xs text-violet-400 font-medium">Public Syllabus</span>
                    </div>
                    <h2 className="font-bold text-white text-sm line-clamp-2">{syllabus?.title}</h2>
                    <p className="text-[10px] text-slate-500 mt-1">{topics.length} topics</p>
                </div>

                {/* Search */}
                <div className="px-3 py-3 border-b border-white/[0.06]">
                    <div className="relative">
                        <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                        <input
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search topics..."
                            className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-600 outline-none focus:border-violet-500/50 transition-colors"
                        />
                    </div>
                </div>

                {/* Topic List */}
                <div className="flex-1 overflow-y-auto py-2">
                    {filteredTopics.map(topic => {
                        const isSelected = selectedTopicId === topic._id;
                        return (
                            <button
                                key={topic._id}
                                onClick={() => setSelectedTopicId(topic._id)}
                                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all ${isSelected ? 'bg-violet-600/15 border-r-2 border-violet-500' : 'hover:bg-white/[0.03]'}`}
                            >
                                {topic.hasNotes
                                    ? <CheckCircle size={13} className="text-emerald-400 flex-shrink-0" />
                                    : <Circle size={13} className={`flex-shrink-0 ${isSelected ? 'text-violet-400' : 'text-slate-700'}`} />
                                }
                                <span className={`text-xs font-medium flex-1 line-clamp-2 ${isSelected ? 'text-violet-300' : 'text-slate-400'}`}>{topic.name}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Credit */}
                <div className="p-3 border-t border-white/[0.06] text-center">
                    <Link to="/signup" className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
                        Create your own notes with NoteAI →
                    </Link>
                </div>
            </div>

            {/* Notes Content */}
            <div className="flex-1 overflow-y-auto">
                {notesLoading && (
                    <div className="flex items-center justify-center h-64">
                        <Loader2 size={28} className="text-violet-400 animate-spin" />
                    </div>
                )}

                {!notesLoading && !notes && (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                        <BookOpen size={36} className="mb-3 opacity-30" />
                        <p>Notes not yet generated for this topic.</p>
                    </div>
                )}

                {notes && (
                    <div className="max-w-4xl mx-auto px-6 py-8">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h1 className="text-2xl font-bold gradient-text">{notes.topicName}</h1>
                                <p className="text-slate-500 text-sm mt-1">{syllabus?.title}</p>
                            </div>
                            {/* TTS controls */}
                            <div className="flex items-center gap-2">
                                <button onClick={toggleAudio} title="Text to speech" className="glass border border-white/[0.08] p-2 rounded-xl text-slate-400 hover:text-violet-400 transition-colors">
                                    {isPausedAudio ? <Pause size={15} /> : <Volume2 size={15} />}
                                </button>
                                {isPlayingAudio && (
                                    <button onClick={stopAudio} className="glass border border-white/[0.08] p-2 rounded-xl text-slate-400 hover:text-red-400 transition-colors">
                                        <Square size={15} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Sections */}
                        <Section title="📖 Definition" sectionKey="definition">
                            <p className="text-slate-300 leading-relaxed">{notes.definition}</p>
                        </Section>

                        <Section title="💡 Explanation" sectionKey="explanation">
                            <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">{notes.explanation}</p>
                        </Section>

                        {notes.keyTerms?.length > 0 && (
                            <Section title="🔑 Key Terms" sectionKey="keyTerms">
                                <div className="space-y-3">
                                    {notes.keyTerms.map((term, i) => (
                                        <div key={i} className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.05]">
                                            <p className="text-violet-300 font-semibold text-sm">{term.term}</p>
                                            <p className="text-slate-400 text-sm mt-1">{term.definition}</p>
                                        </div>
                                    ))}
                                </div>
                            </Section>
                        )}

                        {notes.examples?.length > 0 && (
                            <Section title="📝 Examples" sectionKey="examples">
                                <ul className="space-y-2">
                                    {notes.examples.map((ex, i) => (
                                        <li key={i} className="flex gap-3 text-slate-300 text-sm">
                                            <span className="text-violet-400 font-bold flex-shrink-0">{i + 1}.</span>
                                            <span>{ex}</span>
                                        </li>
                                    ))}
                                </ul>
                            </Section>
                        )}

                        {notes.importantPoints?.length > 0 && (
                            <Section title="⚡ Important Points" sectionKey="points">
                                <ul className="space-y-2">
                                    {notes.importantPoints.map((pt, i) => (
                                        <li key={i} className="flex gap-3 text-slate-300 text-sm">
                                            <span className="text-amber-400">•</span>
                                            <span>{pt}</span>
                                        </li>
                                    ))}
                                </ul>
                            </Section>
                        )}

                        {notes.mermaidDiagram && (
                            <Section title="🔀 Concept Diagram" sectionKey="diagram">
                                <MermaidChart chart={notes.mermaidDiagram} />
                            </Section>
                        )}

                        {notes.summary && (
                            <Section title="📋 Summary" sectionKey="summary">
                                <p className="text-slate-300 leading-relaxed">{notes.summary}</p>
                            </Section>
                        )}

                        {/* CTA */}
                        <div className="mt-8 glass rounded-2xl border border-violet-500/20 p-6 text-center bg-violet-600/5">
                            <p className="text-white font-semibold mb-1">Want AI notes for your own syllabus?</p>
                            <p className="text-slate-400 text-sm mb-4">Upload any PDF or text and get instant notes, quizzes, and flashcards.</p>
                            <Link to="/signup" className="inline-flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-medium transition-all">
                                Get Started Free →
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
