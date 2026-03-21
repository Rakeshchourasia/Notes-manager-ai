import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import ChatAssistant from './ChatAssistant';

export default function Layout() {
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    return (
        <div className="flex h-screen bg-[#0a0a0f] overflow-hidden">
            {/* Mobile hamburger button */}
            <button
                onClick={() => setMobileOpen(true)}
                className="fixed top-4 left-4 z-30 md:hidden glass border border-white/[0.08] p-2 rounded-xl text-slate-400 hover:text-white transition-colors"
                aria-label="Open menu"
            >
                <Menu size={18} />
            </button>

            <Sidebar
                collapsed={collapsed}
                onToggle={() => setCollapsed(c => !c)}
                mobileOpen={mobileOpen}
                onMobileClose={() => setMobileOpen(false)}
            />

            <main
                className="flex-1 overflow-y-auto transition-all duration-300"
                style={{ marginLeft: typeof window !== 'undefined' && window.innerWidth >= 768 ? (collapsed ? 72 : 240) : 0 }}
            >
                <Outlet />
            </main>

            <ChatAssistant />
        </div>
    );
}
