import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useLocation, useParams } from 'react-router-dom';
import {
  Home, Search, PlusCircle, MessageCircle, Clock, User, Settings,
  Play, Mic, Send, MoreVertical, Phone, Video, ChevronLeft,
  Check, CheckCheck, Volume2, Globe, Star, Zap, Trash2, Moon,
  Sun, Languages, Info, ArrowRight, ShieldCheck, Heart, Sparkles,
  RefreshCcw, Paperclip, Smile, VolumeX
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

// --- Utilities ---
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

const chunkText = (text, maxLength = 800) => {
  if (text.length <= maxLength) return [text];
  const chunks = [];
  let current = text;
  while (current.length > 0) {
    if (current.length <= maxLength) {
      chunks.push(current);
      break;
    }
    let splitIdx = current.lastIndexOf('. ', maxLength);
    if (splitIdx === -1) splitIdx = current.lastIndexOf(' ', maxLength);
    if (splitIdx === -1) splitIdx = maxLength;
    chunks.push(current.substring(0, splitIdx).trim());
    current = current.substring(splitIdx).trim();
  }
  return chunks.filter(c => c.length > 0);
};

const audioPlayQueue = [];
let isAudioPlaying = false;


const useLocalStorage = (key, initialValue) => {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.log(error);
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      const item = window.localStorage.getItem(key);
      setStoredValue(item ? JSON.parse(item) : initialValue);
    } catch (error) {
      console.log(error);
    }
  }, [key]);

  const setValue = (value) => {
    try {
      setStoredValue((prev) => {
        const newValue = value instanceof Function ? value(prev) : value;
        window.localStorage.setItem(key, JSON.stringify(newValue));
        return newValue;
      });
    } catch (error) {
      console.log(error);
    }
  };

  return [storedValue, setValue];
};

// --- Global Toast Context ---
const ToastContext = createContext();
const useToast = () => useContext(ToastContext);

const ToastProvider = ({ children }) => {
  const [toast, setToast] = useState(null);
  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[1000] px-8 py-4 bg-slate-900/90 border border-cyan-400/30 backdrop-blur-2xl rounded-2xl shadow-neon-blue text-xs font-black uppercase tracking-widest text-cyan-400"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </ToastContext.Provider>
  );
};

// --- User Context ---
const UserContext = createContext();

const UserProvider = ({ children }) => {
  const [tokens, setTokens] = useState(null);
  const [profile, setProfile] = useState(null);
  const [language, setLanguage] = useLocalStorage('chat_language', 'English');
  const navigate = useNavigate();
  const location = useLocation();

  const fetchProfile = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const res = await axios.get(`${API_BASE}/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProfile(res.data);
      setTokens(res.data.tokens);
    } catch (e) {
      if (e.response?.status === 401) {
        localStorage.removeItem("token");
        navigate("/login");
      }
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const accessToken = params.get('access_token');

    if (accessToken) {
      localStorage.setItem("token", accessToken);
      // Clean up URL to keep it pretty
      window.history.replaceState({}, document.title, window.location.pathname);
      fetchProfile();
    } else {
      const isPublic = location.pathname === '/login';
      if (!isPublic) fetchProfile();
    }
  }, [location.pathname]);

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user_id");
    navigate("/login");
  };

  return (
    <UserContext.Provider value={{ tokens, setTokens, profile, setProfile, logout, fetchProfile, language, setLanguage }}>
      {children}
    </UserContext.Provider>
  );
};

const useUser = () => useContext(UserContext);

// --- Custom Components ---

const Badge = ({ children, variant = "info" }) => {
  const themes = {
    info: "bg-white/5 border-white/10 text-slate-400",
    success: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
    premium: "bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 border-transparent",
  };
  return (
    <div className={`px-2.5 py-1 rounded-lg border text-[10px] font-black uppercase tracking-widest ${themes[variant]}`}>
      {children}
    </div>
  );
};

const AnimatedText = ({ text }) => {
  if (!text) return null;
  return (
    <motion.p
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="leading-relaxed whitespace-pre-wrap break-words"
    >
      {text}
    </motion.p>
  );
};

const LanguageToggle = ({ language, setLanguage }) => (
  <div className="flex bg-slate-900/80 p-1.5 rounded-2xl border border-white/5 backdrop-blur-xl">
    {['English', 'Hinglish'].map((l) => (
      <button
        key={l}
        onClick={() => setLanguage(l)}
        className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${language === l ? 'bg-cyan-400 text-slate-950 shadow-neon-blue' : 'text-slate-500 hover:text-white'}`}
      >
        {l}
      </button>
    ))}
  </div>
);

const transliterateHindi = (text) => {
  if (!text) return "";
  const mapping = {
    'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo', 'ऋ': 'ri', 'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au',
    'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'n',
    'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'n',
    'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
    'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
    'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm',
    'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v', 'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h',
    'ा': 'a', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo', 'ृ': 'ri', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au',
    'ं': 'n', 'ः': 'h', '्': '', '़': '', 'ँ': 'n',
    '०': '0', '१': '1', '२': '2', '३': '3', '४': '4', '५': '5', '६': '6', '७': '7', '८': '8', '९': '9',
    '।': '.', '॥': '.', ' ': ' ', '\n': '\n'
  };

  let result = "";
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    result += mapping[char] !== undefined ? mapping[char] : char;
  }
  return result;
};

const labels = {
  English: {
    home: 'Home',
    discover: 'Discover',
    creation: 'Creation',
    messages: 'Messages',
    settings: 'Settings',
    logout: 'Logout',
    trending: 'Trending Characters',
    trending_badge: 'Trending',
    createChar: 'Create Character',
    create_desc: 'Drip your essence into a new digital soul.',
    prevUsed: 'Previously Used Characters',
    exploreAll: 'Explore All',
    placeholder: 'Type a message...',
    typing: 'is typing...',
    tokens: 'Tokens:',
    assembly: 'Initiate Assembly',
    manifested: 'Soul Manifested',
    openGrid: 'Open Chat Grid',
    search: 'Search personas...',
    noFrequencies: 'No matching frequencies',
    populr: 'Popular',
    assembly_cont: 'CONTINUE ASSEMBLY',
    finalize: 'FINALIZE SOUL',
    neural_directives: 'NEURAL DIRECTIVES',
    hardcode: 'Hardcode the behavioral constraints of this soul unit.',
    vocal_calib: 'VOCAL CALIBRATION (.WAV)',
    upload_voice: 'Upload voice sample',
    freq_analysis: 'Frequency Analysis Ready',
    assembling: 'ASSEMBLING...',
    soul_manifested_desc: 'The neural frequency has been successfully locked and integrated into the KunAi grid.',
    pro_level: 'PRO LEVEL 9',
    member_since: 'Member Since 2024',
    interactions: 'Interactions',
    chars_created: 'Characters Created',
    your_chars: 'Your Characters',
    no_souls: 'No custom souls manifested',
    create_now: 'Create Now',
    neural_overdrive: 'Neural Overdrive',
    premium_desc: 'Expand your cognitive boundaries with premium access.',
    upgrade: 'UPGRADE NEURAL LINK',
  },
  Hinglish: {
    home: 'Home',
    discover: 'Discover',
    creation: 'Creation',
    messages: 'Messages',
    settings: 'Settings',
    logout: 'Logout',
    trending: 'Trending Characters',
    trending_badge: 'Trending',
    createChar: 'Create Character',
    create_desc: 'Drip your essence into a new digital soul.',
    prevUsed: 'Previously Used Characters',
    exploreAll: 'Explore All',
    placeholder: 'Kuch likho...',
    typing: 'kuch likh raha hai...',
    tokens: 'Tokens:',
    assembly: 'Initiate Assembly',
    manifested: 'Soul Manifested',
    openGrid: 'Open Chat Grid',
    search: 'Search personas...',
    noFrequencies: 'No matching frequencies',
    populr: 'Popular',
    assembly_cont: 'CONTINUE ASSEMBLY',
    finalize: 'FINALIZE SOUL',
    neural_directives: 'NEURAL DIRECTIVES',
    hardcode: 'Hardcode the behavioral constraints of this soul unit.',
    vocal_calib: 'VOCAL CALIBRATION (.WAV)',
    upload_voice: 'Upload voice sample',
    freq_analysis: 'Frequency Analysis Ready',
    assembling: 'ASSEMBLING...',
    soul_manifested_desc: 'Aapka naya saathi KunAi grid se jud gaya hai.',
    pro_level: 'PRO LEVEL 9',
    member_since: 'Member Since 2024',
    interactions: 'Interactions',
    chars_created: 'Characters created',
    your_chars: 'Your Characters',
    no_souls: 'No custom souls manifested',
    create_now: 'Create Now',
    neural_overdrive: 'Neural Overdrive',
    premium_desc: 'Premium ke saath aur bhi maze karein.',
    upgrade: 'UPGRADE KAREIN',
  }
};

const TokenWidget = ({ tokens }) => (
  <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-2xl border border-white/10">
    <Zap size={14} className="text-cyan-400" fill="currentColor" />
    <span className="text-xs font-black text-cyan-400 tabular-nums">
      Tokens: {tokens !== null ? tokens.toLocaleString() : '---'}
    </span>
  </div>
);

