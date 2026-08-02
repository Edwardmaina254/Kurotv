const fs = require('fs');
let code = fs.readFileSync('src/pages/Profile.tsx', 'utf8');
code = code.replace(/import \{([^}]+)\} from 'lucide-react';/, (match, p1) => {
   if (!p1.includes('MonitorPlay')) {
       return "import {" + p1 + ", MonitorPlay } from 'lucide-react';";
   }
   return match;
});
fs.writeFileSync('src/pages/Profile.tsx', code);
console.log('Added MonitorPlay import');
