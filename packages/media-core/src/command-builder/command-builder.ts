import { EffectiveConversionPlan } from '@ff-converter/shared-types';

export class CommandBuilder {
  public buildFFmpegArgs(
    inputPath: string,
    outputPath: string,
    plan: EffectiveConversionPlan
  ): string[] {
    const args: string[] = ['-y']; // overwrite temp output file automatically

    // Add progress reporting argument for pipe:1
    args.push('-progress', 'pipe:1');

    // Hardware decoding acceleration flags
    if (plan.video.encoder.includes('nvenc')) {
      args.push('-hwaccel', 'auto');
    } else if (plan.video.encoder.includes('qsv')) {
      args.push('-hwaccel', 'qsv');
    } else if (plan.video.encoder.includes('amf')) {
      args.push('-hwaccel', 'd3d11va');
    } else if (plan.video.encoder.includes('vaapi')) {
      args.push('-hwaccel', 'vaapi');
    }

    // Input file argument
    args.push('-i', inputPath);

    if (plan.video.action !== 'remove' && plan.video.streamIndex !== undefined) {
      args.push('-map', `0:${plan.video.streamIndex}`);
    }
    if (plan.audio.action !== 'remove' && plan.audio.streamIndex !== undefined) {
      args.push('-map', `0:${plan.audio.streamIndex}`);
    }
    if (
      ['copy', 'transcode'].includes(plan.subtitles.action) &&
      plan.subtitles.streamIndex !== undefined
    ) {
      args.push('-map', `0:${plan.subtitles.streamIndex}`);
    }

    // Video arguments
    if (plan.video.action === 'remove') {
      args.push('-vn');
    } else if (plan.video.action === 'copy') {
      args.push('-c:v', 'copy');
    } else {
      args.push('-c:v', plan.video.encoder);

      if (plan.video.quality) {
        if (plan.video.encoder.includes('nvenc')) {
          args.push('-cq', plan.video.quality.toString(), '-preset', 'p4');
        } else {
          args.push('-crf', plan.video.quality.toString(), '-preset', 'medium');
        }
      }

      if (plan.video.pixelFormat) {
        args.push('-pix_fmt', plan.video.pixelFormat);
      }

      if (plan.video.profile) args.push('-profile:v', plan.video.profile);
      if (plan.video.level) args.push('-level:v', plan.video.level);

      const videoFilters: string[] = [];
      if (plan.video.maxWidth || plan.video.maxHeight) {
        const w = plan.video.maxWidth || -2;
        const h = plan.video.maxHeight || -2;
        videoFilters.push(`scale=w='min(${w},iw)':h='min(${h},ih)':force_original_aspect_ratio=decrease`);
      }
      if (plan.video.hdrAction === 'tone-map-sdr') {
        videoFilters.push(
          'zscale=t=linear:npl=100',
          'tonemap=tonemap=hable:desat=0',
          'zscale=p=bt709:t=bt709:m=bt709:r=tv',
          'format=yuv420p'
        );
      }
      if (plan.subtitles.action === 'burn-in') {
        const escapedInput = inputPath
          .replace(/\\/g, '/')
          .replace(/:/g, '\\:')
          .replace(/'/g, "\\'");
        videoFilters.push(`subtitles='${escapedInput}':si=${plan.subtitles.streamTypeIndex || 0}`);
      }
      if (videoFilters.length > 0) {
        args.push('-vf', videoFilters.join(','));
      }

      if (plan.video.framerate) {
        args.push('-r', plan.video.framerate.toString());
      }
    }

    // Audio arguments
    if (plan.audio.action === 'remove') {
      args.push('-an');
    } else if (plan.audio.action === 'copy') {
      args.push('-c:a', 'copy');
    } else {
      args.push('-c:a', plan.audio.encoder);
      if (plan.audio.bitrate) {
        args.push('-b:a', plan.audio.bitrate);
      }
      if (plan.audio.channels) {
        args.push('-ac', plan.audio.channels.toString());
      }
      if (plan.audio.normalizeVolume) {
        args.push('-af', 'loudnorm');
      }
    }

    // Subtitle arguments
    if (plan.subtitles.action === 'remove') {
      args.push('-sn');
    } else if (plan.subtitles.action === 'copy') {
      args.push('-c:s', 'copy');
    } else if (plan.subtitles.action === 'transcode') {
      args.push('-c:s', plan.subtitles.encoder || 'srt');
    } else if (plan.subtitles.action === 'burn-in') {
      args.push('-sn');
    }

    // Metadata & faststart
    if (plan.fastStart && plan.container === 'mp4') {
      args.push('-movflags', '+faststart');
    }

    if (plan.metadataHandling === 'preserve') {
      args.push('-map_metadata', '0');
    }

    // Custom extra arguments
    if (plan.video.customArgs && plan.video.customArgs.length > 0) {
      args.push(...plan.video.customArgs);
    }

    // Output path
    args.push(outputPath);

    return args;
  }
}
