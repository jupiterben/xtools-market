import { generateKeyPairSync } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';

await mkdir('.keys', { recursive: true });
await mkdir('registry', { recursive: true });
const { privateKey, publicKey } = generateKeyPairSync('ed25519');
// Never replace an existing signing identity implicitly.
await writeFile('.keys/market.pem', privateKey.export({ format: 'pem', type: 'pkcs8' }), { flag: 'wx', mode: 0o600 });
await writeFile('registry/trust.json', `${JSON.stringify({
  algorithm: 'Ed25519',
  publicKey: publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('hex'),
}, null, 2)}\n`, { flag: 'wx' });
console.log('Created signing identity. Back up .keys/market.pem securely; never commit it.');
