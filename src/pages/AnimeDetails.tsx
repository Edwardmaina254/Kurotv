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

    const [streamData, setStreamData] = useState<{ url: string; isIframe: boolean; isM3U8?: boolean } | null>(null);
    const [isFetchingStream, setIsFetchingStream] = useState(false);
    const [streamError, setStreamError] = useState<string | null>(null);

    const [audioMode, setAudioMode] = useState<'sub' | 'dub'>(
        (localStorage.getItem('kuro-default-audio') as 'sub' | 'dub') || 'sub'
    );
    const [activeServer, setActiveServer] = useState('Vidstreaming');
    const [hlsInstance, setHlsInstance] = useState<Hls | null>(null);
    const [qualities, setQualities] = useState<{ height: number; level: number }[]>([]);
    const [currentQuality, setCurrentQuality] = useState<number>(-1);
    const [showSettings, setShowSettings] = useState(false);

    const [autoPlay, setAutoPlay] = useState<boolean>(() => localStorage.getItem('kuro-auto-play') !== 'false');
    const [autoSkip, setAutoSkip] = useState<boolean>(() => localStorage.getItem('kuro-auto-skip') === 'true');
    const [autoNext, setAutoNext] = useState<boolean>(() => localStorage.getItem('kuro-auto-next') !== 'false');

    const toggleSetting = (key: string, currentVal: boolean, setter: React.Dispatch<React.SetStateAction<boolean>>) => {
        const newVal = !currentVal;
        setter(newVal);
        localStorage.setItem(key, newVal.toString());
    };

    const [skipTimes, setSkipTimes] = useState<{ op: { start: number, end: number } | null, ed: { start: number, end: number } | null }>({ op: null, ed: null });

    const bingeSettingsRef = useRef({ autoPlay, autoSkip, autoNext, skipTimes });
    useEffect(() => {
        bingeSettingsRef.current = { autoPlay, autoSkip, autoNext, skipTimes };
    }, [autoPlay, autoSkip, autoNext, skipTimes]);

    const videoRef = useRef<HTMLVideoElement>(null);
    const playerContainerRef = useRef<HTMLDivElement>(null);
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

    const controlsTimeoutRef = useRef<number | null>(null);
    const lastSavedTimeRef = useRef<number>(0);

    const playerStateRef = useRef({ volume, currentTime, duration, isPlaying });
    useEffect(() => {
        playerStateRef.current = { volume, currentTime, duration, isPlaying };
    }, [volume, currentTime, duration, isPlaying]);

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
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3005';

            try {
                const initialInfoRes = await fetch(`${apiUrl}/anime/zoro/info/${id}`).catch(() => null);
                const initialInfo = initialInfoRes && initialInfoRes.ok ? await initialInfoRes.json() : null;
                setAnimeFetchResult(initialInfo);
                if (!initialInfo || !initialInfo.title) {
                    setError("Anime data not found.");
                    setLoading(false);
                    return;
                }

                const relatedIds = (initialInfo.relations || [])
                    .map((r: Relation) => parseInt(r.id.toString()))
                    .filter((n: number) => !isNaN(n));

                const titleLower = (initialInfo.title || '').toLowerCase();

                const chainCollected = new Set<number>([parseInt(id), ...relatedIds]);

                const isJojoContext = titleLower.includes('jojo') ||
                    titleLower.includes('phantom blood') ||
                    titleLower.includes('stardust crusaders') ||
                    titleLower.includes('diamond is unbreakable') ||
                    titleLower.includes('golden wind') ||
                    titleLower.includes('stone ocean') ||
                    titleLower.includes('steel ball run');

                const isMhaContext = titleLower.includes('my hero academia') ||
                    titleLower.includes('boku no hero academia');

                if (isJojoContext) {
                    [14719, 20474, 20799, 21440, 36361, 102883, 127720, 131586, 163262].forEach(fid => chainCollected.add(fid));
                } else if (titleLower.includes('attack on titan') || titleLower.includes('shingeki no kyojin')) {
                    [16498, 20958, 99147, 104578, 110277, 131681, 142856].forEach(fid => chainCollected.add(fid));
                } else if (titleLower.includes('demon slayer') || titleLower.includes('kimetsu no yaiba')) {
                    [101922, 127230, 121031, 128851, 142329, 166240, 171424].forEach(fid => chainCollected.add(fid));
                } else if (isMhaContext) {
                    [21459, 21856, 100166, 104276, 117193, 139630, 163139, 182896].forEach(fid => chainCollected.add(fid));
                }

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

                await new Promise(res => setTimeout(res, 350));

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

                const compiledSeasons: ExtendedAnimeDetails[] = rawMediaNodes.map((m: any) => {
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
                        _sortScore: sortScore
                    };
                });

                let isolatedSeasons = compiledSeasons;
                if (isJojoContext) {
                    isolatedSeasons = compiledSeasons.filter(s => {
                        if (s.id.toString() === id) return true;
                        const t = (s.title || '').toLowerCase();
                        return t.includes('jojo') ||
                            t.includes('phantom blood') ||
                            t.includes('stardust') ||
                            t.includes('diamond is unbreakable') ||
                            t.includes('golden wind') ||
                            t.includes('stone ocean') ||
                            t.includes('steel ball run') ||
                            t.includes('kishibe rohan');
                    });
                } else if (titleLower.includes('attack on titan') || titleLower.includes('shingeki no kyojin')) {
                    isolatedSeasons = compiledSeasons.filter(s => {
                        if (s.id.toString() === id) return true;
                        const t = (s.title || '').toLowerCase();
                        return t.includes('attack on titan') || t.includes('shingeki no kyojin');
                    });
                } else if (titleLower.includes('demon slayer') || titleLower.includes('kimetsu no yaiba')) {
                    isolatedSeasons = compiledSeasons.filter(s => {
                        if (s.id.toString() === id) return true;
                        const t = (s.title || '').toLowerCase();
                        return t.includes('demon slayer') || t.includes('kimetsu no yaiba');
                    });
                } else if (isMhaContext) {
                    const mhaIds = new Set(['21459', '21856', '100166', '104276', '117193', '139630', '163139', '182896']);
                    isolatedSeasons = compiledSeasons.filter(s =>
                        mhaIds.has(s.id.toString()) || (s.title || '').toLowerCase().includes('hero academia')
                    );
                } else if (titleLower.includes('wistoria') || titleLower.includes('tsue to tsurugi')) {
                    isolatedSeasons = compiledSeasons.filter(s => {
                        if (s.id.toString() === id) return true;
                        const t = (s.title || '').toLowerCase();
                        return t.includes('wistoria') || t.includes('tsue to tsurugi');
                    });
                } else if (titleLower.includes('mashle')) {
                    const mashleIds = new Set(['150672', '163132']);
                    isolatedSeasons = compiledSeasons.filter(s =>
                        mashleIds.has(s.id.toString()) || (s.title || '').toLowerCase().includes('mashle')
                    );
                } else if (
                    titleLower.includes('one punch') ||
                    titleLower.includes('one-punch') ||
                    titleLower.includes('onepunch') ||
                    titleLower.includes('wan panchi')
                ) {
                    const opmIds = new Set(['21087', '97668']);
                    isolatedSeasons = compiledSeasons.filter(s =>
                        opmIds.has(s.id.toString()) || s.id.toString() === id
                    );
                }

                isolatedSeasons.sort((a: any, b: any) => a._sortScore - b._sortScore);

                const ID_OVERRIDES: Record<number, string> = {
                    14719: 'Season 1',
                    20474: 'Season 2 Part 1',
                    20799: 'Season 2 Part 2',
                    21440: 'Season 3',
                    36361: 'Season 4',
                    102883: 'Season 5 Part 1',
                    127720: 'Season 5 Part 2',
                    131586: 'Season 6 Part 1',
                    163262: 'Season 6 Part 2',
                    16498: 'Season 1',
                    20958: 'Season 2',
                    99147: 'Season 3 Part 1',
                    104578: 'Season 3 Part 2',
                    110277: 'Season 4 Part 1',
                    131681: 'Season 4 Part 2',
                    142856: 'Season 4 Part 3',
                    101922: 'Season 1',
                    127230: 'Season 2 Part 1',
                    121031: 'Season 2 Part 2',
                    128851: 'Season 3',
                    142329: 'Season 4',
                    166240: 'Season 5 Part 1',
                    171424: 'Season 5 Part 2',
                    21087: 'Season 1',
                    97668: 'Season 2',
                    108465: 'Season 1',
                    133632: 'Season 2 Part 1',
                    145139: 'Season 2 Part 2',
                    79120: 'Season 1',
                    108632: 'Season 2 Part 1',
                    116193: 'Season 2 Part 2',
                    136456: 'Season 3',
                    101280: 'Season 1',
                    112707: 'Season 2 Part 1',
                    118456: 'Season 2 Part 2',
                    29803: 'Season 1',
                    98426: 'Season 2',
                    101347: 'Season 3',
                    120725: 'Season 4',
                    20583: 'Season 1',
                    20954: 'Season 2',
                    23273: 'Season 3',
                    99426: 'Season 4 Part 1',
                    110939: 'Season 4 Part 2',
                    11757: 'Season 1',
                    20594: 'Season 2',
                    21881: 'Season 3 Part 1',
                    98706: 'Season 3 Part 2',
                    105749: 'Season 2',
                    177634: 'Season 3',
                    269: 'Season 1',
                    41461: 'Thousand Year Blood War Part 1',
                    145064: 'Thousand Year Blood War Part 2',
                    166922: 'Thousand Year Blood War Part 3',
                    150672: 'Season 1',
                    163132: 'Season 2',
                    97940: 'Season 1',
                    237: 'Season 1',
                    9760: 'Season 2',
                    101348: 'Season 1',
                    136430: 'Season 2',
                    140960: 'Season 1 Part 1',
                    148110: 'Season 1 Part 2',
                    161645: 'Season 2',
                    130003: 'Season 1',
                    127526: 'Season 1',
                    154587: 'Season 1',
                    153518: 'Season 1',
                    145439: 'Season 1',
                    170942: 'Season 2',
                    21459: 'Season 1',
                    21856: 'Season 2',
                    100166: 'Season 3',
                    104276: 'Season 4',
                    117193: 'Season 5',
                    139630: 'Season 6',
                    163139: 'Season 7',
                    182896: 'Season 8'
                };

                isolatedSeasons.forEach(s => {
                    const numericId = parseInt(s.id.toString());
                    const fmt = (s.type || '').toUpperCase();
                    if (['MOVIE', 'OVA', 'MUSIC'].includes(fmt)) return;
                    if (ID_OVERRIDES[numericId] !== undefined) {
                        s._shortLabel = ID_OVERRIDES[numericId];
                        s._franchiseOverride = true;
                        s.type = 'TV';
                    }
                });

                const mainline: ExtendedAnimeDetails[] = [];
                const extras: ExtendedAnimeDetails[] = [];

                isolatedSeasons.forEach(s => {
                    const fmt = (s.type || '').toUpperCase();
                    if (fmt === 'MOVIE') { s._shortLabel = 'Movie'; extras.push(s); }
                    else if (['OVA', 'SPECIAL', 'ONA', 'MUSIC'].includes(fmt)) {
                        s._shortLabel = fmt === 'OVA' ? 'OVA' : fmt === 'ONA' ? 'ONA' : 'Special';
                        extras.push(s);
                    } else {
                        mainline.push(s);
                    }
                });

                mainline.sort((a: any, b: any) => a._sortScore - b._sortScore);

                let rollingSeasonNumber = 1;
                mainline.forEach((s) => {
                    if (s._franchiseOverride && s._shortLabel) {
                        const extractedNumMatch = s._shortLabel.match(/Season\s*(\d+)/i);
                        if (extractedNumMatch) {
                            rollingSeasonNumber = parseInt(extractedNumMatch[1], 10) + 1;
                        }
                    } else {
                        s._shortLabel = `Season ${rollingSeasonNumber}`;
                        rollingSeasonNumber++;
                    }
                });

                extras.sort((a: any, b: any) => a._sortScore - b._sortScore);
                const allMainline = mainline;

                const combined = [...allMainline, ...extras];
                let pruned = combined.filter(s => {
                    if (s.id.toString() === id) return true;
                    return (s.episodes || []).length > 0;
                });

                if (pruned.length === 0) pruned = combined;

                const finalOrdered = pruned;

                if (cancelRef.cancelled) return;
                setChronologicalSeasons(finalOrdered);
                setLoading(false);

                if (cancelRef.cancelled) return;
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
                    for (const s of isolatedSeasons) {
                        const found = (s.episodes || []).find(e => e.id.toString() === epFromUrl.toString());
                        if (found) { targetEpToPlay = found; seasonContextId = s.id; break; }
                    }
                }

                if (!targetEpToPlay) {
                    const { data: sessionData } = await supabase.auth.getSession();
                    if (cancelRef.cancelled) return;
                    const currentUser = sessionData?.session?.user;
                    if (currentUser) {
                        const { data } = await supabase.from('watch_history').select('episode_id, anime_id').eq('user_id', currentUser.id).eq('anime_id', id.toString()).maybeSingle();
                        if (cancelRef.cancelled) return;
                        if (data && data.episode_id) {
                            const foundSeason = isolatedSeasons.find(s => s.id.toString() === data.anime_id?.toString()) || isolatedSeasons.find(s => s.id.toString() === id);
                            if (foundSeason) {
                                const foundEp = (foundSeason.episodes || []).find(e => e.id.toString() === data.episode_id?.toString());
                                if (foundEp) { targetEpToPlay = foundEp; seasonContextId = foundSeason.id; }
                            }
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
                    console.error("Chronological compilation failed:", err);
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
                            recommendations(page: 1, perPage: 12) {
                                nodes {
                                    mediaRecommendation {
                                        id title { english romaji } coverImage { large } averageScore type
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
                const data = await res.json();
                const nodes = data?.data?.Media?.recommendations?.nodes || [];
                const recs = nodes.map((n: any) => n.mediaRecommendation).filter((r: any) => r && r.id.toString() !== id);
                setRecommendations(recs);
            } catch (e) {
                console.error('Failed to fetch recommendations:', e);
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
            fetch(`https://api.aniskip.com/v2/skip-times/${targetMal}/${epNum}?types=op&types=ed&episodeLength=0`)
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

    const handlePlayEpisode = async (episode: Episode, parentSeasonId: string, forceMode?: 'sub' | 'dub') => {
        const modeToUse = forceMode || audioMode;
        setActiveEpisode(episode);
        setPlayingSeasonId(parentSeasonId);
        setIsFetchingStream(true);
        setStreamData(null);
        setStreamError(null);
        setShowSettings(false);
        setSkipTimes({ op: null, ed: null });
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

        window.scrollTo({ top: 0, behavior: 'smooth' });

        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3005';

            const backendUrl = `${apiUrl}/anime/zoro/watch/${encodeURIComponent(episode.id)}?lang=${modeToUse}&animeId=${parentSeasonId}&epNum=${episode.number}`;

            const res = await fetch(backendUrl);
            const data = await res.json();

            if (data.error) {
                setStreamError(data.error);
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
                const bestLink = sourcesArray.find((l: any) => l.quality === 'auto') || sourcesArray[0];
                setStreamData({
                    url: bestLink.url,
                    isIframe: bestLink.isIframe || false,
                    isM3U8: bestLink.isM3U8 === true || bestLink.url.includes('.m3u8')
                });
            } else {
                setStreamError("Stream not found! This episode might be unreleased or currently unavailable on this server.");
            }
        } catch (error) {
            console.error("Failed to fetch stream");
            setStreamError("Failed to connect to the streaming server.");
        }
        finally { setIsFetchingStream(false); }
    };

    const handleServerChange = (srv: string) => {
        if (srv === activeServer) return;
        setActiveServer(srv);
        if (streamData) {
            const currentStream = streamData;
            setIsFetchingStream(true);
            setStreamData(null);
            setTimeout(() => {
                setStreamData(currentStream);
                setIsFetchingStream(false);
            }, 1200);
        }
    };

    const SKIP_OFFSET = 0.5;

    const handleSkipIntro = () => {
        if (videoRef.current && skipTimes.op) {
            const targetTime = skipTimes.op.end + SKIP_OFFSET;
            videoRef.current.currentTime = targetTime;
            setCurrentTime(targetTime);
        }
    };

    const handleSkipOutro = () => {
        if (videoRef.current && skipTimes.ed) {
            const targetTime = skipTimes.ed.end;
            videoRef.current.currentTime = targetTime;
            setCurrentTime(targetTime);
        }
    };

    const handleNextEpisode = () => {
        if (!playingSeasonId || !activeEpisode) return;
        const currentActiveSeasonObj = chronologicalSeasons.find(s => s.id === playingSeasonId);
        if (!currentActiveSeasonObj || !currentActiveSeasonObj.episodes) return;

        const currentEpList = currentActiveSeasonObj.episodes;
        const currentIndex = currentEpList.findIndex(ep => ep.id === activeEpisode.id);

        if (currentIndex !== -1 && currentIndex < currentEpList.length - 1) {
            const nextEp = currentEpList[currentIndex + 1];
            handlePlayEpisode(nextEp, playingSeasonId);
        }
        else if (currentIndex === currentEpList.length - 1) {
            const currentSeasonIndex = chronologicalSeasons.findIndex(s => s.id === playingSeasonId);
            if (currentSeasonIndex !== -1 && currentSeasonIndex < chronologicalSeasons.length - 1) {
                const nextSeasonObj = chronologicalSeasons[currentSeasonIndex + 1];
                if (nextSeasonObj && nextSeasonObj.episodes && nextSeasonObj.episodes.length > 0) {
                    handlePlayEpisode(nextSeasonObj.episodes[0], nextSeasonObj.id);
                }
            }
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
                if (parsedTime > 0) {
                    video.currentTime = parsedTime;
                    return;
                }
            }
            video.currentTime = 0;
        };

        if (streamData.isM3U8 && Hls.isSupported()) {
            hls = new Hls({ xhrSetup: (xhr) => { xhr.withCredentials = false; } });
            hls.loadSource(streamData.url);
            hls.attachMedia(video);

            hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
                const availableQualities = data.levels.map((level, index) => ({ height: level.height, level: index }));
                setQualities(availableQualities.reverse());
                restoreProgress();
                if (autoPlay) {
                    video.play().catch(() => console.warn("Autoplay prevented"));
                }
            });

            setHlsInstance(hls);
        } else {
            video.src = streamData.url;
            video.addEventListener('loadedmetadata', () => {
                restoreProgress();
                if (autoPlay) {
                    video.play().catch(() => console.warn("Autoplay prevented"));
                }
            }, { once: true });
        }

        return () => {
            if (hls) {
                hls.detachMedia();
                hls.destroy();
            }
            if (video) {
                video.pause();
                video.removeAttribute('src');
                video.load();
            }
        };
    }, [streamData, playingSeasonId, activeEpisode?.id, autoPlay]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (document.activeElement?.tagName === 'INPUT') return;
            const { volume: v, currentTime: ct, duration: d, isPlaying: p } = playerStateRef.current;

            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'f', ' ', 's', 'S'].includes(e.key)) {
                e.preventDefault();
                setShowControls(true);
                if (controlsTimeoutRef.current) window.clearTimeout(controlsTimeoutRef.current);
                controlsTimeoutRef.current = window.setTimeout(() => {
                    if (playerStateRef.current.isPlaying) {
                        setShowControls(false);
                        setIsMouseActive(false);
                    }
                }, 3000);
            }

            switch (e.key) {
                case 'ArrowRight':
                    if (videoRef.current) videoRef.current.currentTime = Math.min(ct + 5, d);
                    break;
                case 'ArrowLeft':
                    if (videoRef.current) videoRef.current.currentTime = Math.max(ct - 5, 0);
                    break;
                case 'ArrowUp':
                    const newVolUp = Math.min(v + 0.1, 1);
                    setVolume(newVolUp);
                    if (videoRef.current) { videoRef.current.volume = newVolUp; videoRef.current.muted = newVolUp === 0; setIsMuted(newVolUp === 0); }
                    break;
                case 'ArrowDown':
                    const newVolDown = Math.max(v - 0.1, 0);
                    setVolume(newVolDown);
                    if (videoRef.current) { videoRef.current.volume = newVolDown; videoRef.current.muted = newVolDown === 0; setIsMuted(newVolDown === 0); }
                    break;
                case 'f':
                case 'F':
                    toggleFullscreen();
                    break;
                case ' ':
                    if (videoRef.current) { p ? videoRef.current.pause() : videoRef.current.play(); }
                    break;
                case 's':
                case 'S':
                    if (showSkipOp) handleSkipIntro();
                    else if (showSkipEd) handleSkipOutro();
                    break;
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [skipTimes, currentTime]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video || !activeEpisode || !playingSeasonId) return;

        const currentActiveSeasonObj = chronologicalSeasons.find(s => s.id === playingSeasonId);
        if (!currentActiveSeasonObj) return;

        const progressKey = `kuro-progress-${playingSeasonId}-${activeEpisode.id}`;
        const watchedKey = `kuro-watched-${playingSeasonId}-${activeEpisode.id}`;

        const onTimeUpdate = () => {
            setCurrentTime(video.currentTime);

            const { autoSkip: currentAutoSkip, autoNext: currentAutoNext, skipTimes: currentSkips } = bingeSettingsRef.current;

            if (currentAutoSkip && currentSkips.op) {
                if (video.currentTime >= currentSkips.op.start && video.currentTime < currentSkips.op.end - 0.8) {
                    const exactTarget = currentSkips.op.end + SKIP_OFFSET;
                    video.currentTime = exactTarget;
                    setCurrentTime(exactTarget);
                }
            }

            if (currentAutoSkip && currentSkips.ed) {
                if (video.currentTime >= currentSkips.ed.start && video.currentTime < currentSkips.ed.end - 0.8) {
                    const exactTarget = currentSkips.ed.end;
                    video.currentTime = exactTarget;
                    setCurrentTime(exactTarget);
                }
            }

            if (currentAutoNext && video.duration > 0 && (video.duration - video.currentTime) <= 1.5) {
                handleNextEpisode();
            }

            if (video.currentTime > 5 && video.duration > 0) {
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

                    if (user && Math.abs(video.currentTime - lastSavedTimeRef.current) > 10) {
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
        const onWaiting = () => setIsBuffering(true);
        const onPlaying = () => setIsBuffering(false);

        video.addEventListener('timeupdate', onTimeUpdate);
        video.addEventListener('loadedmetadata', onLoadedMetadata);
        video.addEventListener('play', onPlay);
        video.addEventListener('pause', onPause);
        video.addEventListener('waiting', onWaiting);
        video.addEventListener('playing', onPlaying);

        return () => {
            video.removeEventListener('timeupdate', onTimeUpdate);
            video.removeEventListener('loadedmetadata', onLoadedMetadata);
            video.removeEventListener('play', onPlay);
            video.removeEventListener('pause', onPause);
            video.removeEventListener('waiting', onWaiting);
            video.removeEventListener('playing', onPlaying);
        };
    }, [streamData, playingSeasonId, activeEpisode, user, chronologicalSeasons]);

    const togglePlay = () => {
        if (videoRef.current) {
            if (isPlaying) videoRef.current.pause();
            else videoRef.current.play();
        }
    };

    const toggleMute = () => {
        if (videoRef.current) {
            videoRef.current.muted = !isMuted;
            setIsMuted(!isMuted);
        }
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(e.target.value);
        setVolume(val);
        if (videoRef.current) {
            videoRef.current.volume = val;
            videoRef.current.muted = val === 0;
            setIsMuted(val === 0);
        }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(e.target.value);
        setCurrentTime(val);
        if (videoRef.current) videoRef.current.currentTime = val;
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
            if (document.exitFullscreen) {
                document.exitFullscreen();
                setIsFullscreen(false);
            }
        }
    };

    const changeQuality = (level: number) => {
        if (hlsInstance) {
            hlsInstance.currentLevel = level;
            setCurrentQuality(level);
            setShowSettings(false);
        }
    };

    const handleMouseMove = () => {
        setShowControls(true);
        setIsMouseActive(true);
        if (controlsTimeoutRef.current) window.clearTimeout(controlsTimeoutRef.current);
        controlsTimeoutRef.current = window.setTimeout(() => {
            if (playerStateRef.current.isPlaying) {
                setShowControls(false);
                setIsMouseActive(false);
            }
        }, 3000);
    };

    const clickTimerRef = useRef<number | null>(null);
    const handleZoneClick = (e: React.MouseEvent, zone: 'left' | 'center' | 'right') => {
        if (e.detail === 1) {
            clickTimerRef.current = window.setTimeout(() => {
                togglePlay();
            }, 250);
        } else if (e.detail === 2) {
            if (clickTimerRef.current) window.clearTimeout(clickTimerRef.current);
            if (zone === 'left') skipTime(-10);
            else if (zone === 'center') toggleFullscreen();
            else if (zone === 'right') skipTime(10);
        }
    };

    const showSkipOp = skipTimes.op && currentTime >= skipTimes.op.start && currentTime <= skipTimes.op.end;
    const showSkipEd = skipTimes.ed && currentTime >= skipTimes.ed.start && currentTime <= skipTimes.ed.end;

    const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

    const currentPlayingSeasonObj = chronologicalSeasons.find(s => s.id === playingSeasonId) || primarySeason;

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-black">
                <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
            </div>
        );
    }

    if (error || chronologicalSeasons.length === 0) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-black">
                <h2 className="text-2xl font-bold text-white">Error Loading Anime Details</h2>
            </div>
        );
    }

    return (
        <div className="w-full min-h-screen bg-black text-gray-300 font-sans pb-24 pt-24 px-4 sm:px-8">
            <div className="max-w-[1500px] mx-auto">

                <div className="flex items-center gap-2 text-[10px] font-black tracking-widest text-gray-500 mb-6 uppercase">
                    <button onClick={() => navigate(-1)} className="flex items-center hover:text-blue-500 transition-colors cursor-pointer">
                        <ArrowLeft className="w-3 h-3 mr-1.5" /> Back
                    </button>
                    <span className="text-gray-700">/</span>
                    <span className="hover:text-white transition-colors">{primarySeason?.type || "TV Series"}</span>
                    <span className="text-gray-700">/</span>
                    <span className="text-white">Watching <span className="text-blue-500">{primarySeason?.title}</span></span>
                </div>

                <div className="flex flex-col xl:flex-row gap-5 items-start">
                    <div className="flex-1 min-w-0 w-full">

                        {/* 1. THE MEDIA PLAYER (STAYS AT THE TOP) */}
                        <div className="bg-[#050505] p-2 md:p-4 rounded-xl shadow-2xl border border-[#111] mb-6">
                            <div
                                ref={playerContainerRef}
                                className={`w-full aspect-video bg-black relative rounded-lg overflow-hidden flex items-center justify-center border border-[#111] group ${!isMouseActive && isPlaying ? 'cursor-none [&_*]:cursor-none' : ''}`}
                                onMouseMove={handleMouseMove}
                                onMouseLeave={() => {
                                    if (isPlaying) {
                                        setShowControls(false);
                                        setIsMouseActive(false);
                                    }
                                }}
                            >
                                {streamError ? (
                                    <div className="flex flex-col items-center justify-center w-full h-full bg-black z-50 p-6 text-center">
                                        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4 border border-red-500/20">
                                            <span className="text-red-500 font-bold text-2xl">!</span>
                                        </div>
                                        <h3 className="text-white font-black tracking-widest uppercase mb-2">Stream Unavailable</h3>
                                        <p className="text-gray-500 text-xs font-bold max-w-md">{streamError}</p>
                                    </div>
                                ) : streamData ? (
                                    <div className="w-full h-full relative">
                                        {streamData.isIframe ? (
                                            <iframe src={streamData.url} className="w-full h-full border-none bg-black" allowFullScreen />
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
                                                        <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
                                                    </div>
                                                )}

                                                <div className="absolute bottom-24 right-8 flex flex-col items-end gap-3 z-[100]">
                                                    {showSkipOp && (
                                                        <button
                                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSkipIntro(); }}
                                                            className="bg-blue-600/40 backdrop-blur-md hover:bg-blue-500 text-white px-6 py-3 rounded-sm font-black text-[12px] uppercase tracking-tighter transition-all shadow-[0_0_20px_rgba(0,0,0,0.5)] flex items-center gap-2 cursor-pointer border-l-4 border-blue-600 animate-in fade-in slide-in-from-right-4 duration-300"
                                                        >
                                                            Skip Intro <span className="opacity-50 text-[10px] font-bold ml-1 bg-black/10 px-1.5 py-0.5 rounded">S</span>
                                                        </button>
                                                    )}

                                                    {showSkipEd && (
                                                        <button
                                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSkipOutro(); }}
                                                            className="bg-blue-600/40 backdrop-blur-md hover:bg-blue-500 text-white px-6 py-3 rounded-sm font-black text-[12px] uppercase tracking-tighter transition-all shadow-[0_0_20px_rgba(0,0,0,0.5)] flex items-center gap-2 cursor-pointer border-l-4 border-blue-600 animate-in fade-in slide-in-from-right-4 duration-300"
                                                        >
                                                            Skip Outro <span className="opacity-50 text-[10px] font-bold ml-1 bg-black/10 px-1.5 py-0.5 rounded">S</span>
                                                        </button>
                                                    )}
                                                </div>

                                                <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent pt-16 pb-4 px-6 z-40 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                                                    <div className="w-full flex items-center group/scrubber cursor-pointer mb-3 pointer-events-auto relative">
                                                        <input
                                                            type="range"
                                                            min="0"
                                                            max={duration || 100}
                                                            value={currentTime}
                                                            onChange={handleSeek}
                                                            className="w-full h-1 appearance-none outline-none rounded-full cursor-pointer hover:h-1.5 transition-all [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full relative z-20"
                                                            style={{
                                                                background: `linear-gradient(to right, #ffffff ${progressPercent}%, rgba(255,255,255,0.2) ${progressPercent}%)`
                                                            }}
                                                        />
                                                        {skipTimes.op && duration > 0 && (
                                                            <div
                                                                className="absolute h-1 group-hover/scrubber:h-1.5 bg-blue-500/50 rounded-full pointer-events-none transition-all z-10"
                                                                style={{
                                                                    left: `${(skipTimes.op.start / duration) * 100}%`,
                                                                    width: `${((skipTimes.op.end - skipTimes.op.start) / duration) * 100}%`
                                                                }}
                                                            />
                                                        )}
                                                        {skipTimes.ed && duration > 0 && (
                                                            <div
                                                                className="absolute h-1 group-hover/scrubber:h-1.5 bg-blue-500/50 rounded-full pointer-events-none transition-all z-10"
                                                                style={{
                                                                    left: `${(skipTimes.ed.start / duration) * 100}%`,
                                                                    width: `${((skipTimes.ed.end - skipTimes.ed.start) / duration) * 100}%`
                                                                }}
                                                            />
                                                        )}
                                                    </div>

                                                    <div className="flex items-center justify-between pointer-events-auto">
                                                        <div className="flex items-center gap-5">
                                                            <button onClick={togglePlay} className="text-white hover:text-blue-400 transition-colors z-50 relative cursor-pointer">
                                                                {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-0.5" />}
                                                            </button>

                                                            <div className="flex items-center gap-3 z-50 relative">
                                                                <button onClick={() => skipTime(-10)} className="text-white/80 hover:text-white transition-colors cursor-pointer">
                                                                    <RotateCcw className="w-5 h-5" />
                                                                </button>
                                                                <button onClick={() => skipTime(10)} className="text-white/80 hover:text-white transition-colors cursor-pointer">
                                                                    <RotateCw className="w-5 h-5" />
                                                                </button>
                                                            </div>

                                                            <div className="flex items-center gap-2 group/volume relative z-50">
                                                                <button onClick={toggleMute} className="text-white/80 hover:text-white transition-colors cursor-pointer">
                                                                    {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                                                                </button>
                                                                <input
                                                                    type="range" min="0" max="1" step="0.05" value={isMuted ? 0 : volume} onChange={handleVolumeChange}
                                                                    className="w-0 opacity-0 group-hover/volume:w-16 group-hover/volume:opacity-100 transition-all duration-300 h-1 accent-white appearance-none bg-white/30 rounded-full cursor-pointer"
                                                                />
                                                            </div>

                                                            <span className="text-xs font-bold font-mono tracking-wider text-white/90 z-50 relative pointer-events-none">
                                                                {formatTime(currentTime)} <span className="text-white/40 mx-1">/</span> {formatTime(duration)}
                                                            </span>
                                                        </div>

                                                        <div className="flex items-center gap-5 relative z-50">
                                                            <button onClick={() => setShowSettings(!showSettings)} className={`text-white/80 hover:text-white transition-transform duration-300 cursor-pointer ${showSettings ? 'rotate-90 text-blue-400' : ''}`}>
                                                                <Settings className="w-5 h-5" />
                                                            </button>

                                                            <button onClick={toggleFullscreen} className="text-white/80 hover:text-white transition-colors cursor-pointer">
                                                                {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                                                            </button>

                                                            {showSettings && (
                                                                <div className="absolute bottom-12 right-0 w-40 bg-black/90 backdrop-blur-xl border border-white/10 rounded-lg p-2 shadow-2xl flex flex-col gap-1 pointer-events-auto">
                                                                    <span className="text-[10px] font-black text-gray-500 px-2 py-1 uppercase tracking-widest">Quality</span>
                                                                    {qualities.length > 0 ? (
                                                                        <>
                                                                            <button onClick={() => changeQuality(-1)} className={`text-xs font-bold text-left px-3 py-2 rounded-md hover:bg-white/10 flex justify-between cursor-pointer ${currentQuality === -1 ? 'text-blue-400' : 'text-white'}`}>
                                                                                Auto {currentQuality === -1 && <Check className="w-3 h-3" />}
                                                                            </button>
                                                                            {qualities.map(q => (
                                                                                <button key={q.level} onClick={() => changeQuality(q.level)} className={`text-xs font-bold text-left px-3 py-2 rounded-md hover:bg-white/10 flex justify-between cursor-pointer ${currentQuality === q.level ? 'text-blue-400' : 'text-white'}`}>
                                                                                    {q.height}p {currentQuality === q.level && <Check className="w-3 h-3" />}
                                                                                </button>
                                                                            ))}
                                                                        </>
                                                                    ) : (
                                                                        <button className="text-xs font-bold text-left px-3 py-2 rounded-md flex justify-between text-blue-400 cursor-default">
                                                                            Default (Source) <Check className="w-3 h-3" />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ) : isFetchingStream ? (
                                    <div className="flex flex-col items-center justify-center w-full h-full bg-black z-50">
                                        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                                    </div>
                                ) : (
                                    <>
                                        <img src={currentPlayingSeasonObj?.bannerImage || currentPlayingSeasonObj?.image} alt={currentPlayingSeasonObj?.title} className="absolute inset-0 w-full h-full object-cover opacity-20 blur-md grayscale-[40%]" />
                                        <div className="absolute inset-0 bg-black/80" />
                                        <div className="z-10 flex flex-col items-center gap-4">
                                            <Play className="w-16 h-16 text-white opacity-90" />
                                            {currentPlayingSeasonObj?.episodes && currentPlayingSeasonObj.episodes.length > 0 ? (
                                                <button onClick={() => handlePlayEpisode(currentPlayingSeasonObj.episodes![0], currentPlayingSeasonObj.id)} className="bg-blue-600 hover:bg-blue-500 text-white px-10 py-3 rounded-md font-bold uppercase tracking-widest text-xs transition-colors shadow-lg relative z-50 cursor-pointer">
                                                    Watch Episode 1
                                                </button>
                                            ) : (
                                                <div className="bg-transparent border border-[#333] text-gray-400 px-10 py-3 rounded-md font-bold uppercase tracking-widest text-xs">Transmission Pending</div>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="flex flex-col lg:flex-row gap-6 mt-4 px-2 items-center justify-between">
                                <div className="text-center lg:text-left w-full lg:w-auto">
                                    <p className="text-sm text-gray-400">
                                        Watching <span className="text-blue-400 font-bold">{currentPlayingSeasonObj?.title}</span> <span className="text-white font-black ml-1">Episode {activeEpisode?.number || 1}</span>
                                    </p>

                                    <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 mt-2.5 bg-[#0a0a0a] border border-[#1a1a1a] px-3 py-1.5 rounded-lg w-fit mx-auto lg:mx-0">
                                        <button
                                            onClick={() => toggleSetting('kuro-auto-play', autoPlay, setAutoPlay)}
                                            className={`text-[10px] font-black tracking-wider uppercase flex items-center gap-1.5 transition-colors cursor-pointer ${autoPlay ? 'text-blue-500' : 'text-gray-600 hover:text-gray-400'}`}
                                        >
                                            <span className={`w-2 h-2 rounded-full ${autoPlay ? 'bg-blue-500 shadow-[0_0_8px_#3b82f6]' : 'bg-gray-700'}`}></span>
                                            AutoPlay
                                        </button>
                                        <span className="text-[#222]">|</span>
                                        <button
                                            onClick={() => toggleSetting('kuro-auto-skip', autoSkip, setAutoSkip)}
                                            className={`text-[10px] font-black tracking-wider uppercase flex items-center gap-1.5 transition-colors cursor-pointer ${autoSkip ? 'text-blue-500' : 'text-gray-600 hover:text-gray-400'}`}
                                        >
                                            <span className={`w-2 h-2 rounded-full ${autoSkip ? 'bg-blue-500 shadow-[0_0_8px_#3b82f6]' : 'bg-gray-700'}`}></span>
                                            AutoSkip Intro/Outro
                                        </button>
                                        <span className="text-[#222]">|</span>
                                        <button
                                            onClick={() => toggleSetting('kuro-auto-next', autoNext, setAutoNext)}
                                            className={`text-[10px] font-black tracking-wider uppercase flex items-center gap-1.5 transition-colors cursor-pointer ${autoNext ? 'text-blue-500' : 'text-gray-600 hover:text-gray-400'}`}
                                        >
                                            <span className={`w-2 h-2 rounded-full ${autoNext ? 'bg-blue-500 shadow-[0_0_8px_#3b82f6]' : 'bg-gray-700'}`}></span>
                                            AutoNext Ep
                                        </button>
                                    </div>
                                </div>

                                <div className="flex flex-col items-end gap-3 mt-2 lg:mt-0">
                                    <div className="flex items-center gap-3">
                                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex-shrink-0">Audio:</span>
                                        <div className="flex bg-[#111] p-1 rounded-md border border-[#222]">
                                            <button onClick={() => { setAudioMode('sub'); if (activeEpisode && playingSeasonId) handlePlayEpisode(activeEpisode, playingSeasonId, 'sub'); }} className={`px-4 py-1 text-[10px] font-bold rounded transition-colors cursor-pointer ${audioMode === 'sub' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>SUB</button>
                                            <button onClick={() => { setAudioMode('dub'); if (activeEpisode && playingSeasonId) handlePlayEpisode(activeEpisode, playingSeasonId, 'dub'); }} className={`px-4 py-1 text-[10px] font-bold rounded transition-colors cursor-pointer ${audioMode === 'dub' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>DUB</button>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex-shrink-0">Server:</span>
                                        <div className="flex flex-wrap gap-2">
                                            {['Vidstreaming', 'MegaCloud', 'StreamSB'].map(srv => (
                                                <button
                                                    key={srv}
                                                    onClick={() => handleServerChange(srv)}
                                                    className={`px-4 py-1.5 rounded-md text-[11px] font-bold shadow-md transition-colors cursor-pointer ${activeServer === srv ? 'bg-blue-600 text-white' : 'bg-[#111] border border-[#222] text-gray-400 hover:text-white'}`}
                                                >
                                                    {srv}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 2. REORDERED PRIORITY: THE EPISODES GRID IS PLACED DIRECTLY UNDER THE PLAYER */}
                        {chronologicalSeasons.map((seasonObj) => {
                            const isCurrentlyPlayingThisSeason = playingSeasonId === seasonObj.id;
                            if (!isCurrentlyPlayingThisSeason) return null;
                            const seasonEps = seasonObj.episodes || [];
                            const hasEps = seasonEps.length > 0;

                            return (
                                <div key={`chrono-ep-block-${seasonObj.id}`} className="mb-6 bg-[#030303] rounded-xl p-5 border border-[#111]">
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="flex-1 h-[1px] bg-[#111]"></div>
                                        <h3 className="text-sm font-black uppercase tracking-widest text-white">Episodes</h3>
                                        <div className="flex-1 h-[1px] bg-[#111]"></div>
                                    </div>

                                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2 p-1">
                                        {loading ? (
                                            <div className="col-span-full py-8 flex items-center justify-center gap-3 text-gray-500">
                                                <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                                                <span className="font-bold tracking-widest uppercase text-xs">Syncing...</span>
                                            </div>
                                        ) : hasEps ? (
                                            seasonEps.map((ep) => {
                                                const isWatched = watchedEpisodes.has(ep.id.toString());
                                                const isActive = activeEpisode?.id?.toString() === ep.id.toString();

                                                return (
                                                    <button
                                                        key={`ep-grid-btn-${ep.id}`}
                                                        id={isActive ? `ep-btn-${ep.id}` : undefined}
                                                        onClick={() => handlePlayEpisode(ep, seasonObj.id)}
                                                        className={`relative h-10 rounded border transition-all duration-300 flex items-center justify-center font-bold text-xs overflow-hidden cursor-pointer
                                                            ${isActive
                                                                ? 'bg-blue-600 border-blue-500 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)] scale-[1.05] z-10'
                                                                : isWatched
                                                                    ? 'bg-[#0a0a0a] border-[#222] text-gray-500 hover:text-gray-300 hover:border-gray-500'
                                                                    : 'bg-[#111] border-[#333] text-gray-300 hover:bg-[#222] hover:text-white hover:border-blue-500/50'
                                                            }`}
                                                    >
                                                        {ep.number}
                                                        {isWatched && !isActive && (
                                                            <div className="absolute bottom-0 left-0 w-full h-[3px] bg-gray-600/50" />
                                                        )}
                                                        {isActive && (
                                                            <div className="absolute bottom-0 left-0 w-full h-[3px] bg-white/40" />
                                                        )}
                                                    </button>
                                                );
                                            })
                                        ) : (
                                            <div className="col-span-full py-8 text-center text-gray-500 font-bold uppercase text-xs">Transmission Pending</div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        {/* 3. RELATED SEASONS & MEDIA (FOLLOWS EPISODES) */}
                        {animeFetchResult?.relations && animeFetchResult.relations.length > 0 && (
                            <div className="mb-6 bg-[#030303] rounded-xl p-5 border border-[#111]">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="flex-1 h-[1px] bg-[#111]"></div>
                                    <h3 className="text-sm font-black uppercase tracking-widest text-white">Related Seasons & Media</h3>
                                    <div className="flex-1 h-[1px] bg-[#111]"></div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                    {animeFetchResult.relations.map((rel: Relation) => (
                                        <button
                                            key={rel.id}
                                            onClick={() => navigate(`/anime/${rel.id}`)}
                                            className="flex items-start gap-3 p-2.5 bg-[#0a0a0a] hover:bg-[#111] border border-[#1a1a1a] hover:border-blue-500/40 rounded-lg transition-all text-left cursor-pointer group"
                                        >
                                            <img
                                                src={rel.image}
                                                alt={rel.title}
                                                className="w-12 h-16 object-cover rounded shrink-0 bg-[#111]"
                                            />
                                            <div className="flex flex-col min-w-0 flex-1 justify-between h-full py-0.5">
                                                <div>
                                                    <span className="text-[9px] font-black text-blue-500 tracking-wider uppercase block mb-0.5">
                                                        {rel.relationType?.replace('_', ' ')}
                                                    </span>
                                                    <h4 className="text-xs font-bold text-gray-200 group-hover:text-white line-clamp-2 leading-tight mb-1.5">
                                                        {rel.title}
                                                    </h4>
                                                </div>
                                                <span className="text-[8px] font-black text-gray-500 bg-[#111] border border-[#222] px-1.5 py-0.5 rounded w-fit uppercase tracking-wider">
                                                    {rel.type || 'TV'}
                                                </span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 4. THE DETAILS CARD (PLACED AT THE VERY BOTTOM) */}
                        <div className="flex flex-col gap-8">
                            {chronologicalSeasons.map((seasonObj) => {
                                const isCurrentlyPlayingThisSeason = playingSeasonId === seasonObj.id;
                                if (!isCurrentlyPlayingThisSeason) return null;
                                const seasonEps = seasonObj.episodes || [];
                                const hasEps = seasonEps.length > 0;

                                return (
                                    <div key={`chrono-block-${seasonObj.id}`} className="bg-[#030303] rounded-xl p-5 border border-[#111]">
                                        <div className="flex flex-col sm:flex-row gap-6 items-start">
                                            <div className="w-full sm:w-[160px] shrink-0 aspect-[2/3] rounded-lg overflow-hidden border border-[#1a1a1a] relative">
                                                <img src={seasonObj.image} alt={seasonObj.title} className="w-full h-full object-cover" />
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <h3 className="text-xl font-black text-white mb-2 leading-tight">{seasonObj.title}</h3>
                                                <p className="text-gray-400 text-xs leading-relaxed line-clamp-3 mb-4 font-medium">
                                                    {seasonObj.description?.replace(/<[^>]*>/g, '') || "No synopsis available."}
                                                </p>

                                                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs bg-[#080808] p-3 rounded-lg border border-[#111]">
                                                    <div className="flex gap-2"><span className="font-bold text-gray-500">Status:</span><span className="text-gray-300 font-medium">{seasonObj.status}</span></div>
                                                    <div className="flex gap-2"><span className="font-bold text-gray-500">Aired:</span><span className="text-gray-300 font-medium">{seasonObj.releaseDate}</span></div>
                                                    <div className="flex gap-2"><span className="font-bold text-gray-500">Score:</span><span className="text-gray-300 font-medium flex items-center gap-1"><Star className="w-3 h-3 text-yellow-500 fill-yellow-500" /> {seasonObj.rating}</span></div>
                                                    <div className="flex gap-2"><span className="font-bold text-gray-500">Episodes:</span><span className="text-gray-300 font-medium">{hasEps ? seasonEps.length : '--'}</span></div>
                                                </div>

                                                <div className="flex flex-wrap gap-1.5 mt-3">
                                                    {seasonObj.genres?.map(genre => <span key={genre} className="text-[9px] border border-[#1a1a1a] bg-[#0a0a0a] text-gray-400 px-2 py-0.5 rounded uppercase tracking-wider">{genre}</span>)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="mt-8 flex items-center justify-start">
                            <button
                                onClick={toggleWatchlist}
                                disabled={watchlistLoading}
                                className={`flex items-center justify-center gap-2 px-8 py-3 rounded-md transition-colors border font-bold text-xs uppercase tracking-widest cursor-pointer ${isInWatchlist
                                    ? 'bg-blue-600 text-white border-blue-500 hover:bg-red-600 hover:border-red-500'
                                    : 'bg-[#050505] text-white border-[#111] hover:bg-white hover:text-black'
                                    }`}
                            >
                                {watchlistLoading ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Bookmark className={`w-4 h-4 ${isInWatchlist ? 'fill-current' : ''}`} />
                                )}
                                {isInWatchlist ? 'Remove from List' : 'Add to List'}
                            </button>
                        </div>

                    </div>

                    {/* RECOMMENDATIONS SIDEBAR */}
                    <div className="w-full xl:w-[360px] flex-shrink-0">
                        <div className="sticky top-24 bg-[#050505] rounded-xl border border-[#111] overflow-hidden">
                            <div className="px-4 py-3 border-b border-[#111] flex items-center justify-between">
                                <h3 className="text-xs font-black uppercase tracking-widest text-white">You Might Also Like</h3>
                                {recommendations.length > 0 && (
                                    <span className="text-[10px] font-bold text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-full">
                                        {recommendations.length}
                                    </span>
                                )}
                            </div>

                            <div
                                className="flex flex-col divide-y divide-[#0d0d0d] overflow-y-auto"
                                style={{ maxHeight: 'calc(100vh - 160px)', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                            >
                                {recommendationsLoading ? (
                                    <div className="py-12 flex flex-col items-center justify-center gap-2">
                                        <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                                        <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Loading...</span>
                                    </div>
                                ) : recommendations.length === 0 ? (
                                    <div className="py-12 flex flex-col items-center justify-center gap-2">
                                        <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">No recommendations found</span>
                                    </div>
                                ) : (
                                    recommendations.map((rec) => {
                                        const targetUrl = `/anime/${rec.id}`;
                                        return (
                                            <a
                                                key={rec.id}
                                                href={targetUrl}
                                                onClick={(e) => {
                                                    if (e.ctrlKey || e.metaKey || e.button === 1) return;
                                                    e.preventDefault();
                                                    navigate(targetUrl);
                                                }}
                                                className="flex gap-3 p-3 hover:bg-[#0a0a0a] transition-colors cursor-pointer group block"
                                            >
                                                <div className="relative w-[75px] h-[102px] flex-shrink-0 rounded-md overflow-hidden border border-[#1a1a1a] group-hover:border-blue-500/40 transition-colors">
                                                    <img
                                                        src={rec.coverImage.large}
                                                        alt={rec.title.english || rec.title.romaji}
                                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                                    />
                                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                        <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center shadow-lg">
                                                            <Play className="w-3 h-3 fill-current text-white ml-0.5" />
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex flex-col justify-between flex-1 min-w-0 py-0.5">
                                                    <div>
                                                        <h4 className="text-[11px] font-bold text-gray-200 group-hover:text-blue-400 transition-colors line-clamp-2 leading-snug mb-2">
                                                            {rec.title.english || rec.title.romaji}
                                                        </h4>
                                                        <span className="text-[9px] font-black bg-[#111] border border-[#1e1e1e] text-gray-500 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                                            {rec.type}
                                                        </span>
                                                    </div>
                                                    {rec.averageScore && (
                                                        <div className="flex items-center gap-1 mt-2">
                                                            <Star className="w-3 h-3 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                                                            <span className="text-[10px] font-black text-gray-400">{rec.averageScore}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </a>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}