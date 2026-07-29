const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const requestedDir = process.argv[2];
const suffix = process.platform === 'win32' ? '.exe' : '';
const ffmpeg = requestedDir ? path.join(path.resolve(requestedDir), `ffmpeg${suffix}`) : `ffmpeg${suffix}`;
const ffprobe = requestedDir ? path.join(path.resolve(requestedDir), `ffprobe${suffix}`) : `ffprobe${suffix}`;
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'ff-converter-acceptance-'));
function run(binary, args, label) {
  const result = spawnSync(binary, args, { encoding: 'utf8', timeout: 120000, windowsHide: true });
  if (result.status !== 0) throw new Error(`${label}: ${result.stderr.slice(-1200)}`);
}
function codec(file, selector) {
  const result = spawnSync(ffprobe, ['-v', 'error', '-select_streams', selector, '-show_entries', 'stream=codec_name', '-of', 'default=nw=1:nk=1', file], { encoding: 'utf8', timeout: 30000 });
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stdout.trim();
}
try {
  const source = path.join(work, 'source.mkv');
  const h264 = path.join(work, 'h264.mp4');
  const h265 = path.join(work, 'h265.mkv');
  const audio = path.join(work, 'audio.m4a');
  run(ffmpeg, ['-hide_banner', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=320x180:rate=24', '-f', 'lavfi', '-i', 'sine=frequency=1000', '-t', '1', '-c:v', 'mpeg4', '-c:a', 'pcm_s16le', source], 'fixture');
  run(ffmpeg, ['-hide_banner', '-y', '-i', source, '-c:v', 'libx264', '-c:a', 'aac', h264], 'H.264');
  run(ffmpeg, ['-hide_banner', '-y', '-i', source, '-c:v', 'libx265', '-preset', 'ultrafast', '-c:a', 'aac', h265], 'H.265');
  run(ffmpeg, ['-hide_banner', '-y', '-i', source, '-vn', '-c:a', 'aac', audio], 'extracción AAC');
  if (codec(h264, 'v:0') !== 'h264') throw new Error('Salida H.264 inválida');
  if (codec(h265, 'v:0') !== 'hevc') throw new Error('Salida H.265 inválida');
  if (codec(audio, 'a:0') !== 'aac') throw new Error('Salida AAC inválida');
  console.log(`Matriz aprobada con ${requestedDir ? 'binarios bundled' : 'FFmpeg del sistema'}: H.264, H.265 y extracción AAC.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  fs.rmSync(work, { recursive: true, force: true });
}
