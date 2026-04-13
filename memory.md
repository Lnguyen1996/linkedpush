# LinkedPush — Project Learnings

Format: `YYYY-MM-DD | learning | context`

2026-04-12 | Split-panel login page (hero left, form right) creates premium feel instantly | Login page redesign — the 50/50 split with gradient hero + feature grid on the left and clean auth form on right is a proven SaaS pattern. LinkedIn brand blue gradient (135deg, #0A66C2 → #004182) looks professional.

2026-04-12 | Sidebar needs visual hierarchy: logo area, quick action CTA, section labels, nav items, user footer | Layout redesign — adding "New Post" CTA button in sidebar increases engagement. Section labels ("Menu") with uppercase tracking help organize navigation. User section at bottom with avatar+email creates a complete sidebar experience.

2026-04-12 | Glassmorphism topbar (bg-white/80 backdrop-blur-md) feels modern without being distracting | Layout topbar — the semi-transparent blurred header creates depth layering. Sticky positioning with z-index keeps it accessible during scroll.

2026-04-12 | Stat cards above post list in Dashboard provide instant overview without clicking | Dashboard redesign — four summary cards (Total, Drafts, Scheduled, Published) with colored icons give users immediate status. The card-hover class (translateY -2px + shadow) adds subtle interactivity.

2026-04-12 | Stagger animations on children create a "waterfall" entrance that feels polished | CSS animation pattern — using nth-child animation-delay (0ms, 60ms, 120ms...) with fade-in-up creates a cascading entrance. Applied to stat cards, post lists, and media grids.

2026-04-12 | LinkedIn preview panel in Compose page helps users see exactly how their post will look | Compose redesign — sticky right panel (380px) showing a simulated LinkedIn post with avatar, content, engagement bar, and first comment preview is extremely valuable UX. The xl:block breakpoint hides it on smaller screens.

2026-04-12 | Skeleton loading states (shimmer animation) look far more professional than spinner text | Loading pattern — CSS gradient animation (linear-gradient 90deg with background-size 200%) creates a shimmer effect. Applied everywhere instead of "Loading..." text.

2026-04-12 | Color-coded status dots in calendar cells are more scannable than colored backgrounds | Calendar redesign — small 1.5px dots (bg-blue-500 for scheduled, bg-emerald-500 for published, etc.) next to truncated titles in rounded-lg pills create clean, dense information display.

2026-04-12 | Drag-and-drop zone for media upload increases discoverability over hidden file inputs | Media Library — onDragOver/onDragLeave/onDrop with ring-2 ring-linkedin visual feedback. The empty state becomes a click-to-upload zone with dashed border.

2026-04-12 | Engagement breakdown bar (horizontal stacked bar chart) communicates ratios at a glance | Analytics page — CSS-only horizontal bar with flex segments (rose for likes, blue for comments, emerald for shares) with percentage labels. No chart library needed.

2026-04-12 | LinkedIn OAuth2 state parameter is critical for CSRF — ConcurrentDictionary with 10-min TTL works for single-server | Auth security — generating RandomNumberGenerator.GetBytes(32) state with URL-safe Base64, storing in ConcurrentDictionary with timestamp, and verifying on callback prevents CSRF. Clean up expired states on each login.

2026-04-12 | Token refresh flow must check expiry with 5-minute buffer before any API call | Backend pattern — get_valid_access_token() checks token_expires_at minus 5 minutes. If expired, calls refresh_access_token() using the refresh_token grant type. Scheduler uses this too before publishing.

2026-04-12 | .NET BackgroundService with IServiceProvider.CreateScope() is the clean pattern for periodic tasks — each cycle gets its own DI scope for DbContext | Scheduler pattern — SchedulerService extends BackgroundService, loops with Task.Delay(60s), creates a new scope per cycle to get fresh DbContext and services.

2026-04-12 | Tailwind v4 @theme directive replaces tailwind.config.js — custom colors defined inline in CSS | Tailwind pattern — @theme { --color-linkedin: #0A66C2; } is the v4 way. No more separate config file. Works with the @tailwindcss/vite plugin.

2026-04-12 | Active scale-down on buttons (active:scale-[0.98]) provides tactile micro-interaction feedback | UI pattern — combined with transition-all duration-200, the slight scale creates a "press" feel. Applied to all primary action buttons.

2026-04-12 | Group hover reveals (opacity-0 group-hover:opacity-100 with translate) create progressive disclosure | UI pattern — arrow icons, delete buttons on images, and metadata overlays that appear on hover reduce visual clutter while maintaining discoverability.
