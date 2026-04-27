import { Fragment } from 'react'
import { Navigate, NavLink } from 'react-router-dom'
import { CalendarDays, Check, Clock, Image as ImageIcon, LogIn, PenSquare, Search, ShieldCheck, Sparkles, Plus } from 'lucide-react'
import AppLogo from '@/components/AppLogo'
import { useAuth } from '@/context/AuthContext'
import { Skeleton } from '@/components/ui/skeleton'

const productHighlights = [
  {
    eyebrow: 'Editor',
    title: 'Write inside a real publishing workspace',
    body: 'TipTap editing, first-comment flow, media attachments, and AI-assisted caption drafting without bouncing between tools.',
    detail: 'TipTap, comments, and media all stay in one focused surface.',
  },
  {
    eyebrow: 'Scheduler',
    title: 'Queue posts that actually ship on time',
    body: 'Timezone-aware scheduling, a background publishing worker, and clear states for draft, scheduled, publishing, published, or failed.',
    detail: 'The workflow reads like operations, not a hopeful reminder.',
  },
  {
    eyebrow: 'Review',
    title: 'Keep shipped posts in one workspace',
    body: 'Published posts stay visible beside drafts and scheduled work so the workflow feels active instead of one-and-done.',
    detail: 'Your posting history stays where the work started.',
  },
]

const featureGrid = [
  {
    eyebrow: 'Compose',
    title: 'Rich editor',
    copy: 'TipTap-powered composition with character awareness, links, placeholders, and space for first-comment strategy.',
    points: ['Character-aware drafting', 'First comment and link flow'],
    metric: 'Built for editing, not plain textarea posting.',
    icon: PenSquare,
  },
  {
    eyebrow: 'Schedule',
    title: 'Calendar queue',
    copy: 'A scheduling view that feels operational, not ornamental. See what is queued, live, and still waiting for polish.',
    points: ['Timezone-aware publishing', 'Visible draft-to-live states'],
    metric: 'The queue behaves like a working timeline.',
    icon: CalendarDays,
  },
  {
    eyebrow: 'Assist',
    title: 'AI drafting',
    copy: 'Generate a strong first pass from an idea, then refine it yourself instead of handing the whole voice over to automation.',
    points: ['Prompt-to-caption starting point', 'Human revision stays in control'],
    metric: 'AI is a drafting partner, not the product voice.',
    icon: Sparkles,
  },
  {
    eyebrow: 'Media',
    title: 'Self-hosted media',
    copy: 'Images stay in Postgres, get cache-friendly delivery, and travel with your database backups.',
    points: ['Upload once to the library', 'Serve directly from Postgres'],
    metric: 'Storage follows the database you already own.',
    icon: ImageIcon,
  },
  {
    eyebrow: 'Operate',
    title: 'Operational status',
    copy: 'Publishing is treated like a live system with visible state, not a black box where failures disappear.',
    points: ['Draft, scheduled, publishing, failed', 'Failures stay legible'],
    metric: 'Clear state makes the tool safer to trust.',
    icon: ShieldCheck,
  },
  {
    eyebrow: 'Review',
    title: 'Post history',
    copy: 'Published work stays in the product so you can review what shipped without leaving your workspace.',
    points: ['Published posts stay searchable', 'Drafts stay beside shipped work'],
    metric: 'The loop stays visible after the post goes live.',
    icon: ShieldCheck,
  },
]

const workflowSteps = [
  {
    step: '01',
    phase: 'Compose',
    title: 'Draft with context',
    body: 'Write in the editor, attach media, add a first comment, or use AI to get to a strong first pass faster.',
    detailLabel: 'Inside this step',
    detailTitle: 'Shape the post before it ever touches the queue.',
    chips: ['Editor ready', 'Image attached', 'First comment lined up'],
    visual: 'compose',
  },
  {
    step: '02',
    phase: 'Schedule',
    title: 'Queue the post',
    body: 'Choose the publish time, keep everything in your own workflow, and see the post move through clear states.',
    detailLabel: 'Inside this step',
    detailTitle: 'Set the handoff time and let the scheduler own the transition.',
    chips: ['Timezone saved', 'Worker picks it up', 'Status stays visible'],
    visual: 'schedule',
  },
  {
    step: '03',
    phase: 'Review',
    title: 'Review the outcome',
    body: 'Published posts stay in the product so the workflow stays useful after the post is live.',
    detailLabel: 'Inside this step',
    detailTitle: 'Use your shipped-post history to decide what the next post should do.',
    chips: ['Post published', 'Posts stay searchable', 'Next draft gets easier'],
    visual: 'review',
  },
]

function StepVisual({ type }) {
  if (type === 'compose') {
    return (
      <div className="setup-visual setup-visual-compose" aria-hidden>
        <div className="sv-compose-head">
          <span className="sv-avatar">LP</span>
          <div className="sv-compose-id">
            <span className="sv-compose-name">
              Lam Nguyen <span className="sv-compose-role">· Building LinkedPush</span>
            </span>
            <span className="sv-compose-meta">Posting to LinkedIn · Public</span>
          </div>
          <span className="sv-compose-pill">Draft</span>
        </div>
        <p className="sv-compose-body">
          Building in public taught me 3 things about LinkedIn that took me a year to unlearn —
        </p>
        <div className="sv-compose-foot">
          <span className="sv-mini-thumb sv-mini-thumb-sky" />
          <span className="sv-mini-thumb sv-mini-thumb-ui">
            <span className="sv-mini-thumb-chip" />
          </span>
          <span className="sv-mini-thumb-add">
            <Plus size={10} strokeWidth={2.5} />
          </span>
          <span className="sv-compose-count">847 / 3000</span>
        </div>
      </div>
    )
  }
  if (type === 'schedule') {
    const days = [
      { letter: 'M', num: 28 },
      { letter: 'T', num: 29, dot: true },
      { letter: 'W', num: 30 },
      { letter: 'T', num: 1 },
      { letter: 'F', num: 2, dot: true },
      { letter: 'S', num: 3, dot: true },
      { letter: 'S', num: 4 },
    ]
    return (
      <div className="setup-visual setup-visual-schedule" aria-hidden>
        <div className="sv-sched-head">
          <span className="sv-sched-eyebrow">WEEK OF APR 28</span>
          <span className="sv-sched-count">
            <span className="sv-sched-count-dot" />
            3 scheduled
          </span>
        </div>
        <div className="sv-week">
          {days.map((d, i) => (
            <span key={i} className={`sv-day${i === 4 ? ' sv-day-active' : ''}`}>
              <span className="sv-day-label">{d.letter}</span>
              <span className="sv-day-num">{d.num}</span>
              <span className={`sv-day-marker${d.dot ? ' sv-day-marker-on' : ''}`} />
            </span>
          ))}
        </div>
        <div className="sv-time-row">
          <span className="sv-time-chip">
            <Clock size={11} strokeWidth={2.25} />
            Fri 9:00 AM · Why I schedule everything
          </span>
          <span className="sv-toggle">
            <span className="sv-toggle-dot" />
            Auto-publish <strong>On</strong>
          </span>
        </div>
      </div>
    )
  }
  if (type === 'review') {
    const archive = [
      { title: '5 lessons from building LinkedPush', when: '2d ago' },
      { title: 'Why I schedule everything on Fridays', when: 'Apr 24' },
      { title: 'Self-hosting beats another subscription', when: 'Apr 21' },
    ]
    return (
      <div className="setup-visual setup-visual-review" aria-hidden>
        <div className="sv-archive-head">
          <span className="sv-archive-search">
            <Search size={11} strokeWidth={2.25} />
            <span>find by keyword, hashtag, date…</span>
          </span>
          <span className="sv-archive-count">
            <span className="sv-archive-count-dot" />
            31 published
          </span>
        </div>
        <ul className="sv-archive-list">
          {archive.map((post, i) => (
            <li key={i} className="sv-archive-row">
              <span className="sv-archive-status" aria-hidden>
                <Check size={9} strokeWidth={3} />
              </span>
              <span className="sv-archive-title">{post.title}</span>
              <span className="sv-archive-when">{post.when}</span>
            </li>
          ))}
        </ul>
      </div>
    )
  }
  return null
}

