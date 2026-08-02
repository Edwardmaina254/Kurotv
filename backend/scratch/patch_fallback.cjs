const fs = require('fs');
let code = fs.readFileSync('backend/server.js', 'utf8');

const regex = /(const payload = await extractAniNekoStream[\s\S]*?if\s*\(payload\)\s*\{)/;
if (regex.test(code)) {
    code = code.replace(regex, "$1\n         if (payload.notAired) return res.json(payload);");
    fs.writeFileSync('backend/server.js', code);
    console.log('Successfully patched fallback bypass!');
} else {
    console.log('Failed to find target!');
}
