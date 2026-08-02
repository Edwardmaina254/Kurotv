const fs = require('fs');
let code = fs.readFileSync('src/pages/AnimeDetails.tsx', 'utf8');

const newComponent = `
const PremiereCountdown = ({ airingAt }: { airingAt: number }) => {
    const [timeLeft, setTimeLeft] = React.useState<{ d: number, h: number, m: number, s: number } | null>(null);

    React.useEffect(() => {
        const calculateTimeLeft = () => {
            const difference = (airingAt * 1000) - new Date().getTime();
            if (difference > 0) {
                setTimeLeft({
                    d: Math.floor(difference / (1000 * 60 * 60 * 24)),
                    h: Math.floor((difference / (1000 * 60 * 60)) % 24),
                    m: Math.floor((difference / 1000 / 60) % 60),
                    s: Math.floor((difference / 1000) % 60)
                });
            } else {
                setTimeLeft(null);
            }
        };

        calculateTimeLeft();
        const timer = setInterval(calculateTimeLeft, 1000);
        return () => clearInterval(timer);
    }, [airingAt]);

    if (!timeLeft) return <span className="animate-pulse text-accent">Airing Imminently...</span>;

    return (
        <div className="flex gap-3 text-white text-center mt-2 mb-4">
            <div className="flex flex-col bg-white/5 rounded-lg p-2 min-w-[60px] border border-white/10">
                <span className="text-2xl font-black">{timeLeft.d}</span>
                <span className="text-[10px] text-muted tracking-widest">DAYS</span>
            </div>
            <div className="flex flex-col bg-white/5 rounded-lg p-2 min-w-[60px] border border-white/10">
                <span className="text-2xl font-black">{timeLeft.h.toString().padStart(2, '0')}</span>
                <span className="text-[10px] text-muted tracking-widest">HOURS</span>
            </div>
            <div className="flex flex-col bg-white/5 rounded-lg p-2 min-w-[60px] border border-white/10">
                <span className="text-2xl font-black">{timeLeft.m.toString().padStart(2, '0')}</span>
                <span className="text-[10px] text-muted tracking-widest">MINS</span>
            </div>
            <div className="flex flex-col bg-white/5 rounded-lg p-2 min-w-[60px] border border-white/10">
                <span className="text-2xl font-black">{timeLeft.s.toString().padStart(2, '0')}</span>
                <span className="text-[10px] text-muted tracking-widest">SECS</span>
            </div>
        </div>
    );
};
`;

if (!code.includes('const PremiereCountdown')) {
    code = code.replace('const AnimeDetails = () => {', newComponent + '\nconst AnimeDetails = () => {');
    
    // Inject the component into the render
    const regex = /(<p className="text-muted text-sm mb-6 text-center max-w-xs px-4">[\s\S]*?<\/p>)\s*<div className="flex gap-3">/;
    
    if (regex.test(code)) {
        code = code.replace(regex, "$1\n                                                {!isUploading && streamData.airingAt && <PremiereCountdown airingAt={streamData.airingAt} />}\n                                                <div className=\"flex gap-3 mt-4\">");
        fs.writeFileSync('src/pages/AnimeDetails.tsx', code);
        console.log('Successfully added PremiereCountdown!');
    } else {
        console.log('Failed to find JSX render target!');
    }
} else {
    console.log('Component already exists!');
}