const activityItems = [
  { status: 'live', text: 'Post queued for 9:00 AM Eastern', time: 'now' },
  { status: 'draft', text: 'Caption first pass generated from prompt', time: '2m' },
  { status: 'warn', text: 'LinkedIn reconnect needed before publishing', time: '7m' },
]

const heroPipeline = [
  { step: '01', label: 'Draft' },
  { step: '02', label: 'Schedule' },
  { step: '03', label: 'Publish' },
  { step: '04', label: 'Review' },
]

const featureCategories = ['Compose', 'Schedule', 'Assist', 'Media', 'Operate', 'Review']
const workflowLoopNodes = ['Compose', 'Schedule', 'Review']

export default function Landing() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="lp-presence-loading">
        <Skeleton className="h-8 w-8 rounded-full bg-white/10" />
      </div>
    )
  }

  if (user) return <Navigate to="/app" replace />

  return (
    <div className="lp-presence">
      <style>{presenceCss}</style>

      <div className="presence-shell">
        <header className="presence-nav">
          <AppLogo variant="navMinimal" className="presence-logo" />
          <nav className="presence-links" aria-label="Primary">
            <a href="#product">Product</a>
            <a href="#features">Features</a>
            <a href="#workflow">Workflow</a>
          </nav>
          <div className="presence-actions">
            <NavLink className="presence-btn presence-btn-ghost" to="/login">
              <LogIn size={15} strokeWidth={2} />
              Sign in
            </NavLink>
          </div>
        </header>

        <main>
          <section className="hero-grid">
            <div className="hero-copy">
              <div className="hero-kicker">
                <span className="status-dot" />
                Self-hosted publishing workspace
              </div>

              <h1>
                Run your LinkedIn
                <br />
                like a live
                <br />
                system.
              </h1>

              <p className="hero-deck">
                LinkedPush gives you one place to write, schedule, publish, and review LinkedIn posts
                without handing the workflow over to a subscription tool. It is built for operators who
                want control, clarity, and a product that feels like real software instead of marketing fluff.
              </p>

              <div className="hero-cta">
                <NavLink className="presence-btn presence-btn-primary" to="/login">Get started</NavLink>
                <a className="presence-btn presence-btn-ghost" href="#workflow">See the workflow</a>
              </div>
              <p className="hero-signin-note">
                Sign in with Google, then connect LinkedIn to publish.
              </p>

              <article className="hero-pipeline" aria-label="Publishing loop">
                <div className="hero-pipeline-top">
                  <span className="eyebrow">The loop</span>
                  <span className="hero-pipeline-meta">
                    <span className="hero-pipeline-meta-dot" />
                    4 visible states
                  </span>
                </div>
                <div className="hero-pipeline-steps">
                  {heroPipeline.map((node, i) => (
                    <Fragment key={node.step}>
                      <div className={`hp-step${i === 0 ? ' hp-step-active' : ''}`}>
                        <span className="hp-step-num">{node.step}</span>
                        <span className="hp-step-label">{node.label}</span>
                      </div>
                      {i < heroPipeline.length - 1 ? (
                        <span className="hp-connector" aria-hidden />
                      ) : null}
                    </Fragment>
                  ))}
                </div>
                <p className="hero-pipeline-note">
                  Every post moves through clear, legible states — not a black-box automation.
                </p>
              </article>
            </div>

            <div className="hero-panels">
              <section className="activity-card">
                <div className="card-heading">
                  <div>
                    <span className="eyebrow">Live activity</span>
                    <h2>What the product is doing</h2>
                  </div>
                  <span className="active-pill">3 active</span>
                </div>

                <div className="activity-feed">
                  {activityItems.map((item) => (
                    <div key={`${item.text}-${item.time}`} className="activity-item">
                      <span className={`feed-dot feed-dot-${item.status}`} />
                      <span>{item.text}</span>
                      <time>{item.time}</time>
                    </div>
                  ))}
                </div>
              </section>

              <section className="workspace-card">
                <div className="card-heading">
                  <div>
                    <span className="eyebrow">Workspace preview</span>
                    <h2>Compose, schedule, and ship</h2>
                  </div>
                  <span className="soft-pill">Compose</span>
                </div>

                <div className="workspace-frame" aria-hidden>
                  <div className="workspace-frame-header">
                    <div className="workspace-frame-tabs">
                      <span className="workspace-tab workspace-tab-active">Compose</span>
                      <span className="workspace-tab">Media</span>
                      <span className="workspace-tab">Review</span>
                    </div>
                    <span className="workspace-frame-status">
                      <span className="workspace-frame-status-dot" />
                      Draft saved
                    </span>
                  </div>

                  <div className="workspace-body">
                    <div className="workspace-author">
                      <span className="workspace-avatar">LP</span>
                      <div className="workspace-author-text">
                        <span className="workspace-author-name">LinkedPush</span>
                        <span className="workspace-author-meta">Scheduled · Fri 9:00 AM ET</span>
                      </div>
                      <span className="workspace-author-pill">
                        <CalendarDays size={12} strokeWidth={2.25} />
                        Queue
                      </span>
                    </div>

                    <div className="workspace-prose">
                      <p className="workspace-prose-lead">
                        Shipping the self-hosted publishing loop today.
                      </p>
                      <p className="workspace-prose-body">
                        Write, schedule, and review LinkedIn posts in one workspace, with drafts
                        and shipped work staying together.
                      </p>
                    </div>

                    <div className="workspace-media">
                      <span className="workspace-media-thumb" />
                      <span className="workspace-media-thumb workspace-media-thumb-alt" />
                      <span className="workspace-media-add">
                        <ImageIcon size={14} strokeWidth={2} />
                      </span>
                    </div>
                  </div>

                  <div className="workspace-footer">
                    <div className="workspace-chips">
                      <span className="workspace-chip">
                        <ImageIcon size={12} strokeWidth={2} />
                        2 assets
                      </span>
                      <span className="workspace-chip">
                        <Clock size={12} strokeWidth={2} />
                        Fri · 9:00 AM
                      </span>
                    </div>
                    <span className="workspace-publish">Schedule post</span>
                  </div>
                </div>
              </section>
            </div>
          </section>

          <section id="product" className="strip-section">
            <div className="section-heading">
              <span className="section-kicker">Why it feels different</span>
              <h2>Not a landing page for a brand. A landing page for a working system.</h2>
            </div>

            <div className="highlight-grid">
              {productHighlights.map((item) => (
                <article key={item.title} className="highlight-card">
                  <span className="eyebrow">{item.eyebrow}</span>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                  <div className="highlight-note">{item.detail}</div>
                </article>
              ))}
            </div>
          </section>

          <section id="features" className="strip-section">
            <div className="section-heading">
              <div className="section-heading-main">
                <span className="section-kicker">Core capabilities</span>
                <h2>Everything you need to run the posting pipeline without renting the workflow.</h2>
              </div>
              <aside className="section-meta">
                <div className="section-meta-top">
                  <span className="section-meta-num">06</span>
                  <div className="section-meta-top-text">
                    <span className="section-meta-label">Focused surfaces</span>
                    <span className="section-meta-sub">One workflow, six product surfaces</span>
                  </div>
                </div>
                <div className="section-meta-tags">
                  {featureCategories.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              </aside>
            </div>

            <div className="feature-grid">
              {featureGrid.map((item) => (
                <article key={item.title} className="feature-card">
                  <div className="feature-card-top">
                    <span className="feature-icon">
                      <item.icon size={20} strokeWidth={2} />
                    </span>
                    <div className="feature-card-heading">
                      <span className="eyebrow">{item.eyebrow}</span>
                      <h3>{item.title}</h3>
                    </div>
                  </div>
                  <p>{item.copy}</p>
                  <ul className="feature-points">
                    {item.points.map((point) => (
                      <li key={point}>
                        <span className="feature-point-marker">
                          <Check size={10} strokeWidth={3} />
                        </span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="feature-note">
                    <span className="feature-note-bar" />
                    <span>{item.metric}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section id="workflow" className="strip-section">
            <div className="section-heading">
              <div className="section-heading-main">
                <span className="section-kicker">Product workflow</span>
                <h2>A simple publishing loop your team can actually use.</h2>
              </div>
              <aside className="section-meta section-meta-loop">
                <div className="section-meta-top">
                  <span className="section-meta-num">03</span>
                  <div className="section-meta-top-text">
                    <span className="section-meta-label">Stages · one loop</span>
                    <span className="section-meta-sub">Compose, schedule, then review — on repeat</span>
                  </div>
                </div>
                <div className="loop-diagram" aria-hidden>
                  {workflowLoopNodes.map((node, i) => (
                    <Fragment key={node}>
                      <span className="loop-node">{node}</span>
                      {i < workflowLoopNodes.length - 1 ? (
                        <span className="loop-arrow">→</span>
                      ) : null}
                    </Fragment>
                  ))}
                </div>
              </aside>
            </div>

            <div className="setup-grid">
              {workflowSteps.map((item, index) => (
                <Fragment key={item.step}>
                  <article className="setup-card">
                    <div className="setup-card-top">
                      <div className="setup-badge">
                        <span className="setup-step-num">{item.step}</span>
                        <span className="setup-phase">{item.phase}</span>
                      </div>
                      <span className="setup-arrow" aria-hidden>›</span>
                    </div>
                    <h3>{item.title}</h3>
                    <p>{item.body}</p>
                    <div className="setup-surface">
                      <div className="setup-surface-top">
                        <span className="setup-surface-label">{item.detailLabel}</span>
                        <strong>{item.detailTitle}</strong>
                      </div>
                      <StepVisual type={item.visual} />
                      <div className="setup-chip-row">
                        {item.chips.map((chip) => (
                          <span key={chip}>{chip}</span>
                        ))}
                      </div>
                    </div>
                  </article>
                  {index < workflowSteps.length - 1 ? (
                    <div className="setup-connector" aria-hidden>
                      <span className="setup-connector-line" />
                      <span className="setup-connector-node">
                        <span className="setup-connector-node-inner" />
                      </span>
                    </div>
                  ) : null}
                </Fragment>
              ))}
            </div>
          </section>

          <section className="closing-panel">
            <div>
              <span className="section-kicker">Positioning</span>
              <h2>A serious publishing tool that still feels alive.</h2>
            </div>
            <p>
              LinkedPush is for people who want a cleaner way to run LinkedIn publishing on their own terms:
              sharper workflow, clearer state, and no dependence on SaaS plan math.
            </p>
            <div className="closing-actions">
              <NavLink className="presence-btn presence-btn-primary" to="/login">Open the app</NavLink>
              <a className="presence-btn presence-btn-ghost" href="#features">Review features</a>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}

const presenceCss = `
  .lp-presence{
    --bg:#0a0d14;
    --bg-2:#0f131d;
    --panel:#141924;
    --panel-2:#181e2c;
    --panel-3:#1d2434;
    --line:rgba(255,255,255,.08);
    --line-soft:rgba(255,255,255,.05);
    --text:#f2f3f5;
    --muted:#a9b2c2;
    --muted-2:#8c97aa;
    --blurple:#5865f2;
    --blurple-2:#7c3aed;
    --green:#23a55a;
    --amber:#f0b232;
    --cyan:#55d6ff;
    min-height:100vh;
    color:var(--text);
    background:
      radial-gradient(700px 420px at 84% 12%, rgba(88,101,242,.22), transparent 60%),
      radial-gradient(640px 360px at 12% 0%, rgba(85,214,255,.08), transparent 55%),
      linear-gradient(180deg, #0a0d14 0%, #0d1118 100%);
    font-family: var(--font-sans), system-ui, sans-serif;
    position:relative;
    overflow-x:hidden;
  }
  .lp-presence *{box-sizing:border-box}
  .lp-presence a{color:inherit;text-decoration:none}
  .lp-presence::before{
    content:"";
    position:fixed;
    inset:0;
    pointer-events:none;
    opacity:.2;
    background-image:
      linear-gradient(to right, rgba(255,255,255,.025) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(255,255,255,.025) 1px, transparent 1px);
    background-size: 52px 52px;
    mask-image: linear-gradient(180deg, rgba(0,0,0,.8), transparent 90%);
  }
  .lp-presence-loading{
    min-height:100vh;
    display:flex;
    align-items:center;
    justify-content:center;
    background:var(--bg);
  }

  .presence-shell{
    width:min(1380px, calc(100vw - 40px));
    margin:0 auto;
    padding:24px 0 72px;
    position:relative;
    z-index:1;
  }

  .presence-nav{
    display:grid;
    grid-template-columns:auto 1fr auto;
    gap:24px;
    align-items:center;
    padding:10px 0 18px;
    margin-bottom:20px;
  }
  .presence-logo span:last-child{color:var(--text) !important}
  .presence-links{
    display:flex;
    justify-content:center;
    gap:28px;
    color:var(--muted);
    font-size:14px;
    font-weight:500;
  }
  .presence-links a:hover{color:var(--text)}
  .presence-actions{
    display:flex;
    gap:10px;
    justify-content:flex-end;
  }

  .presence-btn{
    display:inline-flex;
    align-items:center;
    justify-content:center;
    gap:8px;
    border-radius:999px;
    padding:12px 18px;
    font-size:14px;
    font-weight:600;
    transition:transform .18s ease, background .18s ease, border-color .18s ease, box-shadow .18s ease;
    border:1px solid transparent;
  }
  .presence-btn:hover{transform:translateY(-1px)}
  .presence-btn-primary{
    background:linear-gradient(135deg, var(--blurple), color-mix(in srgb, var(--blurple) 68%, var(--blurple-2)));
    color:#fff;
    box-shadow:0 16px 30px rgba(88,101,242,.25);
  }
  .presence-btn-primary:hover{
    box-shadow:0 20px 34px rgba(88,101,242,.32);
  }
  .presence-btn-ghost{
    background:rgba(255,255,255,.03);
    color:var(--text);
    border-color:var(--line);
  }
  .presence-btn-ghost:hover{
    background:rgba(255,255,255,.06);
    border-color:rgba(255,255,255,.12);
  }

  .hero-grid{
    display:grid;
    grid-template-columns:minmax(0, 1.1fr) minmax(0, .9fr);
    border:1px solid var(--line);
    background:linear-gradient(180deg, rgba(20,25,36,.88), rgba(14,18,27,.92));
    border-radius:32px;
    overflow:hidden;
    box-shadow:0 30px 80px rgba(0,0,0,.35);
    backdrop-filter:blur(20px);
  }
  .hero-rail{
    background:#090c12;
    border-right:1px solid var(--line-soft);
    padding:26px 14px;
    display:grid;
    align-content:start;
    gap:12px;
  }
  .rail-node{
    width:48px;
    height:48px;
    border-radius:16px;
    background:#1b2130;
    border:1px solid rgba(255,255,255,.04);
  }
  .rail-node-active{
    background:linear-gradient(135deg, var(--blurple), var(--blurple-2));
    box-shadow:0 12px 22px rgba(88,101,242,.28);
  }

  .hero-copy{
    padding:36px 32px 30px;
    background:linear-gradient(180deg, rgba(88,101,242,.06), transparent 30%);
  }
  .hero-kicker,
  .section-kicker,
  .eyebrow{
    display:inline-flex;
    align-items:center;
    gap:8px;
    text-transform:uppercase;
    letter-spacing:.14em;
    font-size:11px;
    font-weight:700;
    color:#aab3ff;
  }
  .status-dot{
    width:8px;
    height:8px;
    border-radius:999px;
    background:var(--green);
    box-shadow:0 0 0 4px rgba(35,165,90,.14);
  }
  .hero-copy h1{
    margin:18px 0 0;
    font-family:var(--font-display), var(--font-sans), sans-serif;
    font-size:clamp(52px, 8vw, 94px);
    line-height:.93;
    letter-spacing:-.05em;
    font-weight:800;
    max-width:8.8ch;
  }
  .hero-deck{
    margin:18px 0 0;
    max-width:55ch;
    color:var(--muted);
    font-size:17px;
    line-height:1.65;
  }
  .hero-cta{
    margin-top:24px;
    display:flex;
    gap:12px;
    align-items:center;
    flex-wrap:wrap;
  }
  .hero-signin-note{
    margin:12px 0 0;
    font-size:12.5px;
    color:var(--muted-2);
    letter-spacing:.01em;
  }
  .hero-pipeline{
    margin-top:30px;
    background:linear-gradient(180deg, rgba(24,30,44,.96), rgba(18,23,34,.98));
    border:1px solid var(--line);
    border-radius:20px;
    padding:18px 20px;
    max-width:460px;
    box-shadow:0 18px 40px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.03);
    position:relative;
    overflow:hidden;
  }
  .hero-pipeline::before{
    content:"";
    position:absolute;
    inset:0;
    pointer-events:none;
    background:radial-gradient(130% 80% at 0% 0%, rgba(88,101,242,.14), transparent 55%);
    opacity:.8;
  }
  .hero-pipeline > *{position:relative}
  .hero-pipeline-top{
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:10px;
    margin-bottom:14px;
  }
  .hero-pipeline-meta{
    display:inline-flex;
    align-items:center;
    gap:6px;
    font-size:10.5px;
    font-weight:700;
    letter-spacing:.14em;
    text-transform:uppercase;
    color:var(--muted-2);
  }
  .hero-pipeline-meta-dot{
    width:6px;
    height:6px;
    border-radius:999px;
    background:linear-gradient(135deg, var(--blurple), var(--blurple-2));
    box-shadow:0 0 0 3px rgba(88,101,242,.15);
  }
  .hero-pipeline-steps{
    display:flex;
    align-items:stretch;
    gap:4px;
  }
  .hp-step{
    display:flex;
    flex-direction:column;
    gap:4px;
    flex:1;
    padding:9px 10px;
    border-radius:10px;
    background:rgba(255,255,255,.025);
    border:1px solid var(--line-soft);
    align-items:flex-start;
    min-width:0;
  }
  .hp-step-num{
    font-size:9.5px;
    font-weight:800;
    letter-spacing:.18em;
    color:var(--muted-2);
  }
  .hp-step-label{
    font-size:12px;
    font-weight:700;
    color:#dfe3f0;
    letter-spacing:-.005em;
    white-space:nowrap;
  }
  .hp-step-active{
    background:linear-gradient(135deg, rgba(88,101,242,.26), rgba(124,58,237,.2));
    border-color:rgba(88,101,242,.42);
    box-shadow:inset 0 1px 0 rgba(255,255,255,.08), 0 10px 22px rgba(88,101,242,.2);
  }
  .hp-step-active .hp-step-num{color:#c7ccff}
  .hp-step-active .hp-step-label{color:#f1f3ff}
  .hp-connector{
    flex:0 0 10px;
    align-self:center;
    height:2px;
    border-radius:999px;
    background:linear-gradient(90deg, rgba(88,101,242,.55), rgba(124,58,237,.4));
    opacity:.8;
  }
  .hero-pipeline-note{
    margin:14px 0 0;
    color:var(--muted);
    font-size:12.5px;
    line-height:1.55;
  }

  .hero-panels{
    padding:24px;
    background:#0f131c;
    border-left:1px solid var(--line-soft);
    display:grid;
    gap:14px;
  }
  .activity-card,
  .workspace-card,
  .highlight-card,
  .feature-card,
  .setup-card,
  .closing-panel{
    background:linear-gradient(180deg, rgba(24,30,44,.96), rgba(18,23,34,.98));
    border:1px solid var(--line);
    border-radius:24px;
    padding:20px;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.025);
  }
  .card-heading{
    display:flex;
    justify-content:space-between;
    gap:12px;
    align-items:flex-start;
    margin-bottom:14px;
  }
  .card-heading h2{
    margin:6px 0 0;
    font-size:20px;
    line-height:1.15;
    letter-spacing:-.03em;
  }
  .active-pill,
  .soft-pill{
    border-radius:999px;
    padding:8px 10px;
    font-size:11px;
    font-weight:700;
    text-transform:uppercase;
    letter-spacing:.14em;
    white-space:nowrap;
  }
  .active-pill{
    background:rgba(35,165,90,.12);
    color:#86efac;
    border:1px solid rgba(35,165,90,.22);
  }
  .soft-pill{
    background:rgba(255,255,255,.04);
    color:var(--muted);
    border:1px solid var(--line-soft);
  }
  .activity-feed{
    display:grid;
    gap:10px;
  }
  .activity-item{
    display:grid;
    grid-template-columns:auto 1fr auto;
    gap:10px;
    align-items:center;
    background:#1b2130;
    border:1px solid rgba(255,255,255,.04);
    border-radius:16px;
    padding:12px 14px;
    color:#d5dae3;
    font-size:13px;
  }
  .activity-item time{
    color:var(--muted-2);
    font-size:11px;
    text-transform:uppercase;
    letter-spacing:.14em;
  }
  .feed-dot{
    width:9px;
    height:9px;
    border-radius:999px;
  }
  .feed-dot-live{background:var(--green)}
  .feed-dot-draft{background:var(--blurple)}
  .feed-dot-warn{background:var(--amber)}

  .workspace-frame{
    border-radius:18px;
    padding:14px;
    background:linear-gradient(180deg, #0f131b, #0c1018);
    border:1px solid rgba(255,255,255,.05);
    display:grid;
    gap:12px;
  }
  .workspace-frame-header{
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:10px;
  }
  .workspace-frame-tabs{
    display:inline-flex;
    gap:4px;
    background:rgba(255,255,255,.03);
    border:1px solid rgba(255,255,255,.05);
    padding:3px;
    border-radius:999px;
  }
  .workspace-tab{
    padding:6px 12px;
    border-radius:999px;
    font-size:11px;
    font-weight:700;
    letter-spacing:.04em;
    color:var(--muted-2);
  }
  .workspace-tab-active{
    background:linear-gradient(135deg, rgba(88,101,242,.22), rgba(124,58,237,.22));
    color:#e6e9ff;
    box-shadow:inset 0 0 0 1px rgba(88,101,242,.35);
  }
  .workspace-frame-status{
    display:inline-flex;
    align-items:center;
    gap:6px;
    font-size:11px;
    color:var(--muted-2);
    font-weight:600;
    letter-spacing:.04em;
  }
  .workspace-frame-status-dot{
    width:7px;
    height:7px;
    border-radius:999px;
    background:var(--green);
    box-shadow:0 0 0 3px rgba(35,165,90,.15);
  }

  .workspace-body{
    border-radius:14px;
    background:linear-gradient(180deg, #1a2030, #151a28);
    padding:14px;
    display:grid;
    gap:12px;
    border:1px solid rgba(255,255,255,.04);
  }
  .workspace-author{
    display:grid;
    grid-template-columns:auto 1fr auto;
    gap:10px;
    align-items:center;
  }
  .workspace-avatar{
    width:34px;
    height:34px;
    border-radius:12px;
    background:linear-gradient(135deg, var(--blurple), var(--blurple-2));
    display:inline-flex;
    align-items:center;
    justify-content:center;
    font-size:12px;
    font-weight:800;
    color:#fff;
    letter-spacing:.04em;
    box-shadow:0 8px 18px rgba(88,101,242,.3);
  }
  .workspace-author-text{
    display:flex;
    flex-direction:column;
    gap:2px;
    min-width:0;
  }
  .workspace-author-name{
    font-size:13px;
    font-weight:700;
    color:#e8ebf5;
  }
  .workspace-author-meta{
    font-size:11px;
    color:var(--muted-2);
    letter-spacing:.04em;
  }
  .workspace-author-pill{
    display:inline-flex;
    align-items:center;
    gap:5px;
    border-radius:999px;
    padding:5px 9px;
    background:rgba(88,101,242,.12);
    border:1px solid rgba(88,101,242,.22);
    color:#c7ccff;
    font-size:11px;
    font-weight:700;
    letter-spacing:.04em;
  }
  .workspace-prose{
    display:flex;
    flex-direction:column;
    gap:6px;
  }
  .workspace-prose-lead{
    margin:0;
    font-size:14px;
    font-weight:600;
    color:#eef0f8;
    letter-spacing:-.005em;
  }
  .workspace-prose-body{
    margin:0;
    font-size:12.5px;
    line-height:1.55;
    color:var(--muted);
  }
  .workspace-media{
    display:grid;
    grid-template-columns:repeat(3, 1fr);
    gap:8px;
  }
  .workspace-media-thumb{
    height:46px;
    border-radius:10px;
    background:linear-gradient(135deg, rgba(88,101,242,.28), rgba(124,58,237,.22));
    border:1px solid rgba(255,255,255,.06);
  }
  .workspace-media-thumb-alt{
    background:linear-gradient(135deg, rgba(85,214,255,.22), rgba(88,101,242,.14));
  }
  .workspace-media-add{
    height:46px;
    border-radius:10px;
    border:1px dashed rgba(255,255,255,.16);
    background:rgba(255,255,255,.02);
    display:inline-flex;
    align-items:center;
    justify-content:center;
    color:var(--muted-2);
  }

  .workspace-footer{
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:10px;
    flex-wrap:wrap;
  }
  .workspace-chips{
    display:inline-flex;
    gap:6px;
    flex-wrap:wrap;
  }
  .workspace-chip{
    display:inline-flex;
    align-items:center;
    gap:5px;
    padding:6px 10px;
    border-radius:999px;
    background:rgba(255,255,255,.04);
    border:1px solid rgba(255,255,255,.05);
    color:var(--muted);
    font-size:11px;
    font-weight:600;
    letter-spacing:.03em;
  }
  .workspace-publish{
    display:inline-flex;
    align-items:center;
    padding:9px 14px;
    border-radius:999px;
    background:linear-gradient(135deg, var(--blurple), var(--blurple-2));
    color:#fff;
    font-size:12px;
    font-weight:700;
    letter-spacing:.02em;
    box-shadow:0 12px 24px rgba(88,101,242,.32);
  }

  .strip-section{
    padding:84px 0 0;
  }
  .section-heading{
    display:flex;
    align-items:flex-end;
    justify-content:space-between;
    gap:32px;
    margin-bottom:28px;
  }
  .section-heading-main{
    display:flex;
    flex-direction:column;
    min-width:0;
    flex:1;
  }
  .section-heading h2{
    margin:10px 0 0;
    font-family:var(--font-display), var(--font-sans), sans-serif;
    font-size:clamp(32px, 5vw, 56px);
    line-height:.96;
    letter-spacing:-.04em;
    max-width:18ch;
  }
  .section-meta{
    display:flex;
    flex-direction:column;
    gap:14px;
    padding:16px 18px;
    border-radius:18px;
    background:linear-gradient(180deg, rgba(24,30,44,.7), rgba(16,21,31,.7));
    border:1px solid var(--line-soft);
    min-width:280px;
    max-width:340px;
    flex-shrink:0;
    position:relative;
    overflow:hidden;
  }
  .section-meta::before{
    content:"";
    position:absolute;
    inset:0;
    pointer-events:none;
    background:radial-gradient(120% 80% at 100% 0%, rgba(88,101,242,.1), transparent 60%);
  }
  .section-meta > *{position:relative}
  .section-meta-top{
    display:flex;
    align-items:center;
    gap:14px;
  }
  .section-meta-num{
    font-family:var(--font-display), var(--font-sans), sans-serif;
    font-size:38px;
    line-height:1;
    letter-spacing:-.04em;
    font-weight:800;
    color:#eef0f8;
    flex-shrink:0;
  }
  .section-meta-top-text{
    display:flex;
    flex-direction:column;
    gap:4px;
    min-width:0;
  }
  .section-meta-label{
    font-size:10.5px;
    font-weight:800;
    letter-spacing:.14em;
    text-transform:uppercase;
    color:#c1c8ef;
  }
  .section-meta-sub{
    font-size:12px;
    color:var(--muted);
    line-height:1.4;
  }
  .section-meta-tags{
    display:flex;
    flex-wrap:wrap;
    gap:5px;
  }
  .section-meta-tags span{
    display:inline-flex;
    padding:4px 9px;
    border-radius:999px;
    font-size:10.5px;
    font-weight:700;
    letter-spacing:.03em;
    color:#c8cee0;
    background:rgba(255,255,255,.03);
    border:1px solid var(--line-soft);
  }
  .section-meta-loop .loop-diagram{
    display:flex;
    align-items:center;
    gap:6px;
    flex-wrap:wrap;
  }
  .section-meta-loop .loop-node{
    display:inline-flex;
    padding:5px 11px;
    border-radius:999px;
    font-size:10.5px;
    font-weight:700;
    letter-spacing:.04em;
    color:#dfe3f0;
    background:linear-gradient(135deg, rgba(88,101,242,.18), rgba(124,58,237,.14));
    border:1px solid rgba(88,101,242,.28);
  }
  .section-meta-loop .loop-arrow{
    color:rgba(255,255,255,.3);
    font-size:13px;
    font-weight:600;
  }

  .highlight-grid,
  .feature-grid,
  .setup-grid{
    display:grid;
    gap:16px;
  }
  .highlight-grid{
    grid-template-columns:repeat(3, minmax(0, 1fr));
  }
  .feature-grid{
    grid-template-columns:repeat(3, minmax(0, 1fr));
  }
  .setup-grid{
    grid-template-columns:repeat(3, minmax(0, 1fr));
  }
  .highlight-card h3,
  .setup-card h3{
    margin:14px 0 0;
    font-size:24px;
    line-height:1.08;
    letter-spacing:-.03em;
  }
  .highlight-card p,
  .feature-card p,
  .setup-card p,
  .closing-panel p{
    margin:12px 0 0;
    color:var(--muted);
    font-size:14px;
    line-height:1.65;
  }
  .feature-card{
    display:flex;
    flex-direction:column;
    gap:14px;
    padding:22px;
    position:relative;
  }
  .feature-card::before{
    content:"";
    position:absolute;
    inset:0;
    border-radius:inherit;
    pointer-events:none;
    background:radial-gradient(140% 60% at 0% 0%, rgba(88,101,242,.08), transparent 55%);
    opacity:.7;
  }
  .feature-card > *{position:relative}
  .feature-card-top{
    display:flex;
    gap:14px;
    align-items:center;
  }
  .feature-icon{
    width:44px;
    height:44px;
    border-radius:14px;
    display:inline-flex;
    align-items:center;
    justify-content:center;
    background:linear-gradient(135deg, rgba(88,101,242,.32), rgba(124,58,237,.28));
    border:1px solid rgba(88,101,242,.3);
    color:#e1e5ff;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.08), 0 10px 22px rgba(88,101,242,.18);
    flex-shrink:0;
  }
  .feature-card-heading{
    display:flex;
    flex-direction:column;
    gap:3px;
    min-width:0;
  }
  .feature-card-heading h3{
    margin:0;
    font-size:19px;
    letter-spacing:-.02em;
    line-height:1.1;
  }
  .feature-card > p{
    margin:0;
  }
  .feature-points{
    list-style:none;
    margin:0;
    padding:12px 0 0;
    border-top:1px solid var(--line-soft);
    display:flex;
    flex-direction:column;
    gap:8px;
  }
  .feature-points li{
    display:flex;
    align-items:center;
    gap:10px;
    color:#d8ddf0;
    font-size:13px;
    font-weight:500;
  }
  .feature-point-marker{
    width:18px;
    height:18px;
    border-radius:999px;
    display:inline-flex;
    align-items:center;
    justify-content:center;
    background:rgba(88,101,242,.16);
    color:#a9b4ff;
    border:1px solid rgba(88,101,242,.3);
    flex-shrink:0;
  }
  .feature-note{
    margin-top:auto;
    display:flex;
    align-items:center;
    gap:10px;
    padding:10px 12px;
    border-radius:12px;
    background:rgba(88,101,242,.07);
    border:1px solid rgba(88,101,242,.18);
    color:#b9c0de;
    font-size:12px;
    line-height:1.5;
  }
  .feature-note-bar{
    width:3px;
    height:22px;
    border-radius:999px;
    background:linear-gradient(180deg, var(--blurple), var(--blurple-2));
    flex-shrink:0;
  }

  .setup-grid{
    grid-template-columns:minmax(0, 1fr) 44px minmax(0, 1fr) 44px minmax(0, 1fr);
    align-items:stretch;
  }
  .setup-card{
    position:relative;
    padding:22px;
    display:flex;
    flex-direction:column;
    gap:12px;
  }
  .setup-card-top{
    display:flex;
    align-items:center;
    justify-content:space-between;
  }
  .setup-badge{
    display:inline-flex;
    align-items:center;
    gap:10px;
  }
  .setup-step-num{
    width:34px;
    height:34px;
    border-radius:12px;
    display:inline-flex;
    align-items:center;
    justify-content:center;
    font-size:13px;
    font-weight:800;
    letter-spacing:.02em;
    color:#eaecff;
    background:linear-gradient(135deg, rgba(88,101,242,.28), rgba(124,58,237,.22));
    border:1px solid rgba(88,101,242,.35);
    box-shadow:inset 0 1px 0 rgba(255,255,255,.08);
  }
  .setup-phase{
    font-size:11px;
    font-weight:800;
    letter-spacing:.18em;
    text-transform:uppercase;
    color:#c1c8ef;
  }
  .setup-arrow{
    font-size:22px;
    line-height:1;
    color:rgba(255,255,255,.18);
    font-weight:600;
  }
  .setup-card > p{margin:0}
  .setup-surface{
    margin-top:auto;
    padding:14px;
    border-radius:16px;
    background:rgba(15,19,28,.7);
    border:1px solid var(--line-soft);
    display:flex;
    flex-direction:column;
    gap:12px;
  }
  .setup-surface-top{
    display:flex;
    flex-direction:column;
    gap:4px;
  }
  .setup-surface-label{
    font-size:10px;
    text-transform:uppercase;
    letter-spacing:.18em;
    color:var(--muted-2);
    font-weight:700;
  }
  .setup-surface strong{
    font-size:13px;
    line-height:1.45;
    color:#e3e6f2;
    font-weight:600;
    letter-spacing:-.005em;
  }
  .setup-chip-row{
    display:flex;
    flex-wrap:wrap;
    gap:6px;
  }
  .setup-chip-row span{
    display:inline-flex;
    align-items:center;
    padding:5px 10px;
    border-radius:999px;
    background:rgba(255,255,255,.04);
    border:1px solid rgba(255,255,255,.05);
    font-size:11px;
    font-weight:600;
    color:#c8cee0;
    letter-spacing:.02em;
  }

  .setup-visual{
    padding:12px;
    border-radius:12px;
    background:linear-gradient(180deg, rgba(26,32,48,.8), rgba(20,25,38,.8));
    border:1px solid rgba(255,255,255,.04);
    display:flex;
    flex-direction:column;
    gap:10px;
    min-height:118px;
  }
  .sv-compose-head{
    display:flex;
    align-items:center;
    gap:8px;
  }
  .sv-avatar{
    width:22px;
    height:22px;
    border-radius:7px;
    background:linear-gradient(135deg, var(--blurple), var(--blurple-2));
    color:#fff;
    font-size:9px;
    font-weight:800;
    display:inline-flex;
    align-items:center;
    justify-content:center;
    letter-spacing:.04em;
    flex:0 0 auto;
  }
  .sv-compose-id{
    display:flex;
    flex-direction:column;
    gap:1px;
    flex:1;
    min-width:0;
  }
  .sv-compose-name{
    font-size:11px;
    font-weight:700;
    color:#e7eaf3;
    letter-spacing:-.005em;
    white-space:nowrap;
    overflow:hidden;
    text-overflow:ellipsis;
  }
  .sv-compose-role{
    font-weight:500;
    color:var(--muted-2);
  }
  .sv-compose-meta{
    font-size:9px;
    color:var(--muted-2);
    letter-spacing:.02em;
  }
  .sv-compose-pill{
    display:inline-flex;
    align-items:center;
    padding:3px 7px;
    border-radius:999px;
    background:rgba(240,178,50,.12);
    border:1px solid rgba(240,178,50,.28);
    color:var(--amber);
    font-size:9px;
    font-weight:800;
    letter-spacing:.06em;
    text-transform:uppercase;
    flex:0 0 auto;
  }
  .sv-compose-body{
    margin:0;
    font-size:11px;
    line-height:1.35;
    color:#cfd4e3;
    white-space:nowrap;
    overflow:hidden;
    text-overflow:ellipsis;
  }
  .sv-compose-foot{
    display:flex;
    align-items:center;
    gap:6px;
    margin-top:auto;
  }
  .sv-mini-thumb{
    width:26px;
    height:26px;
    border-radius:7px;
    border:1px solid rgba(255,255,255,.06);
    flex:0 0 auto;
    position:relative;
    overflow:hidden;
  }
  .sv-mini-thumb-sky{
    background:linear-gradient(155deg, #6ec5ff 0%, #5865f2 55%, #7c3aed 100%);
  }
  .sv-mini-thumb-ui{
    background:linear-gradient(180deg, #1a2030 0%, #11151f 100%);
    display:flex;
    align-items:center;
    justify-content:center;
  }
  .sv-mini-thumb-chip{
    width:10px;
    height:6px;
    border-radius:2px;
    background:linear-gradient(135deg, var(--blurple), var(--blurple-2));
  }
  .sv-mini-thumb-add{
    width:26px;
    height:26px;
    border-radius:7px;
    border:1px dashed rgba(255,255,255,.18);
    background:rgba(255,255,255,.02);
    display:inline-flex;
    align-items:center;
    justify-content:center;
    color:var(--muted-2);
    flex:0 0 auto;
  }
  .sv-compose-count{
    margin-left:auto;
    font-size:10px;
    font-weight:600;
    color:var(--muted-2);
    letter-spacing:.02em;
    font-variant-numeric:tabular-nums;
  }

  .sv-sched-head{
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:8px;
  }
  .sv-sched-eyebrow{
    font-size:9px;
    font-weight:800;
    letter-spacing:.14em;
    color:var(--muted-2);
  }
  .sv-sched-count{
    display:inline-flex;
    align-items:center;
    gap:5px;
    font-size:9.5px;
    font-weight:700;
    color:#c7ccff;
    padding:3px 8px;
    border-radius:999px;
    background:rgba(88,101,242,.12);
    border:1px solid rgba(88,101,242,.22);
    letter-spacing:.02em;
  }
  .sv-sched-count-dot{
    width:5px;
    height:5px;
    border-radius:999px;
    background:var(--blurple);
    box-shadow:0 0 0 2px rgba(88,101,242,.18);
  }
  .sv-week{
    display:grid;
    grid-template-columns:repeat(7, 1fr);
    gap:4px;
  }
  .sv-day{
    display:flex;
    flex-direction:column;
    align-items:center;
    gap:2px;
    padding:5px 2px 4px;
    border-radius:8px;
    background:rgba(255,255,255,.03);
    border:1px solid rgba(255,255,255,.04);
  }
  .sv-day-label{
    font-size:8.5px;
    font-weight:800;
    letter-spacing:.1em;
    color:var(--muted-2);
    text-transform:uppercase;
  }
  .sv-day-num{
    font-size:11px;
    font-weight:700;
    color:#dde1ee;
    letter-spacing:-.01em;
    line-height:1;
  }
  .sv-day-marker{
    width:4px;
    height:4px;
    border-radius:999px;
    background:transparent;
    margin-top:1px;
  }
  .sv-day-marker-on{background:var(--blurple)}
  .sv-day-active{
    background:linear-gradient(180deg, rgba(88,101,242,.28), rgba(124,58,237,.2));
    border-color:rgba(88,101,242,.4);
  }
  .sv-day-active .sv-day-label{color:#dce0ff}
  .sv-day-active .sv-day-num{color:#fff}
  .sv-day-active .sv-day-marker-on{background:#fff}
  .sv-time-row{
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:6px;
    margin-top:auto;
  }
  .sv-time-chip{
    display:inline-flex;
    align-items:center;
    gap:6px;
    padding:5px 9px;
    border-radius:999px;
    background:rgba(88,101,242,.14);
    border:1px solid rgba(88,101,242,.28);
    color:#c7ccff;
    font-size:10px;
    font-weight:700;
    letter-spacing:.01em;
    max-width:62%;
    overflow:hidden;
    text-overflow:ellipsis;
    white-space:nowrap;
  }
  .sv-toggle{
    display:inline-flex;
    align-items:center;
    gap:6px;
    padding:4px 9px;
    border-radius:999px;
    background:rgba(35,165,90,.1);
    border:1px solid rgba(35,165,90,.22);
    color:var(--muted);
    font-size:10px;
    font-weight:600;
    letter-spacing:.02em;
  }
  .sv-toggle strong{
    color:#a7f0c1;
    font-weight:800;
  }
  .sv-toggle-dot{
    width:6px;
    height:6px;
    border-radius:999px;
    background:#23a55a;
    box-shadow:0 0 0 2px rgba(35,165,90,.2);
  }

  .sv-archive-head{
    display:flex;
    align-items:center;
    gap:8px;
  }
  .sv-archive-search{
    flex:1;
    min-width:0;
    display:inline-flex;
    align-items:center;
    gap:6px;
    padding:5px 9px;
    border-radius:8px;
    background:rgba(255,255,255,.03);
    border:1px solid rgba(255,255,255,.06);
    color:var(--muted-2);
    font-size:10px;
    letter-spacing:.005em;
  }
  .sv-archive-search span{
    overflow:hidden;
    text-overflow:ellipsis;
    white-space:nowrap;
  }
  .sv-archive-count{
    display:inline-flex;
    align-items:center;
    gap:5px;
    padding:4px 8px;
    border-radius:999px;
    background:rgba(35,165,90,.1);
    border:1px solid rgba(35,165,90,.22);
    color:#a7f0c1;
    font-size:9.5px;
    font-weight:700;
    letter-spacing:.02em;
    flex:0 0 auto;
  }
  .sv-archive-count-dot{
    width:5px;
    height:5px;
    border-radius:999px;
    background:#23a55a;
    box-shadow:0 0 0 2px rgba(35,165,90,.2);
  }
  .sv-archive-list{
    list-style:none;
    margin:0;
    padding:0;
    display:flex;
    flex-direction:column;
    gap:3px;
  }
  .sv-archive-row{
    display:flex;
    align-items:center;
    gap:7px;
    padding:4px 8px;
    border-radius:7px;
    background:rgba(255,255,255,.025);
    border:1px solid rgba(255,255,255,.04);
  }
  .sv-archive-status{
    width:14px;
    height:14px;
    border-radius:999px;
    background:rgba(35,165,90,.18);
    border:1px solid rgba(35,165,90,.35);
    color:#7be0a3;
    display:inline-flex;
    align-items:center;
    justify-content:center;
    flex:0 0 auto;
  }
  .sv-archive-title{
    flex:1;
    min-width:0;
    font-size:10.5px;
    font-weight:600;
    color:#dde1ee;
    letter-spacing:-.005em;
    white-space:nowrap;
    overflow:hidden;
    text-overflow:ellipsis;
  }
  .sv-archive-when{
    font-size:9.5px;
    font-weight:600;
    color:var(--muted-2);
    letter-spacing:.02em;
    font-variant-numeric:tabular-nums;
    flex:0 0 auto;
  }

  .setup-connector{
    align-self:center;
    justify-self:stretch;
    display:flex;
    align-items:center;
    justify-content:center;
    position:relative;
    height:100%;
    min-height:60px;
  }
  .setup-connector-line{
    position:absolute;
    left:0;
    right:0;
    top:50%;
    height:2px;
    transform:translateY(-50%);
    background:linear-gradient(90deg, rgba(88,101,242,.0), rgba(88,101,242,.45) 20%, rgba(124,58,237,.45) 80%, rgba(124,58,237,.0));
  }
  .setup-connector-node{
    position:relative;
    width:20px;
    height:20px;
    border-radius:999px;
    background:rgba(10,13,20,.9);
    border:1px solid rgba(88,101,242,.4);
    display:inline-flex;
    align-items:center;
    justify-content:center;
    box-shadow:0 0 0 4px rgba(88,101,242,.08);
  }
  .setup-connector-node-inner{
    width:7px;
    height:7px;
    border-radius:999px;
    background:linear-gradient(135deg, var(--blurple), var(--blurple-2));
  }

  .closing-panel{
    margin-top:84px;
    display:grid;
    grid-template-columns:1.15fr .85fr auto;
    gap:24px;
    align-items:end;
  }
  .closing-panel h2{
    margin:10px 0 0;
    font-size:clamp(32px, 4vw, 52px);
    line-height:.96;
    letter-spacing:-.04em;
  }
  .closing-actions{
    display:flex;
    gap:10px;
    justify-content:flex-end;
    flex-wrap:wrap;
  }

  @media (max-width: 1100px){
    .hero-grid{
      grid-template-columns:1fr;
    }
    .hero-panels{
      border-left:none;
      border-top:1px solid var(--line-soft);
    }
    .hero-pipeline{
      max-width:none;
    }
    .highlight-grid,
    .feature-grid{
      grid-template-columns:1fr 1fr;
    }
    .setup-grid{
      grid-template-columns:1fr;
    }
    .setup-connector{
      display:none;
    }
    .section-heading{
      flex-direction:column;
      align-items:flex-start;
      gap:20px;
    }
    .section-meta{
      min-width:0;
      max-width:none;
      width:100%;
    }
    .closing-panel{
      grid-template-columns:1fr;
      align-items:start;
    }
    .closing-actions{
      justify-content:flex-start;
    }
  }

  @media (max-width: 760px){
    .presence-shell{
      width:min(100vw - 24px, 1380px);
      padding-top:16px;
    }
    .presence-nav{
      grid-template-columns:1fr;
      gap:14px;
    }
    .presence-links{
      justify-content:flex-start;
      flex-wrap:wrap;
      gap:16px;
    }
    .presence-actions{
      justify-content:flex-start;
      flex-wrap:wrap;
    }
    .hero-copy,
    .hero-panels{
      padding:22px 18px;
    }
    .hero-copy h1{
      max-width:unset;
      font-size:clamp(42px, 13vw, 72px);
    }
    .highlight-grid,
    .feature-grid,
    .setup-grid{
      grid-template-columns:1fr;
    }
    .hero-pipeline-steps{
      flex-wrap:wrap;
    }
    .hp-connector{
      display:none;
    }
    .hp-step{
      flex:1 1 calc(50% - 4px);
    }
    .workspace-footer{
      align-items:stretch;
    }
    .workspace-publish{
      justify-content:center;
      padding:10px 14px;
    }
    .section-heading h2{
      max-width:none;
    }
  }
`
