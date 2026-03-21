import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, RotateCw } from 'lucide-react';

export default function FlashcardStudy({ flashcards, topicName, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  if (!flashcards || flashcards.length === 0) return null;

  const nextCard = (e) => {
    e.stopPropagation();
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % flashcards.length);
    }, 200);
  };

  const prevCard = (e) => {
    e.stopPropagation();
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev === 0 ? flashcards.length - 1 : prev - 1));
    }, 200);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="w-full max-w-3xl relative flex flex-col items-center">
        
        {/* Header */}
        <div className="w-full flex justify-between items-center mb-6 px-4">
          <div>
            <h2 className="text-xl font-bold text-white">Flashcards: {topicName}</h2>
            <p className="text-slate-400 text-sm mt-1">Card {currentIndex + 1} of {flashcards.length}</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white bg-white/[0.05] rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Card Container */}
        <div 
            className={`flip-card w-full aspect-[4/3] sm:aspect-[16/9] cursor-pointer ${isFlipped ? 'flipped' : ''}`} 
            onClick={() => setIsFlipped(!isFlipped)}
        >
          <div className="flip-card-inner w-full h-full relative">
            
            {/* Front: Question */}
            <div className="flip-card-front absolute inset-0 glass-strong border border-violet-500/20 rounded-3xl p-8 md:p-12 flex flex-col items-center justify-center text-center shadow-2xl bg-violet-950/10">
              <span className="absolute top-6 left-6 text-violet-400 font-bold text-2xl opacity-50">Q</span>
              <h3 className="text-2xl md:text-4xl font-semibold text-white leading-relaxed">
                {flashcards[currentIndex].question}
              </h3>
              <p className="absolute bottom-6 text-slate-500 text-sm flex items-center gap-2">
                <RotateCw size={14} /> Click anywhere to flip
              </p>
            </div>

            {/* Back: Answer */}
            <div className="flip-card-back absolute inset-0 glass-strong border border-emerald-500/30 rounded-3xl p-8 md:p-12 flex flex-col items-center justify-center text-center shadow-2xl bg-emerald-950/20">
              <span className="absolute top-6 left-6 text-emerald-400 font-bold text-2xl opacity-50">A</span>
              <div className="overflow-y-auto max-h-full w-full">
                <p className="text-xl md:text-3xl font-medium text-emerald-50 leading-relaxed m-auto">
                    {flashcards[currentIndex].answer}
                </p>
              </div>
            </div>

          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-6 mt-8">
          <button onClick={prevCard} className="p-4 rounded-2xl glass hover:bg-white/[0.05] border border-white/[0.06] text-white transition-all transform hover:-translate-x-1">
            <ChevronLeft size={24} />
          </button>
          
          <button onClick={(e) => { e.stopPropagation(); setIsFlipped(!isFlipped); }} className="bg-violet-600 hover:bg-violet-500 text-white font-semibold py-3 px-8 rounded-xl transition-colors shadow-[0_0_20px_rgba(124,58,237,0.3)]">
            Flip Card
          </button>
          
          <button onClick={nextCard} className="p-4 rounded-2xl glass hover:bg-white/[0.05] border border-white/[0.06] text-white transition-all transform hover:translate-x-1">
            <ChevronRight size={24} />
          </button>
        </div>

      </div>
    </div>
  );
}
