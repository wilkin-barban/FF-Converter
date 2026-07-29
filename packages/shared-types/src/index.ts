export type JobStatus =
  | 'DISCOVERED'
  | 'PENDING_ANALYSIS'
  | 'ANALYZING'
  | 'READY'
  | 'QUEUED'
  | 'RUNNING'
  | 'PAUSED'
  | 'CANCELLING'
  | 'CANCELLED'
  | 'FAILED'
  | 'COMPLETED'
  | 'INTERRUPTED'
  | 'SKIPPED'
  | 'VALIDATING_OUTPUT'
  | 'WAITING_FOR_FILE'
  | 'WAITING_FOR_SPACE'
  | 'NEEDS_ATTENTION';

export interface VideoStreamInfo {
  index: number;
  codec: string;
  codecLong?: string;
  profile?: string;
  level?: number;
  width: number;
  height: number;
  framerate: number;
  pixelFormat: string;
  bitDepth: number;
  isHdr: boolean;
  colorPrimaries?: string;
  transferCharacteristics?: string;
  rotation?: number;
  aspectRatio?: string;
  bitrate?: number;
}

export interface AudioStreamInfo {
  index: number;
  codec: string;
  codecLong?: string;
  channels: number;
  channelLayout?: string;
  sampleRate: number;
  bitrate?: number;
  language?: string;
  isDefault?: boolean;
}

export interface SubtitleStreamInfo {
  index: number;
  codec: string;
  language?: string;
  type?: string;
  isForced?: boolean;
  isDefault?: boolean;
}

export interface MediaSnapshot {
  filePath: string;
  container: string;
  durationSeconds: number;
  totalBitrate: number;
  fileSizeBytes: number;
  videoStreams: VideoStreamInfo[];
  audioStreams: AudioStreamInfo[];
  subtitleStreams: SubtitleStreamInfo[];
  metadata: Record<string, string>;
  analyzedAt: string;
}

export type CodecAction = 'copy' | 'transcode' | 'remove' | 'burn-in' | 'extract';

export interface EffectiveVideoPlan {
  action: CodecAction;
  encoder: string; // e.g. h264_nvenc, libx264
  streamIndex?: number;
  qualityMode?: 'cq' | 'crf' | 'cbr' | 'vbr';
  quality?: number;
  bitrate?: string;
  maxWidth?: number;
  maxHeight?: number;
  framerate?: number;
  pixelFormat?: string;
  profile?: string;
  level?: string;
  hdrAction?: 'preserve' | 'tone-map-sdr';
  customArgs?: string[];
}

export interface EffectiveAudioPlan {
  action: CodecAction;
  encoder: string; // e.g. aac, libmp3lame, copy
  streamIndex?: number;
  bitrate?: string;
  channels?: number;
  sampleRate?: number;
  normalizeVolume?: boolean;
  customArgs?: string[];
}

export interface EffectiveSubtitlePlan {
  action: CodecAction;
  streamIndex?: number;
  streamTypeIndex?: number;
  format?: string;
  encoder?: string;
}

export interface EffectiveConversionPlan {
  container: string; // mp4, mkv, m4a, mp3, flac, etc.
  video: EffectiveVideoPlan;
  audio: EffectiveAudioPlan;
  subtitles: EffectiveSubtitlePlan;
  fastStart?: boolean;
  metadataHandling?: 'preserve' | 'strip' | 'embed_cover';
  reasoning?: string[];
}

export interface PresetCategory {
  id: string;
  name: string;
  description: string;
}

