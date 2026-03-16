import path from 'path';
import { spawn } from 'child_process';
import ffmpegStatic from 'ffmpeg-static';

type EncodeGifOptions = {
  framesDir: string;
  outputPath: string;
  fps: number;
  scale: number;
  dither: 'bayer' | 'none';
};

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { stdio: ['ignore', 'inherit', 'inherit'] });
    proc.on('error', (err) => reject(err));
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}`));
    });
  });
}

export async function encodeGif(options: EncodeGifOptions): Promise<void> {
  const { framesDir, outputPath, fps, scale, dither } = options;

  const ffmpegBin = (ffmpegStatic as string) || 'ffmpeg';
  const pattern = path.join(framesDir, 'frame_%06d.png');
  const palettePath = path.join(framesDir, 'palette.png');

  const scaleFilter = `scale=iw*${scale}:ih*${scale}:flags=lanczos`;

  // Step 1: palette generation
  await run(ffmpegBin, [
    '-y',
    '-framerate',
    String(fps),
    '-i',
    pattern,
    '-vf',
    `${scaleFilter},palettegen`,
    palettePath,
  ]);

  // Step 2: use palette to create final GIF with infinite loop
  const ditherFilter = dither === 'none' ? 'paletteuse=dither=none' : 'paletteuse=dither=bayer';

  await run(ffmpegBin, [
    '-y',
    '-framerate',
    String(fps),
    '-i',
    pattern,
    '-i',
    palettePath,
    '-lavfi',
    `${scaleFilter} [x]; [x][1:v] ${ditherFilter}`,
    '-loop',
    '0',
    outputPath,
  ]);
}

