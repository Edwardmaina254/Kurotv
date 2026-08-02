const fs = require('fs');
let code = fs.readFileSync('src/pages/AnimeDetails.tsx', 'utf8');

const searchStr = `        const forceEnableSubtitles = () => {
            if (video.textTracks && video.textTracks.length > 0) {
                let isShowing = false;
                for (let i = 0; i < video.textTracks.length; i++) {
                    if (video.textTracks[i].mode === 'showing') {
                        isShowing = true;
                        break;
                    }
                }
                if (!isShowing) {
                    for (let i = 0; i < video.textTracks.length; i++) {
                        if (video.textTracks[i].kind === 'subtitles' || video.textTracks[i].kind === 'captions') {
                            video.textTracks[i].mode = 'showing';
                            break; // Only enable the first one
                        }
                    }
                }
            }
        };
        forceEnableSubtitles();`;

const replacementStr = `        let attempts = 0;
        const forceEnableSubtitles = () => {
            if (!videoRef.current) return;
            const currentVideo = videoRef.current;
            if (currentVideo.textTracks && currentVideo.textTracks.length > 0) {
                let isShowing = false;
                for (let i = 0; i < currentVideo.textTracks.length; i++) {
                    if (currentVideo.textTracks[i].mode === 'showing') {
                        isShowing = true;
                        break;
                    }
                }
                if (!isShowing) {
                    for (let i = 0; i < currentVideo.textTracks.length; i++) {
                        if (currentVideo.textTracks[i].kind === 'subtitles' || currentVideo.textTracks[i].kind === 'captions') {
                            currentVideo.textTracks[i].mode = 'showing';
                            break;
                        }
                    }
                }
            } else if (attempts < 20) {
                attempts++;
                setTimeout(forceEnableSubtitles, 500);
            }
        };
        forceEnableSubtitles();`;

if (code.includes('const forceEnableSubtitles = () => {')) {
    code = code.replace(/const forceEnableSubtitles = \(\) => \{[\s\S]*?forceEnableSubtitles\(\);/, replacementStr);
    fs.writeFileSync('src/pages/AnimeDetails.tsx', code);
    console.log('Patched AnimeDetails.tsx');
} else {
    console.log('Not found!');
}
