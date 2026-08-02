const fs = require('fs');
let code = fs.readFileSync('src/pages/Profile.tsx', 'utf8');

if (!code.includes('const [alwaysHD, setAlwaysHD]')) {
  code = code.replace('const [autoSkip, setAutoSkip] = useState', 'const [alwaysHD, setAlwaysHD] = useState(() => localStorage.getItem(\'kurotv_always_hd\') === \'true\');\n    const [autoSkip, setAutoSkip] = useState');
  
  const handleAlwaysHDChange = `
    const handleAlwaysHDChange = (value: boolean) => {
        setAlwaysHD(value);
        localStorage.setItem('kurotv_always_hd', value.toString());
        toast.success(value ? 'Always HD enabled' : 'Always HD disabled');
    };`;
    
  code = code.replace('const handleSkipChange = (value: boolean)', handleAlwaysHDChange + '\n\n    const handleSkipChange = (value: boolean)');
  
  const alwaysHDToggleUI = `
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 md:gap-4 pt-4 md:pt-5 border-t border-border">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-bg flex items-center justify-center border border-border shrink-0"><MonitorPlay className="w-3.5 h-3.5 md:w-4 md:h-4 text-accent" /></div>
                                            <div>
                                                <h3 className="text-xs md:text-sm font-semibold text-fg">Always HD</h3>
                                                <p className="text-[9px] md:text-[10px] text-muted uppercase tracking-wider mt-0.5">Force Highest Quality</p>
                                            </div>
                                        </div>
                                        <button onClick={() => handleAlwaysHDChange(!alwaysHD)} className={\`relative w-11 h-5 rounded-full transition-colors duration-300 shrink-0 \${alwaysHD ? 'bg-accent' : 'bg-border'}\`}>
                                            <div className={\`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-300 \${alwaysHD ? 'translate-x-6' : 'translate-x-0'}\`} />
                                        </button>
                                    </div>`;
                                    
  const searchUI = `                                        </button>\n                                    </div>`;
  code = code.replace(searchUI, searchUI + alwaysHDToggleUI);
  
  if(!code.includes('MonitorPlay')) {
     code = code.replace('FastForward', 'FastForward, MonitorPlay');
  }
  
  fs.writeFileSync('src/pages/Profile.tsx', code);
  console.log('Patched Profile.tsx');
} else {
  console.log('Already patched');
}
