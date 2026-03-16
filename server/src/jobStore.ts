import type { Job, RenderRequest } from './types';

const jobs = new Map<string, Job>();

function randomId(): string {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

export function createJob(request: RenderRequest): Job {
  const id = randomId();
  const job: Job = {
    id,
    createdAt: Date.now(),
    status: 'queued',
    request,
    progress: { phase: 'queued' },
  };
  jobs.set(id, job);
  return job;
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

export function updateJob(id: string, patch: Partial<Job>): Job | undefined {
  const job = jobs.get(id);
  if (!job) return undefined;
  const updated: Job = {
    ...job,
    ...patch,
    progress: patch.progress ? { ...job.progress, ...patch.progress } : job.progress,
  };
  jobs.set(id, updated);
  return updated;
}

