require('dotenv').config({ path: require('node:path').resolve(__dirname, '../.env') });
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { randomBytes, createCipheriv, createDecipheriv } = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const run = promisify(execFile);

function configuration(databaseName) {
  const url = new URL(process.env.DATABASE_URL);
  const env = { ...process.env, PGHOST: url.hostname, PGPORT: url.port || '5432',
    PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: databaseName || url.pathname.slice(1), PGCONNECT_TIMEOUT: '5',
    PGSSLMODE: url.searchParams.get('sslmode') || (process.env.NODE_ENV === 'production' ? 'require' : 'prefer') };
  return { env, bin: process.env.PG_BIN || (process.platform === 'win32' ? 'C:/Program Files/PostgreSQL/16/bin' : '') };
}
async function pg(tool, args = [], databaseName, input) {
  args = ['--no-password', ...args];
  const { env, bin } = configuration(databaseName);
  const executable = bin ? path.join(bin, tool + (process.platform === 'win32' ? '.exe' : '')) : tool;
  if (input) {
    const { spawn } = require('node:child_process');
    await new Promise((resolve, reject) => {
      const child = spawn(executable, args, { env, windowsHide: true, stdio: ['pipe', 'ignore', 'pipe'] });
      const deadline = setTimeout(() => {
        child.kill();
        reject(new Error(`${tool} excedió el tiempo permitido.`));
      }, 60000);
      child.once('close', () => clearTimeout(deadline));
      // Do not print errors containing connection credentials or record data.
      child.stderr.resume();
      child.on('error', reject);
      child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`${tool} falló (${code}).`)));
      child.stdin.on('error', reject);
      child.stdin.end(input);
    });
    return;
  }
  return run(executable, args, { env, windowsHide: true, timeout: 30000, encoding: 'buffer', maxBuffer: 256 * 1024 * 1024 });
}
function backupKey(value = process.env.BACKUP_ENCRYPTION_KEY) {
  if (!/^[a-f0-9]{64}$/i.test(value || '')) throw new Error('Configure BACKUP_ENCRYPTION_KEY con 32 bytes hexadecimales en su gestor de secretos.');
  return Buffer.from(value, 'hex');
}
async function backup(file, key = backupKey()) {
  const { stdout } = await pg('pg_dump', ['--format=custom', '--no-owner', '--no-acl']);
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from('MedicalSys backup v1'));
  const ciphertext = Buffer.concat([cipher.update(stdout), cipher.final()]);
  await fs.mkdir(path.dirname(path.resolve(file)), { recursive: true });
  await fs.writeFile(file, Buffer.concat([Buffer.from('MED37'), iv, cipher.getAuthTag(), ciphertext]), { flag: 'wx', mode: 0o600 });
  return { bytes: ciphertext.length, encrypted: true };
}
async function restore(file, testDatabase, key = backupKey()) {
  // This tool is deliberately restricted to newly created test databases.
  if (!/^medicalsys_hu37_restore_\d{14}$/.test(testDatabase)) throw new Error('Restaurar solo en medicalsys_hu37_restore_YYYYMMDDHHMMSS; nunca sobre una base existente.');
  const content = await fs.readFile(file);
  if (content.subarray(0, 5).toString() !== 'MED37') throw new Error('Formato de respaldo no válido.');
  const decipher = createDecipheriv('aes-256-gcm', key, content.subarray(5, 17));
  decipher.setAAD(Buffer.from('MedicalSys backup v1'));
  decipher.setAuthTag(content.subarray(17, 33));
  const archive = Buffer.concat([decipher.update(content.subarray(33)), decipher.final()]);
  await pg('createdb', [testDatabase], 'postgres');
  await pg('pg_restore', ['--exit-on-error', '--no-owner', '--no-acl', '--dbname', testDatabase], testDatabase, archive);
}
async function inventory(databaseName) {
  const { stdout } = await pg('psql', ['--no-psqlrc', '--tuples-only', '--no-align', '--command',
    "SELECT table_schema || '.' || table_name FROM information_schema.tables WHERE table_type = 'BASE TABLE' AND table_schema NOT IN ('pg_catalog', 'information_schema') ORDER BY table_schema, table_name"], databaseName);
  const counts = {};
  for (const qualified of stdout.toString().trim().split(/\r?\n/).filter(Boolean)) {
    const identifiers = qualified.split('.').map((part) => '"' + part.replaceAll('"', '""') + '"').join('.');
    const result = await pg('psql', ['--no-psqlrc', '--tuples-only', '--no-align', '--command', `SELECT COUNT(*) FROM ${identifiers}`], databaseName);
    counts[qualified] = Number(result.stdout.toString().trim());
  }
  return counts;
}
async function verify() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'medicalsys-hu37-'));
  const file = path.join(directory, 'roundtrip.enc');
  const key = randomBytes(32);
  const testDatabase = 'medicalsys_hu37_restore_' + new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  const start = performance.now();
  const before = await inventory();
  const result = await backup(file, key);
  await restore(file, testDatabase, key);
  const after = await inventory(testDatabase);
  const matches = JSON.stringify(before) === JSON.stringify(after);
  if (!matches) throw new Error('Los conteos restaurados no coinciden.');
  return { ...result, testDatabase, tables: Object.keys(after).length, rows: Object.values(after).reduce((a, b) => a + b, 0), matches, durationMs: Math.round(performance.now() - start) };
}
if (require.main === module) {
  (async () => {
    const [command, file, databaseName] = process.argv.slice(2);
    const result = command === 'verify' ? await verify() : command === 'backup' ? await backup(file) : command === 'restore' ? await restore(file, databaseName) : (() => { throw new Error('Uso: backup.js verify | backup archivo.enc | restore archivo.enc base_prueba'); })();
    console.log(JSON.stringify({ event: 'backup.' + command, result: result || { restored: true } }));
  })().catch(() => { console.error('La operación de respaldo/restauración falló. Compruebe PG_BIN, conexión, permisos y clave; no se modificó la base original.'); process.exitCode = 1; });
}
module.exports = { backup, restore, verify };
