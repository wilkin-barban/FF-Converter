const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const executable = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(root, 'dist-app', 'win-unpacked', 'FF-Converter.exe');
if (!fs.existsSync(executable)) {
  console.error(`No se encontró el ejecutable empaquetado: ${executable}`);
  process.exit(1);
}
const result = spawnSync(executable, ['--smoke-test'], {
  encoding: 'utf8', timeout: 30000, windowsHide: true,
  env: { ...process.env, FF_CONVERTER_SMOKE_TEST: '1' }
});
if (result.error || result.status !== 0) {
  console.error(result.error?.message || result.stderr || `Salida ${result.status}`);
  process.exit(1);
}
console.log(`Smoke test aprobado: ${executable}`);
