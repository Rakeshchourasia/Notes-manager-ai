import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, BookOpen, Clock, TrendingUp, Trash2, ChevronRight, FileText, Loader2, Brain } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function Dashboard() {
    const navigate = useNavigate();

    const { data, isLoading, refetch } = useQuery({
        queryKey: ['syllabuses'],
        queryFn: () => api.get('/syllabus').then(r => r.data.data),
    });

    const syllabuses = data || [];

    const handleDelete = async (id, e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!confirm('Delete this syllabus and all its notes?')) return;
        try {
            await api.delete(`/syllabus/${id}`);
            toast.success('Syllabus deleted');
            refetch();
        } catch {
            toast.error('Failed to delete');
        }
    };

    const stats = [
        { label: 'Total Syllabuses', value: syllabuses.length, icon: FileText, color: 'text-violet-400', bg: 'bg-violet-600/10' },
        { label: 'Total Topics', value: syllabuses.reduce((a, s) => a + (s.totalTopics || 0), 0), icon: Brain, color: 'text-cyan-400', bg: 'bg-cyan-600/10' },
        { label: 'Notes Generated', value: syllabuses.reduce((a, s) => a + (s.generatedTopics || 0), 0), icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-600/10' },
    ];

    return (
        <div className="p-8 min-h-screen gradient-bg">
            {/* Header */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
                <h1 className="text-3xl font-black text-white mb-1">Study Dashboard</h1>
                <p className="text-slate-500">Manage your syllabuses and generated notes</p>
            </motion.div>

            {/* Stats */}
            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8"
            >
                {stats.map(({ label, value, icon: Icon, color, bg }) => (
                    <div key={label} className="glass rounded-2xl p-5 border border-white/[0.06]">
                        <div className="flex items-center gap-3 mb-3">
                            <div className={`w-9 h-9 ${bg} rounded-xl flex items-center justify-center`}>
                                <Icon size={18} className={color} />
                            </div>
                            <span className="text-slate-400 text-sm">{label}</span>
                        </div>
                        <p className="text-3xl font-black text-white">{value}</p>
                    </div>
                ))}
            </motion.div>

            {/* Actions */}
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-white">Your Syllabuses</h2>
                <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => navigate('/upload')}
                    className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-semibold px-4 py-2 rounded-xl transition-all text-sm"
                >
                    <Plus size={16} /> Upload New
                </motion.button>
            </div>

            {/* Syllabuses Grid */}
            {isLoading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 size={32} className="text-violet-400 animate-spin" />
                </div>
            ) : syllabuses.length === 0 ? (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="glass rounded-3xl border border-white/[0.06] p-16 text-center"
                >
                    <div className="w-16 h-16 bg-violet-600/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <BookOpen size={28} className="text-violet-400" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">No syllabuses yet</h3>
                    <p className="text-slate-500 mb-6">Upload your first syllabus to get started with AI note generation</p>
                    <button
                        onClick={() => navigate('/upload')}
                        className="bg-violet-600 hover:bg-violet-500 text-white font-semibold px-6 py-2.5 rounded-xl transition-all"
                    >
                        Upload Syllabus
                    </button>
                </motion.div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {syllabuses.map((s, i) => (
                        <motion.div
                            key={s._id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.07 }}
                            whileHover={{ y: -3, scale: 1.01 }}
                            className="group"
                        >
                            <Link to={`/notes/${s._id}`} className="block">
                                <div className="glass rounded-2xl p-5 border border-white/[0.06] hover:border-violet-500/30 transition-all cursor-pointer">
                                    {/* Icon + Status */}
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="w-10 h-10 bg-gradient-to-br from-violet-600 to-purple-800 rounded-xl flex items-center justify-center">
                                            <BookOpen size={18} className="text-white" />
                                        </div>
                                        <div className="flex gap-2 items-center">
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.status === 'completed' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' :
                                                s.status === 'processing' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20' :
                                                    'bg-slate-500/15 text-slate-400'
                                                }`}>
                                                {s.status}
                                            </span>
                                            <button
                                                onClick={(e) => handleDelete(s._id, e)}
                                                className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center transition-all"
                                            >
                                                <Trash2 size={12} className="text-red-400" />
                                            </button>
                                        </div>
                                    </div>

                                    <h3 className="font-bold text-white text-base mb-1 line-clamp-2">{s.title}</h3>

                                    {/* Progress bar */}
                                    <div className="mt-3 mb-3">
                                        <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                                            <span>{s.generatedTopics || 0} / {s.totalTopics || 0} notes</span>
                                            <span>{s.totalTopics ? Math.round(((s.generatedTopics || 0) / s.totalTopics) * 100) : 0}%</span>
                                        </div>
                                        <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-violet-600 to-purple-500 rounded-full transition-all"
                                                style={{ width: `${s.totalTopics ? ((s.generatedTopics || 0) / s.totalTopics) * 100 : 0}%` }}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                                            <Clock size={11} />
                                            <span>{new Date(s.createdAt).toLocaleDateString()}</span>
                                        </div>
                                        <ChevronRight size={14} className="text-violet-400 group-hover:translate-x-1 transition-transform" />
                                    </div>
                                </div>
                            </Link>
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
}
