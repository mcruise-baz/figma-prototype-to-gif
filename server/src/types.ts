export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export type ViewportPreset =
  | 'iphone-13'
  | 'desktop-1440x900'
  | 'custom';

export type RenderRequest = {
  links: string[];
  durationSeconds: number;
  viewport: {
    preset: ViewportPreset;
    width: number;
    height: number;
    deviceScaleFactor?: number;
  };
  quality: {
    scale: number; // 0.25..1
    dither: 'bayer' | 'none';
  };
};

export type JobProgress = {
  phase:
    | 'queued'
    | 'launching'
    | 'navigating'
    | 'capturing'
    | 'encoding'
    | 'finalizing';
  frame?: number;
  totalFrames?: number;
  message?: string;
};

export type JobResult = {
  fileName: string;
  mimeType: 'image/gif';
};

export type Job = {
  id: string;
  createdAt: number;
  status: JobStatus;
  request: RenderRequest;
  progress: JobProgress;
  error?: string;
  results?: JobResult[];
};

