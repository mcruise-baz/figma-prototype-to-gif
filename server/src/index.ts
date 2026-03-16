import cors from 'cors';
import express from 'express';
import path from 'path';
import { z } from 'zod';
import { createJob, getJob, updateJob } from './jobStore';
import type { RenderRequest } from './types';
import { runRenderJob } from './render/renderJob';

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const PORT = Number(process.env.PORT ?? 8787);
const OUTPUT_DIR = process.env.OUTPUT_DIR
  ? path.resolve(process.env.OUTPUT_DIR)
  : path.resolve(process.cwd(), 'output');

const renderRequestSchema = z.object({
  links: z.array(z.string().url()).min(1),
  durationSeconds: z.number().min(1).max(120),
  viewport: z.object({
    preset: z.enum(['iphone-13', 'desktop-1440x900', 'custom']),
    width: z.number().int().min(200).max(4000),
    height: z.number().int().min(200).max(4000),
    deviceScaleFactor: z.number().min(1).max(3).optional(),
  }),
  quality: z.object({
    scale: z.number().min(0.25).max(1),
    dither: z.enum(['bayer', 'none']),
  }),
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/render', async (req, res) => {
  const parsed = renderRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const request: RenderRequest = parsed.data;
  const job = createJob(request);
  res.json({ jobId: job.id });

  // fire-and-forget background execution
  void runRenderJob({
    jobId: job.id,
    outputDir: OUTPUT_DIR,
    request,
    onPatch: (patch) => updateJob(job.id, patch),
  });
});

app.get('/api/jobs/:id', (req, res) => {
  const job = getJob(req.params.id);
  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }
  res.json(job);
});

app.get('/api/jobs/:id/download/:fileName', (req, res) => {
  const job = getJob(req.params.id);
  if (!job || job.status !== 'succeeded' || !job.results?.length) {
    res.status(404).json({ error: 'Not ready' });
    return;
  }
  const requested = req.params.fileName;
  const match = job.results.find((r) => r.fileName === requested);
  if (!match) {
    res.status(404).json({ error: 'File not found' });
    return;
  }
  const fullPath = path.join(OUTPUT_DIR, job.id, match.fileName);
  res.type('gif');
  res.sendFile(fullPath);
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://localhost:${PORT}`);
  // eslint-disable-next-line no-console
  console.log(`Output dir: ${OUTPUT_DIR}`);
});

