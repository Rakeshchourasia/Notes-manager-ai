import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload as UploadIcon, FileText, X, CheckCircle, Loader2, ArrowRight } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function Upload() {
    const navigate = useNavigate();
    const [mode, setMode] = useState('drag'); // 'drag' | 'paste'
    const [title, setTitle] = useState('');
    const [examDate, setExamDate] = useState('');
    const [file, setFile] = useState(null);
    const [pastedText, setPastedText] = useState('');
    const [dragging, setDragging] = useState(false);
    const [loading, setLoading] = useState(false);
    const [loadingMsg, setLoadingMsg] = useState('AI is processing your syllabus...');

    const onDrop = useCallback((e) => {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer?.files[0];
        if (f && (f.type === 'application/pdf' || f.type === 'text/plain')) {
            setFile(f);
        } else {
            toast.error('Only PDF and TXT files supported');
        }
    }, []);

    const onFileChange = (e) => {
        const f = e.target.files[0];
        if (f) setFile(f);
    };

    const handleSubmit = async () => {
        if (!title.trim()) { toast.error('Please add a title'); return; }
        if (!file && !pastedText.trim()) { toast.error('Please upload a file or paste your syllabus'); return; }

        setLoading(true);
        setLoadingMsg(file ? 'Reading your PDF...' : 'Processing syllabus text...');
        try {
            const formData = new FormData();
            formData.append('title', title);
            if (examDate) formData.append('examDate', examDate);
            if (file) formData.append('syllabus', file);
            else formData.append('pastedText', pastedText);

            // Show a follow-up message for PDFs that may use Gemini Vision
            if (file) {
                setTimeout(() => setLoadingMsg('AI is reading the PDF content... (may take up to 2 mins for complex PDFs)'), 5000);
            }

            // Do NOT set Content-Type manually — axios sets it automatically
            // with the correct multipart boundary when FormData is passed
            const { data } = await api.post('/syllabus/upload', formData);

            // Show warning if PDF could not be fully read (graceful fallback mode)
            if (data.warning) {
                toast('⚠️ ' + data.warning, { icon: '⚠️', duration: 5000, style: { background: '#713f12', color: '#fef9c3' } });
            } else {
                toast.success(`✅ ${data.data.totalTopics} topics extracted!`);
            }
            navigate(`/notes/${data.data._id}`);
        } catch (err) {
            const msg = err.response?.data?.error || err.message || 'Upload failed';
            toast.error(msg, { duration: 6000 });
        } finally {
            setLoading(false);
            setLoadingMsg('AI is processing your syllabus...');
        }
    };

    return (
        <div className="min-h-screen gradient-bg p-8">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-2xl mx-auto"
            >
                {/* Header */}
                <div className="mb-10">
                    <h1 className="text-3xl font-black text-white mb-2">Upload Syllabus</h1>
                    <p className="text-slate-500">Upload a PDF, TXT file, or paste your syllabus text. AI will extract topics and generate detailed notes.</p>
                </div>

                {/* Title and Exam Date Inputs */}
                <div className="mb-6 flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-slate-400 mb-2">Syllabus Title</label>
                        <input
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="e.g. Computer Science — Semester 3"
                            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder-slate-600 outline-none focus:border-violet-500/60 transition-colors"
                        />
                    </div>
                    <div className="w-full sm:w-1/3">
                        <label className="block text-sm font-medium text-slate-400 mb-2">Exam Date (Optional)</label>
                        <input
                            type="date"
                            value={examDate}
                            onChange={e => setExamDate(e.target.value)}
                            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-slate-300 outline-none focus:border-violet-500/60 transition-colors color-scheme-dark"
                            style={{ colorScheme: 'dark' }}
                        />
                    </div>
                </div>

                {/* Mode Tabs */}
                <div className="flex gap-1 mb-5 bg-white/[0.04] rounded-xl p-1 border border-white/[0.06]">
                    {[['drag', 'Upload File'], ['paste', 'Paste Text']].map(([m, label]) => (
                        <button
                            key={m}
                            onClick={() => setMode(m)}
                            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${mode === m ? 'bg-violet-600 text-white' : 'text-slate-500 hover:text-white'
                                }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {/* Upload Zone */}
                <AnimatePresence mode="wait">
                    {mode === 'drag' ? (
                        <motion.div
                            key="drag"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        >
                            {!file ? (
                                <div
                                    onDrop={onDrop}
                                    onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                                    onDragLeave={() => setDragging(false)}
                                    onClick={() => document.getElementById('fileInput').click()}
                                    className={`border-2 border-dashed rounded-2xl p-14 text-center cursor-pointer transition-all ${dragging
                                        ? 'border-violet-500 bg-violet-600/10'
                                        : 'border-white/[0.12] hover:border-violet-500/50 hover:bg-white/[0.02]'
                                        }`}
                                >
                                    <input id="fileInput" type="file" accept=".pdf,.txt" onChange={onFileChange} className="hidden" />
                                    <div className="w-14 h-14 bg-violet-600/15 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                        <UploadIcon size={26} className="text-violet-400" />
                                    </div>
                                    <p className="text-white font-semibold mb-1">Drop your syllabus here</p>
                                    <p className="text-slate-600 text-sm">PDF or TXT • Max 10MB</p>
                                </div>
                            ) : (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="glass rounded-2xl p-5 border border-emerald-500/30 flex items-center gap-4"
                                >
                                    <div className="w-12 h-12 bg-emerald-600/15 rounded-xl flex items-center justify-center">
                                        <FileText size={22} className="text-emerald-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-white font-semibold truncate">{file.name}</p>
                                        <p className="text-slate-500 text-sm">{(file.size / 1024).toFixed(1)} KB</p>
                                    </div>
                                    <CheckCircle size={20} className="text-emerald-400 flex-shrink-0" />
                                    <button onClick={() => setFile(null)} className="text-slate-600 hover:text-red-400 transition-colors">
                                        <X size={18} />
                                    </button>
                                </motion.div>
                            )}
                        </motion.div>
                    ) : (
                        <motion.div
                            key="paste"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        >
                            <textarea
                                value={pastedText}
                                onChange={e => setPastedText(e.target.value)}
                                placeholder="Paste your full syllabus text here...

e.g.
Unit 1: Introduction to Programming
  1.1 Variables and Data Types
  1.2 Control Flow
  1.3 Functions

Unit 2: Object-Oriented Programming
  2.1 Classes and Objects
  ..."
                                rows={14}
                                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl px-5 py-4 text-white placeholder-slate-700 outline-none focus:border-violet-500/60 transition-colors resize-none font-mono text-sm leading-relaxed"
                            />
                            <p className="text-xs text-slate-600 mt-2">{pastedText.length} characters</p>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Submit */}
                <motion.button
                    whileHover={{ scale: 1.02, y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSubmit}
                    disabled={loading}
                    className="w-full mt-6 bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-500 hover:to-purple-600 text-white font-bold py-4 rounded-2xl transition-all shadow-[0_0_30px_rgba(124,58,237,0.3)] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-base"
                >
                    {loading ? (
                        <>
                            <Loader2 size={20} className="animate-spin" />
                            {loadingMsg}
                        </>
                    ) : (
                        <>
                            Generate Study Notes <ArrowRight size={20} />
                        </>
                    )}
                </motion.button>

                <p className="text-center text-slate-600 text-xs mt-4">
                    AI will extract topics and prepare your personalized study module
                </p>
            </motion.div>
        </div>
    );
}
