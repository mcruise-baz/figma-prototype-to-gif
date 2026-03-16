import fs from 'fs/promises';
import path from 'path';
import { chromium } from 'playwright';
import type { Browser, Page } from 'playwright';
import type { Job, JobResult, RenderRequest } from '../types';
import { encodeGif } from './ffmpeg';

type RunRenderJobArgs = {
  jobId: string;
  outputDir: string;
  onPatch: (patch: Partial<Job>) => void;
  request: RenderRequest;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeBaseName(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return 'prototype';
  return trimmed
    .replace(/https?:\/\//g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}

async function waitForStability(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout: 45_000 });
  // Figma prototypes can still settle after network idle (fonts, animations, etc.)
  await sleep(800);
}

async function captureFrames24fps(args: {
  page: Page;
  framesDir: string;
  durationSeconds: number;
  onProgress: (frame: number, totalFrames: number) => void;
}): Promise<{ totalFrames: number }> {
  const { page, framesDir, durationSeconds, onProgress } = args;
  const totalFrames = Math.max(1, Math.round(durationSeconds * 24));

  const frameIntervalMs = 1000 / 24;
  const start = performance.now();

  for (let i = 0; i < totalFrames; i++) {
    const framePath = path.join(framesDir, `frame_${String(i).padStart(6, '0')}.png`);
    await page.screenshot({ type: 'png', path: framePath });
    onProgress(i + 1, totalFrames);

    const target = start + (i + 1) * frameIntervalMs;
    const now = performance.now();
    const wait = target - now;
    if (wait > 0) await sleep(wait);
  }

  return { totalFrames };
}

export async function runRenderJob(args: RunRenderJobArgs): Promise<void> {
  const jobOutDir = path.join(args.outputDir, args.jobId);
  await fs.mkdir(jobOutDir, { recursive: true });

  let browser: Browser | undefined;
  try {
    args.onPatch({ status: 'running', progress: { phase: 'launching' } });

    browser = await chromium.launch({ headless: true });

    const { links, durationSeconds, viewport, quality } = args.request;

    const context = await browser.newContext({
      viewport: {
        width: viewport.width,
        height: viewport.height,
      },
      deviceScaleFactor: viewport.deviceScaleFactor ?? 1,
    });

    const results: JobResult[] = [];

    for (const link of links) {
      args.onPatch({
        progress: {
          phase: 'navigating',
          message: `Loading ${link}`,
        },
      });

      const page = await context.newPage();
      await page.goto(link, { waitUntil: 'networkidle', timeout: 60_000 }).catch(async (err) => {
        await page.close();
        throw err;
      });
      await waitForStability(page);

      const baseName = sanitizeBaseName(link);
      const framesDir = path.join(jobOutDir, `${baseName}_frames`);
      await fs.mkdir(framesDir, { recursive: true });

      args.onPatch({
        progress: {
          phase: 'capturing',
          message: `Capturing ${link}`,
        },
      });

      const { totalFrames } = await captureFrames24fps({
        page,
        framesDir,
        durationSeconds,
        onProgress: (frame, total) => {
          args.onPatch({
            progress: {
              phase: 'capturing',
              frame,
              totalFrames: total,
              message: `Capturing ${link} (${frame}/${total})`,
            },
          });
        },
      });

      await page.close();

      args.onPatch({
        progress: {
          phase: 'encoding',
          message: `Encoding GIF for ${link}`,
          totalFrames,
        },
      });

      const outputFileName = `${baseName}.gif`;
      const outputPath = path.join(jobOutDir, outputFileName);

      await encodeGif({
        framesDir,
        outputPath,
        fps: 24,
        scale: quality.scale,
        dither: quality.dither,
      });

      // remove frames to save disk
      await fs.rm(framesDir, { recursive: true, force: true });

      results.push({
        fileName: outputFileName,
        mimeType: 'image/gif',
      });
    }

    args.onPatch({
      status: 'succeeded',
      progress: { phase: 'finalizing', message: 'Done' },
      results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    args.onPatch({
      status: 'failed',
      progress: { phase: 'finalizing', message },
      error: message,
    });
  } finally {
    if (browser) await browser.close().catch(() => undefined);
  }
}

