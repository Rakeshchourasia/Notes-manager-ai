import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, XCircle, Trophy, Loader2 } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function QuizModal({ topicId, topicName, onClose }) {
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [score, setScore] = useState(0);
  const [showExplanation, setShowExplanation] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);

  useEffect(() => {
    const fetchQuiz = async () => {
      try {
        const { data } = await api.post(`/notes/quiz/${topicId}`);
        setQuiz(data.data);
      } catch (error) {
        toast.error('Failed to load quiz');
        onClose();
      } finally {
        setLoading(false);
      }
    };
    fetchQuiz();
  }, [topicId, onClose]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="glass rounded-2xl p-8 flex flex-col items-center">
          <Loader2 size={40} className="text-violet-500 animate-spin mb-4" />
          <p className="text-white font-medium">Generating Quiz...</p>
        </div>
      </div>
    );
  }

  if (!quiz || !quiz.questions || quiz.questions.length === 0) {
    return null;
  }

  const handleOptionSelect = (index) => {
    if (showExplanation) return;
    setSelectedOption(index);
    setShowExplanation(true);
    
    if (index === quiz.questions[currentQuestionIndex].correctIndex) {
      setScore(score + 1);
    }
  };

  const handleNext = () => {
    if (currentQuestionIndex < quiz.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setSelectedOption(null);
      setShowExplanation(false);
    } else {
      setQuizCompleted(true);
    }
  };

  const currentQ = quiz.questions[currentQuestionIndex];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="glass-strong w-full max-w-2xl rounded-3xl overflow-hidden border border-white/[0.08] shadow-2xl relative flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-white/[0.06] bg-white/[0.02]">
          <div>
            <h2 className="text-xl font-bold text-white">Quiz: {topicName}</h2>
            {!quizCompleted && (
               <p className="text-slate-400 text-sm mt-1">Question {currentQuestionIndex + 1} of {quiz.questions.length}</p>
            )}
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white bg-white/[0.05] rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 md:p-8 overflow-y-auto flex-1">
          {quizCompleted ? (
            <div className="text-center py-8">
              <div className="w-24 h-24 bg-violet-600/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trophy size={48} className="text-violet-400" />
              </div>
              <h3 className="text-3xl font-bold text-white mb-2">Quiz Complete!</h3>
              <p className="text-xl text-slate-300 mb-8">You scored <span className="text-violet-400 font-black">{score}</span> out of {quiz.questions.length}</p>
              <button 
                onClick={onClose}
                className="bg-violet-600 hover:bg-violet-500 text-white font-semibold py-3 px-8 rounded-xl transition-colors"
              >
                Close & Return to Notes
              </button>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div 
                key={currentQuestionIndex}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <h3 className="text-xl md:text-2xl text-white font-semibold mb-6 leading-relaxed">
                  {currentQ.question}
                </h3>
                
                <div className="space-y-3">
                  {currentQ.options.map((option, idx) => {
                    let btnClass = "w-full text-left p-4 rounded-xl border transition-all duration-200 ";
                    
                    if (!showExplanation) {
                      btnClass += "border-white/[0.1] bg-white/[0.03] hover:bg-white/[0.08] hover:border-violet-500/50 text-slate-200";
                    } else {
                      if (idx === currentQ.correctIndex) {
                        btnClass += "border-emerald-500/50 bg-emerald-500/10 text-emerald-200";
                      } else if (idx === selectedOption) {
                        btnClass += "border-red-500/50 bg-red-500/10 text-red-200";
                      } else {
                        btnClass += "border-white/[0.05] bg-white/[0.01] text-slate-500 opacity-50";
                      }
                    }

                    return (
                      <button
                        key={idx}
                        disabled={showExplanation}
                        onClick={() => handleOptionSelect(idx)}
                        className={btnClass}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-base md:text-lg">{option}</span>
                          {showExplanation && idx === currentQ.correctIndex && <CheckCircle size={20} className="text-emerald-400 flex-shrink-0" />}
                          {showExplanation && idx === selectedOption && idx !== currentQ.correctIndex && <XCircle size={20} className="text-red-400 flex-shrink-0" />}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {showExplanation && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-6 p-5 rounded-xl bg-violet-900/20 border border-violet-500/20"
                  >
                    <p className="font-semibold text-violet-300 mb-1">Explanation:</p>
                    <p className="text-slate-300 text-sm leading-relaxed">{currentQ.explanation}</p>
                  </motion.div>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>

        {/* Footer */}
        {!quizCompleted && (
          <div className="p-6 border-t border-white/[0.06] bg-white/[0.01] flex justify-end">
            <button
              disabled={!showExplanation}
              onClick={handleNext}
              className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-8 rounded-xl transition-all shadow-[0_0_20px_rgba(124,58,237,0.2)]"
            >
              {currentQuestionIndex < quiz.questions.length - 1 ? 'Next Question' : 'View Results'}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
