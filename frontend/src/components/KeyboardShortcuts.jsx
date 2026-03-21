import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';

/**
 * Global keyboard shortcuts — mounted once at the app root.
 * Only active on the /notes/:syllabusId page.
 *
 * Shortcuts:
 *   Ctrl+K        → Global Search (handled in GlobalSearch.jsx)
 *   Alt+Shift+Q   → Open Quiz
 *   Alt+Shift+F   → Open Flashcards
 *   ?             → Show shortcuts help
 */
export default function KeyboardShortcuts() {
    const navigate = useNavigate();

    useEffect(() => {
        const handler = (e) => {
            // Skip if user is typing in an input/textarea
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

            // ? → show shortcuts
            if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
                toast(
                    <div className="text-xs space-y-1">
                        <p className="font-semibold text-white mb-2">⌨️ Keyboard Shortcuts</p>
                        <p><kbd className="bg-white/10 rounded px-1">Ctrl+K</kbd> Global Search</p>
                        <p><kbd className="bg-white/10 rounded px-1">Alt+Shift+Q</kbd> Open Quiz</p>
                        <p><kbd className="bg-white/10 rounded px-1">Alt+Shift+F</kbd> Open Flashcards</p>
                        <p><kbd className="bg-white/10 rounded px-1">?</kbd> Show this help</p>
                    </div>,
                    { duration: 5000, style: { background: '#18181f', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.08)' } }
                );
            }

            // Alt+Shift+Q → trigger quiz button on NotesViewer
            if (e.altKey && e.shiftKey && e.key === 'Q') {
                e.preventDefault();
                document.getElementById('btn-open-quiz')?.click();
            }

            // Alt+Shift+F → trigger flashcards button on NotesViewer
            if (e.altKey && e.shiftKey && e.key === 'F') {
                e.preventDefault();
                document.getElementById('btn-open-flashcards')?.click();
            }
        };

        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [navigate]);

    return null;
}
