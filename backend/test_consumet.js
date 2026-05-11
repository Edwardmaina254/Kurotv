import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const consumet = require('@consumet/extensions');
const anilist = new consumet.META.Anilist();

anilist.search("jojo").then(r => console.log("Consumet results length:", r.results.length)).catch(console.error);