export interface Preset {
  id: string;
  name: string;
  description: string;
  category: string;
  isSystem: boolean;
  targetContainer: string;
  videoCodec: string; // e.g., 'h264', 'h265', 'av1', 'copy', 'none'
  audioCodec: string; // e.g., 'aac', 'ac3', 'mp3', 'flac', 'copy', 'none'
  maxWidth?: number;
  maxHeight?: number;
  maxFramerate?: number;
  videoQuality?: number;
  audioBitrate?: string;
  hardwarePreference: 'auto' | 'nvenc' | 'qsv' | 'amf' | 'cpu';
  fastStart?: boolean;
  preserveMetadata?: boolean;
  preserveSubtitles?: boolean;
  customFFmpegFlags?: string[];
  deviceFamily?: 'generic' | 'samsung' | 'lg' | 'android-tv' | 'web' | 'archive' | 'audio';
  videoProfile?: string;
  videoLevel?: string;
  pixelFormat?: string;
  maxBitDepth?: 8 | 10 | 12;
  hdrPolicy?: 'preserve' | 'tone-map-sdr';
  subtitlePolicy?: 'preserve-compatible' | 'convert-compatible' | 'remove' | 'burn-in';
  preferredAudioLanguage?: string;
  audioStreamIndex?: number;
  audioChannels?: number;
  normalizeAudio?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Job {
  id: string;
  inputPath: string;
  outputPath: string;
  tempPath?: string;
  overwriteExisting?: boolean;
  presetId: string;
  presetName: string;
  status: JobStatus;
  priority: number;
  progressPercent: number;
  processedSeconds: number;
  totalSeconds: number;
  currentFps: number;
  currentSpeed: number;
  currentBitrate: string;
  etaSeconds: number;
  fileSizeBytes: number;
  outputSizeBytes?: number;
  error?: string;
  inspectionSnapshot?: MediaSnapshot;
  effectivePlan?: EffectiveConversionPlan;
  hardwareUsed?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface JobTransition {
  id: string;
  jobId: string;
  fromStatus?: JobStatus;
  toStatus: JobStatus;
  reason?: string;
  createdAt: string;
}

export interface WatcherRule {
  id: string;
  name: string;
  watchPath: string;
  outputPath: string;
  presetId: string;
  includeSubfolders: boolean;
  allowedExtensions: string[]; // e.g. ['.mp4', '.mkv', '.avi']
  stabilizationSeconds: number; // wait for file write to complete
  postAction: 'keep' | 'delete' | 'move';
  moveDestination?: string;
  duplicatePolicy: 'overwrite' | 'skip' | 'suffix';
  enabled: boolean;
  processExisting?: boolean;
  createdAt: string;
}

export interface HardwareEncoderSupport {
  id: string; // e.g. h264_nvenc
  name: string;
  type: 'nvenc' | 'qsv' | 'amf' | 'vaapi' | 'cpu';
  available: boolean;
  tested: boolean;
  errorDetails?: string;
}

export interface SystemCapabilities {
  ffmpegPath: string;
  ffprobePath: string;
  ffmpegVersion: string;
  requestedFfmpegPathMode?: 'bundled' | 'system' | 'custom';
  effectiveFfmpegPathMode?: 'bundled' | 'system' | 'custom';
  ffmpegPathFallbackReason?: string;
  hardwareEncoders: HardwareEncoderSupport[];
  availableCpuCores: number;
  platform: 'win32' | 'linux' | 'darwin';
}

export interface TechnicalReport {
  generatedAt: string;
  appVersion: string;
  electronVersion: string;
  nodeVersion: string;
  platform: string;
  architecture: string;
  availableBytesOnFfmpegVolume: number | null;
  capabilities: SystemCapabilities;
}

export interface AppSettings {
  maxConcurrentJobs: number;
  autoConcurrency: boolean;
  preferredHardware: 'auto' | 'nvenc' | 'qsv' | 'amf' | 'cpu';
  ffmpegPathMode: 'bundled' | 'system' | 'custom';
  customFFmpegPath?: string;
  customFFprobePath?: string;
  duplicatePolicy: 'overwrite' | 'skip' | 'suffix';
  theme: 'dark' | 'light' | 'system';
  language: 'es' | 'en';
  autoStartWatchers: boolean;
  keepTempFilesOnFailure: boolean;
  desktopNotifications: boolean;
}

export interface ProgressEventPayload {
  jobId: string;
  status: JobStatus;
  progressPercent: number;
  processedSeconds: number;
  totalSeconds: number;
  currentFps: number;
  currentSpeed: number;
  currentBitrate: string;
  etaSeconds: number;
  hardwareUsed?: string;
  error?: string;
}

export type LogLevel = 'info' | 'warn' | 'error';
export type LogSource = 'FFmpeg' | 'Queue' | 'Watcher' | 'Database' | 'Hardware' | 'System';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  source: LogSource;
  message: string;
  details?: string;
}
