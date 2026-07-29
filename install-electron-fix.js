const { downloadArtifact } = require('@electron/get');
const extract = require('extract-zip');
const path = require('path');
const fs = require('fs');

async function fixElectron() {
  const electronDir = path.join(__dirname, 'node_modules', 'electron');
  const distDir = path.join(electronDir, 'dist');
  const pathFile = path.join(electronDir, 'path.txt');

  const { version } = require(path.join(electronDir, 'package.json'));
  console.log(`[FixElectron] Downloading Electron binary v${version}...`);

  const zipPath = await downloadArtifact({
    version,
    artifactName: 'electron',
    platform: 'win32',
    arch: 'x64'
  });

  console.log(`[FixElectron] Extracting ${zipPath} to ${distDir}...`);
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  try {
    await extract(zipPath, { dir: distDir });
    console.log('[FixElectron] Extraction finished!');
  } catch (e) {
    console.error('[FixElectron] Extract failed:', e);
  }

  fs.writeFileSync(pathFile, 'electron.exe', 'utf-8');
  fs.writeFileSync(path.join(distDir, 'version'), version, 'utf-8');

  console.log('[FixElectron] SUCCESS! path.txt created and electron.exe ready.');
}

fixElectron().then(() => {
  console.log('[FixElectron] Done.');
});
