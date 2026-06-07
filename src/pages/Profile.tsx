import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Bookmark, LayoutDashboard, LogOut, Play, Trash2, Loader2, User as UserIcon, Search, Volume2, FastForward, ArrowLeft } from 'lucide-react';

interface WatchlistItem {
    id: string; anime_id: string; title: string; image: string; type: string; created_at: string;
}

export default function Profile() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [user, setUser] = useState<any>(null);
    const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'watchlist' | 'settings'>(
        (searchParams.get('tab') as 'watchlist' | 'settings') || 'watchlist'
    );
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [defaultAudio, setDefaultAudio] = useState(localStorage.getItem('kuro-default-audio') || 'sub');
    const [autoSkip, setAutoSkip] = useState(localStorage.getItem('kuro-auto-skip') === 'true');

    useEffect(() => {
        const fetchUserData = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) { navigate('/'); return; }
            setUser(session.user);
            const { data, error } = await supabase.from('watchlist').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false });
            if (!error && data) setWatchlist(data);
            setLoading(false);
        };
        fetchUserData();
        window.scrollTo(0, 0);
    }, [navigate]);

    const handleSignOut = async () => { await supabase.auth.signOut(); navigate('/'); };
    const removeFromWatchlist = async (e: React.MouseEvent, recordId: string) => {
        e.stopPropagation();
        setDeletingId(recordId);
        const { error } = await supabase.from('watchlist').delete().eq('id', recordId);
        if (!error) setWatchlist(prev => prev.filter(item => item.id !== recordId));
        setDeletingId(null);
    };
    const handleAudioChange = (val: string) => { setDefaultAudio(val); localStorage.setItem('kuro-default-audio', val); };
    const handleSkipChange = (val: boolean) => { setAutoSkip(val); localStorage.setItem('kuro-auto-skip', val.toString()); };

    if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 text-accent animate-spin" /></div>;

    return (
        <div className="min-h-screen pt-20 md:pt-24 pb-12 md:pb-16 px-4 sm:px-6 md:px-10">
            <div className="max-w-[1400px] mx-auto">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wider text-muted mb-4 md:mb-5 uppercase overflow-x-auto scrollbar-hide whitespace-nowrap">
                    <button onClick={() => navigate(-1)} className="flex items-center hover:text-fg transition-colors cursor-pointer shrink-0"><ArrowLeft className="w-3 h-3 mr-1" /> Back</button>
                    <span className="text-border shrink-0">/</span>
                    <span className="text-fg shrink-0">Profile</span>
                    <span className="text-border shrink-0">/</span>
                    <span className="text-accent truncate">{activeTab === 'watchlist' ? 'My Dojo' : 'Settings'}</span>
                </div>

                <div className="flex flex-col lg:flex-row gap-5 md:gap-8">
                    <div className="w-full lg:w-[300px] shrink-0 flex flex-col gap-4 md:gap-5" data-reveal>
                        <div className="card p-4 md:p-6">
                            <div className="flex flex-row lg:flex-col items-center lg:text-center gap-4 lg:gap-0">
                                <div className="w-14 h-14 lg:w-20 lg:h-20 rounded-full border-2 border-border overflow-hidden shrink-0 bg-surface">
                                    {user?.user_metadata?.avatar_url ? <img src={user.user_metadata.avatar_url} alt="" className="w-full h-full object-cover" /> : <UserIcon className="w-full h-full p-3 lg:p-4 text-muted" />}
                                </div>
                                <div className="flex-1 min-w-0 lg:text-center">
                                    <h2 className="text-base lg:text-lg font-bold text-fg truncate w-full font-display">{user?.user_metadata?.full_name || 'User'}</h2>
                                    <p className="text-[11px] lg:text-xs text-muted truncate w-full mt-0.5">{user?.email}</p>
                                </div>
                            </div>
                            <div className="flex flex-row lg:flex-col gap-1.5 mt-4 lg:mt-6">
                                <button onClick={() => setActiveTab('watchlist')} className={`flex items-center gap-2.5 px-3 lg:px-3.5 py-2 lg:py-2.5 rounded-xl transition-all text-[10px] lg:text-[11px] font-semibold tracking-wider uppercase ${activeTab === 'watchlist' ? 'bg-accent-muted text-accent' : 'text-muted hover:text-fg hover:bg-bg'}`}>
                                    <Bookmark className="w-3.5 h-3.5 shrink-0" /> My Dojo <span className="ml-auto bg-bg px-1.5 py-0.5 rounded text-[10px]">{watchlist.length}</span>
                                </button>
                                <button onClick={() => setActiveTab('settings')} className={`flex items-center gap-2.5 px-3 lg:px-3.5 py-2 lg:py-2.5 rounded-xl transition-all text-[10px] lg:text-[11px] font-semibold tracking-wider uppercase ${activeTab === 'settings' ? 'bg-accent-muted text-accent' : 'text-muted hover:text-fg hover:bg-bg'}`}>
                                    <LayoutDashboard className="w-3.5 h-3.5 shrink-0" /> Settings
                                </button>
                            </div>
                            <div className="h-px bg-border my-4 lg:my-5" />
                            <button onClick={handleSignOut} className="flex items-center justify-center gap-2 w-full px-4 py-2 lg:py-2.5 rounded-xl transition-all text-[10px] lg:text-[11px] font-semibold tracking-wider uppercase text-danger hover:bg-danger/10 cursor-pointer"> <LogOut className="w-3.5 h-3.5" /> Sign Out </button>
                        </div>
                    </div>

                    <div className="flex-1 min-h-[400px] md:min-h-[500px]">
                        {activeTab === 'watchlist' && (
                            <div className="animate-slide-up">
                                <div className="mb-4 md:mb-6">
                                    <h1 className="text-xl md:text-2xl font-bold tracking-tight font-display">My Dojo</h1>
                                    <p className="text-xs md:text-sm text-muted mt-0.5">Your personal collection.</p>
                                </div>
                                {watchlist.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-[300px] md:h-[400px] bg-surface rounded-xl md:rounded-2xl border border-border border-dashed">
                                        <Search className="w-10 h-10 md:w-12 md:h-12 text-border mb-3" />
                                        <h3 className="text-sm md:text-base font-bold text-muted mb-1">Your Dojo is Empty</h3>
                                        <p className="text-xs md:text-sm text-muted mb-4 md:mb-5 text-center max-w-xs">Explore the library and build your queue.</p>
                                        <button onClick={() => navigate('/search')} className="bg-accent hover:bg-accent-dim text-white px-6 md:px-8 py-2 md:py-2.5 rounded-xl font-semibold text-[10px] md:text-xs tracking-wider uppercase transition-all cursor-pointer shadow-sm hover:shadow-md">Explore Anime</button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
                                        {watchlist.map((anime) => (
                                            <div key={anime.id} onClick={() => navigate(`/anime/${anime.anime_id}`)} className="group cursor-pointer" data-reveal>
                                                <div className="relative aspect-[2/3] rounded-lg md:rounded-xl overflow-hidden bg-surface border border-border">
                                                    <img src={anime.image} alt={anime.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" loading="lazy" />
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-end pb-2 md:pb-3 pl-2 md:pl-3">
                                                        <div className="w-7 h-7 md:w-8 md:h-8 bg-accent rounded-full flex items-center justify-center"><Play className="w-3 h-3 md:w-3.5 md:h-3.5 ml-0.5 fill-current text-white" /></div>
                                                    </div>
                                                    <button onClick={(e) => removeFromWatchlist(e, anime.id)} className="absolute top-2 right-2 w-6 h-6 md:w-7 md:h-7 bg-black/50 hover:bg-danger rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-10 cursor-pointer">
                                                        {deletingId === anime.id ? <Loader2 className="w-3 h-3 md:w-3.5 md:h-3.5 animate-spin text-white" /> : <Trash2 className="w-3 h-3 md:w-3.5 md:h-3.5 text-white" />}
                                                    </button>
                                                    <span className="absolute top-2 left-2 bg-black/60 text-white text-[8px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wider">{anime.type || 'TV'}</span>
                                                </div>
                                                <h3 className="text-[11px] md:text-xs font-medium text-muted mt-1 md:mt-1.5 truncate group-hover:text-fg transition-colors">{anime.title}</h3>
                                                <span className="text-[9px] md:text-[10px] text-muted">Added {new Date(anime.created_at).toLocaleDateString()}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'settings' && (
                            <div className="animate-slide-up space-y-5 md:space-y-6">
                                <div>
                                    <h1 className="text-xl md:text-2xl font-bold tracking-tight font-display">Settings</h1>
                                    <p className="text-xs md:text-sm text-muted mt-0.5">Customize your experience.</p>
                                </div>
                                <div className="card p-4 md:p-6 space-y-5 md:space-y-6">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 md:gap-4 pb-4 md:pb-5 border-b border-border">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-bg flex items-center justify-center border border-border shrink-0"><Volume2 className="w-3.5 h-3.5 md:w-4 md:h-4 text-accent" /></div>
                                            <div className="min-w-0">
                                                <h3 className="text-xs md:text-sm font-semibold text-fg">Default Audio</h3>
                                                <p className="text-[9px] md:text-[10px] text-muted uppercase tracking-wider mt-0.5">Prefer Sub or Dub</p>
                                            </div>
                                        </div>
                                        <div className="flex bg-bg p-0.5 rounded-md border border-border self-start sm:self-auto">
                                            <button onClick={() => handleAudioChange('sub')} className={`px-4 md:px-5 py-1 md:py-1.5 text-[10px] font-semibold rounded transition-all uppercase tracking-wider ${defaultAudio === 'sub' ? 'bg-accent text-white' : 'text-muted hover:text-fg'}`}>Sub</button>
                                            <button onClick={() => handleAudioChange('dub')} className={`px-4 md:px-5 py-1 md:py-1.5 text-[10px] font-semibold rounded transition-all uppercase tracking-wider ${defaultAudio === 'dub' ? 'bg-accent text-white' : 'text-muted hover:text-fg'}`}>Dub</button>
                                        </div>
                                    </div>
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 md:gap-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-bg flex items-center justify-center border border-border shrink-0"><FastForward className="w-3.5 h-3.5 md:w-4 md:h-4 text-accent" /></div>
                                            <div>
                                                <h3 className="text-xs md:text-sm font-semibold text-fg">Auto-Skip Intros</h3>
                                                <p className="text-[9px] md:text-[10px] text-muted uppercase tracking-wider mt-0.5">Skip opening sequences</p>
                                            </div>
                                        </div>
                                        <button onClick={() => handleSkipChange(!autoSkip)} className={`relative w-11 h-5 rounded-full transition-colors duration-300 shrink-0 ${autoSkip ? 'bg-accent' : 'bg-border'}`}>
                                            <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-300 ${autoSkip ? 'translate-x-6' : 'translate-x-0'}`} />
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
