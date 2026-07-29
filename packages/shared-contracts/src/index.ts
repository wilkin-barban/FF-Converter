import { z } from 'zod';

export const EntityIdSchema = z.string().min(1).max(200).regex(/^[a-zA-Z0-9._:-]+$/);

export const AbsolutePathSchema = z.string()
  .min(1)
  .max(32767)
  .refine((value) => !value.includes('\0'), 'Path contains a null byte');

export const PathListSchema = z.array(AbsolutePathSchema).min(1).max(1000);

export const JobPrioritySchema = z.object({
  id: EntityIdSchema,
  priority: z.number().int().min(-1000).max(1000)
});

export const ResolvePlansSchema = z.object({
  filePaths: PathListSchema,
  presetId: EntityIdSchema
});

export const CreateJobSchema = z.object({
  inputPaths: PathListSchema,
  outputFolder: AbsolutePathSchema,
  presetId: EntityIdSchema,
  priority: z.number().int().min(-1000).max(1000).optional().default(0),
});

export const PresetSchema = z.object({
  id: EntityIdSchema.optional(),
  name: z.string().min(1),
  description: z.string(),
  category: z.string(),
  isSystem: z.boolean().default(false),
  targetContainer: z.string().min(1),
  videoCodec: z.string(),
  audioCodec: z.string(),
  maxWidth: z.number().optional(),
  maxHeight: z.number().optional(),
  maxFramerate: z.number().optional(),
  videoQuality: z.number().optional(),
  audioBitrate: z.string().optional(),
  hardwarePreference: z.enum(['auto', 'nvenc', 'qsv', 'amf', 'cpu']).default('auto'),
  fastStart: z.boolean().optional().default(true),
  preserveMetadata: z.boolean().optional().default(true),
  preserveSubtitles: z.boolean().optional().default(true),
  deviceFamily: z.enum(['generic', 'samsung', 'lg', 'android-tv', 'web', 'archive', 'audio']).optional(),
  videoProfile: z.string().max(50).optional(),
  videoLevel: z.string().max(20).optional(),
  pixelFormat: z.string().max(50).optional(),
  maxBitDepth: z.union([z.literal(8), z.literal(10), z.literal(12)]).optional(),
  hdrPolicy: z.enum(['preserve', 'tone-map-sdr']).optional(),
  subtitlePolicy: z.enum(['preserve-compatible', 'convert-compatible', 'remove', 'burn-in']).optional(),
  preferredAudioLanguage: z.string().min(2).max(20).optional(),
  audioStreamIndex: z.number().int().min(0).optional(),
  audioChannels: z.number().int().min(1).max(16).optional(),
  normalizeAudio: z.boolean().optional(),
  customFFmpegFlags: z.array(z.string().min(1).max(256)).max(32).optional()
    .superRefine((args, context) => {
      if (!args) return;
      const forbidden = new Set([
        '-i', '-y', '-n', '-progress', '-report', '-filter_script',
        '-filter_complex_script', '-attach', '-dump_attachment'
      ]);
      args.forEach((arg, index) => {
        if (forbidden.has(arg.toLowerCase()) || arg.includes('://') || arg.includes('\0')) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Unsafe custom FFmpeg argument: ${arg}`,
            path: [index]
          });
        }
      });
    }),
});

export const WatcherRuleSchema = z.object({
  id: EntityIdSchema.optional(),
  name: z.string().min(1),
  watchPath: AbsolutePathSchema,
  outputPath: AbsolutePathSchema,
  presetId: EntityIdSchema,
  includeSubfolders: z.boolean().default(false),
  allowedExtensions: z.array(z.string()).default(['.mp4', '.mkv', '.avi', '.mov', '.mp3', '.flac', '.wav', '.m4a', '.webm']),
  stabilizationSeconds: z.number().min(1).default(5),
  postAction: z.enum(['keep', 'delete', 'move']).default('keep'),
  moveDestination: AbsolutePathSchema.optional(),
  duplicatePolicy: z.enum(['overwrite', 'skip', 'suffix']).default('suffix'),
  enabled: z.boolean().default(true),
  processExisting: z.boolean().default(false),
});

export const AppSettingsSchema = z.object({
  maxConcurrentJobs: z.number().min(1).max(16).default(2),
  autoConcurrency: z.boolean().default(true),
  preferredHardware: z.enum(['auto', 'nvenc', 'qsv', 'amf', 'cpu']).default('auto'),
  ffmpegPathMode: z.enum(['bundled', 'system', 'custom']).default('bundled'),
  customFFmpegPath: AbsolutePathSchema.optional(),
  customFFprobePath: AbsolutePathSchema.optional(),
  duplicatePolicy: z.enum(['overwrite', 'skip', 'suffix']).default('suffix'),
  theme: z.enum(['dark', 'light', 'system']).default('dark'),
  language: z.enum(['es', 'en']).default('es'),
  autoStartWatchers: z.boolean().default(true),
  keepTempFilesOnFailure: z.boolean().default(false),
  desktopNotifications: z.boolean().default(false),
});

export type CreateJobInput = z.infer<typeof CreateJobSchema>;
export type PresetInput = z.infer<typeof PresetSchema>;
export type WatcherRuleInput = z.infer<typeof WatcherRuleSchema>;
export type AppSettingsInput = z.infer<typeof AppSettingsSchema>;
