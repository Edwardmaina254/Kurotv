import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Play, Loader2, Star } from 'lucide-react';

interface QuickResult {
    id: number;
    title: { english: string; romaji: string };
    coverImage: { extraLarge: string };
    type: string;
    averageScore: number;
}

export default function Landing() {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [bgImages, setBgImages] = useState<string[]>([]);
    const [mosaicReady, setMosaicReady] = useState(false);
    const [liveResults, setLiveResults] = useState<QuickResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const dropdownRef = useRef<HTMLDivElement>(null);
    const heroRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const CACHE_KEY = 'kuro-mosaic-cache';
        const CACHE_TTL = 1000 * 60 * 30;

        const preloadBatch = (srcs: string[]) =>
            Promise.all(srcs.map(src => new Promise<void>(resolve => { const img = new Image(); img.onload = () => resolve(); img.onerror = () => resolve(); img.src = src; })));

        const fetchBackgrounds = async () => {
            try {
                const cached = sessionStorage.getItem(CACHE_KEY);
                if (cached) {
                    const { images, ts } = JSON.parse(cached);
                    if (Date.now() - ts < CACHE_TTL && images?.length) {
                        setBgImages(images);
                        await preloadBatch(images.slice(0, 8));
                        requestAnimationFrame(() => requestAnimationFrame(() => setMosaicReady(true)));
                        return;
                    }
                }
                const query = `query { popular: Page(page: 1, perPage: 25) { media(type: ANIME, sort: POPULARITY_DESC, status_not: NOT_YET_RELEASED) { coverImage { extraLarge } } } rated: Page(page: 1, perPage: 25) { media(type: ANIME, sort: SCORE_DESC, status_not: NOT_YET_RELEASED) { coverImage { extraLarge } } } popular2: Page(page: 2, perPage: 25) { media(type: ANIME, sort: POPULARITY_DESC, status_not: NOT_YET_RELEASED) { coverImage { extraLarge } } } favs: Page(page: 1, perPage: 25) { media(type: ANIME, sort: FAVOURITES_DESC, status_not: NOT_YET_RELEASED) { coverImage { extraLarge } } } }`;
                const res = await fetch('https://graphql.anilist.co', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query })
                }).then(r => r.json()).catch(() => ({ data: null }));

                const extract = (key: string) => res?.data?.[key]?.media?.map((m: any) => m.coverImage?.extraLarge).filter(Boolean) || [];
                const allImages = [...extract('popular'), ...extract('rated'), ...extract('popular2'), ...extract('favs')];
                const unique = Array.from(new Set(allImages));
                const selected = unique.sort(() => 0.5 - Math.random()).slice(0, 20);

                sessionStorage.setItem(CACHE_KEY, JSON.stringify({ images: selected, ts: Date.now() }));

                const firstBatch = selected.slice(0, 8);
                const secondBatch = selected.slice(8);
                await preloadBatch(firstBatch);
                setBgImages(firstBatch);
                requestAnimationFrame(() => requestAnimationFrame(() => setMosaicReady(true)));
                preloadBatch(secondBatch).then(() => setBgImages(selected));
            } catch (error) {
                console.error("Failed to load background images:", error);
            }
        };
        fetchBackgrounds();
    }, []);

    useEffect(() => {
        if (!searchQuery.trim()) { setLiveResults([]); setShowDropdown(false); return; }
        const timer = setTimeout(async () => {
            setIsSearching(true); setShowDropdown(true);
            try {
                const gqlQuery = `query ($search: String) { Page(page: 1, perPage: 5) { media(search: $search, type: ANIME, sort: SEARCH_MATCH) { id title { english romaji } coverImage { extraLarge } type averageScore } } }`;
                const response = await fetch('https://graphql.anilist.co', {
                    method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({ query: gqlQuery, variables: { search: searchQuery.trim() } })
                });
                const data = await response.json();
                if (data.data?.Page?.media) setLiveResults(data.data.Page.media);
            } catch (error) { console.error("Live search failed:", error); }
            finally { setIsSearching(false); }
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setShowDropdown(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (heroRef.current) {
                const rect = heroRef.current.getBoundingClientRect();
                const x = (e.clientX - rect.left) / rect.width - 0.5;
                const y = (e.clientY - rect.top) / rect.height - 0.5;
                setMousePos({ x, y });
            }
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    const handleSearch = (e: React.FormEvent) => { e.preventDefault(); if (searchQuery.trim()) navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`); };
    const handleResultClick = (id: number) => { setShowDropdown(false); navigate(`/anime/${id}`); };

    return (
        <div className="relative w-full min-h-screen bg-bg flex flex-col overflow-hidden">
            <div ref={heroRef} className="relative w-full overflow-hidden" style={{ height: '90vh' }}>
                <div className="absolute inset-0 flex transition-opacity duration-500" style={{ opacity: mosaicReady ? 0 : 1, pointerEvents: 'none' }}>
                    {Array.from({ length: 20 }).map((_, idx) => <div key={idx} className="flex-1 h-full bg-border animate-pulse" />)}
                </div>

                <div className="absolute inset-0 flex transition-opacity duration-700" style={{ opacity: mosaicReady ? 1 : 0 }}>
                    {bgImages.map((img, idx) => (
                        <div key={idx} className={`flex-1 h-full relative overflow-hidden ${idx >= 4 ? 'hidden md:flex' : idx >= 2 ? 'hidden sm:flex' : ''}`}
                            style={{
                                animation: mosaicReady ? `strip-reveal 0.7s ease forwards` : 'none',
                                animationDelay: `${idx * 24}ms`,
                                transform: `translateY(${mousePos.y * (8 + idx % 3 * 4)}px)`,
                                opacity: 0
                            }}>
                            <img src={img} alt="" className="absolute inset-0 w-full h-full object-cover opacity-[0.45] brightness-[1.15] hover:opacity-70 transition-all duration-700" loading="eager" decoding="sync" />
                        </div>
                    ))}
                </div>

                <div className="absolute inset-0 flex pointer-events-none">
                    {Array.from({ length: 19 }).map((_, idx) => <div key={idx} className={`flex-1 border-r border-border/20 last:border-0 ${idx >= 5 ? 'hidden md:block' : idx >= 2 ? 'hidden sm:block' : ''}`} />)}
                </div>

                <div className="absolute inset-0 bg-gradient-to-b from-bg/60 via-bg/35 to-bg pointer-events-none" />
                <div className="absolute bottom-0 left-0 right-0 h-[40%] bg-gradient-to-t from-bg via-bg/60 to-transparent pointer-events-none" />

                <div className="absolute inset-0 flex flex-col items-center justify-center z-10 px-6" style={{ paddingBottom: '6vh' }}>
                    <div className="mb-4 md:mb-6 text-center">
                        <span onClick={() => navigate('/home')} className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight text-fg font-display cursor-pointer hover:opacity-80 transition-opacity">
                            KURO<span className="text-accent">TV</span>
                        </span>
                    </div>

                    <p className="text-xs md:text-sm text-muted mb-5 md:mb-7 text-center max-w-md leading-relaxed font-medium">
                        Stream anime in 1080p — ad-free, minimal, beautiful.
                    </p>

                    <div className="w-full max-w-lg relative" ref={dropdownRef}>
                        <form onSubmit={handleSearch} className="relative flex items-center bg-surface rounded-2xl border border-border focus-within:border-muted overflow-hidden transition-all duration-300 shadow-lg hover:shadow-xl focus-within:shadow-2xl">
                            <div className="pl-5 pr-3">
                                <Search className="w-4 h-4 text-muted" />
                            </div>
                            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onFocus={() => { if (searchQuery.trim() && liveResults.length > 0) setShowDropdown(true); }} className="flex-1 bg-transparent border-none outline-none text-sm text-fg placeholder-muted py-4" />
                            {isSearching && <Loader2 className="w-4 h-4 text-accent animate-spin mr-3 shrink-0" />}
                        </form>

                        {showDropdown && searchQuery.trim().length > 0 && (
                            <div className="absolute top-[calc(100%+6px)] left-0 right-0 bg-surface border border-border rounded-2xl overflow-hidden z-50 animate-float-in shadow-xl">
                                {isSearching && liveResults.length === 0 ? (
                                    <div className="p-5 flex justify-center"><Loader2 className="w-5 h-5 text-accent animate-spin" /></div>
                                ) : liveResults.length > 0 ? (
                                    <>
                                        {liveResults.map((anime) => (
                                            <div key={anime.id} onClick={() => handleResultClick(anime.id)} className="flex items-center gap-3 px-4 py-2.5 hover:bg-bg transition-colors cursor-pointer border-b border-border last:border-0">
                                                <img src={anime.coverImage.extraLarge} alt={anime.title.english} className="w-8 h-11 object-cover rounded shrink-0" />
                                                <div className="flex flex-col min-w-0 flex-1">
                                                    <span className="text-sm font-semibold text-fg truncate">{anime.title.english || anime.title.romaji}</span>
                                                    <div className="flex items-center gap-3 mt-0.5 text-[10px] font-medium text-muted tracking-wider uppercase">
                                                        <span>{anime.type}</span>
                                                        <span className="flex items-center gap-1"><Star className="w-3 h-3 text-accent fill-accent" />{anime.averageScore}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        <button onClick={handleSearch} className="w-full py-2.5 bg-bg hover:bg-accent-muted text-muted hover:text-fg transition-colors text-xs font-semibold tracking-wider uppercase border-t border-border">View all results</button>
                                    </>
                                ) : (
                                    <div className="p-5 text-center text-sm text-muted">No instant results found.</div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-4 mt-6 md:mt-8">
                        <button onClick={() => navigate('/home')} className="flex items-center justify-center gap-2 bg-accent hover:bg-accent-dim text-white px-6 md:px-8 py-2.5 md:py-3 rounded-xl font-semibold text-[10px] md:text-xs uppercase tracking-wider transition-all hover:-translate-y-0.5 active:translate-y-0 shadow-sm hover:shadow-md cursor-pointer">
                            Watch Now <Play className="w-3 h-3 md:w-3.5 md:h-3.5 fill-current" />
                        </button>

                    </div>

                    <p className="text-[10px] md:text-xs text-muted mt-6 md:mt-8 text-center max-w-lg">
                        <span className="font-medium">Popular: </span>
                        One Piece, Jujutsu Kaisen, Solo Leveling, Demon Slayer
                    </p>
                </div>
            </div>

            <div className="w-full overflow-hidden border-t border-border py-6 bg-surface/30">
                <div className="flex animate-marquee gap-12 text-[11px] font-semibold uppercase tracking-wider text-muted">
                    {Array.from({ length: 2 }).map((_, i) => (
                        <div key={i} className="flex gap-12 shrink-0 items-center">
                            <span>✦ 100,000+ Episodes Available</span>
                            <span>✦ Watch in 1080p Free</span>
                            <span>✦ No Ads. No Tracking.</span>
                            <span>✦ Updated Daily</span>
                            <span>✦ Sub & Dub Available</span>
                            <span>✦ Minimal & Beautiful</span>
                            <span>✦ 100,000+ Episodes Available</span>
                            <span>✦ Watch in 1080p Free</span>
                            <span>✦ No Ads. No Tracking.</span>
                            <span>✦ Updated Daily</span>
                            <span>✦ Sub & Dub Available</span>
                            <span>✦ Minimal & Beautiful</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