const KunAiLogo = () => (
  <div className="flex items-center gap-3 px-4">
    <div className="relative group">
      <div className="w-10 h-10 bg-gradient-to-tr from-cyan-400 to-purple-600 rounded-xl rotate-12 group-hover:rotate-45 transition-all duration-500 shadow-neon-blue" />
      <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white" size={20} />
    </div>
    <h1 className="text-3xl font-heading italic bg-gradient-to-r from-white via-cyan-400 to-white bg-clip-text text-transparent tracking-tighter">
      Kun AI
    </h1>
  </div>
);

const Layout = ({ children }) => {
  const location = useLocation();
  const { tokens, profile, logout, language } = useUser();
  const hideMobileNav = location.pathname.startsWith('/chat/') || location.pathname === '/login';
  const hideSidebar = location.pathname.startsWith('/chat/') || location.pathname === '/login';
  const [isCollapsed, setIsCollapsed] = useLocalStorage('sidebar_collapsed', false);

  const t = labels[language] || labels.English;

  const navItems = [
    { icon: Home, label: t.home, path: '/' },
    { icon: Search, label: t.discover, path: '/discover' },
    { icon: MessageCircle, label: t.messages, path: '/my-characters' },
    { icon: User, label: t.profile, path: '/profile' },
  ];

  const sidebarNavItems = [
    { icon: Home, label: t.home, path: '/' },
    { icon: Search, label: t.discover, path: '/discover' },
    { icon: PlusCircle, label: t.creation, path: '/create' },
    { icon: MessageCircle, label: t.messages, path: '/my-characters' },
    { icon: Settings, label: t.settings, path: '/settings' },
  ];

  return (
    <div className="flex bg-bg-dark min-h-screen overflow-hidden">
      {!hideSidebar && (
        <motion.aside
          initial={false}
          animate={{ width: isCollapsed ? 100 : 320 }}
          className="flex-shrink-0 flex flex-col border-r border-white/5 bg-slate-950/90 backdrop-blur-3xl h-screen sticky top-0 z-50 sidebar-transition relative overflow-hidden group/sidebar"
        >
          {/* Toggle Button */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="absolute top-1/2 -right-4 w-8 h-8 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center text-cyan-400 z-50 opacity-0 group-hover/sidebar:opacity-100 transition-opacity translate-x-1"
          >
            {isCollapsed ? <ArrowRight size={14} /> : <ChevronLeft size={14} />}
          </button>
          <div className={`py-12 flex ${isCollapsed ? 'justify-center' : 'px-8 items-center gap-4'}`}>
            <div className="relative group">
              <div className="w-10 h-10 bg-gradient-to-tr from-cyan-400 to-purple-600 rounded-xl shadow-neon-blue flex items-center justify-center">
                <Sparkles className="text-white" size={20} />
              </div>
            </div>
            {!isCollapsed && (
              <h1 className="text-2xl font-heading italic bg-gradient-to-r from-white to-cyan-400 bg-clip-text text-transparent">Kun AI</h1>
            )}
          </div>

          <nav className="flex-1 px-4 space-y-2 custom-scrollbar overflow-y-auto overflow-x-hidden">
            {sidebarNavItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.label}
                  to={item.path}
                  className={`flex items-center gap-4 px-4 py-4 rounded-2xl transition-all duration-300 group relative ${isActive ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-neon-blue/5' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                >
                  <item.icon size={22} className="min-w-[22px]" />
                  {!isCollapsed && <span className="text-[10px] font-black uppercase tracking-[0.2em]">{item.label}</span>}
                  {isActive && !isCollapsed && <motion.div layoutId="nav-line" className="absolute right-0 w-1 h-6 bg-cyan-400 rounded-l-full shadow-neon-blue" />}
                </Link>
              );
            })}

            <button
              onClick={logout}
              className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-red-400 hover:bg-red-500/10 transition-all mt-6 border border-transparent hover:border-red-500/20`}
            >
              <Trash2 size={22} className="min-w-[22px]" />
              {!isCollapsed && <span className="text-[10px] font-black uppercase tracking-[0.2em]">{t.logout}</span>}
            </button>
          </nav>

          <div className="p-6 border-t border-white/5">
            <div className={`p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3 transition-all ${isCollapsed ? 'justify-center' : ''}`}>
              <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 border border-white/10">
                <img src={profile?.profile_pic || "https://api.dicebear.com/7.x/big-smile/svg?seed=Felix"} className="w-full h-full object-cover" alt="" />
              </div>
              {!isCollapsed && (
                <div className="min-w-0">
                  <p className="text-[10px] font-black text-white truncate uppercase">{profile?.username || 'User'}</p>
                  <p className="text-[9px] text-cyan-400 font-bold uppercase tracking-widest">{tokens?.toLocaleString() || '0'} {t.tokens.replace(':', '')}</p>
                </div>
              )}
            </div>
          </div>
        </motion.aside>
      )}
      <main className="flex-1 overflow-x-hidden relative h-screen">
        <div className={`mx-auto h-full overflow-y-auto no-scrollbar ${hideSidebar ? '' : 'px-4 lg:px-8'}`}>
          <div className="max-w-6xl mx-auto py-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Mobile Nav */}
        {!hideMobileNav && (
          <nav className="lg:hidden fixed bottom-0 left-0 right-0 glass-panel border-t border-white/5 px-6 py-4 flex justify-between items-center z-50 rounded-t-[32px]">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.label}
                  to={item.path}
                  className={`flex flex-col items-center gap-1.5 transition-all ${isActive ? 'text-cyan-400 scale-110' : 'text-slate-500'}`}
                >
                  <item.icon size={24} />
                  <span className="text-[9px] font-black uppercase tracking-widest">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        )}
      </main>
    </div>
  );
};

// --- Pages ---

