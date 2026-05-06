// src/pages/Profile.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
    Bookmark, LayoutDashboard, LogOut, Play,
    Trash2, Loader2, User as UserIcon, Search,
    Volume2, FastForward, ArrowLeft
} from 'lucide-react';

interface WatchlistItem {
    id: string;
    anime_id: string;
    title: string;
    image: string;
    type: string;
    created_at: string;
}

export default function Profile() {
    const navigate = useNavigate();
    const [user, setUser] = useState<any>(null);
    const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'watchlist' | 'settings'>('watchlist');
    const [deletingId, setDeletingId] = useState<string | null>(null);

    // Settings State (Saved locally so it works instantly)
    const [defaultAudio, setDefaultAudio] = useState(localStorage.getItem('kuro-default-audio') || 'sub');
    const [autoSkip, setAutoSkip] = useState(localStorage.getItem('kuro-auto-skip') === 'true');

    useEffect(() => {
        const fetchUserData = async () => {
            // 1. Get current logged-in user
            const { data: { session } } = await supabase.auth.getSession();

            if (!session?.user) {
                navigate('/'); // Kick them to home if not logged in
                return;
            }

            setUser(session.user);

            // 2. Fetch their personal watchlist
            const { data, error } = await supabase
                .from('watchlist')
                .select('*')
                .eq('user_id', session.user.id)
                .order('created_at', { ascending: false });

            if (!error && data) {
                setWatchlist(data);
            }

            setLoading(false);
        };

        fetchUserData();
        window.scrollTo(0, 0);
    }, [navigate]);

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        navigate('/');
    };

    const removeFromWatchlist = async (e: React.MouseEvent, recordId: string) => {
        e.stopPropagation(); // Prevent navigating to the anime page
        setDeletingId(recordId);

        const { error } = await supabase
            .from('watchlist')
            .delete()
            .eq('id', recordId);

        if (!error) {
            setWatchlist(prev => prev.filter(item => item.id !== recordId));
        }
        setDeletingId(null);
    };

    // Settings Handlers
    const handleAudioChange = (val: string) => {
        setDefaultAudio(val);
        localStorage.setItem('kuro-default-audio', val);
    };

    const handleSkipChange = (val: boolean) => {
        setAutoSkip(val);
        localStorage.setItem('kuro-auto-skip', val.toString());
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#040404] flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#040404] text-white pt-24 pb-20 px-6 sm:px-10">
            <div className="max-w-[1400px] mx-auto">

                {/* ⚡ THE BACK BUTTON & BREADCRUMBS */}
                <div className="flex items-center gap-2 text-[10px] font-black tracking-widest text-gray-500 mb-6 uppercase">
                    <button onClick={() => navigate(-1)} className="flex items-center hover:text-blue-500 transition-colors cursor-pointer">
                        <ArrowLeft className="w-3 h-3 mr-1.5" /> Back
                    </button>
                    <span className="text-gray-700">/</span>
                    <span className="text-white">Profile</span>
                    <span className="text-gray-700">/</span>
                    <span className="text-blue-500">{activeTab === 'watchlist' ? 'My Dojo' : 'Settings'}</span>
                </div>

                <div className="flex flex-col lg:flex-row gap-8">

                    {/* LEFT SIDEBAR: PROFILE CARD */}
                    <div className="w-full lg:w-[320px] flex-shrink-0 flex flex-col gap-6">
                        {/* User Info Glass Card */}
                        <div className="bg-[#0a0a0a] border border-[#222] rounded-2xl p-6 relative overflow-hidden shadow-2xl">
                            {/* Background Blur Effect */}
                            <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-blue-600/20 to-transparent opacity-50 pointer-events-none" />

                            <div className="relative z-10 flex flex-col items-center text-center">
                                <div className="w-24 h-24 rounded-full border-4 border-[#111] shadow-[0_0_30px_rgba(37,99,235,0.3)] overflow-hidden mb-4 bg-black">
                                    {user?.user_metadata?.avatar_url ? (
                                        <img src={user.user_metadata.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                                    ) : (
                                        <UserIcon className="w-full h-full p-4 text-gray-500" />
                                    )}
                                </div>

                                <h2 className="text-xl font-black tracking-tight text-white line-clamp-1">
                                    {user?.user_metadata?.full_name || 'Otaku'}
                                </h2>
                                <p className="text-xs text-gray-500 font-medium mt-1 truncate w-full">
                                    {user?.email}
                                </p>
                            </div>

                            {/* Navigation Tabs */}
                            <div className="flex flex-col gap-2 mt-8">
                                <button
                                    onClick={() => setActiveTab('watchlist')}
                                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-xs font-bold tracking-widest uppercase ${activeTab === 'watchlist'
                                        ? 'bg-blue-600/10 text-blue-500 border border-blue-500/20'
                                        : 'text-gray-400 hover:bg-[#111] hover:text-white border border-transparent'
                                        }`}
                                >
                                    <Bookmark className="w-4 h-4" /> My Dojo
                                    <span className="ml-auto bg-[#111] px-2 py-0.5 rounded text-[10px]">{watchlist.length}</span>
                                </button>
                                <button
                                    onClick={() => setActiveTab('settings')}
                                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-xs font-bold tracking-widest uppercase ${activeTab === 'settings'
                                        ? 'bg-blue-600/10 text-blue-500 border border-blue-500/20'
                                        : 'text-gray-400 hover:bg-[#111] hover:text-white border border-transparent'
                                        }`}
                                >
                                    <LayoutDashboard className="w-4 h-4" /> Settings
                                </button>
                            </div>

                            <div className="h-[1px] w-full bg-[#222] my-6" />

                            <button
                                onClick={handleSignOut}
                                className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl transition-all text-xs font-bold tracking-widest uppercase text-red-500 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 cursor-pointer"
                            >
                                <LogOut className="w-4 h-4" /> Sign Out
                            </button>
                        </div>
                    </div>

                    {/* RIGHT CONTENT AREA */}
                    <div className="flex-1 min-h-[500px]">
                        {activeTab === 'watchlist' && (
                            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="flex items-center justify-between mb-8">
                                    <div>
                                        <h1 className="text-3xl font-black text-white italic drop-shadow-md">MY DOJO</h1>
                                        <p className="text-sm text-gray-500 font-medium mt-1">Your personal collection of saved anime.</p>
                                    </div>
                                </div>

                                {watchlist.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-[400px] bg-[#0a0a0a] border border-[#222] rounded-2xl border-dashed">
                                        <Search className="w-16 h-16 text-[#222] mb-4" />
                                        <h3 className="text-lg font-black text-white mb-2">Your Dojo is Empty</h3>
                                        <p className="text-sm text-gray-500 mb-6 text-center max-w-sm">
                                            You haven't saved any anime yet. Go explore the library and build your ultimate queue!
                                        </p>
                                        <button
                                            onClick={() => navigate('/search')}
                                            className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-lg font-bold uppercase tracking-widest text-xs transition-colors shadow-lg cursor-pointer"
                                        >
                                            Explore Anime
                                        </button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
                                        {watchlist.map((anime) => (
                                            <div
                                                key={anime.id}
                                                onClick={() => navigate(`/anime/${anime.anime_id}`)}
                                                className="group relative flex flex-col gap-3 cursor-pointer"
                                            >
                                                {/* Image Card Container */}
                                                <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-[#111] border border-[#222] group-hover:border-blue-500/50 transition-all duration-300 shadow-lg">
                                                    <img
                                                        src={anime.image}
                                                        alt={anime.title}
                                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                                        loading="lazy"
                                                    />

                                                    {/* Dark Overlay on Hover */}
                                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                                                        <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.6)] transform translate-y-4 group-hover:translate-y-0 transition-all duration-300">
                                                            <Play className="w-5 h-5 ml-1 fill-current" />
                                                        </div>
                                                    </div>

                                                    {/* Delete Button (Top Right) */}
                                                    <button
                                                        onClick={(e) => removeFromWatchlist(e, anime.id)}
                                                        className="absolute top-2 right-2 w-8 h-8 bg-black/80 hover:bg-red-600 text-gray-400 hover:text-white rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 z-20 backdrop-blur-sm border border-white/10"
                                                        title="Remove from Dojo"
                                                    >
                                                        {deletingId === anime.id ? (
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                        ) : (
                                                            <Trash2 className="w-4 h-4" />
                                                        )}
                                                    </button>

                                                    {/* Type Badge (Top Left) */}
                                                    <div className="absolute top-2 left-2 px-2 py-1 bg-black/80 backdrop-blur-sm border border-white/10 rounded text-[9px] font-black tracking-widest text-white uppercase z-10">
                                                        {anime.type || 'TV'}
                                                    </div>
                                                </div>

                                                {/* Details Section */}
                                                <div className="flex flex-col">
                                                    <h3 className="text-sm font-bold text-gray-200 line-clamp-2 group-hover:text-blue-400 transition-colors leading-tight">
                                                        {anime.title}
                                                    </h3>
                                                    <span className="text-[10px] text-gray-500 font-medium mt-1">
                                                        Added {new Date(anime.created_at).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'settings' && (
                            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                                <div>
                                    <h1 className="text-3xl font-black text-white italic drop-shadow-md">SETTINGS</h1>
                                    <p className="text-sm text-gray-500 font-medium mt-1">Customize your KuroTV experience.</p>
                                </div>

                                <div className="bg-[#0a0a0a] border border-[#222] rounded-2xl p-6 lg:p-8 space-y-8">
                                    {/* Audio Preference */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#111]">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-[#111] flex items-center justify-center border border-[#222]">
                                                <Volume2 className="w-4 h-4 text-blue-500" />
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-bold text-white">Default Audio</h3>
                                                <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-0.5">Prefer Sub or Dub when available</p>
                                            </div>
                                        </div>
                                        <div className="flex bg-[#111] p-1 rounded-lg border border-[#222]">
                                            <button
                                                onClick={() => handleAudioChange('sub')}
                                                className={`px-6 py-2 text-[10px] font-bold rounded-md transition-all uppercase tracking-widest ${defaultAudio === 'sub' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:text-white'}`}
                                            >
                                                Sub
                                            </button>
                                            <button
                                                onClick={() => handleAudioChange('dub')}
                                                className={`px-6 py-2 text-[10px] font-bold rounded-md transition-all uppercase tracking-widest ${defaultAudio === 'dub' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:text-white'}`}
                                            >
                                                Dub
                                            </button>
                                        </div>
                                    </div>

                                    {/* Auto Skip Toggle */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-[#111] flex items-center justify-center border border-[#222]">
                                                <FastForward className="w-4 h-4 text-blue-500" />
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-bold text-white">Auto-Skip Intros</h3>
                                                <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-0.5">Automatically skip opening sequences</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleSkipChange(!autoSkip)}
                                            className={`relative w-12 h-6 rounded-full transition-colors duration-300 focus:outline-none ${autoSkip ? 'bg-blue-600' : 'bg-[#222]'}`}
                                        >
                                            <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform duration-300 ${autoSkip ? 'translate-x-6' : 'translate-x-0'}`} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}