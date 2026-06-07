import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import HeroBanner from '../components/HeroBanner';
import TrendingSidebar from '../components/TrendingSidebar';
import { consumetApi, type AnimeResult } from '../services/consumet';
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
    const heroRef = useRef<HTMLDivElement>(null);

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
                const [trendingData, recentData] = await Promise.all([
                    consumetApi.getTopTrending(),
                    consumetApi.getAiringSchedule()
                ]);
                setTrending(trendingData);
                setSchedule(recentData.length > 0 ? recentData : trendingData);
            } catch (error) {
                console.error("Data fetch failed:", error);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    useEffect(() => {
        const handleParallax = () => {
            if (!heroRef.current) return;
            const scrollY = window.scrollY;
            const bg = heroRef.current.querySelector('.parallax-bg') as HTMLElement;
            if (bg) {
                bg.style.transform = `translateY(${scrollY * 0.12}px)`;
            }
        };
        window.addEventListener('scroll', handleParallax, { passive: true });
        return () => window.removeEventListener('scroll', handleParallax);
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
    const slideCount = Math.min(trending.length, 20);
    const prevAnime = trending[(currentIndex - 1 + slideCount) % slideCount];
    const nextAnime = trending[(currentIndex + 1) % slideCount];

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
            const { error } = await supabase.from('watch_history').delete().eq('user_id', session.user.id).eq('anime_id', anime_id);
            if (error) console.error("Failed to remove from history:", error);
        }
    };

    return (
        <main className="w-full flex flex-col">
            <section ref={heroRef} className="relative w-full h-[400px] md:h-[480px] xl:h-[520px]">
                {loading ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-bg">
                        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : activeAnime && (
                    <HeroBanner anime={activeAnime} prevAnime={prevAnime} nextAnime={nextAnime} currentIndex={currentIndex} total={slideCount} onNext={handleNext} onPrev={handlePrev} onSelect={handleSelectSlide} />
                )}
            </section>

            <div className="flex flex-col lg:flex-row gap-5 md:gap-6 px-4 md:px-6 py-4 md:py-6 max-w-[1500px] mx-auto w-full">
                <section className="flex-1 min-w-0">
                    {history.length > 0 && (
                        <div className="mb-6 md:mb-8" data-reveal>
                            <div className="flex items-center justify-between mb-3 md:mb-5">
                                <h2 className="section-title text-lg md:text-2xl">Continue Watching</h2>
                                <div className="flex items-center gap-1.5">
                                    <button onClick={() => { const el = document.getElementById('continue-scroll'); if (el) el.scrollBy({ left: -320, behavior: 'smooth' }); }} className="w-7 h-7 md:w-8 md:h-8 flex items-center justify-center rounded-xl bg-surface border border-border text-muted hover:text-fg hover:border-muted transition-all cursor-pointer">
                                        <ChevronLeft className="w-3 h-3 md:w-3.5 md:h-3.5" />
                                    </button>
                                    <button onClick={() => { const el = document.getElementById('continue-scroll'); if (el) el.scrollBy({ left: 320, behavior: 'smooth' }); }} className="w-7 h-7 md:w-8 md:h-8 flex items-center justify-center rounded-xl bg-surface border border-border text-muted hover:text-fg hover:border-muted transition-all cursor-pointer">
                                        <ChevronRight className="w-3 h-3 md:w-3.5 md:h-3.5" />
                                    </button>
                                </div>
                            </div>
                            <div id="continue-scroll" className="flex gap-3 md:gap-4 overflow-x-auto py-1 scrollbar-hide">
                                {history.map((item) => {
                                    const progressPercent = item.duration > 0 ? (item.progress / item.duration) * 100 : 0;
                                    return (
                                        <Link key={`history-${item.anime_id}`} to={`/anime/${item.anime_id}?ep=${item.episode_id}`} className="group w-[200px] sm:w-[240px] md:w-[280px] shrink-0 block">
                                            <div className="w-full aspect-video rounded-lg md:rounded-xl overflow-hidden bg-surface border border-border relative">
                                                <img src={item.anime_image} alt={item.anime_title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                                <div className="absolute inset-0 bg-overlay opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                                                    <div className="w-8 h-8 md:w-10 md:h-10 bg-accent/90 rounded-full flex items-center justify-center">
                                                        <Play className="w-3.5 h-3.5 md:w-4 md:h-4 ml-0.5 fill-current text-white" />
                                                    </div>
                                                </div>
                                                <button onClick={(e) => handleRemoveHistory(e, item.anime_id)} className="absolute top-2 right-2 w-6 h-6 bg-black/50 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-danger cursor-pointer z-10">
                                                    <X className="w-3 h-3 text-white" />
                                                </button>
                                                <span className="absolute top-2 left-2 bg-black/60 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wider">EP {item.episode_number}</span>
                                                <div className="absolute bottom-0 left-0 w-full h-0.5 bg-border">
                                                    <div className="h-full bg-accent" style={{ width: `${progressPercent}%` }} />
                                                </div>
                                            </div>
                                            <h3 className="text-[11px] md:text-xs font-medium text-muted mt-1.5 md:mt-2 truncate group-hover:text-fg transition-colors">{item.anime_title}</h3>
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="mb-4 md:mb-6" data-reveal>
                        <h2 className="section-title text-lg md:text-2xl">Latest Updates</h2>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-y-6 md:gap-y-8 gap-x-3 md:gap-x-4">
                        {loading ? (
                            Array.from({ length: 20 }).map((_, i) => (
                                <div key={i} className="aspect-[2/3] bg-border rounded-xl animate-pulse" />
                            ))
                        ) : (
                            schedule.slice(0, 20).map((anime, index) => (
                                <Link key={`latest-${anime.id}-${index}`} to={`/anime/${anime.id}?ep=${(anime as any).episodeId || (anime as any).episode || 1}`} className="group block" data-reveal data-reveal-delay={`${(index % 5) * 100}`}>
                                    <div className="aspect-[2/3] bg-surface rounded-lg md:rounded-xl overflow-hidden mb-1.5 md:mb-2 border border-border relative shadow-sm">
                                        <img src={anime.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt={anime.title} />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                                        <span className="absolute top-2 right-2 md:top-2.5 md:right-2.5 bg-black/70 text-white text-[8px] md:text-[9px] font-semibold px-1.5 md:px-2 py-0.5 rounded-full uppercase tracking-wider">EP {(anime as any).episode || "1"}</span>
                                        <span className="absolute bottom-2 left-2 md:bottom-2.5 md:left-2.5 bg-black/70 text-white text-[8px] md:text-[9px] font-semibold px-1.5 md:px-2 py-0.5 rounded-full uppercase tracking-wider">{anime.subOrDub || "SUB"}</span>
                                    </div>
                                    <h4 className="font-semibold text-[11px] md:text-sm truncate text-fg group-hover:text-accent transition-colors leading-tight">{anime.title}</h4>
                                    <p className="text-[9px] md:text-[10px] text-muted font-medium mt-0.5 uppercase tracking-wider">TV Series</p>
                                </Link>
                            ))
                        )}
                    </div>
                </section>

                <aside className="w-full lg:w-[300px] shrink-0">
                    <div className="lg:sticky lg:top-24">
                        {!loading && <TrendingSidebar trendingList={trending.slice(0, 10)} />}
                    </div>
                </aside>
            </div>
        </main>
    );
}
