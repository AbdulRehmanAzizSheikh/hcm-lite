import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { LayoutDashboard, Users, ClipboardCheck, Calendar, Wallet, Settings, Megaphone, ScrollText, UserCog, LogOut, Bot, BookOpen } from 'lucide-react';
import { useState } from 'react';
import client from '../api/client';
import toast from 'react-hot-toast';

const navByRole = {
  admin: [
    { to: '/', label: 'dashboard', icon: LayoutDashboard },
    { to: '/employees', label: 'employees', icon: Users },
    { to: '/attendance', label: 'attendance', icon: ClipboardCheck },
    { to: '/leaves', label: 'leaves', icon: Calendar },
    { to: '/payroll', label: 'payroll', icon: Wallet },
    { to: '/announcements', label: 'announcements', icon: Megaphone },
    { to: '/audit', label: 'auditLog', icon: ScrollText },
    { to: '/users', label: 'users', icon: UserCog },
    { to: '/settings', label: 'settings', icon: Settings },
    { to: '/guide', label: 'userGuide', icon: BookOpen },
  ],
  hr: [
    { to: '/', label: 'dashboard', icon: LayoutDashboard },
    { to: '/employees', label: 'employees', icon: Users },
    { to: '/attendance', label: 'attendance', icon: ClipboardCheck },
    { to: '/leaves', label: 'leaves', icon: Calendar },
    { to: '/payroll', label: 'payroll', icon: Wallet },
    { to: '/announcements', label: 'announcements', icon: Megaphone },
    { to: '/guide', label: 'userGuide', icon: BookOpen },
  ],
  employee: [
    { to: '/', label: 'dashboard', icon: LayoutDashboard },
    { to: '/attendance', label: 'attendance', icon: ClipboardCheck },
    { to: '/leaves', label: 'leaves', icon: Calendar },
    { to: '/announcements', label: 'announcements', icon: Megaphone },
    { to: '/guide', label: 'userGuide', icon: BookOpen },
  ],
};

export default function Layout() {
  const { user, logout } = useAuth();
  const { t, lang, setLang, LANGS, langInfo } = useLang();
  const navigate = useNavigate();
  const [chatOpen, setChatOpen] = useState(false);
  const items = navByRole[user?.role] || [];
  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b">
          <h1 className="text-xl font-bold text-blue-600">HCM Lite</h1>
          <p className="text-xs text-gray-500">{user?.email}</p>
          <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">{user?.role}</span>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {items.map((it) => (
            <NavLink key={it.to} to={it.to} end={it.to === '/'}
              className={({ isActive }) => `flex items-center gap-2 px-3 py-2 rounded text-sm ${isActive ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-100'}`}>
              <it.icon size={16} /> {t(it.label)}
            </NavLink>
          ))}
        </nav>
        <div className="p-2 border-t space-y-1">
          <select value={lang} onChange={e => setLang(e.target.value)} className="w-full border rounded px-2 py-1 text-sm">
            {LANGS.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
          <button onClick={() => setChatOpen(true)} className="flex items-center gap-2 px-3 py-2 rounded text-sm text-gray-700 hover:bg-gray-100 w-full">
            <Bot size={16} /> AI Assistant
          </button>
          <button onClick={() => { logout(); navigate('/login'); }} className="flex items-center gap-2 px-3 py-2 rounded text-sm text-red-600 hover:bg-red-50 w-full">
            <LogOut size={16} /> Logout
          </button>
        </div>
      </aside>
      <main className="flex-1 p-6 overflow-auto">
        <Outlet />
      </main>
      {chatOpen && <ChatPanel onClose={() => setChatOpen(false)} />}
    </div>
  );
}

function ChatPanel({ onClose }) {
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const send = async () => {
    if (!input.trim()) return;
    const text = input.trim();
    setInput('');
    setMsgs((m) => [...m, { role: 'user', content: text }]);
    setLoading(true);
    try {
      const r = await client.post('/ai/chat', { message: text, history: msgs });
      setMsgs((m) => [...m, { role: 'assistant', content: r.data.reply }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: 'assistant', content: 'Error: ' + (e.response?.data?.message || e.message) }]);
    } finally { setLoading(false); }
  };
  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-xl border-l z-50 flex flex-col">
      <div className="p-4 border-b flex justify-between items-center">
        <h2 className="font-semibold">AI Assistant</h2>
        <button onClick={onClose} className="text-gray-500">✕</button>
      </div>
      <div className="flex-1 overflow-auto p-4 space-y-3">
        {msgs.map((m, i) => (
          <div key={i} className={`text-sm p-2 rounded ${m.role === 'user' ? 'bg-blue-50 ml-8' : 'bg-gray-100 mr-8'}`}>
            {m.content}
            {m.role === 'assistant' && <div className="ai-label mt-1">AI-generated</div>}
          </div>
        ))}
        {loading && <div className="text-sm text-gray-500">Thinking...</div>}
      </div>
      <div className="p-4 border-t flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} className="flex-1 border rounded px-3 py-2 text-sm" placeholder="Ask..." />
        <button onClick={send} className="bg-blue-600 text-white px-3 py-2 rounded text-sm">Send</button>
      </div>
    </div>
  );
}