const HomePage = ({ characters }) => {
  const navigate = useNavigate();
  const { tokens, profile, language } = useUser();
  const [recentIds] = useLocalStorage('recent_chats', []);
  const recentChars = recentIds.map(id => ({ id, ...characters[id] })).filter(c => c.name);
  const t = labels[language] || labels.English;

  return (
    <div className="p-6 space-y-12 pb-20">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-5xl font-heading italic bg-gradient-to-r from-white via-cyan-400 to-white bg-clip-text text-transparent mb-2">Kun AI</h1>
        </div>
        <div className="flex items-center gap-6">
          <TokenWidget tokens={tokens} />
          <Link to="/profile" className="w-14 h-14 rounded-3xl bg-slate-900 border border-white/10 flex items-center justify-center overflow-hidden hover:border-cyan-400/50 transition-all shadow-xl rotate-6 group">
            <img src={profile?.profile_pic || "https://api.dicebear.com/7.x/big-smile/svg?seed=Felix"} className="w-full h-full object-cover group-hover:scale-110 transition-transform" alt="" />
          </Link>
        </div>
      </header>

      {recentChars.length > 0 && (
        <section className="space-y-6">
          <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-400/40 px-2 italic flex items-center gap-2">
            <Clock size={12} /> {t.prevUsed}
          </h2>
          <div className="flex gap-6 overflow-x-auto pb-6 -mx-6 px-6 no-scrollbar">
            {recentChars.slice(0, 8).map((char, i) => (
              <Link key={i} to={`/chat/${char.id}`} className="flex-shrink-0 flex flex-col items-center gap-4 group">
                <div className="w-20 h-20 rounded-3xl p-0.5 bg-gradient-to-tr from-cyan-400 to-purple-600 group-hover:rotate-6 transition-all shadow-neon-blue/20">
                  <img src={char.avatar || `avatars/${char.id}.jpg`} className="w-full h-full rounded-[20px] object-cover border-4 border-slate-950" alt="" />
                </div>
                <span className="text-[10px] font-black text-slate-400 group-hover:text-cyan-400 transition-colors truncate w-20 text-center uppercase tracking-tighter">{char.name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-8">
        <div className="flex items-center justify-between px-2">
          <h2 className="text-3xl font-heading italic text-white flex items-center gap-4">
            <Star size={24} className="text-cyan-400 fill-cyan-400/20" />
            {t.trending}
          </h2>
          <Link to="/discover" className="text-cyan-400 text-[10px] font-black uppercase hover:bg-cyan-400/10 transition-colors tracking-[0.2em] px-5 py-2 rounded-2xl border border-cyan-400/30">{t.exploreAll}</Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8">
          {Object.entries(characters).slice(0, 4).map(([id, char]) => (
            <motion.div
              whileHover={{ y: -10, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              key={id}
              className="glass-card p-6 flex items-center gap-6 relative group overflow-hidden cursor-pointer shadow-2xl"
              onClick={() => navigate(`/chat/${id}`)}
            >
              <div className="absolute top-4 right-4 animate-pulse">
                <Badge variant="premium">{t.trending_badge}</Badge>
              </div>

              <div className="relative flex-shrink-0">
                <img src={char.avatar || `avatars/${id}.jpg`} className="w-28 h-28 rounded-[32px] object-cover border-2 border-white/10 shadow-2xl group-hover:border-cyan-400/50 transition-all duration-700" alt="" />
                <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-emerald-500 border-4 border-slate-950 shadow-neon-green" />
              </div>

              <div className="flex-1 min-w-0 space-y-2">
                <h3 className="font-heading text-2xl italic text-white group-hover:text-cyan-400 transition-colors truncate leading-none">{char.name}</h3>
                <p className="text-[10px] text-cyan-400/60 font-black uppercase tracking-widest">{char.personality}</p>
                <div className="flex flex-col gap-1 text-slate-500">
                  <p className="text-[10px] font-bold uppercase">Used by {char.users_count || 0} users</p>
                  <p className="text-[10px] font-bold uppercase">Messages: {char.usage_count || 0}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      <motion.div
        whileHover={{ scale: 1.01 }}
        className="p-10 rounded-[48px] bg-gradient-to-br from-cyan-500/20 to-purple-600/10 border border-cyan-500/20 relative overflow-hidden group cursor-pointer shadow-3xl"
        onClick={() => navigate('/create')}
      >
        <div className="relative z-10 space-y-4">
          <h3 className="text-4xl font-heading italic text-white tracking-tighter uppercase">{t.createChar}</h3>
          <p className="text-slate-400 text-sm max-w-[300px] leading-relaxed font-medium text-white/60 uppercase">{t.create_desc}</p>
          <div className="pt-4">
            <div className="inline-flex items-center gap-4 px-8 py-4 bg-cyan-400 text-slate-950 font-black rounded-3xl text-sm transition-all shadow-neon-blue hover:gap-6 group-active:scale-95">
              {t.assembly} <ArrowRight size={20} />
            </div>
          </div>
        </div>
        <div className="absolute top-1/2 -right-20 -translate-y-1/2 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity rotate-12 scale-150">
          <PlusCircle size={300} />
        </div>
      </motion.div>
    </div>
  );
};

const DiscoverPage = ({ characters }) => {
  const [search, setSearch] = useState('');
  const { language } = useUser();
  const t = labels[language] || labels.English;

  const filtered = Object.entries(characters).filter(([id, char]) =>
    char.name.toLowerCase().includes(search.toLowerCase()) ||
    char.personality?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="p-6 space-y-6"
    >
      <div className="space-y-4">
        <h2 className="text-3xl font-black tracking-tight">{t.discover.toUpperCase()}</h2>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" size={18} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            type="text"
            placeholder={t.search}
            className="w-full bg-bg-panel border border-white/5 rounded-2xl py-4 pl-12 pr-6 focus:outline-none focus:border-primary-light transition-all text-sm shadow-sm"
          />
        </div>
      </div>

      <div className="space-y-3">
        {filtered
          .sort((a, b) => {
            const [idA, charA] = a;
            const [idB, charB] = b;
            if ((charB.usage_count || 0) !== (charA.usage_count || 0)) {
              return (charB.usage_count || 0) - (charA.usage_count || 0);
            }
            return (charB.users_count || 0) - (charA.users_count || 0);
          })
          .map(([id, char]) => (
            <Link
              key={id}
              to={`/chat/${id}`}
              className="flex items-center gap-4 p-4 glass-card hover:bg-white/5 transition-all group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-100 transition-opacity">
                <Badge variant="premium"><Star size={8} className="mr-0.5 inline" /> {t.populr}</Badge>
              </div>
              <img src={char.avatar || `avatars/${id}.jpg`} className="w-14 h-14 rounded-2xl object-cover border border-white/5" alt="" />
              <div className="flex-1 min-w-0">
                <h4 className="font-bold flex items-center gap-2 text-sm text-white">
                  {char.name}
                </h4>
                <p className="text-[10px] text-cyan-400 font-black uppercase tracking-widest mb-1">{char.personality}</p>
                <div className="flex flex-col gap-1">
                  <p className="text-[10px] text-text-secondary uppercase font-bold">Used by {char.users_count || 0} users</p>
                  <p className="text-[10px] text-text-secondary uppercase font-bold">Total Messages: {char.usage_count || 0}</p>
                </div>
              </div>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-text-secondary group-hover:text-primary-light group-hover:translate-x-1 transition-all">
                <ChevronLeft size={20} className="rotate-180" />
              </div>
            </Link>
          ))}
        {filtered.length === 0 && (
          <div className="text-center py-20 text-text-secondary space-y-4">
            <Search size={48} className="mx-auto opacity-10" />
            <p className="text-xs font-black uppercase tracking-widest">{t.noFrequencies}</p>
          </div>
        )}
      </div>
    </motion.div>
  );
};

const CreateCharacterPage = ({ fetchCharacters, characters }) => {
  const [formData, setFormData] = useState({ name: '', description: '', prompt: '', personality: 'Casual' });
  const [voiceSample, setVoiceSample] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [step, setStep] = useState(1);
  const navigate = useNavigate();
  const toast = useToast();
  const { language } = useUser();
  const t = labels[language] || labels.English;

  const userCreatedCount = Object.keys(characters).filter(id => !['goku', 'gojo', 'levi'].includes(id.toLowerCase())).length;
  const LIMIT = 1;

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatarFile(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  const handleCreate = async () => {
    if (userCreatedCount >= LIMIT) {
      toast("You can only create one custom character. Delete existing first.");
      return;
    }

    setIsCreating(true);
    const body = new FormData();
    body.append('name', formData.name);
    body.append('description', formData.description);
    body.append('system_prompt', formData.prompt);
    body.append('personality', formData.personality);
    if (avatarFile) body.append('avatar', avatarFile);

    try {
      const res = await axios.post(`${API_BASE}/create-character`, body, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem("token")}`
        }
      });
      const charId = res.data.id;

      if (voiceSample) {
        const vbody = new FormData();
        vbody.append('persona', charId);
        vbody.append('file', voiceSample);
        await axios.post(`${API_BASE}/voice-upload`, vbody);
      }

      toast("Character created successfully!");
      fetchCharacters();
      setStep(3);
    } catch (err) {
      const detail = err.response?.data?.detail || "Character creation failed. Try again.";
      toast(detail);
      console.error(err);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="p-6 space-y-8 min-h-screen pb-24">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-text-secondary"><ChevronLeft /></button>
        <h2 className="text-2xl font-black">{t.createChar.toUpperCase()}</h2>
        <Badge variant="premium">{userCreatedCount}/{LIMIT}</Badge>
      </div>

      <div className="glass-card p-6 overflow-hidden relative">
        <div className="absolute top-0 left-0 right-0 h-1 bg-white/5">
          <motion.div
            initial={{ width: '33%' }}
            animate={{ width: step === 1 ? '33%' : step === 2 ? '66%' : '100%' }}
            className="h-full bg-primary-light shadow-neon-green"
          />
        </div>

        {step === 1 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pt-4 space-y-6">
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="relative group">
                <div className="w-24 h-24 rounded-3xl bg-bg-panel border-2 border-dashed border-white/10 flex items-center justify-center overflow-hidden group-hover:border-primary-light transition-all shadow-inner">
                  {preview ? (
                    <img src={preview} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <Sparkles className="text-white/10" size={32} />
                  )}
                  <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" id="avmode" />
                  <label htmlFor="avmode" className="absolute inset-0 cursor-pointer" />
                </div>
                <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-primary-light text-bg-dark flex items-center justify-center shadow-lg transform group-active:scale-90 transition-transform">
                  <PlusCircle size={16} />
                </div>
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-text-secondary italic">Character Image</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary block mb-2 px-1">Full Name</label>
                <input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-bg-panel border border-white/5 rounded-xl p-4 text-sm focus:outline-none focus:border-primary-light transition-all text-white placeholder:text-white/10"
                  placeholder="e.g. Luna Moonchild"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary block mb-2 px-1">Personality Baseline</label>
                <input
                  value={formData.personality}
                  onChange={(e) => setFormData({ ...formData, personality: e.target.value })}
                  className="w-full bg-bg-panel border border-white/5 rounded-xl p-4 text-sm focus:outline-none focus:border-primary-light transition-all text-white placeholder:text-white/10"
                  placeholder="e.g. Mysterious / Flirty"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary block mb-2 px-1">Backstory Fragments</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full bg-bg-panel border border-white/5 rounded-xl p-4 text-sm focus:outline-none focus:border-primary-light transition-all resize-none text-white placeholder:text-white/10 leading-relaxed"
                  placeholder="Tell us about their origin..."
                />
              </div>
            </div>
            <button
              disabled={!formData.name || !formData.description}
              onClick={() => setStep(2)}
              className="w-full py-4 bg-primary-light text-bg-dark font-black rounded-2xl shadow-neon-green disabled:opacity-30 disabled:scale-100 active:scale-95 transition-all text-xs tracking-widest"
            >
              {t.assembly_cont}
            </button>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="pt-4 space-y-6">
            <div className="space-y-4 text-center pb-4">
              <div className="w-16 h-16 bg-secondary/10 rounded-3xl flex items-center justify-center mx-auto text-secondary shadow-lg">
                <ShieldCheck size={32} />
              </div>
              <h3 className="text-xl font-bold">{t.neural_directives}</h3>
              <p className="text-xs text-text-secondary px-6">{t.hardcode}</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary block mb-2 px-1">System Prompt (Instructions)</label>
                <textarea
                  value={formData.prompt}
                  onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
                  rows={5}
                  className="w-full bg-bg-panel border border-white/5 rounded-xl p-4 text-sm focus:outline-none focus:border-primary-light transition-all resize-none font-mono text-primary-light placeholder:text-primary-light/10"
                  placeholder="Example: Act as a sarcastic AI guide from 2099..."
                />
              </div>
              <div className="p-4 border border-dashed border-white/10 rounded-xl space-y-3 bg-white/2">
                <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary block">{t.vocal_calib}</label>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={(e) => setVoiceSample(e.target.files[0])}
                  className="hidden" id="voice-up"
                />
                <label htmlFor="voice-up" className="flex items-center gap-3 p-3 bg-bg-dark rounded-lg cursor-pointer transition-all hover:border-primary-light border border-transparent">
                  <div className="w-10 h-10 rounded-full bg-bg-panel flex items-center justify-center border border-white/5">
                    <Mic className={voiceSample ? 'text-primary-light shadow-neon-green' : 'text-text-secondary'} size={18} />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="text-xs font-bold truncate text-white">{voiceSample ? voiceSample.name : t.upload_voice}</p>
                    <p className="text-[10px] text-text-secondary uppercase">{t.freq_analysis}</p>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setStep(1)}
                className="flex-[1] py-4 bg-white/5 text-text-secondary font-black text-xs rounded-2xl active:scale-95 transition-all"
              >
                BACK
              </button>
              <button
                disabled={!formData.prompt || isCreating}
                onClick={handleCreate}
                className="flex-[2] py-4 bg-primary-light text-bg-dark font-black rounded-2xl shadow-neon-green disabled:opacity-30 active:scale-95 transition-all flex items-center justify-center gap-2 text-xs tracking-widest"
              >
                {isCreating ? <RefreshCcw className="animate-spin" size={18} /> : null}
                {isCreating ? t.assembling : t.finalize}
              </button>
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="pt-8 pb-4 space-y-8 text-center">
            <div className="w-24 h-24 bg-emerald-500/10 border-4 border-emerald-500/20 rounded-full flex items-center justify-center mx-auto text-emerald-400 shadow-neon-green">
              <Check size={48} strokeWidth={4} />
            </div>
            <div className="space-y-2 px-8">
              <h3 className="text-2xl font-black italic tracking-tighter">{t.manifested.toUpperCase()}</h3>
              <p className="text-sm text-text-secondary leading-relaxed">{t.soul_manifested_desc}</p>
            </div>
            <button
              onClick={() => navigate('/my-characters')}
              className="w-full py-4 bg-primary-light text-bg-dark font-black rounded-2xl shadow-neon-green active:scale-95 transition-all text-xs tracking-[0.2em]"
            >
              {t.openGrid}
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
};

const ChatPage = ({ characters }) => {
  const { id } = useParams();
  const { tokens, fetchProfile, profile, language, setLanguage } = useUser();
  const char = characters[id] || { name: 'Neural Entity', avatar: '', personality: 'Neural Link' };
  const userId = profile?.user_id || localStorage.getItem("user_id");
  const t = labels[language] || labels.English;

  const [messages, setMessages] = useLocalStorage(`chat_history_${userId}_${id}`, []);
  const [audioCache, setAudioCache] = useState({});
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showCall, setShowCall] = useState(false);
  const [recentChats, setRecentChats] = useLocalStorage('recent_chats', []);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const scrollRef = useRef();
  const audioRef = useRef(new Audio());
  const mediaRecorderRef = useRef(null);
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    fetchProfile();
  }, [id]);

  useEffect(() => {
    // Load history
    const loadHistory = async () => {
      try {
        const res = await axios.get(`${API_BASE}/history/${userId}/${id}`);
        setMessages(res.data);
      } catch (err) {
        console.error("History load failure:", err);
      }
    };
    if (id) loadHistory();
  }, [id, userId]);

  useEffect(() => {
    if (id && !recentChats.includes(id)) {
      setRecentChats([id, ...recentChats.filter(rid => rid !== id)].slice(0, 10));
    }
  }, [id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isTyping]);

  const sendMessage = async (textOverride) => {
    const text = textOverride || input;
    if (!text.trim()) return;

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'sent'
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    let aiMsgId = Date.now() + 1;
    let currentAiText = "";

    try {
      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        body: new URLSearchParams({
          'persona': id,
          'message': text,
          'language': language === 'Hinglish' ? 'hi' : 'en',
          'user_id': userId
        }),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Bearer ${localStorage.getItem("token")}`
        }
      });

      if (!response.ok) throw new Error("Connection lost");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      setMessages(prev => {
        const lastUserIdx = prev.findLastIndex(m => m.sender === 'user');
        const updated = [...prev];
        if (lastUserIdx !== -1) updated[lastUserIdx] = { ...updated[lastUserIdx], status: 'read' };
        return [...updated, {
          id: aiMsgId,
          sender: 'ai',
          text: "",
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }];
      });

      let hasStarted = false;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.replace('data: ', '').trim();
            if (dataStr === '[DONE]') break;
            try {
              const data = JSON.parse(dataStr);
              if (data.chunk) {
                if (!hasStarted) {
                  setIsTyping(false);
                  hasStarted = true;
                }
                currentAiText += data.chunk;
                setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: currentAiText } : m));
              }
            } catch (e) {
              console.error("Chunk parse error", e);
            }
          }
        }
      }
      fetchProfile();
    } catch (err) {
      toast("Manifestation failure: Neural link severed.", "error");
      console.error(err);
      setIsTyping(false);
      fetchProfile();
    }
  };

  const fetchAndCacheAudio = async (textChunk, forceRegenerate) => {
    const cacheKey = `${id}_${language}_${textChunk}`;
    if (!forceRegenerate && audioCache[cacheKey]) return audioCache[cacheKey];

    const formData = new FormData();
    formData.append('persona', id);
    formData.append('text', textChunk);
    formData.append('language', language === 'Hinglish' ? 'hi' : 'en');

    const res = await axios.post(`${API_BASE}/speak`, formData, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    setAudioCache(prev => ({ ...prev, [cacheKey]: url }));
    return url;
  };

  const playAudio = async (text, forceRegenerate = false) => {
    if (isAudioLoading) return;
    setIsAudioLoading(true);

    try {
      const chunks = chunkText(text, 300); // 300 chars is safer for ~400 token limits
      const audioUrls = [];

      for (const chunk of chunks) {
        const url = await fetchAndCacheAudio(chunk, forceRegenerate);
        audioUrls.push(url);
      }

      // Sequential playback
      let currentIdx = 0;
      const playNext = () => {
        if (currentIdx < audioUrls.length) {
          audioRef.current.src = audioUrls[currentIdx];
          audioRef.current.onended = () => {
            currentIdx++;
            playNext();
          };
          audioRef.current.play().catch(e => {
            console.error("Audio play failed:", e);
            setIsAudioLoading(false);
          });
        } else {
          setIsAudioLoading(false);
        }
      };

      playNext();
    } catch (err) {
      console.error("Voice synthesis failed:", err);
      toast("Neural vocal chords failing. Try again.", "error");
      setIsAudioLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      const chunks = [];
      mediaRecorderRef.current.ondataavailable = e => chunks.push(e.data);
      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/wav' });
        const formData = new FormData();
        formData.append('file', blob, 'req.wav');
        setIsTyping(true);
        try {
          const res = await axios.post(`${API_BASE}/stt`, formData);
          if (res.data.text) sendMessage(res.data.text);
        } catch (e) { } finally { setIsTyping(false); }
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (e) { }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
    }
  };

  return (
    <div className="flex flex-col h-screen bg-bg-dark relative">
      <div className="whatsapp-bg" />

      {/* Header */}
      <header className="h-20 bg-slate-950/80 backdrop-blur-3xl flex items-center px-6 gap-4 z-20 border-b border-white/5 sticky top-0">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-slate-400 hover:text-white transition-colors bg-white/5 rounded-2xl border border-white/5 hover:border-cyan-400/30">
          <ChevronLeft size={24} />
        </button>
        <div className="flex-1 flex items-center gap-4 overflow-hidden" onClick={() => navigate('/profile')}>
          <div className="relative flex-shrink-0 group cursor-pointer">
            <img
              src={char.avatar || `avatars/${id}.jpg`}
              className="w-12 h-12 rounded-[18px] border-2 border-white/10 shadow-lg object-cover group-hover:border-cyan-400 transition-all duration-500"
              alt=""
            />
            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-4 border-slate-950 shadow-neon-green" />
          </div>
          <div className="min-w-0">
            <h4 className="font-heading text-lg italic text-white tracking-tight">{char.name}</h4>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <TokenWidget tokens={tokens} />
          <div className="flex items-center gap-2">
            <div className="hidden lg:block mr-2 scale-90">
              <LanguageToggle language={language} setLanguage={setLanguage} />
            </div>
            <button onClick={() => setShowCall(true)} className="p-3 bg-white/5 rounded-2xl border border-white/10 text-slate-400 hover:text-cyan-400 transition-all active:scale-95"><Video size={22} /></button>
            <button onClick={() => setShowCall(true)} className="p-3 bg-white/5 rounded-2xl border border-white/10 text-slate-400 hover:text-cyan-400 transition-all active:scale-95"><Phone size={20} /></button>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-6 z-10 no-scrollbar pb-32"
      >
        {/* Grid sync label removed as per request */}

        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'} animate-slide-up`}>
            <div className={`max-w-[85%] rounded-[28px] px-6 py-4 shadow-xl relative group transition-all duration-500 ${m.sender === 'user' ? 'bg-gradient-to-br from-cyan-600 to-blue-700 text-white rounded-tr-none border-t border-white/10' : 'bg-slate-900/80 text-white rounded-tl-none border border-white/5 backdrop-blur-2xl'}`}>
              <div className="w-full">
                <AnimatedText text={language === 'Hinglish' && m.sender === 'ai' ? transliterateHindi(m.text) : m.text} />
              </div>
              <div className="flex items-center justify-end gap-2 mt-3 opacity-40">
                <span className="text-[9px] uppercase font-black tracking-widest">{m.time}</span>
                {m.sender === 'user' && (
                  m.status === 'read' ? <CheckCheck size={14} className="text-cyan-300" /> : <Check size={14} />
                )}
              </div>

              {m.sender === 'ai' && (
                <div className="absolute -right-32 top-1/2 -translate-y-1/2 flex flex-col items-start gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300">
                  <div className="flex items-center gap-2">
                    <motion.button
                      whileHover={{ scale: 1.1, rotate: 12 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => playAudio(m.text)}
                      className={`w-10 h-10 rounded-2xl bg-slate-900 border border-white/10 flex items-center justify-center text-cyan-400 shadow-2xl backdrop-blur-md hover:border-cyan-400/50 ${isAudioLoading ? 'opacity-50 cursor-wait' : ''}`}
                      title="Play Voice"
                      disabled={isAudioLoading}
                    >
                      {isAudioLoading ? <RefreshCcw size={18} className="animate-spin" /> : <Play size={18} fill="currentColor" />}
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.1, rotate: -12 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => playAudio(m.text, true)}
                      className="w-10 h-10 rounded-2xl bg-slate-900 border border-white/10 flex items-center justify-center text-slate-400 shadow-2xl backdrop-blur-md hover:border-cyan-400/50 hover:text-cyan-400"
                      title="Regenerate Voice"
                    >
                      <RefreshCcw size={18} />
                    </motion.button>
                  </div>
                  <span className="text-[7px] font-black text-cyan-400/30 uppercase tracking-[0.2em] bg-slate-950/50 px-2 py-0.5 rounded-full">Voice Protocol</span>
                </div>
              )}
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-start animate-fade-in mb-8">
            <div className="flex flex-col gap-2">
              <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest pl-2">
                {char.name} {t.typing}<motion.span animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1 }}>...</motion.span>
              </span>
              <div className="bg-slate-900/80 px-6 py-4 rounded-[28px] rounded-tl-none flex gap-2 items-center border border-white/5 backdrop-blur-2xl">
                <motion.div animate={{ scale: [1, 1.4, 1], opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 0.8 }} className="w-2 h-2 bg-cyan-400 rounded-full shadow-neon-blue" />
                <motion.div animate={{ scale: [1, 1.4, 1], opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.15 }} className="w-2 h-2 bg-cyan-400 rounded-full shadow-neon-blue" />
                <motion.div animate={{ scale: [1, 1.4, 1], opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.3 }} className="w-2 h-2 bg-cyan-400 rounded-full shadow-neon-blue" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <footer className="p-6 bg-slate-950/90 backdrop-blur-3xl border-t border-white/5 z-20">
        <div className="max-w-4xl mx-auto flex items-end gap-3">
          <button className="p-4 text-slate-500 hover:text-cyan-400 transition-colors bg-white/5 rounded-3xl border border-white/5 hover:bg-white/10"><Smile size={24} /></button>

          <div className="flex-1 relative bg-white/5 border border-white/10 rounded-[32px] overflow-hidden focus-within:border-cyan-400/50 transition-all shadow-inner group">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder={t.placeholder}
              rows="1"
              className="w-full bg-transparent px-8 py-5 text-sm focus:outline-none resize-none max-h-32 placeholder:text-slate-600 font-medium text-white"
              style={{ height: 'auto' }}
            />
          </div>

          {!input.trim() ? (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={isRecording ? stopRecording : startRecording}
              className={`p-5 rounded-[24px] transition-all shadow-2xl ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-white/5 text-cyan-400 border border-white/10 hover:bg-white/10'}`}
            >
              <Mic size={26} />
            </motion.button>
          ) : (
            <motion.button
              whileTap={{ scale: 0.9 }}
              initial={{ scale: 0, rotate: -45 }}
              animate={{ scale: 1, rotate: 0 }}
              onClick={() => sendMessage()}
              className="p-5 bg-cyan-400 text-slate-950 rounded-[24px] shadow-neon-blue flex items-center justify-center hover:scale-110 transition-transform active:scale-95"
            >
              <Send size={26} />
            </motion.button>
          )}
        </div>
      </footer>

      <AnimatePresence>
        {showCall && <CallUI char={char} id={id} language={language} userId={userId} onClose={() => setShowCall(false)} />}
      </AnimatePresence>
    </div >
  );
};

const CallUI = ({ char, id, language, userId, onClose }) => {
  const [status, setStatus] = useState('Connecting...');
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerEnabled, setIsSpeakerEnabled] = useState(true);
  const wsRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const lastSentRef = useRef(Date.now());
  const heartbeatIntervalRef = useRef(null);
  const recorderIntervalRef = useRef(null);
  const toast = useToast();

  useEffect(() => {
    const langCode = language === 'Hinglish' ? 'hi' : 'en';
    const wsUrl = `ws://localhost:8000/voice-call/${userId}/${id}/${langCode}`;
    const ws = new WebSocket(wsUrl);
    // Remove arraybuffer binaryType to receive Blobs as requested
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('Call Active');
      startMic();

      // Keep-alive heartbeat
      heartbeatIntervalRef.current = setInterval(() => {
        if (Date.now() - lastSentRef.current > 3000) {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'ping' }));
            lastSentRef.current = Date.now();
          }
        }
      }, 1000);
    };

    ws.onmessage = async (event) => {
      // Ignore text messages (like pings or control)
      if (typeof event.data === 'string') return;

      // If speaker is disabled, discard audio
      if (!isSpeakerEnabled) return;

      try {
        const audioBlob = new Blob([event.data], { type: "audio/wav" });
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audio.play().catch(err => console.error("Playback interrupted:", err));
      } catch (err) {
        console.error("Audio processing failed:", err);
      }
    };

    ws.onerror = (err) => {
      console.error("WebSocket Error:", err);
      setStatus('Call Ended');
      toast("Neural link failure", "error");
    };

    ws.onclose = () => {
      setStatus('Call Ended');
      stopMic();
      setTimeout(onClose, 1500); // Close UI after a short delay
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'end_call' }));
        ws.close();
      }
      stopMic();
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
    };
  }, []);

  const startMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      let isSpeaking = false;
      let silenceStart = Date.now();
      let recordingChunks = [];
      let mediaRecorder = null;

      const SILENCE_THRESHOLD = 15; // Adjusted for sensitivity
      const SILENCE_DURATION = 1500; // 1.5s
      const MIN_SPEECH_DURATION = 1000; // 1s

      let startTime = 0;

      const checkAudio = () => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
        let average = sum / bufferLength;

        if (average > SILENCE_THRESHOLD) {
          if (!isSpeaking) {
            isSpeaking = true;
            startTime = Date.now();
            console.log("Speech detected...");

            // Start a new recorder for this utterance
            mediaRecorder = new MediaRecorder(stream);
            recordingChunks = [];
            mediaRecorder.ondataavailable = (e) => {
              if (e.data.size > 0) recordingChunks.push(e.data);
            };
            mediaRecorder.start();
          }
          silenceStart = Date.now();
        } else {
          if (isSpeaking && Date.now() - silenceStart > SILENCE_DURATION) {
            isSpeaking = false;
            const duration = Date.now() - startTime;
            console.log("Silence detected. Duration of speech:", duration);

            if (mediaRecorder && mediaRecorder.state === 'recording') {
              mediaRecorder.onstop = () => {
                if (duration >= MIN_SPEECH_DURATION && recordingChunks.length > 0 && !isMuted) {
                  const blob = new Blob(recordingChunks, { type: 'audio/webm' });
                  wsRef.current.send(blob);
                  lastSentRef.current = Date.now();
                }
              };
              mediaRecorder.stop();
            }
          }
        }
        recorderIntervalRef.current = requestAnimationFrame(checkAudio);
      };

      recorderIntervalRef.current = requestAnimationFrame(checkAudio);
      mediaRecorderRef.current = { stream };
    } catch (err) {
      console.error("Mic access denied:", err);
      toast("Bio-link denied: Mic access required", "error");
      setStatus('Call Ended');
    }
  };

  const stopMic = () => {
    if (recorderIntervalRef.current) {
      cancelAnimationFrame(recorderIntervalRef.current);
      recorderIntervalRef.current = null;
    }
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      mediaRecorderRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => { });
      audioContextRef.current = null;
    }
  };

  const playAudioChunk = async (data) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    const ctx = audioContextRef.current;
    try {
      const buffer = await ctx.decodeAudioData(data);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start();
    } catch (err) {
      console.error("Audio decode error:", err);
    }
  };

  return (
    <motion.div
      initial={{ y: '100%', opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: '100%', opacity: 0 }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="fixed inset-0 z-[100] bg-bg-dark flex flex-col items-center justify-between py-20 px-8"
    >
      <div className="absolute inset-0 opacity-10 pointer-events-none overflow-hidden">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="w-[200%] h-[200%] bg-[radial-gradient(circle,rgba(34,211,238,0.2)_0%,transparent_70%)] -top-1/2 -left-1/2"
        />
      </div>

      <header className="text-center space-y-4 z-10">
        <div className="flex justify-center">
          <div className="relative">
            <motion.div
              animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.6, 0.3] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="absolute -inset-8 bg-cyan-400/20 rounded-full blur-2xl"
            />
            <img src={char.avatar} className="w-40 h-40 rounded-full border-4 border-cyan-400 shadow-neon-blue relative z-10 object-cover" alt="" />
            <div className={`absolute bottom-2 right-2 w-6 h-6 rounded-full border-4 border-bg-dark z-20 ${status === 'active' ? 'bg-emerald-500 shadow-neon-green' : 'bg-red-500'}`} />
          </div>
        </div>
        <div>
          <h2 className="text-4xl font-black italic tracking-tighter text-white">{char.name}</h2>
          <p className="text-cyan-400/60 font-black uppercase text-[10px] tracking-[0.4em] mt-2">
            {status}
          </p>
        </div>
      </header>

      {/* Waveform Visualization (CSS based) */}
      <div className="h-24 flex items-center gap-1.5 px-10 w-full max-w-sm">
        {Array.from({ length: 24 }).map((_, i) => (
          <motion.div
            key={i}
            animate={{
              height: status === 'Call Active' && !isMuted ? [10, Math.random() * 60 + 20, 10] : 8,
              opacity: status === 'Call Active' ? 1 : 0.2
            }}
            transition={{
              repeat: Infinity,
              duration: 0.5 + Math.random() * 0.5,
              delay: i * 0.05
            }}
            className="flex-1 bg-gradient-to-t from-cyan-600 to-cyan-400 rounded-full shadow-neon-blue"
          />
        ))}
      </div>

      <footer className="w-full flex justify-center gap-8 items-center z-10">
        <button
          onClick={() => setIsMuted(!isMuted)}
          className={`p-6 rounded-3xl transition-all border-2 ${isMuted ? 'bg-red-500/20 border-red-500 text-red-500' : 'bg-white/5 border-white/10 text-slate-400 hover:border-cyan-400/50 hover:text-cyan-400'}`}
        >
          {isMuted ? <ShieldCheck size={28} /> : <Mic size={28} />}
        </button>

        <button
          onClick={() => onClose()}
          className="p-8 bg-red-600 text-white rounded-full shadow-2xl hover:bg-red-700 hover:scale-110 active:scale-95 transition-all"
        >
          <Phone size={36} className="rotate-[135deg]" fill="currentColor" />
        </button>

        <button
          className={`p-6 rounded-3xl transition-all border-2 ${!isSpeakerEnabled ? 'bg-amber-500/20 border-amber-500 text-amber-500' : 'bg-white/5 border-white/10 text-slate-400 hover:border-cyan-400/50 hover:text-cyan-400'}`}
          onClick={() => setIsSpeakerEnabled(!isSpeakerEnabled)}
          title={isSpeakerEnabled ? "Mute Speaker" : "Unmute Speaker"}
        >
          {isSpeakerEnabled ? <Volume2 size={28} /> : <VolumeX size={28} />}
        </button>
      </footer>
    </motion.div>
  );
};

