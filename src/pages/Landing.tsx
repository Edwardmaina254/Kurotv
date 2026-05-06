// src/pages/Landing.tsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, Play, Loader2, Star } from 'lucide-react';

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
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const CACHE_KEY = 'kuro-mosaic-cache';
        const CACHE_TTL = 1000 * 60 * 30; // 30 minutes

        const preloadBatch = (srcs: string[]) =>
            Promise.all(
                srcs.map(src => new Promise<void>(resolve => {
                    const img = new Image();
                    img.onload = () => resolve();
                    img.onerror = () => resolve();
                    img.src = src;
                }))
            );

        const fetchBackgrounds = async () => {
            try {
                // ── 1. Serve from sessionStorage cache on refresh ──
                // First visit fetches from API; every subsequent visit/refresh
                // within 30 min is instant — zero network round trip.
                const cached = sessionStorage.getItem(CACHE_KEY);
                if (cached) {
                    const { images, ts } = JSON.parse(cached);
                    if (Date.now() - ts < CACHE_TTL && images?.length) {
                        setBgImages(images);
                        await preloadBatch(images.slice(0, 8)); // preload first 8 only — fast
                        requestAnimationFrame(() => requestAnimationFrame(() => setMosaicReady(true)));
                        return;
                    }
                }

                // ── 2. Single batched GQL query — 1 HTTP round trip instead of 4 ──
                const query = `query {
                    popular:  Page(page: 1, perPage: 25) { media(type: ANIME, sort: POPULARITY_DESC, status_not: NOT_YET_RELEASED) { coverImage { extraLarge } } }
                    rated:    Page(page: 1, perPage: 25) { media(type: ANIME, sort: SCORE_DESC,      status_not: NOT_YET_RELEASED) { coverImage { extraLarge } } }
                    popular2: Page(page: 2, perPage: 25) { media(type: ANIME, sort: POPULARITY_DESC, status_not: NOT_YET_RELEASED) { coverImage { extraLarge } } }
                    favs:     Page(page: 1, perPage: 25) { media(type: ANIME, sort: FAVOURITES_DESC, status_not: NOT_YET_RELEASED) { coverImage { extraLarge } } }
                }`;

                const res = await fetch('https://graphql.anilist.co', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query })
                }).then(r => r.json()).catch(() => ({ data: null }));

                const extract = (key: string) =>
                    res?.data?.[key]?.media?.map((m: any) => m.coverImage?.extraLarge).filter(Boolean) || [];

                const allImages = [...extract('popular'), ...extract('rated'), ...extract('popular2'), ...extract('favs')];
                const unique = Array.from(new Set(allImages));
                const selected = unique.sort(() => 0.5 - Math.random()).slice(0, 20);

                // ── 3. Cache for next visit ──
                sessionStorage.setItem(CACHE_KEY, JSON.stringify({ images: selected, ts: Date.now() }));

                // ── 4. Show first 8 strips immediately, then load the rest ──
                // User sees a partial mosaic within ~300ms instead of waiting
                // for all 20 images. Remaining strips fade in a moment later.
                const firstBatch = selected.slice(0, 8);
                const secondBatch = selected.slice(8);

                await preloadBatch(firstBatch);
                setBgImages(firstBatch);
                requestAnimationFrame(() => requestAnimationFrame(() => setMosaicReady(true)));

                // Load remaining 12 in background — no await blocking the UI
                preloadBatch(secondBatch).then(() => {
                    setBgImages(selected);
                });

            } catch (error) {
                console.error("Failed to load background images:", error);
            }
        };
        fetchBackgrounds();
    }, []);

    useEffect(() => {
        if (!searchQuery.trim()) {
            setLiveResults([]);
            setShowDropdown(false);
            return;
        }
        const timer = setTimeout(async () => {
            setIsSearching(true);
            setShowDropdown(true);
            try {
                const gqlQuery = `query ($search: String) { Page(page: 1, perPage: 5) { media(search: $search, type: ANIME, sort: SEARCH_MATCH) { id title { english romaji } coverImage { extraLarge } type averageScore } } }`;
                const response = await fetch('https://graphql.anilist.co', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({ query: gqlQuery, variables: { search: searchQuery.trim() } })
                });
                const data = await response.json();
                if (data.data?.Page?.media) setLiveResults(data.data.Page.media);
            } catch (error) {
                console.error("Live search failed:", error);
            } finally {
                setIsSearching(false);
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchQuery.trim()) navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    };

    const handleResultClick = (id: number) => {
        setShowDropdown(false);
        navigate(`/anime/${id}`);
    };

    return (
        <div className="relative w-full min-h-screen bg-[#0f0f0f] flex flex-col overflow-hidden">

            {/* ── MOSAIC HERO ── */}
            <div className="relative w-full overflow-hidden" style={{ height: '82vh' }}>

                {/* Skeleton — shown until all images are preloaded */}
                <div
                    className="absolute inset-0 flex transition-opacity duration-500"
                    style={{ opacity: mosaicReady ? 0 : 1, pointerEvents: 'none' }}
                >
                    {Array.from({ length: 20 }).map((_, idx) => (
                        <div key={idx} className="flex-1 h-full bg-[#1a1a1a] animate-pulse" />
                    ))}
                </div>

                {/* Real mosaic — fades in all at once when every image is cached */}
                <div
                    className="absolute inset-0 flex transition-opacity duration-700"
                    style={{ opacity: mosaicReady ? 1 : 0 }}
                >
                    {bgImages.map((img, idx) => (
                        <div
                            key={idx}
                            className="flex-1 h-full relative overflow-hidden group"
                            style={{
                                // Staggered slide-up on each strip
                                animation: mosaicReady
                                    ? `stripReveal 0.6s ease forwards`
                                    : 'none',
                                animationDelay: `${idx * 28}ms`,
                                transform: 'translateY(12px)',
                                opacity: 0,
                            }}
                        >
                            <img
                                src={img}
                                alt="anime"
                                className="absolute inset-0 w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-all duration-700 group-hover:scale-105"
                                // Already cached — no network request on render
                                loading="eager"
                                decoding="sync"
                            />
                        </div>
                    ))}
                </div>

                {/* Thin vertical dividers */}
                <div className="absolute inset-0 flex pointer-events-none">
                    {Array.from({ length: 19 }).map((_, idx) => (
                        <div key={idx} className="flex-1 border-r border-black/60 last:border-0" />
                    ))}
                </div>

                {/* Overlays */}
                <div className="absolute inset-0 bg-black/30 pointer-events-none" />
                <div className="absolute bottom-0 left-0 right-0 h-[55%] bg-gradient-to-t from-[#0f0f0f] via-[#0f0f0f]/60 to-transparent pointer-events-none" />
                <div className="absolute top-0 left-0 right-0 h-[15%] bg-gradient-to-b from-[#0f0f0f]/70 to-transparent pointer-events-none" />

                {/* ── CENTERED CONTENT ── */}
                <div className="absolute inset-0 flex flex-col items-center justify-center z-10 px-6" style={{ paddingBottom: '4vh' }}>

                    {/* Logo */}
                    <div className="mb-7">
                        <span
                            onClick={() => navigate('/home')}
                            className="text-5xl md:text-6xl font-black tracking-tight text-white italic font-['Oswald'] drop-shadow-[0_4px_24px_rgba(0,0,0,0.9)] cursor-pointer hover:opacity-80 transition-opacity duration-200"
                        >
                            KURO<span className="text-blue-500">TV</span>
                        </span>
                    </div>

                    {/* Search bar */}
                    <div className="w-full max-w-2xl relative" ref={dropdownRef}>
                        <form
                            onSubmit={handleSearch}
                            className="relative flex items-center bg-[#0a0a0a] rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.8)] border border-[#222] focus-within:border-blue-500/50 overflow-hidden transition-colors duration-200"
                        >
                            <div className="pl-5 pr-3 flex-shrink-0">
                                <Search className="w-5 h-5 text-gray-400" />
                            </div>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onFocus={() => { if (searchQuery.trim() && liveResults.length > 0) setShowDropdown(true); }}
                                placeholder="Search for anime..."
                                className="flex-1 bg-transparent border-none outline-none text-base text-white placeholder-gray-500 font-medium py-4"
                            />
                            {isSearching && <Loader2 className="w-5 h-5 text-blue-500 animate-spin mr-3 flex-shrink-0" />}
                            <button
                                type="button"
                                onClick={() => navigate('/search')}
                                className="flex items-center gap-1.5 text-[11px] font-bold tracking-widest text-gray-400 hover:text-white uppercase bg-[#1a1a1a] hover:bg-[#222] px-5 py-3.5 transition-colors mr-1.5 rounded-full my-1.5 flex-shrink-0 cursor-pointer border border-[#333]"
                            >
                                <Filter className="w-3.5 h-3.5" /> Filter
                            </button>
                        </form>

                        {/* Dropdown results */}
                        {showDropdown && searchQuery.trim().length > 0 && (
                            <div className="absolute top-[110%] left-0 right-0 bg-[#141414] border border-[#2a2a2a] rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.95)] overflow-hidden z-50 flex flex-col text-left">
                                {isSearching && liveResults.length === 0 ? (
                                    <div className="p-6 flex justify-center"><Loader2 className="w-6 h-6 text-blue-500 animate-spin" /></div>
                                ) : liveResults.length > 0 ? (
                                    <>
                                        <div className="flex flex-col">
                                            {liveResults.map((anime) => (
                                                <div
                                                    key={anime.id}
                                                    onClick={() => handleResultClick(anime.id)}
                                                    className="flex items-center gap-4 p-3 hover:bg-[#1e1e1e] transition-colors cursor-pointer border-b border-[#1f1f1f] last:border-0"
                                                >
                                                    <img src={anime.coverImage.extraLarge} alt={anime.title.english} className="w-10 h-14 object-cover rounded-md shadow-sm flex-shrink-0" />
                                                    <div className="flex flex-col flex-1 min-w-0">
                                                        <span className="text-sm font-bold text-white line-clamp-1">{anime.title.english || anime.title.romaji}</span>
                                                        <div className="flex items-center gap-3 mt-1 text-[10px] font-bold text-gray-500 tracking-widest uppercase">
                                                            <span>{anime.type}</span>
                                                            <span className="flex items-center gap-1 text-gray-400">
                                                                <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />{anime.averageScore}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <button
                                            onClick={handleSearch}
                                            className="w-full py-3 bg-[#1a1a1a] hover:bg-blue-600 hover:text-white transition-colors text-xs font-black tracking-widest uppercase text-gray-400 border-t border-[#2a2a2a]"
                                        >
                                            View all results
                                        </button>
                                    </>
                                ) : (
                                    <div className="p-6 text-center text-sm font-bold text-gray-500">No instant results found.</div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Top searches hint */}
                    <p className="text-[13px] text-gray-300 mt-5 text-center max-w-xl leading-relaxed">
                        <span className="text-gray-500 font-semibold">Top Searches: </span>
                        One Piece, Jujutsu Kaisen, Solo Leveling, Demon Slayer, Mushoku Tensei, Bleach
                    </p>

                    {/* Watch Now button */}
                    <button
                        onClick={() => navigate('/home')}
                        className="mt-6 flex items-center justify-center gap-3 text-white px-16 py-[14px] rounded-full font-black uppercase tracking-widest text-sm transition-all hover:-translate-y-0.5 cursor-pointer shadow-[0_4px_24px_rgba(59,130,246,0.5)] hover:shadow-[0_6px_32px_rgba(59,130,246,0.7)]"
                        style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' }}
                    >
                        Watch Now <Play className="w-4 h-4 fill-current" />
                    </button>
                </div>
            </div>

            {/* ── BOTTOM TAGLINE ── */}
            <div className="w-full px-8 md:px-16 py-8 bg-[#0f0f0f]">
                <h1 className="text-2xl md:text-3xl font-black text-white uppercase tracking-wide mb-2">
                    The Best Site to Watch Anime Online For Free
                </h1>
                <p className="text-[13px] text-gray-400 max-w-3xl leading-relaxed">
                    KuroTV is a minimalist, ad-free platform designed for the ultimate viewing experience. Stream in 1080p without interruptions.
                </p>
            </div>

            {/* ── Keyframe for strip staggered reveal ── */}
            <style>{`
                @keyframes stripReveal {
                    from { transform: translateY(12px); opacity: 0; }
                    to   { transform: translateY(0);    opacity: 1; }
                }
            `}</style>
        </div>
    );
}