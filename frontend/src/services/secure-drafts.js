const PREFIX = 'medicalsys-draft:';
const TTL = 8 * 60 * 60 * 1000;
const keys = new Map();
const versions = new Map();
let generation = 0;
function keyDatabase() {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('medicalsys-draft-keys', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('keys');
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
}
async function sessionKey(scope) {
  if (!crypto.subtle) throw new Error('El guardado seguro requiere HTTPS.');
  let session = sessionStorage.getItem(PREFIX + 'session');
  if (!session) { session = crypto.randomUUID(); sessionStorage.setItem(PREFIX + 'session', session); }
  const keyId = session + ':' + scope;
  if (!keys.has(keyId)) keys.set(keyId, (async () => {
    const db = await keyDatabase();
    try {
      const stored = await new Promise((resolve, reject) => {
        const read = db.transaction('keys').objectStore('keys').get(keyId);
        read.onsuccess = () => resolve(read.result); read.onerror = () => reject(read.error);
      });
      if (stored && Date.now() - stored.createdAt < TTL) return stored.key;
      const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      await new Promise((resolve, reject) => {
        const tx = db.transaction('keys', 'readwrite');
        tx.objectStore('keys').put({ key, createdAt: Date.now() }, keyId);
        tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
      });
      return key;
    } finally { db.close(); }
  })());
  return keys.get(keyId);
}
const encode = (bytes) => {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 16384) binary += String.fromCharCode(...bytes.subarray(offset, offset + 16384));
  return btoa(binary);
};
const decode = (value) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
export async function saveDraft(scope, value) {
  const version = generation;
  const revision = (versions.get(scope) || 0) + 1;
  versions.set(scope, revision);
  const key = await sessionKey(scope);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(value));
  if (data.length > 128 * 1024) throw new Error('Borrador demasiado grande.');
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(scope) }, key, data);
  if (version !== generation || versions.get(scope) !== revision) return;
  sessionStorage.setItem(PREFIX + scope, JSON.stringify({ iv: encode(iv), data: encode(new Uint8Array(encrypted)), createdAt: Date.now() }));
}
export async function loadDraft(scope) {
  const raw = sessionStorage.getItem(PREFIX + scope);
  if (!raw) return null;
  try {
    const saved = JSON.parse(raw);
    if (Date.now() - saved.createdAt > TTL) { removeDraft(scope); return null; }
    const key = await sessionKey(scope);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(saved.iv), additionalData: new TextEncoder().encode(scope) }, key, decode(saved.data));
    return JSON.parse(new TextDecoder().decode(plain));
  } catch (_) { removeDraft(scope); return null; }
}
export function removeDraft(scope) { versions.set(scope, (versions.get(scope) || 0) + 1); sessionStorage.removeItem(PREFIX + scope); }
export async function clearDrafts() {
  generation++;
  keys.clear();
  for (const key of Object.keys(sessionStorage)) if (key.startsWith(PREFIX)) sessionStorage.removeItem(key);
  try {
    const db = await keyDatabase();
    const tx = db.transaction('keys', 'readwrite'); tx.objectStore('keys').clear();
    tx.oncomplete = () => db.close();
  } catch (_) {}
}