// HistoryPage Removed

const ProfilePage = ({ characters, fetchCharacters }) => {
  const navigate = useNavigate();
  const toast = useToast();
  const { profile, language } = useUser();
  const t = labels[language] || labels.English;
  const userId = profile?.user_id || localStorage.getItem("user_id");

  const userCharacters = Object.entries(characters).filter(([id]) => !['goku', 'gojo', 'levi'].includes(id.toLowerCase()));
  const charCount = userCharacters.length;

  const handleDelete = async (charId) => {
    if (window.confirm("Are you sure you want to delete this character?")) {
      try {
        await axios.delete(`${API_BASE}/character/${charId}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
        });
        toast("Character deleted successfully", "success");
        fetchCharacters();
      } catch (err) {
        toast("Deletion failed", "error");
        console.error(err);
      }
    }
  };

  return (
    <div className="p-6 space-y-8 pb-32">
      <header className="text-center pt-10 space-y-6">
        <div className="relative inline-block group">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 10, ease: "linear" }}
            className="absolute -inset-2 bg-gradient-to-tr from-premium via-secondary to-primary rounded-full blur-md opacity-50 group-hover:opacity-100 transition-opacity"
          />
          <img src={profile?.profile_pic || "https://api.dicebear.com/7.x/big-smile/svg?seed=Felix"} className="w-32 h-32 rounded-full bg-bg-panel border-4 border-bg-dark relative z-10 shadow-2xl" alt="" />
          <div className="absolute -bottom-2 inset-x-0 flex justify-center z-20">
            <div className="px-4 py-1.5 bg-premium text-bg-dark text-[10px] font-black rounded-full shadow-neon-premium transform hover:scale-110 transition-transform">{t.pro_level}</div>
          </div>
        </div>
        <div>
          <h2 className="text-3xl font-black italic tracking-tighter uppercase">{profile?.username || 'Pilot_01'}</h2>
          <div className="flex items-center justify-center gap-2 mt-1">
            <Badge variant="success">Active / Deactive</Badge>
            <span className="text-[10px] text-text-secondary uppercase font-black opacity-50">{t.member_since}</span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-4 pt-4">
        <div className="glass-card p-4 text-center space-y-1 bg-white/2 border-white/5">
          <p className="text-3xl font-black italic text-primary-light">128</p>
          <p className="text-[10px] text-text-secondary font-black uppercase tracking-widest">{t.interactions}</p>
        </div>
        <div className="glass-card p-4 text-center space-y-1 bg-white/2 border-white/5">
          <p className="text-3xl font-black italic text-secondary">{charCount.toString().padStart(2, '0')}</p>
          <p className="text-[10px] text-text-secondary font-black uppercase tracking-widest">{t.chars_created}</p>
        </div>
      </div>

      <section className="space-y-6">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xl font-black italic tracking-tighter uppercase italic">{t.your_chars} ({charCount})</h3>
        </div>

        <div className="space-y-4">
          {userCharacters.map(([id, char]) => (
            <div key={id} className="glass-card p-4 flex items-center gap-4 group relative overflow-hidden">
              <img src={char.avatar} className="w-16 h-16 rounded-2xl object-cover border border-white/10" alt="" />
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-white truncate">{char.name}</h4>
                <p className="text-xs text-text-secondary line-clamp-1">{char.description}</p>
                {char.created_at && <p className="text-[9px] text-text-secondary opacity-40 mt-1 font-bold uppercase tracking-widest">Constructed: {char.created_at}</p>}
              </div>
              <button
                onClick={() => handleDelete(id)}
                className="p-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all border border-red-500/20"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
          {userCharacters.length === 0 && (
            <div className="text-center py-10 glass-card border-dashed">
              <p className="text-xs text-text-secondary uppercase font-black tracking-widest">{t.no_souls}</p>
              <button onClick={() => navigate('/create')} className="mt-4 text-cyan-400 text-[10px] font-black uppercase">{t.create_now}</button>
            </div>
          )}
        </div>
      </section>

      <div className="glass-card p-8 space-y-8 relative overflow-hidden bg-gradient-to-br from-white/2 to-transparent">
        <div className="absolute top-0 right-0 p-4 opacity-5">
          <Star size={80} fill="currentColor" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-black italic flex items-center gap-2 tracking-tighter uppercase">
            <Sparkles className="text-premium" size={24} /> {t.neural_overdrive}
          </h3>
          <p className="text-xs text-text-secondary leading-relaxed">{t.premium_desc}</p>
        </div>
        <ul className="space-y-4">
          {[
            { label: 'Unlimited Vocal Manifestations', icon: Volume2, color: 'text-emerald-500' },
            { label: 'High-Fidelity Neural Core Access', icon: Zap, color: 'text-amber-500' },
            { label: 'Deep Memory Integration (Unlimited)', icon: Clock, color: 'text-indigo-500' },
            { label: 'Custom Persona Sub-Grid Slots (3/5)', icon: ShieldCheck, color: 'text-blue-500' },
          ].map((item, i) => (
            <li key={i} className="flex items-center gap-4 text-xs font-bold text-white/80">
              <div className={`p-1.5 rounded-lg bg-white/5 ${item.color}`}>
                <item.icon size={16} />
              </div>
              {item.label}
            </li>
          ))}
        </ul>
        <button className="w-full py-5 bg-gradient-to-r from-premium to-amber-600 text-bg-dark font-black rounded-2xl shadow-neon-premium active:scale-95 transition-all text-xs tracking-[0.2em]">
          {t.upgrade}
        </button>
      </div>
    </div>
  );
};

const SettingsPage = ({ characters, fetchCharacters }) => {
  const [activeTab, setActiveTab] = useState('profile');
  const { profile, fetchProfile } = useUser();
  const [analytics, setAnalytics] = useState(null);
  const [passwords, setPasswords] = useState({ current: '', next: '' });
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();

  const handleDelete = async (personaId) => {
    if (!window.confirm("Sever this neural link permanently?")) return;
    try {
      await axios.delete(`${API_BASE}/character/${personaId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      fetchCharacters();
      toast("Neural link severed successfully.", "success");
    } catch (e) { toast("Severance failed.", "error"); }
  };

  const fetchSettingsData = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const analyticsRes = await axios.get(`${API_BASE}/usage-analytics`, { headers: { Authorization: `Bearer ${token}` } });
      fetchProfile();
      setAnalytics(analyticsRes.data);
    } catch (e) {
      toast("Sync failed: Data integrity compromised.", "error");
    }
  };

  useEffect(() => {
    fetchSettingsData();
  }, []);


  const handleAvatarUpload = async (file) => {
    const body = new FormData();
    body.append('profile_pic', file);
    try {
      await axios.post(`${API_BASE}/profile/update`, body, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      fetchSettingsData();
      toast("Avatar manifestation updated.", "success");
    } catch (e) { toast("Calibration failed.", "error"); }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwords.next !== passwords.confirm) {
      toast("Passwords do not match!", "error");
      return;
    }
    const body = new FormData();
    body.append('current_password', passwords.current);
    body.append('new_password', passwords.next);
    try {
      await axios.post(`${API_BASE}/change-password`, body, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      toast("Password updated successfully.", "success");
      setPasswords({ current: '', next: '', confirm: '' });
    } catch (e) { toast("Password update failed.", "error"); }
  };

  const userChars = Object.entries(characters).filter(([id]) => id.startsWith('user_'));

  return (
    <div className="p-6 space-y-10 min-h-screen pb-40">
      <header className="flex items-center justify-between">
        <h2 className="text-4xl font-heading italic tracking-tighter text-white">Settings</h2>
        <div className="flex bg-slate-900/50 p-1.5 rounded-2xl border border-white/5">
          {['profile', 'characters', 'analytics'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-cyan-400 text-slate-950 shadow-neon-blue' : 'text-slate-500 hover:text-white'}`}
            >
              {tab}
            </button>
          ))}
        </div>
      </header>

      <AnimatePresence mode="wait">
        {activeTab === 'profile' && (
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-8">
            <div className="glass-card p-10 flex flex-col items-center text-center space-y-6 relative overflow-hidden">
              <div className="relative group">
                <div className="w-32 h-32 rounded-full p-1 bg-gradient-to-tr from-cyan-400 via-purple-600 to-cyan-400 group-hover:rotate-180 transition-all duration-700">
                  <img src={profile?.profile_pic || 'https://api.dicebear.com/7.x/big-smile/svg?seed=Felix'} className="w-full h-full rounded-full bg-slate-950 object-cover" alt="" />
                </div>
                <label className="absolute bottom-0 right-0 w-10 h-10 rounded-full bg-cyan-400 text-slate-950 flex items-center justify-center cursor-pointer shadow-neon-blue hover:scale-110 active:scale-90 transition-all">
                  <PlusCircle size={20} />
                  <input type="file" className="hidden" onChange={e => handleAvatarUpload(e.target.files[0])} />
                </label>
              </div>
              <div>
                <h3 className="text-2xl font-black italic tracking-tighter text-white uppercase">{profile?.username || 'Pilot_01'}</h3>
                <p className="text-xs text-cyan-400/60 font-black uppercase tracking-[0.4em]">{profile?.email}</p>
              </div>
              <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
                <div className="p-4 rounded-3xl bg-white/5 border border-white/5">
                  <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-1">User_ID</p>
                  <p className="text-xs font-mono text-white">#{profile?.user_id}</p>
                </div>
                <div className="p-4 rounded-3xl bg-white/5 border border-white/5">
                  <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-1">Linked_Since</p>
                  <p className="text-xs font-mono text-white">{profile?.created_at}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-8">
              <div className="glass-card p-8 space-y-6">
                <h4 className="text-[10px] font-black text-cyan-400 uppercase tracking-widest italic flex items-center gap-2">
                  <ShieldCheck size={14} /> SECURITY
                </h4>
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <input
                    type="password"
                    placeholder="Current Password"
                    className="w-full bg-slate-950 border border-white/5 p-4 rounded-xl text-xs outline-none focus:border-cyan-400 transition-all text-white"
                    required
                    value={passwords.current}
                    onChange={e => setPasswords({ ...passwords, current: e.target.value })}
                  />
                  <input
                    type="password"
                    placeholder="New Password"
                    className="w-full bg-slate-950 border border-white/5 p-4 rounded-xl text-xs outline-none focus:border-cyan-400 transition-all text-white"
                    required
                    value={passwords.next}
                    onChange={e => setPasswords({ ...passwords, next: e.target.value })}
                  />
                  <input
                    type="password"
                    placeholder="Confirm New Password"
                    className="w-full bg-slate-950 border border-white/5 p-4 rounded-xl text-xs outline-none focus:border-cyan-400 transition-all text-white"
                    required
                    value={passwords.confirm || ''}
                    onChange={e => setPasswords({ ...passwords, confirm: e.target.value })}
                  />
                  <button className="w-full py-4 bg-cyan-400 text-slate-950 font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-neon-blue">Update Password</button>
                </form>
              </div>


            </div>
          </motion.div>
        )}

        {activeTab === 'characters' && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-12">
            <section className="space-y-6">
              <h4 className="text-xs font-black text-cyan-400/50 uppercase tracking-[0.3em] italic px-2">Manifested_Entities ({userChars.length})</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {userChars.map(([id, char]) => (
                  <div key={id} className="glass-card p-4 flex items-center gap-4 group relative border-white/5 hover:border-cyan-400/30">
                    <img src={char.avatar} className="w-16 h-16 rounded-2xl object-cover" alt="" />
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/chat/${id}`)}>
                      <p className="font-bold text-white truncate text-sm uppercase">{char.name}</p>
                      <p className="text-[10px] text-cyan-400/60 font-black uppercase tracking-widest truncate">{char.personality}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => navigate(`/chat/${id}`)} className="p-2 text-slate-500 hover:text-cyan-400 transition-colors"><ArrowRight size={18} /></button>
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(id); }} className="p-2 text-slate-700 hover:text-red-500 transition-colors"><Trash2 size={18} /></button>
                    </div>
                  </div>
                ))}
                {userChars.length === 0 && <p className="text-center py-20 text-slate-500 italic text-xs uppercase tracking-widest w-full col-span-2">No custom entities founded in this grid.</p>}
              </div>
            </section>
          </motion.div>
        )}

        {activeTab === 'analytics' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { label: 'Overall Messages Sent', value: analytics?.overall_messages_sent || 0, icon: MessageCircle, color: 'text-cyan-400' },
                { label: 'Overall Tokens Used', value: analytics?.overall_tokens_used?.toLocaleString() || 0, icon: Zap, color: 'text-amber-400' },
                { label: 'Most Used Persona', value: analytics?.most_used_persona || 'Syncing...', icon: Heart, color: 'text-pink-500' },
              ].map((stat, i) => (
                <div key={i} className="glass-card p-8 space-y-4 relative overflow-hidden group">
                  <div className="absolute -top-4 -right-4 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                    <stat.icon size={120} />
                  </div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">{stat.label}</p>
                  <p className={`text-4xl font-heading italic tracking-tighter ${stat.color}`}>{stat.value}</p>
                </div>
              ))}
            </div>

            <div className="glass-card p-10 space-y-8">
              <h4 className="text-xs font-black text-white uppercase tracking-[0.4em] italic">Current_Cycle_Metrics</h4>
              <div className="grid grid-cols-2 gap-20">
                <div className="space-y-6">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Daily Flux (Messages)</p>
                  <div className="h-4 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min((analytics?.daily_messages || 0) * 5, 100)}%` }}
                      className="h-full bg-cyan-400 shadow-neon-blue"
                    />
                  </div>
                  <p className="text-2xl font-black text-white italic">{analytics?.daily_messages || 0} <span className="text-[10px] text-slate-600 not-italic uppercase tracking-widest">Turns Today</span></p>
                </div>
                <div className="space-y-6">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Daily Consumption (Tokens)</p>
                  <div className="h-4 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min((analytics?.daily_tokens || 0) / 100, 100)}%` }}
                      className="h-full bg-amber-400 shadow-neon-premium"
                    />
                  </div>
                  <p className="text-2xl font-black text-white italic">{analytics?.daily_tokens?.toLocaleString() || 0} <span className="text-[10px] text-slate-600 not-italic uppercase tracking-widest">TKS Expended</span></p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
const LoginPage = () => {
  const [userIdInput, setUserIdInput] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/login`, { user_id: userIdInput, password });
      localStorage.setItem("token", res.data.access_token);
      localStorage.setItem("user_id", userIdInput);
      toast("Neural link established", "success");
      navigate("/");
    } catch (err) {
      toast("Authorization failed", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen w-full flex items-center justify-center bg-bg-dark -mt-20 px-6">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md glass-card p-10 space-y-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-400 via-purple-600 to-cyan-400 animate-shimmer" />
        <div className="text-center space-y-2">
          <KunAiLogo />
          <p className="text-[10px] font-black uppercase tracking-[0.5em] text-cyan-400/50">Secure Neural Access</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block px-1">Identity UID</label>
            <input
              type="text"
              required
              value={userIdInput}
              onChange={(e) => setUserIdInput(e.target.value)}
              className="w-full bg-slate-900 border border-white/5 rounded-2xl p-4 text-sm focus:border-cyan-400 outline-none transition-all text-white placeholder:text-white/10"
              placeholder="e.g. kunal"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block px-1">Access Cipher</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-900 border border-white/5 rounded-2xl p-4 text-sm focus:border-cyan-400 outline-none transition-all text-white placeholder:text-white/10"
              placeholder="••••••••"
            />
          </div>
          <button
            disabled={isLoading}
            className="w-full py-5 bg-cyan-400 text-bg-dark font-black rounded-2xl shadow-neon-blue active:scale-95 transition-all text-xs tracking-widest flex items-center justify-center gap-3 overflow-hidden"
          >
            {isLoading ? <RefreshCcw className="animate-spin" size={18} /> : <span>INITIATE LINK</span>}
          </button>
        </form>

        <p className="text-[9px] text-center text-slate-600 uppercase font-bold tracking-widest leading-relaxed">
          By accessing the KunAi grid, you agree to the <br />
          <span className="text-cyan-400/50">Neural Protocol Terms and Data Ethics.</span>
        </p>
      </motion.div>
    </div>
  );
};

const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem("token");
  if (!token) return <LoginPage />;
  return children;
};

const MyCharactersPage = ({ characters }) => {
  const [recentIds] = useLocalStorage('recent_chats', []);
  const recentChars = recentIds.map(id => ({ id, ...characters[id] })).filter(c => c.name);
  const [charStatuses, setCharStatuses] = useState({});

  useEffect(() => {
    const fetchStatuses = async () => {
      const statuses = {};
      for (const char of recentChars) {
        try {
          const res = await axios.get(`${API_BASE}/character-status/${char.id}`);
          statuses[char.id] = res.data.status;
        } catch (e) {
          statuses[char.id] = 'inactive';
        }
      }
      setCharStatuses(statuses);
    };
    if (recentChars.length > 0) fetchStatuses();
  }, [recentIds.length]);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="p-6 space-y-6 pb-24"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-black tracking-tight italic">MESSAGES</h2>
        <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary-light border border-primary/20">
          <MessageCircle size={20} />
        </div>
      </div>

      <div className="space-y-3">
        {recentChars.map((char) => {
          const isActive = charStatuses[char.id] === 'active';
          return (
            <Link
              key={char.id}
              to={`/chat/${char.id}`}
              className="flex items-center gap-4 p-4 bg-bg-panel/40 border border-white/5 rounded-[24px] hover:border-cyan-400/30 transition-all group relative overflow-hidden backdrop-blur-sm"
            >
              <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-100 transition-opacity">
                <ChevronLeft size={16} className="rotate-180 text-cyan-400" />
              </div>
              <div className="relative flex-shrink-0">
                <img src={char.avatar || `avatars/${char.id}.jpg`} className="w-14 h-14 rounded-full object-cover border border-white/10 shadow-lg" alt="" />
                <div className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-bg-dark ${isActive ? 'bg-emerald-500 shadow-neon-green' : 'bg-slate-600'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-0.5 pr-6">
                  <h4 className="font-bold text-sm truncate uppercase tracking-tighter text-white">{char.name}</h4>
                  <span className={`text-[9px] uppercase font-black whitespace-nowrap ${isActive ? 'text-emerald-400' : 'text-slate-500'}`}>
                    {isActive ? 'Active' : 'Deactive'}
                  </span>
                </div>
                <p className="text-[10px] text-cyan-400 font-black uppercase tracking-widest mb-1 opacity-60 truncate">{char.personality}</p>
                <p className="text-xs text-text-secondary truncate pr-8 leading-relaxed italic">
                  {isActive ? 'Continue your conversation...' : 'Start a new session...'}
                </p>
              </div>
            </Link>
          );
        })}
        {recentChars.length === 0 && (
          <div className="text-center py-24 text-text-secondary space-y-6">
            <div className="relative w-24 h-24 mx-auto">
              <MessageCircle size={64} className="opacity-10 absolute inset-0 m-auto" />
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 4, ease: "linear" }} className="w-full h-full border-2 border-dashed border-white/5 rounded-full" />
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase font-black tracking-[0.3em] text-white">No messages yet</p>
              <p className="text-[10px] opacity-40">Start chatting with a character to see them here.</p>
            </div>
            <Link to="/discover" className="inline-block px-10 py-4 bg-primary-light text-bg-dark rounded-2xl font-black text-xs tracking-widest shadow-neon-green hover:scale-105 transition-all">DISCOVER CHARACTERS</Link>
          </div>
        )}
      </div>
    </motion.div>
  );
};

// --- App Root ---

export default function App() {
  const [characters, setCharacters] = useState({});
  const [loading, setLoading] = useState(true);

  const fetchCharacters = async () => {
    try {
      const res = await axios.get(`${API_BASE}/characters`);
      console.log("Characters Synced:", res.data);
      setCharacters(res.data);
      setLoading(false);
    } catch (err) {
      console.error("Link Failure:", err);
      // Stop infinite loading so user can see the "Connection Sync Failure" screen
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCharacters();
  }, []);

  const hasCharacters = Object.keys(characters).length > 0;

  if (loading && !hasCharacters) return (
    <div className="h-screen w-full bg-bg-dark flex flex-col items-center justify-center gap-10 px-16">
      <div className="relative">
        <motion.div
          animate={{ scale: [1, 1.1, 1], rotate: [0, 180, 360], borderRadius: ["30%", "50%", "30%"] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="w-32 h-32 border-4 border-primary/20 border-t-primary-light shadow-neon-green/20"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <Sparkles className="text-primary-light animate-pulse" size={40} />
        </div>
      </div>
      <div className="space-y-6 text-center w-full">
        <div>
          <h2 className="text-3xl font-black italic tracking-tighter text-white mb-1">Kun AI</h2>
          <p className="text-[10px] font-black uppercase tracking-[0.8em] text-primary-light/50 ml-1">Grid Manifestation</p>
        </div>
        <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden relative">
          <motion.div
            initial={{ left: '-100%' }}
            animate={{ left: '100%' }}
            transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
            className="w-1/2 h-full bg-primary-light shadow-neon-green absolute"
          />
        </div>
      </div>
    </div>
  );

  if (!hasCharacters && !loading) return (
    <div className="h-screen w-full bg-bg-dark flex flex-col items-center justify-center p-10 text-center space-y-8">
      <div className="w-20 h-20 rounded-3xl bg-red-500/10 flex items-center justify-center text-red-500 border border-red-500/20 shadow-lg">
        <RefreshCcw size={40} className="animate-spin-slow" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-black italic text-white">CONNECTION SYNC FAILURE</h2>
        <p className="text-xs text-text-secondary leading-relaxed uppercase tracking-widest font-bold">Neural grid unable to locate backend at {API_BASE}</p>
      </div>
      <button
        onClick={fetchCharacters}
        className="px-10 py-4 bg-white/5 border border-white/10 rounded-2xl text-xs font-black tracking-[0.3em] hover:bg-white/10 transition-all text-white"
      >
        RE-INITIATE LINK
      </button>
    </div>
  );

  return (
    <ToastProvider>
      <Router>
        <UserProvider>
          <Layout>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<PrivateRoute><HomePage characters={characters} /></PrivateRoute>} />
              <Route path="/discover" element={<PrivateRoute><DiscoverPage characters={characters} /></PrivateRoute>} />
              <Route path="/create" element={<PrivateRoute><CreateCharacterPage fetchCharacters={fetchCharacters} characters={characters} /></PrivateRoute>} />
              <Route path="/my-characters" element={<PrivateRoute><MyCharactersPage characters={characters} /></PrivateRoute>} />
              <Route path="/chat/:id" element={<PrivateRoute><ChatPage characters={characters} /></PrivateRoute>} />
              <Route path="/profile" element={<PrivateRoute><ProfilePage characters={characters} fetchCharacters={fetchCharacters} /></PrivateRoute>} />
              <Route path="/settings" element={<PrivateRoute><SettingsPage characters={characters} fetchCharacters={fetchCharacters} /></PrivateRoute>} />
            </Routes>
          </Layout>
        </UserProvider>
      </Router>
    </ToastProvider>
  );
}

const CheckCircle2 = ({ size, className }) => <ShieldCheck size={size} className={className} />;
