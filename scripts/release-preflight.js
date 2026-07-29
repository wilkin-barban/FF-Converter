const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const allowSystem = process.argv.includes('--allow-system-ffmpeg');
const platformKey = process.platform === 'win32' ? 'win32-x64' : 'linux-x64';
const suffix = process.platform === 'win32' ? '.exe' : '';
const failures = [];
const warnings = [];

function requireFile(relativePath, label = relativePath) {
  const absolute = path.join(root, relativePath);
  if (!fs.existsSync(absolute) || fs.statSync(absolute).size === 0) failures.push(`${label}: falta ${relativePath}`);
  return absolute;
}

const ffmpeg = requireFile(`resources/ffmpeg/${platformKey}/ffmpeg${suffix}`, 'FFmpeg bundled');
const ffprobe = requireFile(`resources/ffmpeg/${platformKey}/ffprobe${suffix}`, 'FFprobe bundled');
requireFile('LICENSE');
const notices = requireFile('resources/ffmpeg/THIRD_PARTY_NOTICES.md');
requireFile('resources/ffmpeg/GPL-3.0.txt', 'Licencia GPLv3 de FFmpeg');
const manifestPath = requireFile('resources/ffmpeg/manifest.json', 'Manifiesto de FFmpeg');
requireFile('apps/desktop/dist/main/main.js', 'Build principal');
requireFile('apps/desktop/dist/preload/preload.js', 'Build preload');
requireFile('apps/desktop/dist/renderer/index.html', 'Build renderer');

if (fs.existsSync(notices) && /placeholder|before distributing/i.test(fs.readFileSync(notices, 'utf8'))) {
  failures.push('Los avisos legales de FFmpeg siguen siendo un placeholder.');
}
if (fs.existsSync(manifestPath)) {
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const platform = manifest.platforms?.[platformKey];
    if (!platform) {
      failures.push(`El manifiesto no contiene la plataforma ${platformKey}.`);
    } else {
      for (const [fileName, expectedHash] of Object.entries(platform.files ?? {})) {
        const binaryPath = path.join(root, 'resources', 'ffmpeg', platformKey, fileName);
        if (!fs.existsSync(binaryPath)) continue;
        const actualHash = crypto.createHash('sha256').update(fs.readFileSync(binaryPath)).digest('hex').toUpperCase();
        if (actualHash !== String(expectedHash).toUpperCase()) {
          failures.push(`Hash SHA-256 incorrecto para ${platformKey}/${fileName}.`);
        }
      }
    }
  } catch (error) {
    failures.push(`El manifiesto de FFmpeg no es válido: ${error.message}`);
  }
}
for (const binary of [ffmpeg, ffprobe]) {
  if (fs.existsSync(binary)) {
    const result = spawnSync(binary, ['-version'], { encoding: 'utf8', timeout: 15000 });
    if (result.status !== 0) failures.push(`El binario no puede ejecutarse: ${binary}`);
  }
}
const nativeCheck = spawnSync(process.execPath, ['-e', "require('better-sqlite3'); process.stdout.write('ok')"], { cwd: root, encoding: 'utf8', timeout: 15000 });
if (nativeCheck.status !== 0) failures.push(`better-sqlite3 no carga con Node local: ${nativeCheck.stderr.trim()}`);

if (allowSystem) {
  const ignored = failures.filter((failure) => /bundled|FFmpeg|FFprobe|avisos legales/i.test(failure));
  ignored.forEach((failure) => warnings.push(`[solo desarrollo] ${failure}`));
  for (const failure of ignored) failures.splice(failures.indexOf(failure), 1);
}
console.log(`Preflight de lanzamiento (${process.platform}/${process.arch})`);
warnings.forEach((warning) => console.warn(`WARN: ${warning}`));
if (failures.length) {
  failures.forEach((failure) => console.error(`FAIL: ${failure}`));
  console.error('Resultado: NO APTO para distribución.');
  process.exit(1);
}
console.log('Resultado: APTO para continuar con el empaquetado.');
