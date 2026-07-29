import { spawn } from 'child_process';
import fs from 'fs';
import { MediaSnapshot, VideoStreamInfo, AudioStreamInfo, SubtitleStreamInfo } from '@ff-converter/shared-types';

export class MediaInspector {
  constructor(private ffprobePath: string = 'ffprobe') {}

  public async inspect(filePath: string): Promise<MediaSnapshot> {
    return new Promise((resolve, reject) => {
      try {
        if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
          return reject(new Error(`Path '${filePath}' is a directory, not a media file.`));
        }
      } catch (_) {}

      const args = [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        filePath
      ];

      const child = spawn(this.ffprobePath, args);
      let stdoutData = '';
      let stderrData = '';

      child.stdout.on('data', (chunk) => {
        stdoutData += chunk.toString();
      });

      child.stderr.on('data', (chunk) => {
        stderrData += chunk.toString();
      });

      child.on('error', (err) => {
        reject(new Error(`Failed to spawn ffprobe at '${this.ffprobePath}': ${err.message}`));
      });

      child.on('close', (code) => {
        if (code !== 0) {
          return reject(new Error(`FFprobe exited with code ${code}: ${stderrData}`));
        }

        try {
          const raw = JSON.parse(stdoutData);
          const snapshot = this.parseRawProbe(filePath, raw);
          resolve(snapshot);
        } catch (e: any) {
          reject(new Error(`Failed to parse ffprobe output: ${e.message}`));
        }
      });
    });
  }

  private parseRawProbe(filePath: string, raw: any): MediaSnapshot {
    const format = raw.format || {};
    const streams = Array.isArray(raw.streams) ? raw.streams : [];

    const durationSeconds = parseFloat(format.duration || '0');
    const totalBitrate = parseInt(format.bit_rate || '0', 10);
    const fileSizeBytes = parseInt(format.size || '0', 10);
    const container = (format.format_name || '').split(',')[0] || 'unknown';

    const videoStreams: VideoStreamInfo[] = [];
    const audioStreams: AudioStreamInfo[] = [];
    const subtitleStreams: SubtitleStreamInfo[] = [];

    streams.forEach((st: any) => {
      const codecType = st.codec_type;
      if (codecType === 'video') {
        const fpsStr = st.r_frame_rate || st.avg_frame_rate || '30/1';
        let fps = 30;
        if (fpsStr.includes('/')) {
          const [num, den] = fpsStr.split('/').map(Number);
          fps = den > 0 ? num / den : 30;
        } else {
          fps = parseFloat(fpsStr) || 30;
        }

        const pixFmt = st.pix_fmt || 'yuv420p';
        const isHdr = Boolean(
          (st.color_transfer && ['smpte2084', 'arib-std-b67'].includes(st.color_transfer)) ||
          (st.color_primaries && st.color_primaries === 'bt2020')
        );

        videoStreams.push({
          index: st.index,
          codec: st.codec_name || 'unknown',
          codecLong: st.codec_long_name,
          profile: st.profile,
          level: st.level,
          width: st.width || 0,
          height: st.height || 0,
          framerate: Math.round(fps * 100) / 100,
          pixelFormat: pixFmt,
          bitDepth: pixFmt.includes('10') ? 10 : 8,
          isHdr,
          colorPrimaries: st.color_primaries,
          transferCharacteristics: st.color_transfer,
          bitrate: parseInt(st.bit_rate || '0', 10)
        });
      } else if (codecType === 'audio') {
        audioStreams.push({
          index: st.index,
          codec: st.codec_name || 'unknown',
          codecLong: st.codec_long_name,
          channels: st.channels || 2,
          channelLayout: st.channel_layout,
          sampleRate: parseInt(st.sample_rate || '44100', 10),
          bitrate: parseInt(st.bit_rate || '0', 10),
          language: st.tags?.language,
          isDefault: Boolean(st.disposition?.default)
        });
      } else if (codecType === 'subtitle') {
        const subtitleCodec = st.codec_name || 'unknown';
        const bitmapCodecs = new Set(['hdmv_pgs_subtitle', 'dvd_subtitle', 'dvb_subtitle', 'xsub']);
        subtitleStreams.push({
          index: st.index,
          codec: subtitleCodec,
          language: st.tags?.language,
          type: bitmapCodecs.has(subtitleCodec) ? 'bitmap' : 'text',
          isForced: Boolean(st.disposition?.forced),
          isDefault: Boolean(st.disposition?.default)
        });
      }
    });

    return {
      filePath,
      container,
      durationSeconds,
      totalBitrate,
      fileSizeBytes,
      videoStreams,
      audioStreams,
      subtitleStreams,
      metadata: format.tags || {},
      analyzedAt: new Date().toISOString()
    };
  }
}
