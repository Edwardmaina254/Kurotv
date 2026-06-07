import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Play, Clock } from 'lucide-react';

interface ScheduledAnime {
    id: string;
    title: string;
    image: string;
    type: string;
    episode: number;
    airingAt: number;
}

export default function Schedule() {
    const navigate = useNavigate();
    const [schedule, setSchedule] = useState<ScheduledAnime[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeDay, setActiveDay] = useState(new Date().getDay());

    const days = [
        { label: 'SUN', index: 0 }, { label: 'MON', index: 1 }, { label: 'TUE', index: 2 },
        { label: 'WED', index: 3 }, { label: 'THU', index: 4 }, { label: 'FRI', index: 5 }, { label: 'SAT', index: 6 },
    ];

    useEffect(() => {
        const fetchScheduleForDay = async () => {
            setLoading(true);
            try {
                const now = new Date();
                const targetDate = new Date(now);
                targetDate.setDate(now.getDate() + (activeDay - now.getDay()));
                targetDate.setHours(0, 0, 0, 0);

                const startUnix = Math.floor(targetDate.getTime() / 1000);
                const endUnix = startUnix + (24 * 60 * 60) - 1;

                const query = `query ($start: Int, $end: Int) { Page(page: 1, perPage: 150) { airingSchedules(airingAt_greater: $start, airingAt_lesser: $end, sort: TIME) { airingAt episode media { id title { english romaji } coverImage { extraLarge } type isAdult } } } }`;
                const res = await fetch('https://graphql.anilist.co', {
                    method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({ query, variables: { start: startUnix, end: endUnix } })
                });
                const json = await res.json();
                const BANNED_ANIME_IDS = ['209940', '196840', '210234', '179950', '181284'];
                const formatted = (json?.data?.Page?.airingSchedules || [])
                    .filter((item: any) => item?.media?.isAdult === false && !BANNED_ANIME_IDS.includes(item?.media?.id?.toString()))
                    .map((item: any) => ({
                    id: item?.media?.id?.toString() || '', title: item?.media?.title?.english || item?.media?.title?.romaji || 'Unknown',
                    image: item?.media?.coverImage?.extraLarge || '', type: item?.media?.type || "TV",
                    episode: item?.episode || 1, airingAt: item?.airingAt || 0
                }));
                const seen = new Set();
                setSchedule(formatted.filter(anime => { if (seen.has(anime.id)) return false; seen.add(anime.id); return true; }));
            } catch (error) {
                console.error("Failed to load schedule", error);
                setSchedule([]);
            } finally { setLoading(false); }
        };
        fetchScheduleForDay();
    }, [activeDay]);

    return (
        <div className="min-h-screen pt-20 md:pt-24 pb-12 md:pb-16 px-4 md:px-10">
            <div className="max-w-[1400px] mx-auto">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-5 mb-6 md:mb-10" data-reveal>
                    <div className="flex items-center gap-3">
                        <Calendar className="w-4 h-4 md:w-5 md:h-5 text-accent" />
                        <h1 className="text-xl md:text-2xl font-bold tracking-tight font-display">Release Schedule</h1>
                    </div>
                    <div className="flex bg-surface border border-border rounded-lg md:rounded-xl p-0.5 overflow-x-auto shadow-sm scrollbar-hide">
                        {days.map((day) => (
                            <button key={day.label} onClick={() => setActiveDay(day.index)}
                                className={`px-3 md:px-5 py-1.5 md:py-2 text-[10px] md:text-[11px] font-semibold tracking-wider rounded-md md:rounded-lg transition-all whitespace-nowrap uppercase ${activeDay === day.index ? 'bg-accent text-white shadow-sm' : 'text-muted hover:text-fg hover:bg-bg'}`}>
                                {day.label}
                            </button>
                        ))}
                    </div>
                </div>

                {loading ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-y-6 md:gap-y-10 gap-x-3 md:gap-x-5">
                        {Array.from({ length: 12 }).map((_, i) => <div key={`skel-${i}`} className="aspect-[2/3] bg-border rounded-lg md:rounded-xl animate-pulse" />)}
                    </div>
                ) : schedule.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 md:py-24 text-muted bg-surface rounded-xl md:rounded-2xl border border-border">
                        <Clock className="w-8 h-8 md:w-10 md:h-10 mb-3 opacity-20" />
                        <h2 className="text-base md:text-lg font-bold tracking-tight">Nothing Scheduled</h2>
                        <p className="text-xs md:text-sm mt-1">No major releases for this day.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-y-6 md:gap-y-10 gap-x-3 md:gap-x-5">
                        {schedule.map((anime) => {
                            const timeString = new Date(anime.airingAt * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            return (
                                <div key={anime.id} onClick={() => navigate(`/anime/${anime.id}`)} className="group cursor-pointer" data-reveal>
                                    <div className="aspect-[2/3] bg-surface rounded-lg md:rounded-xl overflow-hidden mb-1.5 md:mb-2 border border-border relative">
                                        <img src={anime.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={anime.title} />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-end pb-2 md:pb-3 pl-2 md:pl-3">
                                            <div className="w-7 h-7 md:w-8 md:h-8 bg-accent rounded-full flex items-center justify-center"><Play className="w-3 h-3 md:w-3.5 md:h-3.5 text-white fill-current ml-0.5" /></div>
                                        </div>
                                        <span className="absolute top-2 left-2 md:top-3 md:left-3 bg-black/60 text-white text-[8px] md:text-[9px] font-semibold px-1.5 md:px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1"><Clock className="w-2.5 h-2.5 md:w-3 md:h-3" /> {timeString}</span>
                                        <span className="absolute top-2 right-2 md:top-3 md:right-3 bg-black/60 text-white text-[8px] md:text-[9px] font-semibold px-1.5 md:px-2 py-0.5 rounded-full uppercase tracking-wider">EP {anime.episode || "1"}</span>
                                    </div>
                                    <h4 className="font-semibold text-[11px] md:text-sm truncate text-fg group-hover:text-accent transition-colors">{anime.title}</h4>
                                    <span className="text-[9px] md:text-[10px] text-muted font-medium uppercase tracking-wider">{anime.type || "TV"}</span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
