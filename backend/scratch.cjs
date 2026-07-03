(async () => {
    const vidUrl = 'https://bibiemb.xyz/aged17efae9a120bc79807e4a083b696d14h';
    console.log('Fetching:', vidUrl);
    const vidRes = await fetch(vidUrl, { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://anineko.to/' } });
    const vidHtml = await vidRes.text();
    const m3u8Match = vidHtml.match(/["']([^"']+\.m3u8.*?)["']/);
    console.log('m3u8 Match:', m3u8Match ? m3u8Match[1] : 'None');
    if (!m3u8Match) {
        console.log('Response Status:', vidRes.status);
        console.log('HTML snippet:', vidHtml.substring(0, 1000));
    }
})();
