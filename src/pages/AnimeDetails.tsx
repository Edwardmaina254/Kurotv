// src/pages/AnimeDetails.tsx
import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { type AnimeDetails as AnimeDetailsType, type Episode } from '../services/consumet';
import {
    Bookmark, ArrowLeft, Play, Pause, Loader2, Star,
    Maximize, Minimize, Volume2, VolumeX, Settings,
    RotateCcw, RotateCw, FastForward, Check, ChevronRight
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

interface ExtendedAnimeDetails extends AnimeDetailsType {
    rating?: number | string;
    type?: string;
    releaseDate?: string;
    relations?: Relation[];
}

const formatTime = (time: number) => {
    if (isNaN(time)) return "00:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

export default function AnimeDetails() {
    const { id } = useParams<{ id: string }>();
    const location = useLocation();
    const navigate = useNavigate();

    const [anime, setAnime] = useState<ExtendedAnimeDetails | null>(null);
    const [malId, setMalId] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [episodesLoading, setEpisodesLoading] = useState(true);
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

    const [skipTimes, setSkipTimes] = useState<{ op: { start: number, end: number } | null, ed: { start: number, end: number } | null }>({ op: null, ed: null });

    const videoRef = useRef<HTMLVideoElement>(null);
    const playerContainerRef = useRef<HTMLDivElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // ⚡ FIX: Split UI visibility and Mouse visibility
    const [showControls, setShowControls] = useState(true);
    const [isMouseActive, setIsMouseActive] = useState(true);
    const [isBuffering, setIsBuffering] = useState(false);

    const controlsTimeoutRef = useRef<number | null>(null);
    const lastSavedTimeRef = useRef<number>(0);

    const playerStateRef = useRef({ volume, currentTime, duration, isPlaying });
    useEffect(() => {
        playerStateRef.current = { volume, currentTime, duration, isPlaying };
    }, [volume, currentTime, duration, isPlaying]);

    useEffect(() => {
        if (anime && activeEpisode) {
            document.title = `Watch ${anime.title} Episode ${activeEpisode.number} - KuroTV`;
        } else if (anime) {
            document.title = `${anime.title} - KuroTV`;
        } else {
            document.title = 'KuroTV';
        }

        return () => {
            document.title = 'KuroTV';
        };
    }, [anime, activeEpisode]);

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
            if (user && anime) {
                const { data } = await supabase
                    .from('watchlist')
                    .select('id')
                    .eq('user_id', user.id)
                    .eq('anime_id', anime.id.toString())
                    .maybeSingle();

                if (data) setIsInWatchlist(true);
                else setIsInWatchlist(false);
            } else {
                setIsInWatchlist(false);
            }
        };

        checkWatchlistStatus();
    }, [user, anime]);

    const toggleWatchlist = async () => {
        if (!user) {
            alert("Please sign in to add this anime to your watchlist!");
            return;
        }
        if (!anime) return;

        setWatchlistLoading(true);

        try {
            if (isInWatchlist) {
                const { error } = await supabase.from('watchlist').delete().eq('user_id', user.id).eq('anime_id', anime.id.toString());
                if (error) throw error;
                setIsInWatchlist(false);
            } else {
                const { error } = await supabase.from('watchlist').insert([
                    { user_id: user.id, anime_id: anime.id.toString(), title: anime.title, image: anime.image || anime.bannerImage, type: anime.type || 'TV' }
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
        setAnime(null);
        setActiveEpisode(null);
        setStreamData(null);
        setIsFetchingStream(false);
        setStreamError(null);
        setSkipTimes({ op: null, ed: null });
        lastSavedTimeRef.current = 0;

        if (hlsInstance) {
            hlsInstance.destroy();
            setHlsInstance(null);
        }
        if (videoRef.current) {
            videoRef.current.pause();
            videoRef.current.removeAttribute('src');
            videoRef.current.load();
        }

        const fetchDetails = async () => {
            try {
                if (id) {
                    const apiUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3005';
                    const [infoRes, epsRes, malDataRes] = await Promise.all([
                        fetch(`${apiUrl}/anime/zoro/info/${id}`).catch(() => null),
                        fetch(`${apiUrl}/anime/zoro/episodes/${id}`).catch(() => null),
                        fetch('https://graphql.anilist.co', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ query: `query($id:Int){Media(id:$id){idMal}}`, variables: { id: parseInt(id) } })
                        }).then(r => r.json()).catch(() => null)
                    ]);

                    const infoData = infoRes && infoRes.ok ? await infoRes.json() : null;
                    const epsJson = epsRes && epsRes.ok ? await epsRes.json() : { episodes: [] };
                    const epsData = epsJson.episodes || [];

                    if (infoData && infoData.title) {
                        setAnime({ ...infoData, episodes: epsData } as ExtendedAnimeDetails);

                        const watched = new Set<string>();
                        epsData.forEach((ep: Episode) => {
                            if (localStorage.getItem(`kuro-watched-${id}-${ep.id}`) === 'true') {
                                watched.add(ep.id.toString());
                            }
                        });
                        setWatchedEpisodes(watched);

                        let targetEp = null;
                        const queryParams = new URLSearchParams(window.location.search);
                        const epFromUrl = queryParams.get('ep');

                        if (epFromUrl && epsData.length > 0) {
                            targetEp = epsData.find((e: Episode) => e.id.toString() === epFromUrl.toString());
                        }

                        if (!targetEp && epsData.length > 0) {
                            const { data: sessionData } = await supabase.auth.getSession();
                            const currentUser = sessionData?.session?.user;
                            if (currentUser) {
                                const { data } = await supabase
                                    .from('watch_history')
                                    .select('episode_id')
                                    .eq('user_id', currentUser.id)
                                    .eq('anime_id', id.toString())
                                    .maybeSingle();

                                if (data && data.episode_id) {
                                    targetEp = epsData.find((e: Episode) => e.id.toString() === data.episode_id.toString());
                                }
                            }
                        }

                        if (!targetEp && epsData.length > 0) {
                            const localLastEp = localStorage.getItem(`kuro-last-ep-${id}`);
                            if (localLastEp) {
                                targetEp = epsData.find((e: Episode) => e.id.toString() === localLastEp);
                            }
                        }

                        if (!targetEp && epsData.length > 0) {
                            targetEp = epsData[0];
                        }

                        if (targetEp) {
                            handlePlayEpisode(targetEp);
                        }

                        if (malDataRes?.data?.Media?.idMal) {
                            setMalId(malDataRes.data.Media.idMal);
                        }
                    } else {
                        setError("Anime data not found.");
                    }
                }
            } catch (err) { setError("Network error occurred."); }
            finally { setLoading(false); setEpisodesLoading(false); }
        };
        fetchDetails();
    }, [id]);

    useEffect(() => {
        if (malId && activeEpisode) {
            const epNum = parseInt(activeEpisode.number.toString());
            fetch(`https://api.aniskip.com/v2/skip-times/${malId}/${epNum}?types=op&types=ed&episodeLength=0`)
                .then(res => res.json())
                .then(data => {
                    if (data.found) {
                        const op = data.results?.find((r: any) => r.skipType === 'op');
                        const ed = data.results?.find((r: any) => r.skipType === 'ed');
                        setSkipTimes(prev => ({
                            op: prev.op || (op ? { start: op.interval.startTime, end: op.interval.endTime } : null),
                            ed: prev.ed || (ed ? { start: ed.interval.startTime, end: ed.interval.endTime } : null)
                        }));
                    }
                }).catch(() => { });
        }
    }, [malId, activeEpisode]);

    const handlePlayEpisode = async (episode: Episode, forceMode?: 'sub' | 'dub') => {
        const modeToUse = forceMode || audioMode;
        setActiveEpisode(episode);
        setIsFetchingStream(true);
        setStreamData(null);
        setStreamError(null);
        setShowSettings(false);
        setSkipTimes({ op: null, ed: null });
        lastSavedTimeRef.current = 0;

        setCurrentTime(0);
        if (videoRef.current) {
            videoRef.current.currentTime = 0;
        }

        window.history.replaceState(null, '', `/anime/${id}?ep=${encodeURIComponent(episode.id)}`);

        localStorage.setItem(`kuro-last-ep-${id}`, episode.id.toString());

        setTimeout(() => {
            const activeBtn = document.getElementById(`ep-btn-${episode.id}`);
            if (activeBtn) {
                activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
        }, 300);

        window.scrollTo({ top: 0, behavior: 'smooth' });

        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3005';
            const backendUrl = `${apiUrl}/anime/zoro/watch/${encodeURIComponent(episode.id)}?lang=${modeToUse}`;
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

    useEffect(() => {
        if (!streamData || !videoRef.current || streamData.isIframe) return;
        const video = videoRef.current;
        let hls: Hls | null = null;
        setQualities([]);

        const progressKey = `kuro-progress-${id}-${activeEpisode?.id}`;

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
                video.play().catch(() => console.warn("Autoplay prevented"));
            });

            setHlsInstance(hls);
        } else {
            video.src = streamData.url;
            video.addEventListener('loadedmetadata', restoreProgress, { once: true });
            video.play().catch(() => console.warn("Autoplay prevented"));
        }

        return () => { if (hls) hls.destroy(); };
    }, [streamData, id, activeEpisode?.id]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (document.activeElement?.tagName === 'INPUT') return;
            const { volume: v, currentTime: ct, duration: d, isPlaying: p } = playerStateRef.current;

            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'f', ' ', 's', 'S'].includes(e.key)) {
                e.preventDefault();

                // ⚡ FIX: Wake up controls, but do NOT wake up the mouse cursor
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
                    if (videoRef.current) videoRef.current.currentTime = Math.min(ct + 10, d);
                    break;
                case 'ArrowLeft':
                    if (videoRef.current) videoRef.current.currentTime = Math.max(ct - 10, 0);
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
        if (!video || !activeEpisode || !anime) return;

        const progressKey = `kuro-progress-${id}-${activeEpisode.id}`;
        const watchedKey = `kuro-watched-${id}-${activeEpisode.id}`;

        const onTimeUpdate = () => {
            setCurrentTime(video.currentTime);

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
                            anime_id: id?.toString(),
                            episode_id: activeEpisode.id.toString(),
                            episode_number: activeEpisode.number,
                            anime_title: anime.title,
                            anime_image: anime.image || anime.bannerImage,
                            progress: video.currentTime,
                            duration: video.duration,
                            updated_at: new Date().toISOString()
                        }, { onConflict: 'user_id, anime_id' })
                            .then(({ error }) => {
                                if (error) console.error("Cloud sync failed:", error);
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
    }, [streamData, id, activeEpisode, user, anime]);

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

    // ⚡ FIX: Mouse move explicitly activates the cursor, then hides it after 3s
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

    const SKIP_OFFSET = 1.5;

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
        if (!anime || !activeEpisode) return;
        const currentIndex = anime.episodes.findIndex(ep => ep.id === activeEpisode.id);
        if (currentIndex !== -1 && currentIndex < anime.episodes.length - 1) {
            const nextEp = anime.episodes[currentIndex + 1];
            handlePlayEpisode(nextEp);
        }
    };

    useEffect(() => {
        const isAutoSkipEnabled = localStorage.getItem('kuro-auto-skip') === 'true';

        if (isAutoSkipEnabled && videoRef.current) {
            if (skipTimes.op && currentTime >= skipTimes.op.start && currentTime < skipTimes.op.end - 0.5) {
                handleSkipIntro();
            }
        }
    }, [currentTime, skipTimes]);

    const showSkipOp = skipTimes.op && currentTime >= skipTimes.op.start && currentTime <= skipTimes.op.end;
    const showSkipEd = skipTimes.ed && currentTime >= skipTimes.ed.start && currentTime <= skipTimes.ed.end;

    const showNextEpPrompt = duration > 0 && (duration - currentTime <= 40) && (duration - currentTime > 5);
    const hasNextEpisode = anime && activeEpisode && anime.episodes.findIndex(ep => ep.id === activeEpisode.id) < anime.episodes.length - 1;

    const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-black">
                <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
            </div>
        );
    }

    if (error || !anime) return <div className="min-h-screen flex items-center justify-center bg-black"><h2 className="text-2xl font-bold text-white">Error Loading Anime</h2></div>;
    const hasEpisodes = anime.episodes && anime.episodes.length > 0;

    return (
        <div className="w-full min-h-screen bg-black text-gray-300 font-sans pb-24 pt-24 px-4 sm:px-8">
            <div className="max-w-[1300px] mx-auto">

                <div className="flex items-center gap-2 text-[10px] font-black tracking-widest text-gray-500 mb-6 uppercase">
                    <button onClick={() => navigate(-1)} className="flex items-center hover:text-blue-500 transition-colors cursor-pointer">
                        <ArrowLeft className="w-3 h-3 mr-1.5" /> Back
                    </button>
                    <span className="text-gray-700">/</span>
                    <span className="hover:text-white transition-colors">{anime.type || "TV Series"}</span>
                    <span className="text-gray-700">/</span>
                    <span className="text-white">Watching <span className="text-blue-500">{anime.title}</span></span>
                </div>

                <div className="bg-[#050505] p-2 md:p-4 rounded-xl shadow-2xl border border-[#111]">
                    <div
                        ref={playerContainerRef}
                        // ⚡ FIX: Uses !isMouseActive to completely force the cursor away via the [&_*] tailwind modifier
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
                                                    className="bg-white hover:bg-blue-500 hover:text-white text-black px-6 py-3 rounded-sm font-black text-[12px] uppercase tracking-tighter transition-all shadow-[0_0_20px_rgba(0,0,0,0.5)] flex items-center gap-2 cursor-pointer border-l-4 border-blue-600 animate-in fade-in slide-in-from-right-4 duration-300"
                                                >
                                                    Skip Intro <span className="opacity-50 text-[10px] font-bold ml-1 bg-black/10 px-1.5 py-0.5 rounded">S</span>
                                                </button>
                                            )}

                                            {showSkipEd && (
                                                <button
                                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSkipOutro(); }}
                                                    className="bg-white hover:bg-blue-500 hover:text-white text-black px-6 py-3 rounded-sm font-black text-[12px] uppercase tracking-tighter transition-all shadow-[0_0_20px_rgba(0,0,0,0.5)] flex items-center gap-2 cursor-pointer border-l-4 border-blue-600 animate-in fade-in slide-in-from-right-4 duration-300"
                                                >
                                                    Skip Outro <span className="opacity-50 text-[10px] font-bold ml-1 bg-black/10 px-1.5 py-0.5 rounded">S</span>
                                                </button>
                                            )}

                                            {showNextEpPrompt && hasNextEpisode && (
                                                <button
                                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleNextEpisode(); }}
                                                    className="bg-[#111]/90 backdrop-blur-md hover:bg-blue-600 text-white px-6 py-4 rounded-sm font-black text-[12px] uppercase tracking-tighter transition-all shadow-2xl flex flex-col items-start gap-1 cursor-pointer border-l-4 border-blue-500 group animate-in fade-in slide-in-from-right-8 duration-500"
                                                >
                                                    <span className="text-[9px] text-blue-400 group-hover:text-white/80 transition-colors">Up Next</span>
                                                    <div className="flex items-center gap-2">
                                                        Episode {parseInt(activeEpisode!.number.toString()) + 1} <ChevronRight className="w-4 h-4" />
                                                    </div>
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
                                                    <button onClick={togglePlay} className="text-white hover:text-blue-400 transition-colors z-50 relative">
                                                        {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-0.5" />}
                                                    </button>

                                                    <div className="flex items-center gap-3 z-50 relative">
                                                        <button onClick={() => skipTime(-10)} className="text-white/80 hover:text-white transition-colors">
                                                            <RotateCcw className="w-5 h-5" />
                                                        </button>
                                                        <button onClick={() => skipTime(10)} className="text-white/80 hover:text-white transition-colors">
                                                            <RotateCw className="w-5 h-5" />
                                                        </button>
                                                    </div>

                                                    <div className="flex items-center gap-2 group/volume relative z-50">
                                                        <button onClick={toggleMute} className="text-white/80 hover:text-white transition-colors">
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
                                                    <button onClick={() => setShowSettings(!showSettings)} className={`text-white/80 hover:text-white transition-transform duration-300 ${showSettings ? 'rotate-90 text-blue-400' : ''}`}>
                                                        <Settings className="w-5 h-5" />
                                                    </button>

                                                    <button onClick={toggleFullscreen} className="text-white/80 hover:text-white transition-colors">
                                                        {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                                                    </button>

                                                    {showSettings && (
                                                        <div className="absolute bottom-12 right-0 w-40 bg-black/90 backdrop-blur-xl border border-white/10 rounded-lg p-2 shadow-2xl flex flex-col gap-1 pointer-events-auto">
                                                            <span className="text-[10px] font-black text-gray-500 px-2 py-1 uppercase tracking-widest">Quality</span>
                                                            {qualities.length > 0 ? (
                                                                <>
                                                                    <button onClick={() => changeQuality(-1)} className={`text-xs font-bold text-left px-3 py-2 rounded-md hover:bg-white/10 flex justify-between ${currentQuality === -1 ? 'text-blue-400' : 'text-white'}`}>
                                                                        Auto {currentQuality === -1 && <Check className="w-3 h-3" />}
                                                                    </button>
                                                                    {qualities.map(q => (
                                                                        <button key={q.level} onClick={() => changeQuality(q.level)} className={`text-xs font-bold text-left px-3 py-2 rounded-md hover:bg-white/10 flex justify-between ${currentQuality === q.level ? 'text-blue-400' : 'text-white'}`}>
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
                                <img src={anime.bannerImage || anime.image} alt={anime.title} className="absolute inset-0 w-full h-full object-cover opacity-20 blur-md grayscale-[40%]" />
                                <div className="absolute inset-0 bg-black/80" />
                                <div className="z-10 flex flex-col items-center gap-4">
                                    <Play className="w-16 h-16 text-white opacity-90" />
                                    {hasEpisodes ? (
                                        <button onClick={() => handlePlayEpisode(activeEpisode || anime.episodes[0])} className="bg-blue-600 hover:bg-blue-500 text-white px-10 py-3 rounded-md font-bold uppercase tracking-widest text-xs transition-colors shadow-lg relative z-50">
                                            Watch Episode {activeEpisode?.number || 1}
                                        </button>
                                    ) : (
                                        <div className="bg-transparent border border-[#333] text-gray-400 px-10 py-3 rounded-md font-bold uppercase tracking-widest text-xs">Not Yet Aired</div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                    <div className="flex flex-col lg:flex-row gap-6 mt-4 px-2 items-center justify-between">
                        <div className="text-center lg:text-left">
                            <p className="text-sm text-gray-400">You are watching <span className="text-white font-black">Episode {activeEpisode?.number || 1}</span></p>
                            <p className="text-[10px] text-gray-600 mt-1 uppercase tracking-wide font-bold">If current server doesn't work please try other servers.</p>
                        </div>
                        <div className="flex flex-col items-end gap-3">
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex-shrink-0">Audio:</span>
                                <div className="flex bg-[#111] p-1 rounded-md border border-[#222]">
                                    <button onClick={() => { setAudioMode('sub'); if (activeEpisode) handlePlayEpisode(activeEpisode, 'sub'); }} className={`px-4 py-1 text-[10px] font-bold rounded transition-colors ${audioMode === 'sub' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>SUB</button>
                                    <button onClick={() => { setAudioMode('dub'); if (activeEpisode) handlePlayEpisode(activeEpisode, 'dub'); }} className={`px-4 py-1 text-[10px] font-bold rounded transition-colors ${audioMode === 'dub' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>DUB</button>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex-shrink-0">Server:</span>
                                <div className="flex flex-wrap gap-2">
                                    {['Vidstreaming', 'MegaCloud', 'StreamSB'].map(srv => (
                                        <button
                                            key={srv}
                                            onClick={() => handleServerChange(srv)}
                                            className={`px-4 py-1.5 rounded-md text-[11px] font-bold shadow-md transition-colors ${activeServer === srv ? 'bg-blue-600 text-white' : 'bg-[#111] border border-[#222] text-gray-400 hover:text-white'}`}
                                        >
                                            {srv}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* SEASONS & RELATED MEDIA */}
                {anime.relations && anime.relations.length > 0 && (
                    <div className="mt-6 bg-[#030303] rounded-xl p-5 border border-[#111]">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="flex-1 h-[1px] bg-[#111]"></div>
                            <h3 className="text-sm font-black uppercase tracking-widest text-white">Related Seasons</h3>
                            <div className="flex-1 h-[1px] bg-[#111]"></div>
                        </div>

                        <div className="flex gap-4 overflow-x-auto custom-scrollbar pb-2">
                            {anime.relations.map((rel) => {
                                let displayRelation = rel.relationType.replace('_', ' ');
                                if (rel.relationType === 'SEQUEL') displayRelation = "Next Season";
                                if (rel.relationType === 'PREQUEL') displayRelation = "Previous Season";
                                if (rel.relationType === 'ALTERNATIVE') displayRelation = "Alternative Setting";

                                return (
                                    <div
                                        key={rel.id}
                                        onClick={() => navigate(`/anime/${rel.id}`)}
                                        className="flex-shrink-0 w-32 group cursor-pointer"
                                    >
                                        <div className="relative aspect-[2/3] rounded-lg overflow-hidden border border-[#111] group-hover:border-blue-500/50 transition-all">
                                            <img src={rel.image} alt={rel.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                            <div className="absolute bottom-2 left-2 right-2">
                                                <span className="text-[8px] font-black bg-blue-600 text-white px-1.5 py-0.5 rounded uppercase tracking-tighter">{rel.type}</span>
                                            </div>
                                        </div>
                                        <h4 className="text-[10px] font-bold mt-2 line-clamp-2 group-hover:text-blue-400 transition-colors">{rel.title}</h4>
                                        <p className="text-[8px] font-black text-gray-600 uppercase tracking-widest mt-0.5">{displayRelation}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ⚡ EPISODE HIGHLIGHTS REBUILT */}
                <div className="mt-6 bg-[#030303] rounded-xl p-5 border border-[#111]">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="flex-1 h-[1px] bg-[#111]"></div>
                        <h3 className="text-sm font-black uppercase tracking-widest text-white">Episodes</h3>
                        <div className="flex-1 h-[1px] bg-[#111]"></div>
                    </div>

                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2 p-1">
                        {episodesLoading ? (
                            <div className="col-span-full py-8 flex items-center justify-center gap-3 text-gray-500">
                                <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                                <span className="font-bold tracking-widest uppercase text-xs">Syncing...</span>
                            </div>
                        ) : hasEpisodes ? (
                            anime.episodes.map((ep) => {
                                const isWatched = watchedEpisodes.has(ep.id.toString());
                                const isActive = activeEpisode?.id?.toString() === ep.id.toString();

                                return (
                                    <button
                                        key={ep.id}
                                        id={`ep-btn-${ep.id}`}
                                        onClick={() => handlePlayEpisode(ep)}
                                        className={`relative h-10 rounded border transition-all duration-300 flex items-center justify-center font-bold text-xs overflow-hidden
                                            ${isActive
                                                ? 'bg-blue-600 border-blue-500 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)] scale-[1.05] z-10'
                                                : isWatched
                                                    ? 'bg-[#0a0a0a] border-[#222] text-gray-500 hover:text-gray-300 hover:border-gray-500'
                                                    : 'bg-[#111] border-[#333] text-gray-300 hover:bg-[#222] hover:text-white hover:border-blue-500/50'
                                            }`}
                                    >
                                        {ep.number}

                                        {/* Watched Progress Indicator */}
                                        {isWatched && !isActive && (
                                            <div className="absolute bottom-0 left-0 w-full h-[3px] bg-gray-600/50" />
                                        )}
                                        {/* Active Progress Indicator */}
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

                <div className="mt-6 flex flex-col md:flex-row gap-8">
                    <div className="w-full md:w-[220px] flex-shrink-0 flex flex-col gap-4">
                        <div className="aspect-[2/3] rounded-lg overflow-hidden border border-[#111]">
                            <img src={anime.image} alt={anime.title} className="w-full h-full object-cover grayscale-[10%]" />
                        </div>
                        <button
                            onClick={toggleWatchlist}
                            disabled={watchlistLoading}
                            className={`w-full flex items-center justify-center gap-2 py-3 rounded-md transition-colors border font-bold text-xs uppercase tracking-widest ${isInWatchlist
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

                    <div className="flex-1 flex flex-col">
                        <h1 className="text-3xl font-black mb-4 text-white leading-tight">{anime.title}</h1>
                        <p className="text-gray-400 text-sm leading-relaxed mb-6">{anime.description?.replace(/<[^>]*>/g, '') || "No synopsis available."}</p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm bg-[#030303] p-5 rounded-xl border border-[#111]">
                            <div className="flex gap-2"><span className="font-bold text-gray-500 w-24">Type:</span><span className="text-gray-300 font-medium">{anime.type || "TV"}</span></div>
                            <div className="flex gap-2"><span className="font-bold text-gray-500 w-24">Status:</span><span className="text-gray-300 font-medium">{anime.status || "Unknown"}</span></div>
                            <div className="flex gap-2"><span className="font-bold text-gray-500 w-24">Date Aired:</span><span className="text-gray-300 font-medium">{anime.releaseDate || "Unknown"}</span></div>
                            <div className="flex gap-2"><span className="font-bold text-gray-500 w-24">Score:</span><span className="text-gray-300 font-medium flex items-center gap-1"><Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" /> {anime.rating || "N/A"}</span></div>
                            <div className="flex gap-2 col-span-full mt-2">
                                <span className="font-bold text-gray-500 w-24 shrink-0">Genres:</span>
                                <div className="flex flex-wrap gap-2">
                                    {anime.genres?.map(genre => <span key={genre} className="text-[10px] border border-[#111] bg-[#0a0a0a] text-gray-300 px-2 py-1 rounded-sm uppercase tracking-wide">{genre}</span>)}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}