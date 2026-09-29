import { buildSite } from '../src/site.js';
const registry = await buildSite();
console.log(`Static market built in _site: ${registry.latest.size} tools, ${registry.packages.size} verified packages.`);
