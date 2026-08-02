const fs = require('fs');
let code = fs.readFileSync('src/pages/AnimeDetails.tsx', 'utf8');

const regex = /if\s*\(\s*data\.error\s*\|\|\s*!data\.sources\s*\|\|\s*data\.sources\.length\s*===\s*0\s*\)\s*\{[\s\S]*?setIsFetchingStream\(false\);\s*return;\s*\}/;

const rep = `if (data.error || !data.sources || data.sources.length === 0) {
                if (data.error === "PREMIERE_AWAITING" || data.error === "UPLOADING_DELAY") {
                    setStreamData(data);
                } else {
                    setStreamError(data.error || "Stream Unavailable. All streaming providers failed to respond.");
                }
                setIsFetchingStream(false);
                return;
            }`;

if (regex.test(code)) {
    code = code.replace(regex, rep);
    fs.writeFileSync('src/pages/AnimeDetails.tsx', code);
    console.log('Successfully patched AnimeDetails.tsx via regex!');
} else {
    console.log('Failed to find target via regex!');
}
