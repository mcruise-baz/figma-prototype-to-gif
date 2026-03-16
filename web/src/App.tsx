import type { FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import './App.css'

type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed'

type JobProgress = {
  phase: 'queued' | 'launching' | 'navigating' | 'capturing' | 'encoding' | 'finalizing'
  frame?: number
  totalFrames?: number
  message?: string
}

type JobResult = {
  fileName: string
  mimeType: 'image/gif'
}

type Job = {
  id: string
  status: JobStatus
  progress: JobProgress
  results?: JobResult[]
  error?: string
}

type ViewportPreset = 'iphone-13' | 'desktop-1440x900' | 'custom'

const defaultViewportByPreset: Record<
  ViewportPreset,
  { width: number; height: number; deviceScaleFactor: number }
> = {
  'iphone-13': { width: 390, height: 844, deviceScaleFactor: 3 },
  'desktop-1440x900': { width: 1440, height: 900, deviceScaleFactor: 2 },
  custom: { width: 1080, height: 1080, deviceScaleFactor: 2 },
}

function App() {
  const [linksText, setLinksText] = useState('')
  const [durationSeconds, setDurationSeconds] = useState(10)
  const [preset, setPreset] = useState<ViewportPreset>('iphone-13')
  const [customWidth, setCustomWidth] = useState(1080)
  const [customHeight, setCustomHeight] = useState(1080)
  const [qualityScale, setQualityScale] = useState(0.75)
  const [dither, setDither] = useState<'bayer' | 'none'>('bayer')

  const [jobId, setJobId] = useState<string | null>(null)
  const [job, setJob] = useState<Job | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const links = useMemo(
    () =>
      linksText
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean),
    [linksText],
  )

  const effectiveViewport = useMemo(() => {
    const base = defaultViewportByPreset[preset]
    if (preset === 'custom') {
      return {
        width: customWidth,
        height: customHeight,
        deviceScaleFactor: base.deviceScaleFactor,
      }
    }
    return base
  }, [preset, customWidth, customHeight])

  useEffect(() => {
    if (!jobId) return
    let cancelled = false

    async function poll() {
      try {
        const res = await fetch(`/api/jobs/${jobId}`)
        if (!res.ok) return
        const data: Job = await res.json()
        if (cancelled) return
        setJob(data)

        if (data.status === 'queued' || data.status === 'running') {
          setTimeout(poll, 1000)
        }
      } catch {
        if (!cancelled) {
          setTimeout(poll, 2000)
        }
      }
    }

    poll()
    return () => {
      cancelled = true
    }
  }, [jobId])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!links.length) return

    setIsSubmitting(true)
    setJob(null)
    setJobId(null)

    try {
      const body = {
        links,
        durationSeconds,
        viewport: {
          preset,
          width: effectiveViewport.width,
          height: effectiveViewport.height,
          deviceScaleFactor: effectiveViewport.deviceScaleFactor,
        },
        quality: {
          scale: qualityScale,
          dither,
        },
      }

      const res = await fetch('/api/render', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        // eslint-disable-next-line no-console
        console.error('Failed to start render', await res.text())
        setIsSubmitting(false)
        return
      }

      const data = (await res.json()) as { jobId: string }
      setJobId(data.jobId)
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error starting render', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const canSubmit = links.length > 0 && durationSeconds > 0 && !isSubmitting

  return (
    <div className="app-root">
      <header className="app-header">
        <h1>Figma prototype → 24fps GIF</h1>
        <p>Paste public prototype links, choose duration, and get endlessly looping GIFs.</p>
      </header>

      <main className="app-main">
        <section className="card">
          <h2>1. Links &amp; settings</h2>
          <form className="form-grid" onSubmit={handleSubmit}>
            <label className="field">
              <span>Prototype links</span>
              <textarea
                value={linksText}
                onChange={(e) => setLinksText(e.target.value)}
                placeholder="One Figma prototype link per line…"
                rows={5}
              />
              <small>{links.length} link{links.length === 1 ? '' : 's'} detected</small>
            </label>

            <div className="field-row">
              <label className="field">
                <span>Duration (seconds)</span>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={durationSeconds}
                  onChange={(e) => setDurationSeconds(Number(e.target.value) || 0)}
                />
              </label>

              <label className="field">
                <span>Viewport preset</span>
                <select
                  value={preset}
                  onChange={(e) => setPreset(e.target.value as ViewportPreset)}
                >
                  <option value="iphone-13">iPhone 13 (390×844)</option>
                  <option value="desktop-1440x900">Desktop 1440×900</option>
                  <option value="custom">Custom</option>
                </select>
              </label>
            </div>

            {preset === 'custom' && (
              <div className="field-row">
                <label className="field">
                  <span>Width</span>
                  <input
                    type="number"
                    min={200}
                    max={4000}
                    value={customWidth}
                    onChange={(e) => setCustomWidth(Number(e.target.value) || 0)}
                  />
                </label>
                <label className="field">
                  <span>Height</span>
                  <input
                    type="number"
                    min={200}
                    max={4000}
                    value={customHeight}
                    onChange={(e) => setCustomHeight(Number(e.target.value) || 0)}
                  />
                </label>
              </div>
            )}

            <div className="field-row">
              <label className="field">
                <span>Quality (scale)</span>
                <input
                  type="range"
                  min={0.25}
                  max={1}
                  step={0.05}
                  value={qualityScale}
                  onChange={(e) => setQualityScale(Number(e.target.value))}
                />
                <small>{Math.round(qualityScale * 100)}% size</small>
              </label>

              <label className="field">
                <span>Dithering</span>
                <select
                  value={dither}
                  onChange={(e) => setDither(e.target.value as 'bayer' | 'none')}
                >
                  <option value="bayer">Bayer (smoother gradients)</option>
                  <option value="none">None (sharper, smaller)</option>
                </select>
              </label>
            </div>

            <div className="actions">
              <button type="submit" disabled={!canSubmit}>
                {isSubmitting ? 'Starting…' : 'Render GIFs'}
              </button>
            </div>
          </form>
        </section>

        <section className="card">
          <h2>2. Progress &amp; downloads</h2>
          {!jobId && <p>No render started yet.</p>}
          {jobId && !job && <p>Starting job {jobId}…</p>}
          {job && (
            <>
              <p>
                Job <code>{job.id}</code> – <strong>{job.status}</strong>
              </p>
              {job.progress && (
                <p>
                  <strong>Phase:</strong> {job.progress.phase}
                  {job.progress.message ? ` – ${job.progress.message}` : null}
                  {typeof job.progress.frame === 'number' &&
                    typeof job.progress.totalFrames === 'number' && (
                      <>
                        {' '}
                        ({job.progress.frame}/{job.progress.totalFrames} frames)
                      </>
                    )}
                </p>
              )}
              {job.error && (
                <p className="error">
                  Error: {job.error}
                </p>
              )}

              {job.status === 'succeeded' && job.results && job.results.length > 0 && (
                <ul className="results-list">
                  {job.results.map((r) => (
                    <li key={r.fileName}>
                      <span>{r.fileName}</span>
                      <a
                        href={`/api/jobs/${job.id}/download/${encodeURIComponent(r.fileName)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Download GIF
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  )
}

export default App
