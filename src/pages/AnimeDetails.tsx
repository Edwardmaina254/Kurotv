// src/pages/AnimeDetails.tsx
import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { type AnimeDetails as AnimeDetailsType, type Episode } from '../services/consumet';
import {
    Bookmark, ArrowLeft, Play, Pause, Loader2, Star,
    Maximize, Minimize, Volume2, VolumeX, Settings,
    RotateCcw, RotateCw, Check
} from 'lucide-react';
import Hls from 'hls.js';
import { supabase } from '../lib/supabase';

interface Relation {
    id: string | number;
    title: string;
    image: string;
    type: string;
    relationType: string;
}

interface Recommendation {
    id: number;
    title: { english: string | null; romaji: string };
    coverImage: { large: string };
    averageScore: number | null;
    type: string;
}

interface ExtendedAnimeDetails extends AnimeDetailsType {
    rating?: number | string;
    type?: string;
    releaseDate?: string;
    relations?: Relation[];
    episodes: Episode[];
    _shortLabel?: string;
    _extractedSeason?: number;
    _extractedPart?: number;
    _sortScore?: number;
    _franchiseOverride?: boolean;
}

const formatTime = (time: number) => {
    if (isNaN(time)) return "00:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

export default function AnimeDetails() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [chronologicalSeasons, setChronologicalSeasons] = useState<ExtendedAnimeDetails[]>([]);
    const [playingSeasonId, setPlayingSeasonId] = useState<string | null>(null);

    const [malId, setMalId] = useState<number | null>(null);
    const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [recommendationsLoading, setRecommendationsLoading] = useState(true);

    const [activeEpisode, setActiveEpisode] = useState<Episode | null>(null);
    const [watchedEpisodes, setWatchedEpisodes] = useState<Set<string>>(new Set());

    const [user, setUser] = useState<any>(null);
    const [isInWatchlist, setIsInWatchlist] = useState(false);
    const [watchlistLoading, setWatchlistLoading] = useState(false);

    const [availableSources, setAvailableSources] = useState<any[]>([]);
    const [streamData, setStreamData] = useState<{ url: string; isIframe: boolean; isM3U8?: boolean } | null>(null);
    const [isFetchingStream, setIsFetchingStream] = useState(false);
    const [streamError, setStreamError] = useState<string | null>(null);

    const [loadingPhase, setLoadingPhase] = useState(0);

    const [audioMode, setAudioMode] = useState<'sub' | 'dub'>(
        (localStorage.getItem('kuro-default-audio') as 'sub' | 'dub') || 'sub'
    );
    const [activeServer, setActiveServer] = useState('Vidstreaming');
    const [hlsInstance, setHlsInstance] = useState<Hls | null>(null);
    const [qualities, setQualities] = useState<{ height: number; level: number }[]>([]);
    const [currentQuality, setCurrentQuality] = useState<number>(-1);
    const [showSettings, setShowSettings] = useState(false);

    const [skipTimes, setSkipTimes] = useState<{ op: { start: number, end: number } | null, ed: { start: number, end: number } | null }>({ op: null, ed: null });

    const videoRef = useRef<HTMLVideoElement>(null);
    const playerContainerRef = useRef<HTMLDivElement>(null);
    const seekContainerRef = useRef<HTMLDivElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [animeFetchResult, setAnimeFetchResult] = useState<any>(null);

    const [showControls, setShowControls] = useState(true);
    const [isMouseActive, setIsMouseActive] = useState(true);
    const [isBuffering, setIsBuffering] = useState(false);

    const [hoverTime, setHoverTime] = useState(0);
    const [hoverPercent, setHoverPercent] = useState(0);
    const [isHovering, setIsHovering] = useState(false);
    const [bufferedEnd, setBufferedEnd] = useState(0);

    const controlsTimeoutRef = useRef<number | null>(null);
    const lastSavedTimeRef = useRef<number>(0);

    const playerStateRef = useRef({ volume, currentTime, duration, isPlaying });
    useEffect(() => {
        playerStateRef.current = { volume, currentTime, duration, isPlaying };
    }, [volume, currentTime, duration, isPlaying]);

    // 🔥 Keeps the maximize/minimize icon synced if the user presses the ESC key
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    const primarySeason = chronologicalSeasons.find(s => s.id.toString() === id) || chronologicalSeasons[0];

    useEffect(() => {
        if (primarySeason && activeEpisode) {
            document.title = `Watch ${primarySeason.title} Episode ${activeEpisode.number} - KuroTV`;
        } else if (primarySeason) {
            document.title = `${primarySeason.title} - KuroTV`;
        } else {
            document.title = 'KuroTV';
        }
        return () => { document.title = 'KuroTV'; };
    }, [primarySeason, activeEpisode]);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
        });
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
        });
        return () => subscription.unsubscribe();
    }, []);

    useEffect(() => {
        const checkWatchlistStatus = async () => {
            if (user && primarySeason) {
                const { data } = await supabase
                    .from('watchlist')
                    .select('id')
                    .eq('user_id', user.id)
                    .eq('anime_id', primarySeason.id.toString())
                    .maybeSingle();
                if (data) setIsInWatchlist(true);
                else setIsInWatchlist(false);
            } else {
                setIsInWatchlist(false);
            }
        };
        checkWatchlistStatus();
    }, [user, primarySeason]);

    const toggleWatchlist = async () => {
        if (!user) {
            alert("Please sign in to add this anime to your watchlist!");
            return;
        }
        if (!primarySeason) return;
        setWatchlistLoading(true);
        try {
            if (isInWatchlist) {
                const { error } = await supabase.from('watchlist').delete().eq('user_id', user.id).eq('anime_id', primarySeason.id.toString());
                if (error) throw error;
                setIsInWatchlist(false);
            } else {
                const { error } = await supabase.from('watchlist').insert([
                    { user_id: user.id, anime_id: primarySeason.id.toString(), title: primarySeason.title, image: primarySeason.image || primarySeason.bannerImage, type: primarySeason.type || 'TV' }
                ]);
                if (error) throw error;
                setIsInWatchlist(true);
            }
        } catch (error) {
            console.error("Error updating watchlist:", error);
            alert("There was a problem updating your watchlist.");
        } finally {
            setWatchlistLoading(false);
        }
    };

    useEffect(() => {
        setLoading(true);
        setChronologicalSeasons([]);
        setActiveEpisode(null);
        setPlayingSeasonId(null);
        setStreamData(null);
        setIsFetchingStream(false);
        setStreamError(null);
        setSkipTimes({ op: null, ed: null });
        setAvailableSources([]);
        lastSavedTimeRef.current = 0;

        if (hlsInstance) {
            hlsInstance.detachMedia();
            hlsInstance.destroy();
            setHlsInstance(null);
        }
        if (videoRef.current) {
            videoRef.current.pause();
            videoRef.current.removeAttribute('src');
            videoRef.current.load();
        }

        const cancelRef = { cancelled: false };

        const fetchFullChronology = async () => {
            if (!id) return;
            const apiUrl = import.meta.env.VITE_API_URL || 'https://kurotv-backend.onrender.com';

            try {
                const initialInfoRes = await fetch(`${apiUrl}/anime/zoro/info/${id}`).catch(() => null);
                const initialInfo = initialInfoRes && initialInfoRes.ok ? await initialInfoRes.json() : null;

                if (cancelRef.cancelled) return;
                setAnimeFetchResult(initialInfo);

                if (!initialInfo || !initialInfo.title) {
                    setError("Anime data not found.");
                    setLoading(false);
                    return;
                }

                const baseEpsRes = await fetch(`${apiUrl}/anime/zoro/episodes/${id}`).catch(() => null);
                const baseEpsData = baseEpsRes && baseEpsRes.ok ? await baseEpsRes.json() : { episodes: [] };
                const baseEpisodes = baseEpsData.episodes || [];

                const safeBaseSeason: ExtendedAnimeDetails = {
                    id: initialInfo.id?.toString() || id,
                    title: initialInfo.title,
                    image: initialInfo.image || '',
                    bannerImage: initialInfo.bannerImage || initialInfo.image || '',
                    description: initialInfo.description || 'No synopsis available.',
                    genres: initialInfo.genres || [],
                    rating: initialInfo.rating || 'N/A',
                    status: initialInfo.status || 'UNKNOWN',
                    type: initialInfo.type || 'TV',
                    releaseDate: initialInfo.releaseDate || 'Unknown',
                    episodes: baseEpisodes,
                    totalEpisodes: initialInfo.totalEpisodes || baseEpisodes.length || 0,
                    url: initialInfo.url || `/anime/${id}`,
                    _shortLabel: 'Season 1',
                    _sortScore: 0
                };

                const relatedIds = (initialInfo.relations || [])
                    .map((r: Relation) => parseInt(r.id.toString()))
                    .filter((n: number) => !isNaN(n));

                const chainCollected = new Set<number>([parseInt(id), ...relatedIds]);
                const allIdsToFetch = Array.from(chainCollected);

                const sortingQuery = `
                    query($ids: [Int]) {
                        Page(page: 1, perPage: 50) {
                            media(id_in: $ids, type: ANIME) {
                                id idMal startDate { year month day } format status averageScore description genres bannerImage coverImage { extraLarge } title { english romaji }
                            }
                        }
                    }
                `;

                let compiledSeasons: ExtendedAnimeDetails[] = [];
                try {
                    const [sortingRes, ...episodesResponses] = await Promise.all([
                        fetch('https://graphql.anilist.co', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ query: sortingQuery, variables: { ids: allIdsToFetch } })
                        }).then(r => r.json()).catch(() => null),

                        ...allIdsToFetch.map(seasonId =>
                            fetch(`${apiUrl}/anime/zoro/episodes/${seasonId}`)
                                .then(r => r.json())
                                .catch(() => ({ episodes: [] }))
                        )
                    ]);

                    const rawMediaNodes = sortingRes?.data?.Page?.media || [];
                    const targetMalNode = rawMediaNodes.find((m: any) => m.id.toString() === id);
                    if (targetMalNode?.idMal) setMalId(targetMalNode.idMal);

                    const episodesMap = new Map();
                    allIdsToFetch.forEach((seasonId, index) => {
                        episodesMap.set(seasonId.toString(), episodesResponses[index]?.episodes || []);
                    });

                    if (rawMediaNodes.length > 0) {
                        compiledSeasons = rawMediaNodes.map((m: any) => {
                            const year = m.startDate?.year || 9999;
                            const month = m.startDate?.month || 1;
                            const day = m.startDate?.day || 1;
                            const sortScore = year * 10000 + month * 100 + day;

                            let dispTitle = initialInfo.id.toString() === m.id.toString() ? initialInfo.title : (m.title?.english || m.title?.romaji || "");
                            if (!dispTitle || dispTitle.toLowerCase().includes('unknown')) {
                                const fmt = m.format === 'TV' ? 'Season' : (m.format || 'Entry');
                                dispTitle = `${initialInfo.title?.split('Season')[0]?.trim() || 'Anime'} (${fmt})`;
                            }

                            return {
                                id: m.id.toString(),
                                title: dispTitle,
                                image: m.coverImage?.extraLarge || "",
                                bannerImage: m.bannerImage || m.coverImage?.extraLarge || "",
                                description: m.description || "No synopsis available.",
                                genres: m.genres || [],
                                rating: m.averageScore || "N/A",
                                status: m.status || "UNKNOWN",
                                type: m.format || "TV",
                                releaseDate: m.startDate?.year ? `${m.startDate.year}-${m.startDate.month || 1}-${m.startDate.day || 1}` : "Unknown",
                                episodes: episodesMap.get(m.id.toString()) || [],
                                totalEpisodes: m.episodes || 0,
                                url: `/anime/${m.id}`,
                                _sortScore: sortScore
                            };
                        });
                    }
                } catch (sortErr) {
                    console.warn("Secondary sorting fallback engaged.");
                }

                if (compiledSeasons.length === 0) compiledSeasons = [safeBaseSeason];

                let isolatedSeasons = compiledSeasons;
                isolatedSeasons.sort((a: any, b: any) => a._sortScore - b._sortScore);

                let rollingSeasonNumber = 1;
                isolatedSeasons.forEach((s) => {
                    s._shortLabel = `Season ${rollingSeasonNumber}`;
                    rollingSeasonNumber++;
                });

                const finalOrdered = isolatedSeasons.filter(s => {
                    if (s.id.toString() === id) return true;
                    return (s.episodes || []).length > 0;
                });

                if (cancelRef.cancelled) return;
                setChronologicalSeasons(finalOrdered.length > 0 ? finalOrdered : isolatedSeasons);
                setLoading(false);

                const globalWatched = new Set<string>();
                isolatedSeasons.forEach(season => {
                    (season.episodes || []).forEach(ep => {
                        if (localStorage.getItem(`kuro-watched-${season.id}-${ep.id}`) === 'true') {
                            globalWatched.add(ep.id.toString());
                        }
                    });
                });
                setWatchedEpisodes(globalWatched);

                let targetEpToPlay = null;
                let seasonContextId = id;
                const queryParams = new URLSearchParams(window.location.search);
                const epFromUrl = queryParams.get('ep');

                if (epFromUrl) {
                    const extractedNumMatch = epFromUrl.match(/\d+$/);
                    const targetNum = extractedNumMatch ? extractedNumMatch[0] : epFromUrl;

                    // ⚡ FIX: 1. PRIORITIZE THE REQUESTED SEASON FROM THE URL FIRST
                    const requestedSeason = isolatedSeasons.find(s => s.id.toString() === id);
                    if (requestedSeason) {
                        const foundInRequested = (requestedSeason.episodes || []).find(e =>
                            e.id.toString() === epFromUrl.toString() ||
                            e.number.toString() === epFromUrl.toString() ||
                            e.number.toString() === targetNum ||
                            epFromUrl.toString().endsWith(`-${e.number}`)
                        );
                        if (foundInRequested) {
                            targetEpToPlay = foundInRequested;
                            seasonContextId = requestedSeason.id;
                        }
                    }

                    // ⚡ FIX: 2. FALLBACK: If not found in the exact requested season, then check chronological seasons
                    if (!targetEpToPlay) {
                        for (const s of isolatedSeasons) {
                            const found = (s.episodes || []).find(e =>
                                e.id.toString() === epFromUrl.toString() ||
                                e.number.toString() === epFromUrl.toString() ||
                                e.number.toString() === targetNum ||
                                epFromUrl.toString().endsWith(`-${e.number}`)
                            );
                            if (found) { targetEpToPlay = found; seasonContextId = s.id; break; }
                        }
                    }
                }

                if (!targetEpToPlay) {
                    const localLastEp = localStorage.getItem(`kuro-last-ep-${id}`);
                    if (localLastEp) {
                        for (const s of isolatedSeasons) {
                            const found = (s.episodes || []).find(e => e.id.toString() === localLastEp);
                            if (found) { targetEpToPlay = found; seasonContextId = s.id; break; }
                        }
                    }
                }

                if (!targetEpToPlay) {
                    const currentRequestedSeason = isolatedSeasons.find(s => s.id.toString() === id) || isolatedSeasons[0];
                    if (currentRequestedSeason && currentRequestedSeason.episodes && currentRequestedSeason.episodes.length > 0) {
                        targetEpToPlay = currentRequestedSeason.episodes[0];
                        seasonContextId = currentRequestedSeason.id;
                    }
                }

                if (!cancelRef.cancelled && targetEpToPlay && seasonContextId) {
                    handlePlayEpisode(targetEpToPlay, seasonContextId);
                }

            } catch (err) {
                if (!cancelRef.cancelled) {
                    setError("Failed to compile chronological seasons.");
                    setLoading(false);
                }
            }
        };

        fetchFullChronology();
        return () => { cancelRef.cancelled = true; };
    }, [id]);

    useEffect(() => {
        const fetchRecommendations = async () => {
            if (!id) return;
            setRecommendationsLoading(true);
            try {
                const query = `
                    query($id: Int) {
                        Media(id: $id, type: ANIME) {
                            recommendations(page: 1, perPage: 15) {
                                nodes {
                                    mediaRecommendation {
                                        # 🔥 Added isAdult here so we can read it
                                        id title { english romaji } coverImage { large } averageScore type isAdult
                                    }
                                }
                            }
                        }
                    }
                `;
                const res = await fetch('https://graphql.anilist.co', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query, variables: { id: parseInt(id) } })
                });

                if (!res.ok) throw new Error("Rate Limited");
                const data = await res.json();
                const nodes = data?.data?.Media?.recommendations?.nodes || [];
                
                // 🔥 Filtered out anything where isAdult is true
                setRecommendations(nodes
                    .map((n: any) => n.mediaRecommendation)
                    .filter((r: any) => r && r.id.toString() !== id && r.isAdult !== true)
                    .slice(0, 12)
                );
            } catch (e) {
                setRecommendations([]);
            } finally {
                setRecommendationsLoading(false);
            }
        };
        fetchRecommendations();
    }, [id]);

    useEffect(() => {
        let targetMal = malId;
        if (!targetMal && primarySeason) {
            const explicitMal = (primarySeason as any).idMal;
            if (explicitMal) targetMal = explicitMal;
        }

        if (targetMal && activeEpisode) {
            const epNum = parseInt(activeEpisode.number.toString());
            fetch(`https://api.aniskip.com/v2/skip-times/${targetMal}/${epNum}?types[]=op&types[]=ed`)
                .then(res => res.json())
                .then(data => {
                    if (data.found) {
                        const op = data.results?.find((r: any) => r.skipType === 'op');
                        const ed = data.results?.find((r: any) => r.skipType === 'ed');
                        setSkipTimes({
                            op: op ? { start: op.interval.startTime, end: op.interval.endTime } : null,
                            ed: ed ? { start: ed.interval.startTime, end: ed.interval.endTime } : null
                        });
                    } else {
                        setSkipTimes({ op: null, ed: null });
                    }
                }).catch(() => { setSkipTimes({ op: null, ed: null }); });
        } else {
            setSkipTimes({ op: null, ed: null });
        }
    }, [malId, primarySeason, activeEpisode]);

    // Domains known to block iframes — skip these sources entirely
    const BLOCKED_IFRAME_DOMAINS = ['anidb.app', 'anidb.net', 'kwik.cx', 'kwik.si'];
    const isBlockedSource = (source: any) => {
        if (!source.isIframe) return false;
        try { return BLOCKED_IFRAME_DOMAINS.some(d => new URL(source.url).hostname.includes(d)); }
        catch { return false; }
    };

    const loadSpecificSource = (source: any) => {
        const finalUrl = source.url.includes('?') ? `${source.url}&cb=${Date.now()}` : `${source.url}?cb=${Date.now()}`;
        setStreamData({
            url: finalUrl,
            isIframe: source.isIframe || false,
            isM3U8: source.isM3U8 === true || source.url.includes('.m3u8')
        });
    };

    const triggerFallback = () => {
        setAvailableSources((prevSources) => {
            const nextSources = [...prevSources];
            nextSources.shift();
            if (nextSources.length > 0) {
                console.warn(`[FALLBACK] Engaging alternate player source branch...`);
                loadSpecificSource(nextSources[0]);
                return nextSources;
            } else {
                setStreamError("All streaming providers failed to respond. Upstream CDNs are currently resetting connections.");
                setStreamData(null);
                return [];
            }
        });
    };

    const fallbackRef = useRef(triggerFallback);
    useEffect(() => { fallbackRef.current = triggerFallback; }, [triggerFallback]);

    useEffect(() => {
        let interval: number;
        if (isFetchingStream) {
            setLoadingPhase(0);
            interval = window.setInterval(() => {
                setLoadingPhase(prev => (prev + 1) % 4);
            }, 3000);
        }
        return () => clearInterval(interval);
    }, [isFetchingStream]);

    const getLoadingText = () => {
        switch (loadingPhase) {
            case 0: return "Establishing secure connection...";
            case 1: return "Bypassing upstream security systems...";
            case 2: return "Extracting encrypted video manifest...";
            case 3: return "Initializing player instance...";
            default: return "Loading...";
        }
    };

    // ⚡ FIX 1: Allow the function to accept a forceServer parameter
    const handlePlayEpisode = async (episode: Episode, parentSeasonId: string, forceMode?: 'sub' | 'dub', forceServer?: string) => {
        const modeToUse = forceMode || audioMode;
        const serverToUse = forceServer || activeServer; // Use the requested server

        setActiveEpisode(episode);
        setPlayingSeasonId(parentSeasonId);
        setIsFetchingStream(true);
        setStreamData(null);
        setStreamError(null);
        setShowSettings(false);
        setAvailableSources([]);
        lastSavedTimeRef.current = 0;

        if (hlsInstance) {
            hlsInstance.detachMedia();
            hlsInstance.destroy();
            setHlsInstance(null);
        }
        if (videoRef.current) {
            videoRef.current.pause();
            videoRef.current.removeAttribute('src');
            videoRef.current.load();
        }

        setCurrentTime(0);
        window.history.replaceState(null, '', `/anime/${parentSeasonId}?ep=${encodeURIComponent(episode.id)}`);
        localStorage.setItem(`kuro-last-ep-${parentSeasonId}`, episode.id.toString());

        setTimeout(() => {
            const activeBtn = document.getElementById(`ep-btn-${episode.id}`);
            if (activeBtn) activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }, 300);

        try {
            const STATIC_FRONTEND_MAP: Record<string, string> = {
                "186497": "60852",
                "195333": "61943",
                "21": "21"
            };

            let currentKnownMal = malId;
            if (!currentKnownMal && animeFetchResult?.idMal) {
                currentKnownMal = animeFetchResult.idMal;
            }

            const resolvedTargetMal = currentKnownMal?.toString() || STATIC_FRONTEND_MAP[parentSeasonId] || '';

            const apiUrl = import.meta.env.VITE_API_URL || 'https://kurotv-backend.onrender.com';
            
            // ⚡ FIX 2: Attach the target server to the backend API request
            const backendUrl = `${apiUrl}/anime/zoro/watch/${encodeURIComponent(episode.id)}?lang=${modeToUse}&animeId=${parentSeasonId}&epNum=${episode.number}&malId=${resolvedTargetMal}&server=${encodeURIComponent(serverToUse)}`;

            const res = await fetch(backendUrl);
            const data = await res.json();

            if (data.error || !data.sources || data.sources.length === 0) {
                const message = data.error || "This media segment is undergoing background synchronization from mirror servers. Please try another episode or server.";
                setStreamError(message);
                setIsFetchingStream(false);
                return;
            }

            if (data.intro || data.outro) {
                setSkipTimes({
                    op: data.intro ? { start: data.intro.start, end: data.intro.end } : null,
                    ed: data.outro ? { start: data.outro.start, end: data.outro.end } : null
                });
            }

            const sourcesArray = data.sources || [];
            if (sourcesArray && sourcesArray.length > 0) {
                // Strip known broken iframe domains before touching the player
                const cleanSources = sourcesArray.filter((s: any) => !isBlockedSource(s));

                if (cleanSources.length === 0) {
                    // All sources were blocked iframes — auto-try next server
                    const servers = ['Vidstreaming', 'MegaCloud', 'StreamSB'];
                    const nextServer = servers.find(s => s !== serverToUse);
                    console.warn(`[PLAYER] All sources blocked (anidb/kwik). Auto-switching to ${nextServer}...`);
                    if (nextServer && activeEpisode && parentSeasonId) {
                        setActiveServer(nextServer);
                        handlePlayEpisode(activeEpisode, parentSeasonId, modeToUse, nextServer);
                    } else {
                        setStreamError("No working stream found. Try a different server.");
                    }
                    return;
                }

                const sortedSources = [...cleanSources].sort((a: any, b: any) => {
                    if (!a.isIframe && b.isIframe) return -1;
                    if (a.isIframe && !b.isIframe) return 1;
                    return 0;
                });
                setAvailableSources(sortedSources);
                loadSpecificSource(sortedSources[0]);
            } else {
                setStreamError("No stream sources returned from server.");
            }
        } catch (error) {
            console.error("Failed to fetch stream");
            setStreamError("Remote connection dropped. The playback module is compiling alternate extraction targets.");
        } finally {
            setIsFetchingStream(false);
        }
    };

    // ⚡ FIX 3: Make the server button actually trigger a new API fetch
    const handleServerChange = (srv: string) => {
        if (srv === activeServer) return;
        setActiveServer(srv);
        if (activeEpisode && playingSeasonId) {
            // Actually call the backend to get the new server's video links!
            handlePlayEpisode(activeEpisode, playingSeasonId, audioMode, srv);
        }
    };

    const handleNextEpisode = () => {
        if (!playingSeasonId || !activeEpisode) return;
        const currentActiveSeasonObj = chronologicalSeasons.find(s => s.id === playingSeasonId);
        if (!currentActiveSeasonObj?.episodes) return;

        const currentEpList = currentActiveSeasonObj.episodes;
        const currentIndex = currentEpList.findIndex(ep => ep.id === activeEpisode.id);

        if (currentIndex !== -1 && currentIndex < currentEpList.length - 1) {
            handlePlayEpisode(currentEpList[currentIndex + 1], playingSeasonId);
        }
    };

    useEffect(() => {
        if (!streamData || !videoRef.current || streamData.isIframe) return;
        const video = videoRef.current;
        let hls: Hls | null = null;
        setQualities([]);

        const progressKey = `kuro-progress-${playingSeasonId}-${activeEpisode?.id}`;

        const restoreProgress = () => {
            const savedTime = localStorage.getItem(progressKey);
            if (savedTime) {
                const parsedTime = parseFloat(savedTime);
                if (parsedTime > 0) { video.currentTime = parsedTime; return; }
            }
            video.currentTime = 0;
        };

        if (streamData.isM3U8 && Hls.isSupported()) {
            hls = new Hls({
                xhrSetup: (xhr) => { xhr.withCredentials = false; },
                fragLoadingTimeOut: 20000,
                manifestLoadingTimeOut: 20000,
                levelLoadingTimeOut: 20000,
                fragLoadingMaxRetry: 4,
                manifestLoadingMaxRetry: 4,
                levelLoadingMaxRetry: 4,
                enableWorker: true,
                lowLatencyMode: true
            });

            hls.attachMedia(video);
            hls.on(Hls.Events.MEDIA_ATTACHED, () => { hls!.loadSource(streamData.url); });

            hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
                const parsedQualities = data.levels.map((level, index) => ({ height: level.height, level: index })).reverse();
                setQualities(parsedQualities);
                
                // 🔥 FORCE HIGHEST QUALITY: Stop Hls.js from auto-downgrading
                if (parsedQualities.length > 0) {
                    const highestQuality = parsedQualities[0].level;
                    hls!.currentLevel = highestQuality;
                    setCurrentQuality(highestQuality);
                }
                
                restoreProgress();
                video.play().catch(e => console.warn("Play interrupted:", e));
            });

            hls.on(Hls.Events.ERROR, (_, data) => {
                if (data.fatal) {
                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            console.error(`[HLS] Fatal stream error (${data.details}). Evacuating to next stream node.`);
                            hls!.destroy();
                            fallbackRef.current(); // Instantly skips to the next server
                            break;
                        default:
                            hls!.destroy();
                            fallbackRef.current();
                            break;
                    }
                }
            });

            setHlsInstance(hls);
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = streamData.url;
            video.addEventListener('loadedmetadata', () => {
                restoreProgress();
                video.play().catch(e => console.warn(e));
            }, { once: true });
            video.addEventListener('error', () => { fallbackRef.current(); }, { once: true });
        } else {
            video.src = streamData.url;
            video.addEventListener('loadedmetadata', () => {
                restoreProgress();
                video.play().catch(() => null);
            }, { once: true });
            video.addEventListener('error', () => { fallbackRef.current(); }, { once: true });
        }

        return () => {
            if (hls) { hls.detachMedia(); hls.destroy(); }
            if (video) { video.pause(); video.removeAttribute('src'); video.load(); }
        };
    }, [streamData, playingSeasonId, activeEpisode?.id]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (document.activeElement?.tagName === 'INPUT') return;
            const { volume: v, currentTime: ct, duration: d, isPlaying: p } = playerStateRef.current;

            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'f', ' ', 's', 'S'].includes(e.key)) {
                e.preventDefault();
                setShowControls(true);
                if (controlsTimeoutRef.current) window.clearTimeout(controlsTimeoutRef.current);
                controlsTimeoutRef.current = window.setTimeout(() => {
                    if (playerStateRef.current.isPlaying) { setShowControls(false); setIsMouseActive(false); }
                }, 3000);
            }

            switch (e.key) {
                case 'ArrowRight':
                    if (videoRef.current) videoRef.current.currentTime = Math.min(ct + 5, d);
                    break;
                case 'ArrowLeft':
                    if (videoRef.current) videoRef.current.currentTime = Math.max(ct - 10, 0);
                    break;
                case 'ArrowUp':
                    const newVolUp = Math.min(v + 0.1, 1);
                    setVolume(newVolUp);
                    if (videoRef.current) { videoRef.current.volume = newVolUp; setIsMuted(newVolUp === 0); }
                    break;
                case 'ArrowDown':
                    const newVolDown = Math.max(v - 0.1, 0);
                    setVolume(newVolDown);
                    if (videoRef.current) { videoRef.current.volume = newVolDown; setIsMuted(newVolDown === 0); }
                    break;
                case 'f':
                case 'F':
                    toggleFullscreen();
                    break;
                case ' ':
                    if (videoRef.current) { p ? videoRef.current.pause() : videoRef.current.play(); }
                    break;
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentTime]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video || !activeEpisode || !playingSeasonId) return;

        const currentActiveSeasonObj = chronologicalSeasons.find(s => s.id === playingSeasonId);
        if (!currentActiveSeasonObj) return;

        const progressKey = `kuro-progress-${playingSeasonId}-${activeEpisode.id}`;
        const watchedKey = `kuro-watched-${playingSeasonId}-${activeEpisode.id}`;

        const onTimeUpdate = () => {
            setCurrentTime(video.currentTime);

            if (video.buffered.length > 0) {
                setBufferedEnd(video.buffered.end(video.buffered.length - 1));
            }

            // 🔥 Dropped threshold from 5s to 2s
            if (video.currentTime > 2 && video.duration > 0) {
                if (video.duration - video.currentTime < 30) {
                    localStorage.setItem(watchedKey, 'true');
                    localStorage.removeItem(progressKey);
                    setWatchedEpisodes(prev => {
                        const newSet = new Set(prev);
                        newSet.add(activeEpisode.id.toString());
                        return newSet;
                    });
                } else {
                    localStorage.setItem(progressKey, video.currentTime.toString());

                    // 🔥 Dropped threshold from 10s difference to 4s difference
                    if (user && Math.abs(video.currentTime - lastSavedTimeRef.current) > 4) {
                        lastSavedTimeRef.current = video.currentTime;
                        supabase.from('watch_history').upsert({
                            user_id: user.id,
                            anime_id: playingSeasonId,
                            episode_id: activeEpisode.id.toString(),
                            episode_number: activeEpisode.number,
                            anime_title: currentActiveSeasonObj.title,
                            anime_image: currentActiveSeasonObj.image || currentActiveSeasonObj.bannerImage,
                            progress: video.currentTime,
                            duration: video.duration,
                            updated_at: new Date().toISOString()
                        }, { onConflict: 'user_id, anime_id' }).then(({ error }) => {
                            if (error) console.error("History sync error:", error);
                        });
                    }
                }
            }
        };

        const onLoadedMetadata = () => setDuration(video.duration);
        const onPlay = () => setIsPlaying(true);
        const onPause = () => setIsPlaying(false);

        // 🔥 STALL DETECTOR: If buffering > 5s with no progress, nuke & fallback
        let stallTimer: number | null = null;
        let lastProgressTime = video.currentTime;

        const clearStall = () => {
            if (stallTimer !== null) { window.clearTimeout(stallTimer); stallTimer = null; }
        };

        const onWaiting = () => {
            setIsBuffering(true);
            lastProgressTime = video.currentTime;
            clearStall();
            stallTimer = window.setTimeout(() => {
                // Only fire if currentTime hasn't advanced (genuine stall, not a seek)
                if (Math.abs(video.currentTime - lastProgressTime) < 0.5) {
                    console.warn('[STALL] Stream stalled for 5s with no progress. Evacuating to next source.');
                    fallbackRef.current();
                }
            }, 5000);
        };

        const onPlaying = () => {
            setIsBuffering(false);
            clearStall(); // Progress resumed — cancel the stall timer
        };

        video.addEventListener('timeupdate', onTimeUpdate);
        video.addEventListener('loadedmetadata', onLoadedMetadata);
        video.addEventListener('play', onPlay);
        video.addEventListener('pause', onPause);
        video.addEventListener('waiting', onWaiting);
        video.addEventListener('playing', onPlaying);

        return () => {
            clearStall();
            video.removeEventListener('timeupdate', onTimeUpdate);
            video.removeEventListener('loadedmetadata', onLoadedMetadata);
            video.removeEventListener('play', onPlay);
            video.removeEventListener('pause', onPause);
            video.removeEventListener('waiting', onWaiting);
            video.removeEventListener('playing', onPlaying);
        };
    }, [streamData, playingSeasonId, activeEpisode, user, chronologicalSeasons]);

    const togglePlay = () => {
        if (videoRef.current) { isPlaying ? videoRef.current.pause() : videoRef.current.play(); }
    };

    const toggleMute = () => {
        if (videoRef.current) { videoRef.current.muted = !isMuted; setIsMuted(!isMuted); }
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(e.target.value);
        setVolume(val);
        if (videoRef.current) { videoRef.current.volume = val; setIsMuted(val === 0); }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(e.target.value);
        setCurrentTime(val);
        if (videoRef.current) videoRef.current.currentTime = val;
    };

    const handleSeekHover = (e: React.PointerEvent<HTMLDivElement>) => {
        const rect = seekContainerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const percent = (x / rect.width) * 100;
        setHoverPercent(percent);
        setHoverTime((percent / 100) * (duration || 100));
        setIsHovering(true);
    };

    const handleSeekLeave = () => {
        setIsHovering(false);
    };

    const skipTime = (seconds: number) => {
        if (videoRef.current) videoRef.current.currentTime += seconds;
    };

    const toggleFullscreen = () => {
        if (!playerContainerRef.current) return;
        if (!document.fullscreenElement) {
            playerContainerRef.current.requestFullscreen().catch(err => console.error(err));
            setIsFullscreen(true);
        } else {
            if (document.exitFullscreen) { document.exitFullscreen(); setIsFullscreen(false); }
        }
    };

    const changeQuality = (level: number) => {
        if (hlsInstance) { hlsInstance.currentLevel = level; setCurrentQuality(level); setShowSettings(false); }
    };

    const handleMouseMove = () => {
        setShowControls(true);
        setIsMouseActive(true);
        if (controlsTimeoutRef.current) window.clearTimeout(controlsTimeoutRef.current);
        controlsTimeoutRef.current = window.setTimeout(() => {
            if (playerStateRef.current.isPlaying) { setShowControls(false); setIsMouseActive(false); }
        }, 3000);
    };

    const clickTimerRef = useRef<number | null>(null);
    const handleZoneClick = (e: React.MouseEvent, zone: 'left' | 'center' | 'right') => {
        if (e.detail === 1) {
            clickTimerRef.current = window.setTimeout(() => { togglePlay(); }, 250);
        } else if (e.detail === 2) {
            if (clickTimerRef.current) window.clearTimeout(clickTimerRef.current);
            if (zone === 'left') skipTime(-10);
            else if (zone === 'center') toggleFullscreen();
            else if (zone === 'right') skipTime(10);
        }
    };

    const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
    const bufferedPercent = duration > 0 ? (bufferedEnd / duration) * 100 : 0;
    const currentPlayingSeasonObj = chronologicalSeasons.find(s => s.id === playingSeasonId) || primarySeason;

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-accent animate-spin" />
            </div>
        );
    }

    if (error || chronologicalSeasons.length === 0) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <h2 className="text-lg font-bold text-muted">Error Loading Anime Details</h2>
            </div>
        );
    }

    return (
        <div className="w-full min-h-screen pt-20 md:pt-24 pb-12 px-3 sm:px-6 md:px-8">
            <div className="max-w-[1500px] mx-auto">

                <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wider text-muted mb-4 md:mb-5 uppercase overflow-x-auto scrollbar-hide whitespace-nowrap">
                    <button onClick={() => navigate(-1)} className="flex items-center hover:text-fg transition-colors cursor-pointer shrink-0">
                        <ArrowLeft className="w-3 h-3 mr-1" /> Back
                    </button>
                    <span className="text-border shrink-0">/</span>
                    <span className="shrink-0">{primarySeason?.type || "TV Series"}</span>
                    <span className="text-border shrink-0">/</span>
                    <span className="text-fg truncate">Watching <span className="text-accent">{primarySeason?.title}</span></span>
                </div>

                <div className="flex flex-col xl:flex-row gap-6 md:gap-8 items-start">
                    <div className="flex-1 min-w-0 w-full">

                        <div className="bg-surface border border-border rounded-xl md:rounded-2xl p-2 md:p-4 mb-6 transition-transform duration-300" data-reveal>
                            <div
                                ref={playerContainerRef}
                                className={`w-full aspect-video bg-black relative rounded-xl md:rounded-2xl overflow-hidden flex items-center justify-center border border-border group ${!isMouseActive && isPlaying ? 'cursor-none [&_*]:cursor-none' : ''}`}
                                onMouseMove={handleMouseMove}
                                onMouseLeave={() => { if (isPlaying) { setShowControls(false); setIsMouseActive(false); } }}
                            >
                                {streamError ? (
                                    <div className="flex flex-col items-center justify-center w-full h-full bg-black z-50 p-6 text-center">
                                        <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3 border border-danger/30 bg-danger/10">
                                            <span className="text-danger font-bold text-lg">!</span>
                                        </div>
                                        <h3 className="text-sm font-semibold text-white mb-1">Stream Unavailable</h3>
                                        <p className="text-xs text-white/60 max-w-md">{streamError}</p>
                                    </div>
                                ) : streamData ? (
                                    <div className="w-full h-full relative">
                                        {streamData.isIframe ? (
                                            <iframe
                                                src={streamData.url}
                                                className="w-full h-full border-0 absolute inset-0 z-10 bg-black"
                                                allowFullScreen
                                                allow="autoplay; encrypted-media"
                                            ></iframe>
                                        ) : (
                                            <>
                                                <video
                                                    ref={videoRef}
                                                    playsInline
                                                    className="w-full h-full bg-black outline-none"
                                                    style={{ objectFit: 'contain' }}
                                                />

                                                <div className={`absolute top-0 left-0 w-1/4 h-full z-10 ${!isMouseActive && isPlaying ? 'cursor-none' : 'cursor-pointer'}`} onClick={(e) => handleZoneClick(e, 'left')}></div>
                                                <div className={`absolute top-0 left-1/4 w-2/4 h-full z-10 ${!isMouseActive && isPlaying ? 'cursor-none' : 'cursor-pointer'}`} onClick={(e) => handleZoneClick(e, 'center')}></div>
                                                <div className={`absolute top-0 right-0 w-1/4 h-full z-10 ${!isMouseActive && isPlaying ? 'cursor-none' : 'cursor-pointer'}`} onClick={(e) => handleZoneClick(e, 'right')}></div>

                                                {isBuffering && (
                                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 z-20 pointer-events-none">
                                                        <Loader2 className="w-12 h-12 text-accent animate-spin" />
                                                    </div>
                                                )}

                                                <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent pt-10 md:pt-14 pb-3 md:pb-4 px-3 md:px-5 z-40 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                                                    <div className="w-full flex items-center mb-2 pointer-events-auto">
                                                        <div ref={seekContainerRef} className="relative w-full h-6 md:h-5 flex items-center cursor-pointer group/seek"
                                                            onPointerMove={handleSeekHover}
                                                            onPointerLeave={handleSeekLeave}>
                                                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 rounded-full bg-white/10 overflow-hidden pointer-events-none">
                                                                <div className="h-full bg-white/20 rounded-full transition-all duration-150" style={{ width: `${bufferedPercent}%` }} />
                                                            </div>
                                                            <input type="range" min="0" max={duration || 100} value={currentTime} onChange={handleSeek}
                                                                className="relative z-10 w-full h-1 appearance-none outline-none rounded-full cursor-pointer hover:h-1.5 transition-all [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:rounded-full"
                                                                style={{ background: `linear-gradient(to right, #fff ${progressPercent}%, rgba(255,255,255,0.2) ${progressPercent}%)` }} />
                                                            {isHovering && (
                                                                <div className="absolute -top-8 left-0 -translate-x-1/2 pointer-events-none z-20 bg-black/90 text-white text-[10px] font-mono px-1.5 py-0.5 rounded shadow-lg border border-white/10"
                                                                    style={{ left: `${hoverPercent}%` }}>
                                                                    {formatTime(hoverTime)}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center justify-between pointer-events-auto">
                                                        <div className="flex items-center gap-2 md:gap-4">
                                                            <button onClick={togglePlay} className="text-white hover:text-accent transition-colors cursor-pointer p-1 -ml-1">
                                                                {isPlaying ? <Pause className="w-5 h-5 md:w-5 md:h-5 fill-current" /> : <Play className="w-5 h-5 md:w-5 md:h-5 fill-current ml-0.5" />}
                                                            </button>
                                                            <div className="flex items-center gap-1.5 md:gap-2.5">
                                                                <button onClick={() => skipTime(-10)} className="text-white/70 hover:text-white transition-colors cursor-pointer p-1"><RotateCcw className="w-4 h-4" /></button>
                                                                <button onClick={() => skipTime(10)} className="text-white/70 hover:text-white transition-colors cursor-pointer p-1"><RotateCw className="w-4 h-4" /></button>
                                                            </div>
                                                            <div className="flex items-center gap-1.5 group/volume">
                                                                <button onClick={toggleMute} className="text-white/70 hover:text-white transition-colors cursor-pointer">
                                                                    {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                                                                </button>
                                                                <input type="range" min="0" max="1" step="0.05" value={isMuted ? 0 : volume} onChange={handleVolumeChange}
                                                                    className="hidden md:block w-0 opacity-0 group-hover/volume:w-14 group-hover/volume:opacity-100 transition-all duration-300 h-1 accent-white appearance-none bg-white/30 rounded-full cursor-pointer" />
                                                            </div>
                                                            <span className="text-[11px] font-semibold font-mono tracking-wider text-white/80 pointer-events-none">
                                                                {formatTime(currentTime)} <span className="text-white/30 mx-0.5">/</span> {formatTime(duration)}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-4">
                                                            <div className="relative">
                                                                <button onClick={() => setShowSettings(!showSettings)} className={`text-white/70 hover:text-white transition-transform cursor-pointer ${showSettings ? 'rotate-90 text-accent' : ''}`}>
                                                                    <Settings className="w-4 h-4" />
                                                                </button>
                                                                {showSettings && (
                                                                    <div className="absolute bottom-8 right-0 w-36 bg-black/90 backdrop-blur-xl border border-white/10 rounded-xl p-1.5 flex flex-col gap-1 pointer-events-auto">
                                                                        <span className="text-[9px] font-semibold text-white/50 px-2 py-1 uppercase tracking-wider">Quality</span>
                                                                        {qualities.length > 0 ? (
                                                                            <>
                                                                                <button onClick={() => changeQuality(-1)} className={`text-[11px] font-medium text-left px-3 py-1.5 rounded hover:bg-white/10 flex justify-between cursor-pointer ${currentQuality === -1 ? 'text-accent' : 'text-white'}`}>Auto {currentQuality === -1 && <Check className="w-3 h-3" />}</button>
                                                                                {qualities.map(q => (
                                                                                    <button key={q.level} onClick={() => changeQuality(q.level)} className={`text-xs font-bold text-left px-3 py-2 rounded-md hover:bg-white/10 flex justify-between cursor-pointer ${currentQuality === q.level ? 'text-accent' : 'text-white'}`}>
                                                                                        {q.height}p {currentQuality === q.level && <Check className="w-3 h-3" />}
                                                                                    </button>
                                                                                ))}
                                                                            </>
                                                                        ) : (
                                                                            <button className="text-xs font-bold text-left px-3 py-2 rounded-md flex justify-between text-accent-dim cursor-default">Default (Source) <Check className="w-3 h-3" /></button>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            {/* 🔥 NEW FULLSCREEN BUTTON */}
                                                            <button onClick={toggleFullscreen} className="text-white/70 hover:text-white transition-colors cursor-pointer ml-1">
                                                                {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ) : isFetchingStream ? (
                                    <div className="flex flex-col items-center justify-center w-full h-full bg-black z-50">
                                        <Loader2 className="w-8 h-8 text-accent animate-spin mb-3" />
                                        <p className="text-[10px] font-semibold tracking-wider text-accent uppercase animate-pulse">{getLoadingText()}</p>
                                    </div>
                                ) : (
                                    <>
                                        <img src={currentPlayingSeasonObj?.bannerImage || currentPlayingSeasonObj?.image} alt="" className="absolute inset-0 w-full h-full object-cover opacity-10" />
                                        <div className="absolute inset-0 bg-black/40" />
                                        <div className="z-10 flex flex-col items-center gap-3">
                                            <Play className="w-12 h-12 text-muted" />
                                            {currentPlayingSeasonObj?.episodes && currentPlayingSeasonObj.episodes.length > 0 ? (
                                                <button onClick={() => handlePlayEpisode(currentPlayingSeasonObj.episodes![0], currentPlayingSeasonObj.id)} className="bg-accent hover:bg-accent-dim text-white px-8 py-2.5 rounded-xl font-semibold text-xs tracking-wider uppercase transition-colors cursor-pointer shadow-sm">Watch Episode 1</button>
                                            ) : (
                                                <span className="text-xs text-muted font-medium uppercase tracking-wider border border-border px-8 py-2.5 rounded-xl">Transmission Pending</span>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="flex flex-col md:flex-row gap-3 md:gap-4 mt-4 px-0 md:px-2 items-center justify-between">
                                <p className="text-xs text-muted text-center md:text-left">Watching <span className="text-accent font-semibold">{currentPlayingSeasonObj?.title}</span> <span className="text-fg font-semibold ml-1">Episode {activeEpisode?.number || 1}</span></p>
                                <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4">
                                    <div className="flex items-center gap-2">
                                        <span className="kicker hidden sm:inline">Audio:</span>
                                        <div className="flex bg-surface p-0.5 rounded-md border border-border">
                                            <button onClick={() => { setAudioMode('sub'); if (activeEpisode && playingSeasonId) handlePlayEpisode(activeEpisode, playingSeasonId, 'sub'); }} className={`px-3 py-1 text-[10px] font-semibold rounded transition-colors cursor-pointer ${audioMode === 'sub' ? 'bg-accent text-white' : 'text-muted hover:text-fg'}`}>SUB</button>
                                            <button onClick={() => { setAudioMode('dub'); if (activeEpisode && playingSeasonId) handlePlayEpisode(activeEpisode, playingSeasonId, 'dub'); }} className={`px-3 py-1 text-[10px] font-semibold rounded transition-colors cursor-pointer ${audioMode === 'dub' ? 'bg-accent text-white' : 'text-muted hover:text-fg'}`}>DUB</button>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="kicker hidden sm:inline">Server:</span>
                                        <div className="flex gap-1.5 flex-wrap justify-center">
                                            {['Vidstreaming', 'MegaCloud', 'StreamSB'].map(srv => (
                                                <button key={srv} onClick={() => handleServerChange(srv)} className={`px-2.5 md:px-3 py-1 rounded text-[10px] font-semibold transition-colors cursor-pointer ${activeServer === srv ? 'bg-accent text-white' : 'bg-surface border border-border text-muted hover:text-fg'}`}>{srv}</button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {chronologicalSeasons.map((seasonObj) => {
                            if (playingSeasonId !== seasonObj.id) return null;
                            const seasonEps = seasonObj.episodes || [];
                            return (
                                <div key={`chrono-ep-block-${seasonObj.id}`} className="bg-surface border border-border rounded-2xl p-5 mb-6 transition-transform duration-300" data-reveal>
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="flex-1 h-px bg-border"></div>
                                        <h3 className="text-xs font-semibold tracking-wider text-fg uppercase">Episodes</h3>
                                        <div className="flex-1 h-px bg-border"></div>
                                    </div>
                                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-1.5 max-h-[280px] overflow-y-auto pr-1">
                                        {seasonEps.length > 0 ? (
                                            seasonEps.map((ep) => {
                                                const isWatched = watchedEpisodes.has(ep.id.toString());
                                                const isActive = activeEpisode?.id?.toString() === ep.id.toString();
                                                return (
                                                    <button key={`ep-grid-btn-${ep.id}`} id={isActive ? `ep-btn-${ep.id}` : undefined} onClick={() => handlePlayEpisode(ep, seasonObj.id)}
                                                        className={`relative h-9 rounded border transition-all duration-200 flex items-center justify-center font-semibold text-xs cursor-pointer ${isActive ? 'bg-accent border-accent text-white z-10' : isWatched ? 'bg-surface border-border text-muted hover:text-fg' : 'bg-surface border-border text-muted hover:border-muted'}`}>
                                                        {ep.number}
                                                        {isWatched && !isActive && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-border" />}
                                                        {isActive && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-white/40" />}
                                                    </button>
                                                );
                                            })
                                        ) : (
                                            <div className="col-span-full py-8 text-center text-muted text-xs font-semibold uppercase">Transmission Pending</div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        {animeFetchResult?.relations && animeFetchResult.relations.length > 0 && (
                            <div className="bg-surface border border-border rounded-2xl p-5 mb-6 transition-transform duration-300" data-reveal>
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="flex-1 h-px bg-border"></div>
                                    <h3 className="text-xs font-semibold tracking-wider text-fg uppercase">Related Seasons & Media</h3>
                                    <div className="flex-1 h-px bg-border"></div>
                                </div>
                                <div className="flex gap-2 overflow-x-auto md:grid md:grid-cols-2 lg:grid-cols-4 scrollbar-hide pb-1">
                                    {animeFetchResult.relations.map((rel: Relation) => (
                                        <button key={rel.id} onClick={() => navigate(`/anime/${rel.id}`)} className="flex items-start gap-2.5 p-2.5 bg-surface hover:bg-bg border border-border rounded-xl transition-all text-left cursor-pointer group shrink-0 w-[240px] md:w-auto">
                                            <img src={rel.image} alt={rel.title} className="w-11 h-15 object-cover rounded shrink-0" />
                                            <div className="flex flex-col min-w-0 flex-1 justify-between py-0.5">
                                                <div>
                                                    <span className="kicker block mb-0.5">{rel.relationType?.replace('_', ' ')}</span>
                                                    <h4 className="text-[11px] font-medium text-muted group-hover:text-fg line-clamp-2 leading-snug mb-1">{rel.title}</h4>
                                                </div>
                                                <span className="text-[8px] font-semibold text-muted bg-surface px-1.5 py-0.5 rounded w-fit uppercase tracking-wider">{rel.type || 'TV'}</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex flex-col gap-6">
                            {chronologicalSeasons.map((seasonObj) => {
                                if (playingSeasonId !== seasonObj.id) return null;
                                return (
                                    <div key={`chrono-block-${seasonObj.id}`} className="bg-surface border border-border rounded-2xl p-5 transition-transform duration-300" data-reveal>
                                        <div className="flex flex-col sm:flex-row gap-5 items-start">
                                            <div className="w-full sm:w-[150px] shrink-0 aspect-[2/3] rounded-xl overflow-hidden border border-border">
                                                <img src={seasonObj.image} alt={seasonObj.title} className="w-full h-full object-cover" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="text-lg font-bold text-fg mb-2 leading-tight font-display">{seasonObj.title}</h3>
                                                <p className="text-muted text-xs leading-relaxed line-clamp-3 mb-3">{seasonObj.description?.replace(/<[^>]*>/g, '') || "No synopsis available."}</p>
                                                <div className="grid grid-cols-2 gap-x-5 gap-y-1.5 text-xs bg-bg p-3 rounded-xl border border-border">
                                                    <div className="flex gap-1.5"><span className="font-medium text-muted">Status:</span><span className="text-fg">{seasonObj.status}</span></div>
                                                    <div className="flex gap-1.5"><span className="font-medium text-muted">Aired:</span><span className="text-fg">{seasonObj.releaseDate}</span></div>
                                                    <div className="flex gap-1.5"><span className="font-medium text-muted">Score:</span><span className="text-fg flex items-center gap-1"><Star className="w-3 h-3 text-yellow-500 fill-yellow-500" /> {seasonObj.rating}</span></div>
                                                    <div className="flex gap-1.5"><span className="font-medium text-muted">Episodes:</span><span className="text-fg">{seasonObj.episodes?.length || '--'}</span></div>
                                                </div>
                                                <div className="flex flex-wrap gap-1.5 mt-2.5">
                                                    {seasonObj.genres?.map(genre => <span key={genre} className="text-[9px] border border-border bg-surface text-muted px-2 py-0.5 rounded uppercase tracking-wider">{genre}</span>)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="mt-6 flex items-center justify-start">
                            <button onClick={toggleWatchlist} disabled={watchlistLoading}
                                className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl transition-all border font-semibold text-xs uppercase tracking-wider cursor-pointer ${isInWatchlist ? 'bg-accent text-white border-accent hover:bg-danger hover:border-danger' : 'bg-surface text-fg border-border hover:bg-surface hover:text-fg hover:border-muted shadow-sm'}`}>
                                {watchlistLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bookmark className={`w-4 h-4 ${isInWatchlist ? 'fill-current' : ''}`} />}
                                {isInWatchlist ? 'Remove from List' : 'Add to List'}
                            </button>
                        </div>

                    </div>

                    <div className="w-full xl:w-[340px] shrink-0 -mx-3 sm:mx-0" data-reveal>
                        <div className="xl:sticky xl:top-24 bg-surface border-0 xl:border border-border rounded-none xl:rounded-2xl overflow-hidden transition-transform duration-300">
                            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                                <h3 className="text-xs font-semibold tracking-wider text-fg uppercase">You Might Also Like</h3>
                                {recommendations.length > 0 && <span className="text-[10px] font-semibold text-accent bg-accent/10 px-2 py-0.5 rounded-full">{recommendations.length}</span>}
                            </div>
                            {/* Mobile: horizontal scroll row */}
                            <div className="xl:hidden overflow-x-auto scrollbar-hide -mx-3 px-3 pb-2">
                                <div className="flex gap-3">
                                    {recommendationsLoading ? (
                                        <div className="flex items-center justify-center w-full py-6"><Loader2 className="w-4 h-4 text-accent animate-spin" /></div>
                                    ) : recommendations.length === 0 ? (
                                        <div className="text-center text-xs text-muted font-semibold uppercase tracking-wider py-6 w-full">No recommendations</div>
                                    ) : (
                                        recommendations.slice(0, 8).map((rec) => (
                                            <a key={rec.id} href={`/anime/${rec.id}`} onClick={(e) => { e.preventDefault(); navigate(`/anime/${rec.id}`); }} className="flex gap-2.5 p-2.5 bg-surface border border-border rounded-xl hover:bg-bg transition-colors cursor-pointer group shrink-0 w-[220px]">
                                                <div className="relative w-[50px] h-[70px] shrink-0 rounded-md overflow-hidden border border-border">
                                                    <img src={rec.coverImage.large} alt={rec.title.english || rec.title.romaji} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                                </div>
                                                <div className="flex flex-col justify-between flex-1 min-w-0 py-0.5">
                                                    <div>
                                                        <h4 className="text-[10px] font-medium text-muted group-hover:text-fg transition-colors line-clamp-2 leading-snug mb-1">{rec.title.english || rec.title.romaji}</h4>
                                                        <span className="text-[8px] font-semibold bg-surface text-muted px-1.5 py-0.5 rounded uppercase tracking-wider">{rec.type}</span>
                                                    </div>
                                                    {rec.averageScore && <div className="flex items-center gap-1 mt-1"><Star className="w-2.5 h-2.5 text-yellow-500 fill-yellow-500" /><span className="text-[9px] font-semibold text-muted">{rec.averageScore}</span></div>}
                                                </div>
                                            </a>
                                        ))
                                    )}
                                </div>
                            </div>
                            {/* Desktop: vertical list */}
                            <div className="hidden xl:flex flex-col divide-y divide-border overflow-y-auto max-h-[calc(100vh-160px)] scrollbar-hide">
                                {recommendationsLoading ? (
                                    <div className="py-10 flex flex-col items-center justify-center gap-2">
                                        <Loader2 className="w-4 h-4 text-accent animate-spin" />
                                        <span className="text-[10px] font-semibold text-muted uppercase tracking-wider">Loading...</span>
                                    </div>
                                ) : recommendations.length === 0 ? (
                                    <div className="py-10 text-center text-xs text-muted font-semibold uppercase tracking-wider">No recommendations</div>
                                ) : (
                                    recommendations.map((rec) => (
                                        <a key={rec.id} href={`/anime/${rec.id}`} onClick={(e) => { e.preventDefault(); navigate(`/anime/${rec.id}`); }} className="flex gap-3 p-3 hover:bg-bg transition-colors cursor-pointer group">
                                            <div className="relative w-[70px] h-[96px] shrink-0 rounded-md overflow-hidden border border-border">
                                                <img src={rec.coverImage.large} alt={rec.title.english || rec.title.romaji} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                            </div>
                                            <div className="flex flex-col justify-between flex-1 min-w-0 py-0.5">
                                                <div>
                                                    <h4 className="text-[11px] font-medium text-muted group-hover:text-fg transition-colors line-clamp-2 leading-snug mb-1.5">{rec.title.english || rec.title.romaji}</h4>
                                                    <span className="text-[8px] font-semibold bg-surface text-muted px-1.5 py-0.5 rounded uppercase tracking-wider">{rec.type}</span>
                                                </div>
                                                {rec.averageScore && <div className="flex items-center gap-1 mt-1.5"><Star className="w-3 h-3 text-yellow-500 fill-yellow-500" /><span className="text-[10px] font-semibold text-muted">{rec.averageScore}</span></div>}
                                            </div>
                                        </a>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}