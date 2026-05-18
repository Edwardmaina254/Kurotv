// src/pages/Home.tsx
import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import HeroBanner from '../components/HeroBanner';
import TrendingSidebar from '../components/TrendingSidebar';
import { type AnimeResult } from '../services/consumet';
import { supabase } from '../lib/supabase';
import { Play, ChevronLeft, ChevronRight, X } from 'lucide-react';

interface WatchHistoryItem {
    anime_id: string;
    episode_id: string;
    episode_number: number;
    anime_title: string;
    anime_image: string;
    progress: number;
    duration: number;
}

export default function Home() {
    const [trending, setTrending] = useState<AnimeResult[]>([]);
    const [schedule, setSchedule] = useState<AnimeResult[]>([]);
    const [history, setHistory] = useState<WatchHistoryItem[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);

    const slideIntervalRef = useRef<number | null>(null);

    useEffect(() => {
        const fetchHistory = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                const { data } = await supabase
                    .from('watch_history')
                    .select('*')
                    .eq('user_id', session.user.id)
                    .order('updated_at', { ascending: false })
                    .limit(10);

                if (data) setHistory(data);
            }
        };
        fetchHistory();
    }, []);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3005';

                const [trendingRes, recentRes] = await Promise.all([
                    fetch(`${apiUrl}/anime/zoro/top-airing`).catch(() => null),
                    fetch(`${apiUrl}/anime/zoro/recent-episodes`).catch(() => null)
                ]);

                const trendingData = trendingRes ? await trendingRes.json() : { results: [] };
                const recentData = recentRes ? await recentRes.json() : { results: [] };

                setTrending(trendingData.results || []);
                setSchedule(recentData.results && recentData.results.length > 0 ? recentData.results : trendingData.results);
            } catch (error) {
                console.error("Data fetch failed:", error);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    const startSlideTimer = () => {
        if (slideIntervalRef.current) clearInterval(slideIntervalRef.current);
        slideIntervalRef.current = window.setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % Math.min(trending.length, 20));
        }, 5000);
    };

    useEffect(() => {
        if (trending.length === 0 || loading) return;
        startSlideTimer();
        return () => { if (slideIntervalRef.current) clearInterval(slideIntervalRef.current); };
    }, [trending, loading]);

    const activeAnime = trending[currentIndex];

    const handleNext = () => {
        setCurrentIndex((prev) => (prev + 1) % Math.min(trending.length, 20));
        startSlideTimer();
    };

    const handlePrev = () => {
        setCurrentIndex((prev) => (prev - 1 + Math.min(trending.length, 20)) % Math.min(trending.length, 20));
        startSlideTimer();
    };

    const handleSelectSlide = (index: number) => {
        setCurrentIndex(index);
        startSlideTimer();
    };

    const handleRemoveHistory = async (e: React.MouseEvent, anime_id: string) => {
        e.preventDefault();
        e.stopPropagation();

        setHistory(prev => prev.filter(item => item.anime_id !== anime_id));

        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
            const { error } = await supabase
                .from('watch_history')
                .delete()
                .eq('user_id', session.user.id)
                .eq('anime_id', anime_id);

            if (error) console.error("Failed to remove from history:", error);
        }
    };

    return (
        <main className="w-full flex flex-col">
            <section className="relative w-full h-[480px] xl:h-[500px]">
                {loading ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-[#040404] z-50">
                        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : (
                    activeAnime && (
                        <HeroBanner
                            anime={activeAnime}
                            currentIndex={currentIndex}
                            total={Math.min(trending.length, 20)}
                            onNext={handleNext}
                            onPrev={handlePrev}
                            onSelect={handleSelectSlide}
                        />
                    )
                )}
            </section>

            <div className="flex flex-col lg:flex-row gap-8 px-12 py-10 mt-4 relative z-40">
                <section className="flex-1 overflow-hidden">

                    {history.length > 0 && (
                        <div className="mb-12 pt-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-[22px] font-black uppercase tracking-tighter italic">Continue Watching</h2>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => { const el = document.getElementById('continue-scroll'); if (el) el.scrollBy({ left: -340, behavior: 'smooth' }); }}
                                        className="w-8 h-8 rounded-full bg-[#111] border border-[#222] hover:bg-blue-600 hover:border-blue-500 text-gray-400 hover:text-white flex items-center justify-center transition-all duration-200 cursor-pointer"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => { const el = document.getElementById('continue-scroll'); if (el) el.scrollBy({ left: 340, behavior: 'smooth' }); }}
                                        className="w-8 h-8 rounded-full bg-[#111] border border-[#222] hover:bg-blue-600 hover:border-blue-500 text-gray-400 hover:text-white flex items-center justify-center transition-all duration-200 cursor-pointer"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <div id="continue-scroll" className="flex gap-4 overflow-x-auto py-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                                {history.map((item) => {
                                    const progressPercent = item.duration > 0 ? (item.progress / item.duration) * 100 : 0;
                                    return (
                                        <Link
                                            key={`history-${item.anime_id}`}
                                            to={`/anime/${item.anime_id}?ep=${item.episode_id}`}
                                            className="group relative w-[260px] md:w-[300px] shrink-0 cursor-pointer flex flex-col gap-3 block"
                                        >
                                            <div className="w-full aspect-video rounded-xl overflow-hidden bg-[#0a0a0a] border border-[#222] group-hover:border-blue-500/50 transition-all duration-300 shadow-lg relative">
                                                <img
                                                    src={item.anime_image}
                                                    alt={item.anime_title}
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-70 group-hover:opacity-100"
                                                />
                                                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors duration-300" />

                                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20">
                                                    <div className="w-12 h-12 bg-blue-600/90 text-white rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.6)] transform scale-75 group-hover:scale-100 transition-all duration-300">
                                                        <Play className="w-5 h-5 ml-1 fill-current" />
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={(e) => handleRemoveHistory(e, item.anime_id)}
                                                    className="absolute top-2 right-2 w-7 h-7 bg-black/60 backdrop-blur-sm border border-white/10 hover:bg-red-600 hover:border-red-500 rounded-full flex items-center justify-center text-white/70 hover:text-white transition-all duration-300 z-30 opacity-0 group-hover:opacity-100 shadow-lg cursor-pointer"
                                                    title="Remove from history"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>

                                                <div className="absolute top-2 left-2 bg-black/80 backdrop-blur-md px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest border border-white/10 z-10">
                                                    EP {item.episode_number}
                                                </div>

                                                <div className="absolute bottom-0 left-0 w-full h-1 bg-[#222]">
                                                    <div
                                                        className="h-full bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.8)]"
                                                        style={{ width: `${progressPercent}%` }}
                                                    />
                                                </div>
                                            </div>

                                            <h3 className="text-sm font-bold text-gray-200 line-clamp-1 group-hover:text-blue-400 transition-colors px-1">
                                                {item.anime_title}
                                            </h3>
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="flex items-center justify-between mb-8 pt-12 mt-8 border-t border-white/5">
                        <div className="flex items-center gap-4">
                            <h2 className="text-[22px] font-black uppercase tracking-tighter italic">Latest Updates</h2>
                            <div className="h-1 w-16 bg-blue-600 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.5)] mt-1" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-y-10 gap-x-5">
                        {loading ? (
                            Array.from({ length: 20 }).map((_, i) => (
                                <div key={i} className="aspect-[2/3] bg-white/5 rounded-[20px] animate-pulse" />
                            ))
                        ) : (
                            schedule.slice(0, 20).map((anime, index) => (
                                // ⚡ FIX: Prioritize episodeId (if the API has it) over just the number
                                <Link
                                    key={`latest-${anime.id}-${index}`}
                                    to={`/anime/${anime.id}?ep=${(anime as any).episodeId || (anime as any).episode || 1}`}
                                    className="group cursor-pointer block"
                                >
                                    <div className="aspect-[2/3] bg-[#0a0a0a] rounded-[20px] overflow-hidden mb-3 border border-white/5 group-hover:border-blue-500/50 transition-all duration-500 shadow-2xl relative">
                                        <img
                                            src={anime.image}
                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                            alt={anime.title}
                                        />
                                        <div className="absolute top-3 right-3 bg-blue-600 text-[10px] font-black px-2 py-1 rounded-lg uppercase shadow-lg z-20">
                                            EP {(anime as any).episode || "1"}
                                        </div>
                                        <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-md text-[9px] font-black px-2 py-1 rounded-md uppercase border border-white/10 z-20">
                                            {anime.subOrDub || "SUB"}
                                        </div>
                                    </div>

                                    <h4 className="font-bold text-[14px] truncate text-gray-300 group-hover:text-blue-400 transition-all duration-300 px-1">
                                        {anime.title}
                                    </h4>
                                    <p className="text-[10px] text-gray-600 font-bold mt-1 uppercase tracking-widest px-1">TV Series</p>
                                </Link>
                            ))
                        )}
                    </div>
                </section>

                <aside className="w-full lg:w-[320px]">
                    <div className="sticky top-20">
                        {!loading && <TrendingSidebar trendingList={trending.slice(0, 10)} />}
                    </div>
                </aside>
            </div>
            <style>{`#continue-scroll::-webkit-scrollbar { display: none; }`}</style>
        </main>
    );
}