import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    themeVariables: {
        primaryColor: '#7c3aed',
        primaryTextColor: '#e2e8f0',
        primaryBorderColor: '#a78bfa',
        lineColor: '#6d28d9',
        sectionBkgColor: '#18181f',
        altSectionBkgColor: '#111118',
        gridColor: '#3d3d4d',
        fontFamily: 'Inter, sans-serif',
        fontSize: '14px',
    },
    securityLevel: 'loose',
});

/**
 * Sanitize mermaid diagram string from AI output
 */
const sanitizeDiagram = (raw) => {
    if (!raw || typeof raw !== 'string') return '';
    let d = raw.trim();

    // Strip markdown code fences
    d = d.replace(/^```(?:mermaid)?\s*/i, '').replace(/\s*```\s*$/, '').trim();

    // Replace literal \n strings with real newlines
    d = d.replace(/\\n/g, '\n');

    // Remove any HTML tags that could cause issues
    d = d.replace(/<br\s*\/?>/gi, '\n');

    return d.trim();
};

export default function MermaidChart({ diagram }) {
    const ref = useRef(null);
    const id = useRef(`mermaid-${Math.random().toString(36).slice(2)}`);
    const [error, setError] = useState(false);

    useEffect(() => {
        const cleaned = sanitizeDiagram(diagram);
        if (!cleaned || !ref.current) return;

        setError(false);
        ref.current.innerHTML = '';

        // Reset the mermaid id to avoid "already rendered" errors
        const renderId = `mermaid-${Math.random().toString(36).slice(2)}`;

        mermaid.render(renderId, cleaned)
            .then(({ svg }) => {
                if (ref.current) ref.current.innerHTML = svg;
            })
            .catch(err => {
                console.warn('Mermaid render error:', err);
                setError(true);
                if (ref.current) {
                    ref.current.innerHTML = '';
                }
            });
    }, [diagram]);

    if (!diagram) return null;

    return (
        <div className="glass rounded-2xl p-5 border border-violet-500/20 overflow-x-auto">
            <div className="text-xs text-violet-400 font-medium mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-violet-500 inline-block" />
                Visual Flowchart
            </div>
            <div ref={ref} className="mermaid flex justify-center" />
            {error && (
                <div className="mt-2 p-3 bg-white/[0.03] rounded-xl border border-white/[0.06]">
                    <p className="text-xs text-slate-500 mb-2">⚠️ Flowchart couldn't be rendered. Raw diagram:</p>
                    <pre className="text-xs text-slate-600 font-mono whitespace-pre-wrap break-all">
                        {sanitizeDiagram(diagram)}
                    </pre>
                </div>
            )}
        </div>
    );
}
