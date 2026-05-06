// src/pages/Schedule.tsx
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

    // Automatically default to today's day index (0 = Sunday, 6 = Saturday)
    const [activeDay, setActiveDay] = useState(new Date().getDay());

    const days = [
        { label: 'SUN', index: 0 },
        { label: 'MON', index: 1 },
        { label: 'TUE', index: 2 },
        { label: 'WED', index: 3 },
        { label: 'THU', index: 4 },
        { label: 'FRI', index: 5 },
        { label: 'SAT', index: 6 },
    ];

    useEffect(() => {
        const fetchSchedule = async () => {
            setLoading(true);
            try {
                const res = await fetch(`https://kurotv-production-9a26.up.railway.app/anime/zoro/schedule`);
                const data = await res.json();
                setSchedule(data.results || []);
            } catch (error) {
                console.error("Failed to load schedule", error);
            } finally {
                setLoading(false);
            }
        };

        fetchSchedule();
    }, []);

    // Filter the schedule list based on the active day tab
    const daySchedule = schedule
        .filter(anime => {
            if (!anime.airingAt) return false;
            return new Date(anime.airingAt * 1000).getDay() === activeDay;
        })
        .sort((a, b) => a.airingAt - b.airingAt); // Sort chronologically

    return (
        <div className="min-h-screen bg-[#040404] text-white pt-28 pb-20 px-6 md:px-12">
            <div className="max-w-[1400px] mx-auto">

                {/* 🛑 HEADER & DAY TOGGLES */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                    <div className="flex items-center gap-3">
                        <Calendar className="w-8 h-8 text-blue-500" />
                        <h1 className="text-3xl font-black uppercase tracking-widest">Release Schedule</h1>
                    </div>

                    <div className="flex bg-[#111] border border-[#222] rounded-xl p-1 shadow-inner overflow-x-auto custom-scrollbar">
                        {days.map((day) => (
                            <button
                                key={day.label}
                                onClick={() => setActiveDay(day.index)}
                                className={`px-6 py-2.5 text-xs font-black uppercase tracking-widest rounded-lg transition-all whitespace-nowrap ${activeDay === day.index
                                        ? 'bg-blue-600 text-white shadow-md'
                                        : 'text-gray-500 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                {day.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 🛑 RESULTS GRID */}
                {loading ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-y-10 gap-x-6">
                        {Array.from({ length: 12 }).map((_, i) => (
                            <div key={`skel-${i}`} className="aspect-[2/3] bg-white/5 rounded-[20px] animate-pulse" />
                        ))}
                    </div>
                ) : daySchedule.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-32 text-gray-500 bg-[#0a0a0a] rounded-2xl border border-[#111]">
                        <Clock className="w-12 h-12 mb-4 opacity-20" />
                        <h2 className="text-xl font-black uppercase tracking-widest">Nothing Scheduled</h2>
                        <p className="text-sm font-bold mt-2">There are no major releases scheduled for this day.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-y-10 gap-x-6">
                        {daySchedule.map((anime) => {
                            // Automatically formats the unix timestamp to local browser time (e.g., 8:30 PM)
                            const timeString = new Date(anime.airingAt * 1000).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit'
                            });

                            return (
                                <div
                                    key={anime.id}
                                    onClick={() => navigate(`/anime/${anime.id}`)}
                                    className="group cursor-pointer relative"
                                >
                                    <div className="aspect-[2/3] bg-[#0a0a0a] rounded-[20px] overflow-hidden mb-3 border border-white/5 group-hover:border-blue-500/50 transition-all duration-500 shadow-2xl relative">
                                        <img src={anime.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={anime.title} />

                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                                            <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center transform scale-75 group-hover:scale-100 transition-transform duration-300 shadow-[0_0_30px_rgba(37,99,235,0.6)]">
                                                <Play className="w-5 h-5 text-white fill-current ml-1" />
                                            </div>
                                        </div>

                                        {/* Airing Time Badge */}
                                        <div className="absolute top-3 left-3 bg-white/10 backdrop-blur-md border border-white/20 text-white text-[10px] font-black px-2 py-1 rounded-lg uppercase shadow-lg z-20 flex items-center gap-1.5">
                                            <Clock className="w-3 h-3" /> {timeString}
                                        </div>

                                        {/* Episode Badge */}
                                        <div className="absolute top-3 right-3 bg-blue-600 text-[10px] font-black px-2 py-1 rounded-lg uppercase shadow-lg z-20">
                                            EP {anime.episode || "1"}
                                        </div>
                                    </div>
                                    <h4 className="font-bold text-[14px] truncate text-gray-300 group-hover:text-blue-400 transition-all duration-300 px-1">{anime.title}</h4>
                                    <div className="flex items-center gap-2 mt-1 px-1">
                                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                                            {anime.type || "TV"}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}