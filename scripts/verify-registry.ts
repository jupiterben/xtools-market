import { loadRegistry } from '../src/registry.js';
const registry = await loadRegistry('registry');
console.log(`Verified signature and ${registry.packages.size} packages (${registry.latest.size} tools).`);
