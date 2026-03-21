import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import {
    BookOpen, ChevronRight, Loader2, Sparkles, BookmarkPlus, Bookmark,
    CheckCircle, Circle, Copy, TrendingUp, AlertCircle, ChevronDown, ChevronUp,
    RefreshCw, Wand2, Search, Download, Printer, BrainCircuit, Share2, Globe
} from 'lucide-react';
import toast from 'react-hot-toast';
import MermaidChart from '../components/MermaidChart';
import QuizModal from '../components/QuizModal';
import FlashcardStudy from '../components/FlashcardStudy';
import { Layers, Volume2, Pause, Square } from 'lucide-react';
import { useGamification } from '../context/GamificationContext';
import SpacedRepetition from '../components/SpacedRepetition';

export default function NotesViewer() {
    const { syllabusId } = useParams();
    const queryClient = useQueryClient();
    const { trackEvent } = useGamification();
    const [selectedTopicId, setSelectedTopicId] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedSections, setExpandedSections] = useState({
        definition: true, explanation: true, keyTerms: true, examples: true,
        points: true, questions: true, applications: true, flashcards: true
    });
    const [showQuiz, setShowQuiz] = useState(false);
    const [showFlashcards, setShowFlashcards] = useState(false);
    const [isPlayingAudio, setIsPlayingAudio] = useState(false);
    const [isPausedAudio, setIsPausedAudio] = useState(false);
    
    // Translation states
    const [selectedLanguage, setSelectedLanguage] = useState('English');
    const [translatedNotes, setTranslatedNotes] = useState(null);

    const toggleSection = (key) => setExpandedSections(p => ({ ...p, [key]: !p[key] }));

    // Fetch syllabus
    const { data: syllabusData, isLoading: syllabusLoading, isError: syllabusError, error: syllabusErrorObj } = useQuery({
        queryKey: ['syllabus', syllabusId],
        queryFn: () => api.get(`/syllabus/${syllabusId}`).then(r => r.data.data),
    });


    const syllabus = syllabusData;
    const topics = syllabus?.topics || [];

    // Set default topic when loaded
    useEffect(() => {
        if (!selectedTopicId && topics.length > 0) {
            setSelectedTopicId(topics[0]._id);
        }
        // Reset translation when topic changes
        setSelectedLanguage('English');
        setTranslatedNotes(null);
    }, [topics, selectedTopicId]);

    // Filter topics by search
    const filteredTopics = topics.filter(t =>
        t.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Fetch progress
    const { data: progressData } = useQuery({
        queryKey: ['progress', syllabusId],
        queryFn: () => api.get(`/progress/${syllabusId}`).then(r => r.data.data),
    });

    // Fetch notes for selected topic (404 = not generated yet → return null)
    const { data: notesData, isLoading: notesLoading } = useQuery({
        queryKey: ['notes', selectedTopicId],
        queryFn: async () => {
            try {
                const res = await api.get(`/notes/${selectedTopicId}`);
                return res.data.data;
            } catch (err) {
                // 404 means notes haven't been generated yet — not a real error
                if (err.response?.status === 404) return null;
                throw err;
            }
        },
        enabled: !!selectedTopicId,
        retry: false,
        refetchOnWindowFocus: false,
    });

    // Generate notes mutation
    const generateMutation = useMutation({
        mutationFn: (topicId) => api.post(`/notes/generate/${topicId}`).then(r => r.data.data),
        onSuccess: (data) => {
            queryClient.setQueryData(['notes', selectedTopicId], data);
            queryClient.invalidateQueries({ queryKey: ['syllabus', syllabusId] });
            toast.success('Notes generated!');
            trackEvent('note_generated');
        },
        onError: (err) => toast.error(err.response?.data?.error || 'AI generation failed. Check your API key.'),
    });

    // Regenerate notes mutation
    const regenerateMutation = useMutation({
        mutationFn: (topicId) => api.put(`/notes/regenerate/${topicId}`).then(r => r.data.data),
        onSuccess: (data) => {
            queryClient.setQueryData(['notes', selectedTopicId], data);
            queryClient.invalidateQueries({ queryKey: ['syllabus', syllabusId] });
            toast.success('Notes regenerated!');
        },
        onError: (err) => toast.error(err.response?.data?.error || 'Regeneration failed'),
    });

    // Generate all notes mutation
    const generateAllMutation = useMutation({
        mutationFn: () => api.post(`/notes/generate-all/${syllabusId}`).then(r => r.data),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['syllabus', syllabusId] });
            queryClient.invalidateQueries({ queryKey: ['notes'] });
            
            if (data.remaining > 0) {
                toast(`Generated ${data.generated} notes. ${data.remaining} remaining. Click again to continue matching.`, { icon: '⏳', duration: 5000 });
            } else {
                toast.success(`Generated ${data.generated} new notes (${data.total} total topics)`);
            }
        },
        onError: (err) => toast.error(err.response?.data?.error || 'Batch generation failed. Please try again.'),
    });

    // Complete topic
    const completeMutation = useMutation({
        mutationFn: (topicId) => api.put(`/progress/${syllabusId}/complete/${topicId}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['progress', syllabusId] });
            trackEvent('topic_completed');
        },
    });

    // Share link 
    const shareMutation = useMutation({
        mutationFn: () => api.put(`/syllabus/${syllabusId}/public`).then(r => r.data),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['syllabus', syllabusId] });
            const shareUrl = `${window.location.origin}/shared/${syllabusId}`;
            navigator.clipboard.writeText(shareUrl);
            toast.success(data.isPublic ? 'Link copied to clipboard! Anyone can view it.' : 'Link is now private.');
        },
    });

    // Bookmark
    const bookmarkMutation = useMutation({
        mutationFn: (topicId) => api.put(`/progress/${syllabusId}/bookmark/${topicId}`).then(r => r.data),
        onSuccess: (d) => {
            queryClient.invalidateQueries({ queryKey: ['progress', syllabusId] });
            toast.success(d.bookmarked ? 'Bookmarked!' : 'Bookmark removed');
        },
    });

    // Translation
    const translateMutation = useMutation({
        mutationFn: (lang) => api.post(`/notes/translate/${selectedTopicId}`, { targetLanguage: lang }).then(r => r.data.data),
        onSuccess: (data) => {
            setTranslatedNotes(data);
            toast.success(`Notes translated to ${selectedLanguage}!`);
        },
        onError: (err) => {
            toast.error('Translation failed. Reverting to original.');
            setSelectedLanguage('English');
            setTranslatedNotes(null);
        }
    });

    const handleLanguageChange = (e) => {
        const lang = e.target.value;
        setSelectedLanguage(lang);
        if (lang === 'English') {
            setTranslatedNotes(null);
        } else {
            translateMutation.mutate(lang);
        }
    };

    const completedTopics = progressData?.completedTopics || [];
    const bookmarkedTopics = progressData?.bookmarkedTopics || [];
    const notes = notesData;
    const displayNotes = translatedNotes || notes;

    const copyNotes = () => {
        if (!notes) return;
        const text = `# ${notes.topicName}\n\n## Definition\n${notes.definition}\n\n## Explanation\n${notes.explanation}\n\n## Key Terms\n${notes.keyTerms?.map(t => `- ${t.term}: ${t.definition}`).join('\n')}\n\n## Important Points\n${notes.importantPoints?.map(p => `- ${p}`).join('\n')}\n\n## Summary\n${notes.summary}`;
        navigator.clipboard.writeText(text);
        toast.success('Notes copied to clipboard!');
    };

    const [downloadingPDF, setDownloadingPDF] = useState(false);

    const downloadAsPDF = async () => {
        try {
            setDownloadingPDF(true);
            toast.loading('Generating PDF...', { id: 'pdf-toast' });
            
            // Using axios directly to get the blob
            const response = await api.get(`/notes/download/${syllabusId}`, {
                responseType: 'blob'
            });
            
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            
            // Extract filename from disposition header if available
            const disposition = response.headers['content-disposition'];
            let fileName = `${syllabus?.title || 'Notes'}.pdf`;
            if (disposition && disposition.indexOf('attachment') !== -1) {
                const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
                if (matches != null && matches[1]) { 
                    fileName = matches[1].replace(/['"]/g, '');
                }
            }
            
            link.setAttribute('download', fileName);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            window.URL.revokeObjectURL(url);
            
            toast.success('PDF Downloaded!', { id: 'pdf-toast' });
        } catch (error) {
            console.error('PDF download error:', error);
            toast.error('Failed to generate PDF. Make sure notes exist for this syllabus.', { id: 'pdf-toast' });
        } finally {
            setDownloadingPDF(false);
        }
    };

    // Text to Speech logic
    const toggleAudio = () => {
        if (!displayNotes) return;

        if (window.speechSynthesis.speaking) {
            if (window.speechSynthesis.paused) {
                window.speechSynthesis.resume();
                setIsPausedAudio(false);
            } else {
                window.speechSynthesis.pause();
                setIsPausedAudio(true);
            }
        } else {
            const textToRead = `Topic: ${topics.find(t => t._id === selectedTopicId)?.name}. Definition: ${displayNotes.definition}. Explanation: ${displayNotes.explanation}. Summary: ${displayNotes.summary}.`;
            const utterance = new SpeechSynthesisUtterance(textToRead);
            utterance.rate = 0.95; // Slightly slower for better comprehension
            
            utterance.onend = () => {
                setIsPlayingAudio(false);
                setIsPausedAudio(false);
            };
            
            utterance.onerror = (e) => {
                console.error("SpeechSynthesis error", e);
                setIsPlayingAudio(false);
                setIsPausedAudio(false);
            };

            window.speechSynthesis.speak(utterance);
            setIsPlayingAudio(true);
            setIsPausedAudio(false);
        }
    };

    const stopAudio = () => {
        window.speechSynthesis.cancel();
        setIsPlayingAudio(false);
        setIsPausedAudio(false);
    };

    // Stop audio when component unmounts or topic changes
    useEffect(() => {
        return () => {
            window.speechSynthesis.cancel();
        };
    }, [selectedTopicId]);

    if (syllabusLoading) return (
        <div className="flex items-center justify-center h-screen">
            <Loader2 size={36} className="text-violet-400 animate-spin" />
        </div>
    );

    if (syllabusError) return (
        <div className="flex items-center justify-center h-screen flex-col gap-4">
            <AlertCircle size={48} className="text-red-400" />
            <h2 className="text-xl font-bold text-white">Failed to load syllabus</h2>
            <p className="text-slate-400">{syllabusErrorObj?.message || 'Unknown error occurred. Please try again.'}</p>
            <Link to="/dashboard" className="px-4 py-2 bg-white/[0.1] rounded-lg mt-4 hover:bg-white/[0.15] transition-colors">
                Return to Dashboard
            </Link>
        </div>
    );

    const Section = ({ title, sectionKey, children }) => (
        <div className="glass rounded-2xl border border-white/[0.06] overflow-hidden mb-4">
            <button
                onClick={() => toggleSection(sectionKey)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors"
            >
                <span className="font-semibold text-white print:text-black">{title}</span>
                {expandedSections[sectionKey] ? <ChevronUp size={16} className="text-slate-500 print:hidden" /> : <ChevronDown size={16} className="text-slate-500 print:hidden" />}
            </button>
            <AnimatePresence>
                {expandedSections[sectionKey] && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="px-5 pb-5">{children}</div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );

    return (
        <div className="flex h-screen gradient-bg print:block print:h-auto print:bg-none print:bg-white print:text-black">
            {/* Topic Sidebar */}
            <div className="w-72 flex-shrink-0 border-r border-white/[0.06] flex flex-col glass print:hidden">
                <div className="p-5 border-b border-white/[0.06]">
                    <Link to="/dashboard" className="text-xs text-slate-600 hover:text-violet-400 transition-colors flex items-center gap-1 mb-2">
                        ← Dashboard
                    </Link>
                    <h2 className="font-bold text-white text-sm line-clamp-2">{syllabus?.title}</h2>
                    <div className="flex items-center gap-2 mt-2">
                        <div className="flex-1 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-violet-600 to-purple-500 rounded-full"
                                style={{ width: `${topics.length ? (completedTopics.length / topics.length) * 100 : 0}%` }}
                            />
                        </div>
                        <span className="text-xs text-slate-500">{completedTopics.length}/{topics.length}</span>
                    </div>
                </div>

                {/* Search + Generate All */}
                <div className="px-3 py-3 border-b border-white/[0.06] space-y-2">
                    <div className="relative">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                        <input
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search topics..."
                            className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-600 outline-none focus:border-violet-500/50 transition-colors"
                        />
                    </div>
                    <button
                        onClick={() => generateAllMutation.mutate()}
                        disabled={generateAllMutation.isPending}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-medium bg-violet-600/20 text-violet-400 hover:bg-violet-600/30 border border-violet-500/20 transition-all disabled:opacity-50"
                    >
                        {generateAllMutation.isPending ? (
                            <><Loader2 size={12} className="animate-spin" /> Generating...</>
                        ) : (
                            <><Wand2 size={12} /> Generate All Notes</>
                        )}
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto py-2">
                    {filteredTopics.map((topic, i) => {
                        const isCompleted = completedTopics.includes(topic._id);
                        const isBookmarked = bookmarkedTopics.includes(topic._id);
                        const isSelected = selectedTopicId === topic._id;

                        return (
                            <button
                                key={topic._id}
                                onClick={() => setSelectedTopicId(topic._id)}
                                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all group ${isSelected ? 'bg-violet-600/15 border-r-2 border-violet-500' : 'hover:bg-white/[0.03]'
                                    }`}
                            >
                                <span className="text-xs text-slate-600 w-5 flex-shrink-0">{topics.indexOf(topic) + 1}</span>
                                {isCompleted
                                    ? <CheckCircle size={14} className="text-emerald-400 flex-shrink-0" />
                                    : <Circle size={14} className={`flex-shrink-0 ${isSelected ? 'text-violet-400' : 'text-slate-700'}`} />
                                }
                                <span className={`text-xs font-medium flex-1 line-clamp-2 ${isSelected ? 'text-violet-300' : 'text-slate-400'}`}>
                                    {topic.name}
                                </span>
                                {isBookmarked && <Bookmark size={11} className="text-amber-400 flex-shrink-0" />}
                                {topic.hasNotes && <div className="w-1.5 h-1.5 rounded-full bg-violet-500/60 flex-shrink-0" />}
                            </button>
                        );
                    })}
                </div>

                <div className="p-3 border-t border-white/[0.06] space-y-2">
                    <button
                        onClick={() => shareMutation.mutate()}
                        disabled={shareMutation.isPending}
                        className={`flex items-center justify-center gap-2 w-full py-2 px-3 rounded-xl text-xs font-medium transition-colors border ${
                            syllabus?.isPublic
                                ? 'bg-emerald-600/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-600/20'
                                : 'bg-white/[0.03] text-slate-400 border-transparent hover:bg-white/[0.08]'
                        }`}
                        title="Share notes publicly"
                    >
                        {shareMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Share2 size={13} />}
                        {syllabus?.isPublic ? 'Public Link Copied' : 'Share Link'}
                    </button>
                    <Link
                        to={`/progress/${syllabusId}`}
                        className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-xl text-xs font-medium text-violet-400 hover:bg-violet-600/10 transition-colors border border-transparent"
                    >
                        <TrendingUp size={13} /> Study Progress
                    </Link>
                </div>
            </div>

            {/* Notes Content */}
            <div className="flex-1 overflow-y-auto print:overflow-visible print:text-black">
                {!selectedTopicId ? (
                    <div className="flex items-center justify-center h-full text-slate-600">
                        <div className="text-center">
                            <BookOpen size={40} className="mx-auto mb-3 opacity-30" />
                            <p>Select a topic to view notes</p>
                        </div>
                    </div>
                ) : (
                    <div className="max-w-3xl mx-auto p-8 print:max-w-none print:p-4">
                        {/* Topic Header */}
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-6 print:hidden gap-4">
                            <div>
                                <h1 className="text-2xl font-black text-white mb-1">
                                    {topics.find(t => t._id === selectedTopicId)?.name}
                                </h1>
                                <p className="text-slate-600 text-sm">Topic {(topics.findIndex(t => t._id === selectedTopicId) + 1)} of {topics.length}</p>
                            </div>
                            
                            <div className="flex flex-wrap items-center gap-2">
                                {/* Language Selector */}
                                {notes && (
                                    <div className="relative flex items-center bg-white/[0.03] border border-white/[0.06] rounded-xl px-2 py-1.5 focus-within:border-violet-500/50 transition-colors">
                                        <Globe size={14} className="text-slate-500 text-violet-400 absolute left-2" />
                                        <select 
                                            value={selectedLanguage}
                                            onChange={handleLanguageChange}
                                            disabled={translateMutation.isPending}
                                            className="bg-transparent text-slate-300 text-xs font-medium outline-none appearance-none pl-6 pr-4 py-0.5 cursor-pointer disabled:opacity-50"
                                        >
                                            <option value="English" className="bg-slate-900">English</option>
                                            <option value="Spanish" className="bg-slate-900">Spanish</option>
                                            <option value="French" className="bg-slate-900">French</option>
                                            <option value="German" className="bg-slate-900">German</option>
                                            <option value="Hindi" className="bg-slate-900">Hindi</option>
                                            <option value="Mandarin" className="bg-slate-900">Mandarin</option>
                                        </select>
                                        {translateMutation.isPending && (
                                            <Loader2 size={12} className="absolute right-2 text-violet-400 animate-spin" />
                                        )}
                                    </div>
                                )}

                                {notes && (
                                    <>
                                        {/* TTS Controls */}
                                        {isPlayingAudio ? (
                                            <div className="flex items-center bg-violet-600/20 border border-violet-500/30 rounded-xl p-1 shrink-0">
                                                <button onClick={toggleAudio} title={isPausedAudio ? "Resume audio" : "Pause audio"} className="p-1.5 text-violet-300 hover:text-white transition-colors">
                                                    {isPausedAudio ? <Volume2 size={15} /> : <Pause size={15} />}
                                                </button>
                                                <div className="w-px h-4 bg-violet-500/20 mx-1"></div>
                                                <button onClick={stopAudio} title="Stop audio" className="p-1.5 text-violet-300 hover:text-red-400 transition-colors">
                                                    <Square size={13} fill="currentColor" />
                                                </button>
                                            </div>
                                        ) : (
                                            <button onClick={toggleAudio} title="Listen to Notes" className="p-2 rounded-xl glass border border-white/[0.06] text-slate-500 hover:text-white transition-colors">
                                                <Volume2 size={15} />
                                            </button>
                                        )}
                                        
                                        <button onClick={copyNotes} title="Copy notes" className="p-2 rounded-xl glass border border-white/[0.06] text-slate-500 hover:text-white transition-colors">
                                            <Copy size={15} />
                                        </button>
                                        <button 
                                            onClick={downloadAsPDF} 
                                            disabled={downloadingPDF}
                                            title="Print / Download PDF" 
                                            className="p-2 rounded-xl glass border border-white/[0.06] text-slate-500 hover:text-white transition-colors disabled:opacity-50"
                                        >
                                            {downloadingPDF ? <Loader2 size={15} className="animate-spin" /> : <Printer size={15} />}
                                        </button>
                                        <button
                                            onClick={() => regenerateMutation.mutate(selectedTopicId)}
                                            disabled={regenerateMutation.isPending}
                                            title="Regenerate notes"
                                            className="p-2 rounded-xl glass border border-white/[0.06] text-slate-500 hover:text-white transition-colors"
                                        >
                                            <RefreshCw size={15} className={regenerateMutation.isPending ? 'animate-spin' : ''} />
                                        </button>
                                        <button
                                            onClick={() => setShowQuiz(true)}
                                            title="Take Quiz"
                                            className="p-2 rounded-xl glass border border-violet-500/30 text-violet-400 hover:text-white hover:bg-violet-600/20 transition-colors flex items-center gap-1"
                                        >
                                            <BrainCircuit size={15} />
                                            <span className="text-xs font-semibold hidden sm:inline">Take Quiz</span>
                                        </button>
                                        <button
                                            onClick={() => bookmarkMutation.mutate(selectedTopicId)}
                                            title="Bookmark"
                                            className={`p-2 rounded-xl glass border border-white/[0.06] transition-colors ${bookmarkedTopics.includes(selectedTopicId) ? 'text-amber-400' : 'text-slate-500 hover:text-amber-400'}`}
                                        >
                                            {bookmarkedTopics.includes(selectedTopicId) ? <Bookmark size={15} /> : <BookmarkPlus size={15} />}
                                        </button>
                                        <button
                                            onClick={() => completeMutation.mutate(selectedTopicId)}
                                            title="Mark complete"
                                            className={`p-2 rounded-xl glass border border-white/[0.06] transition-colors ${completedTopics.includes(selectedTopicId) ? 'text-emerald-400' : 'text-slate-500 hover:text-emerald-400'}`}
                                        >
                                            <CheckCircle size={15} />
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Print-only header */}
                        <div className="hidden print:block mb-4">
                            <h1 className="text-2xl font-bold">{topics.find(t => t._id === selectedTopicId)?.name}</h1>
                            <p className="text-sm text-gray-500">{syllabus?.title}</p>
                        </div>

                        {/* Notes Content */}
                        {notesLoading || translateMutation.isPending ? (
                            <div className="flex items-center justify-center py-20 flex-col gap-3">
                                <Loader2 size={28} className="text-violet-400 animate-spin" />
                                {translateMutation.isPending && <p className="text-violet-300 text-sm animate-pulse">Translating to {selectedLanguage}...</p>}
                            </div>
                        ) : notes ? (
                            <div>
                                {/* Definition */}
                                <Section title="📖 Definition" sectionKey="definition">
                                    <p className="text-slate-300 print:text-black leading-relaxed">{displayNotes.definition}</p>
                                </Section>

                                {/* Explanation */}
                                <Section title="💡 Detailed Explanation" sectionKey="explanation">
                                    <p className="text-slate-300 print:text-black leading-relaxed whitespace-pre-line">{displayNotes.explanation}</p>
                                </Section>

                                {/* Mermaid Flowchart */}
                                {displayNotes.mermaidDiagram && (
                                    <div className="mb-4">
                                        <MermaidChart diagram={displayNotes.mermaidDiagram} />
                                    </div>
                                )}

                                {/* Key Terms */}
                                {displayNotes.keyTerms?.length > 0 && (
                                    <Section title="🔑 Key Terminology" sectionKey="keyTerms">
                                        <div className="space-y-3">
                                            {displayNotes.keyTerms.map((kt, i) => (
                                                <div key={i} className="flex gap-3 p-3 bg-violet-600/8 print:border-gray-200 rounded-xl border border-violet-500/15">
                                                    <span className="font-semibold text-violet-300 print:text-black flex-shrink-0">{kt.term}:</span>
                                                    <span className="text-slate-400 print:text-gray-800 text-sm leading-relaxed">{kt.definition}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </Section>
                                )}

                                {/* Examples */}
                                {displayNotes.examples?.length > 0 && (
                                    <Section title="🧪 Examples" sectionKey="examples">
                                        <div className="space-y-4">
                                            {displayNotes.examples.map((ex, i) => (
                                                <div key={i}>
                                                    <p className="font-semibold text-white print:text-black mb-1 text-sm">{ex.title}</p>
                                                    <p className="text-slate-400 print:text-gray-800 text-sm leading-relaxed">{ex.content}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </Section>
                                )}

                                {/* Important Points */}
                                {displayNotes.importantPoints?.length > 0 && (
                                    <Section title="⭐ Important Points" sectionKey="points">
                                        <ul className="space-y-2">
                                            {displayNotes.importantPoints.map((pt, i) => (
                                                <li key={i} className="flex gap-2 text-slate-300 print:text-black text-sm">
                                                    <ChevronRight size={14} className="text-violet-400 print:hidden mt-0.5 flex-shrink-0" />
                                                    <span className="hidden print:inline mr-1">•</span>{pt}
                                                </li>
                                            ))}
                                        </ul>
                                    </Section>
                                )}

                                {/* Real-world Applications */}
                                {displayNotes.realWorldApplications?.length > 0 && (
                                    <Section title="🌍 Real-world Applications" sectionKey="applications">
                                        <ul className="space-y-2">
                                            {displayNotes.realWorldApplications.map((app, i) => (
                                                <li key={i} className="flex gap-2 text-slate-300 print:text-black text-sm">
                                                    <span className="text-cyan-400 print:hidden">▶</span>
                                                    <span className="hidden print:inline font-bold mr-1">▶</span> {app}
                                                </li>
                                            ))}
                                        </ul>
                                    </Section>
                                )}

                                {/* Flashcards */}
                                {displayNotes.flashcards?.length > 0 && (
                                    <Section title={
                                        <div className="flex items-center gap-3">
                                            <span>🃏 Flashcards</span>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); setShowFlashcards(true); }}
                                                className="flex items-center gap-1 text-xs bg-violet-600/20 text-violet-300 hover:text-white hover:bg-violet-600/40 px-3 py-1.5 rounded-lg transition-colors border border-violet-500/30"
                                            >
                                                <Layers size={14} /> Practice Mode
                                            </button>
                                        </div>
                                    } sectionKey="flashcards">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 print:block print:space-y-3">
                                            {displayNotes.flashcards.map((fc, i) => (
                                                <div key={i} className="p-3 bg-white/[0.03] print:border-gray-300 rounded-xl border border-white/[0.06]">
                                                    <p className="text-violet-400 print:text-black text-xs font-bold mb-1">Q: {fc.question}</p>
                                                    <p className="text-slate-400 print:text-gray-800 text-xs leading-relaxed">A: {fc.answer}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </Section>
                                )}

                                {/* Important Questions */}
                                {displayNotes.importantQuestions?.length > 0 && (
                                    <Section title="❓ Important Questions" sectionKey="questions">
                                        <ul className="space-y-2">
                                            {displayNotes.importantQuestions.map((q, i) => (
                                                <li key={i} className="text-slate-400 print:text-black print:border-gray-200 text-sm p-3 bg-white/[0.03] rounded-xl border border-white/[0.04]">
                                                    <span className="text-violet-400 print:text-black font-bold mr-2">{i + 1}.</span>{q}
                                                </li>
                                            ))}
                                        </ul>
                                    </Section>
                                )}

                                {/* Summary */}
                                {displayNotes.summary && (
                                    <div className="glass-strong rounded-2xl p-5 border border-violet-500/20 print:border-gray-300 mt-4">
                                        <h3 className="font-bold text-violet-300 print:text-black mb-3 flex items-center gap-2">
                                            <Sparkles size={15} className="print:hidden" /> Quick Revision Summary
                                        </h3>
                                        <p className="text-slate-300 print:text-black leading-relaxed text-sm">{displayNotes.summary}</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            /* No notes yet */
                            <div className="text-center py-20">
                                <div className="w-16 h-16 bg-violet-600/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
                                    <Sparkles size={28} className="text-violet-400" />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">No notes generated yet</h3>
                                <p className="text-slate-500 text-sm mb-6">Click below to let AI generate detailed notes for this topic</p>
                                <motion.button
                                    whileHover={{ scale: 1.04 }}
                                    whileTap={{ scale: 0.96 }}
                                    onClick={() => generateMutation.mutate(selectedTopicId)}
                                    disabled={generateMutation.isPending}
                                    className="bg-gradient-to-r from-violet-600 to-purple-700 text-white font-bold px-6 py-3 rounded-xl flex items-center gap-2 mx-auto disabled:opacity-60"
                                >
                                    {generateMutation.isPending ? (
                                        <><Loader2 size={18} className="animate-spin" /> Generating with AI...</>
                                    ) : (
                                        <><Sparkles size={18} /> Generate Notes</>
                                    )}
                                </motion.button>
                                {generateMutation.isError && (
                                    <div className="mt-4 flex items-center gap-2 text-red-400 text-sm justify-center">
                                        <AlertCircle size={14} /> Check backend connection and API key
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Render Quiz Modal */}
            {showQuiz && selectedTopicId && (
                <QuizModal 
                    topicId={selectedTopicId} 
                    topicName={topics.find(t => t._id === selectedTopicId)?.name} 
                    onClose={() => setShowQuiz(false)} 
                />
            )}

            {/* Render Flashcard Study Mode */}
            {showFlashcards && displayNotes?.flashcards && (
                <FlashcardStudy 
                    flashcards={displayNotes.flashcards} 
                    topicName={topics.find(t => t._id === selectedTopicId)?.name} 
                    onClose={() => setShowFlashcards(false)} 
                />
            )}
        </div>
    );
}
