import { NavLink } from 'react-router-dom'
import AppLogo from '@/components/AppLogo'

const sections = [
  {
    title: 'Information We Collect',
    body: [
      'Account and profile details you provide during sign-in (via Google), such as name, email, and profile photo. When you connect LinkedIn as a publishing integration, we also store the LinkedIn profile metadata LinkedIn returns.',
      'Content and media you create or upload in LinkedPush, including post drafts, scheduled posts, and attached files.',
      'Operational metadata such as timestamps, publish status, and basic usage events required to run the product.',
    ],
  },
  {
    title: 'How We Use Information',
    body: [
      'To provide core product features, including drafting, scheduling, and publishing workflows.',
      'To secure accounts, detect abuse, and keep the service reliable and performant.',
      'To improve product quality through aggregate usage patterns, diagnostics, and bug resolution.',
    ],
  },
  {
    title: 'Cookies and Session Data',
    body: [
      'LinkedPush uses essential cookies/session tokens to authenticate users and keep sessions active.',
      'These cookies are used for security and product operation, not third-party ad targeting.',
      'Disabling required cookies may prevent sign-in or other authenticated functionality from working.',
    ],
  },
  {
    title: 'Third-Party Services',
    body: [
      'Google OAuth is used for user sign-in. We receive your name, email, and profile photo from Google.',
      'LinkedIn APIs are used only as a publishing integration — never for sign-in. After you connect LinkedIn in Settings, we use its APIs to publish posts you explicitly create.',
      'Anthropic APIs may be used for AI-assisted writing when that feature is enabled by your workspace.',
      'Infrastructure providers may process data solely to host, secure, and operate the application.',
    ],
  },
  {
    title: 'Data Retention',
    body: [
      'We retain account and content data for as long as your workspace is active and the data is needed to provide the service.',
      'You can delete posts and media at any time inside the product.',
      'Backups and logs may be retained for a limited period for disaster recovery and security analysis.',
    ],
  },
  {
    title: 'Security',
    body: [
      'We apply technical and organizational safeguards designed to protect your information.',
      'No system is perfectly secure; you should also use strong passwords and secure your deployment environment.',
      'If a material security incident occurs, we will communicate details and remediation guidance as required.',
    ],
  },
  {
    title: 'Your Rights and Choices',
    body: [
      'Depending on your location, you may have rights to access, correct, export, or delete personal data.',
      'You can request account/data changes through your workspace administrator or support contact.',
      'Where applicable, you may object to or restrict certain processing activities.',
    ],
  },
  {
    title: 'International Data Transfers',
    body: [
      'If data is processed outside your jurisdiction, we use reasonable safeguards to protect transferred information.',
      'Transfer mechanisms and contractual protections are applied when required by law.',
    ],
  },
  {
    title: 'Policy Updates',
    body: [
      'We may update this policy from time to time to reflect legal, product, or operational changes.',
      'Material updates will be communicated through the product or other appropriate channels.',
      'The “Last updated” date indicates the latest revision.',
    ],
  },
]

export default function Privacy() {
  return (
    <div className="relative min-h-screen bg-[#0a0a0a] text-white noise-bg">
      <div className="relative z-10">
        <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#0a0a0a]/70 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-6">
          <AppLogo variant="navMinimal" />
          <NavLink
            to="/"
            className="rounded-md px-3 py-1.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            Back to home
          </NavLink>
        </div>
      </header>

      <main className="relative">
        <section className="border-b border-white/[0.06]">
          <div className="mx-auto w-full max-w-5xl px-6 py-16 sm:py-20">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-white/45">Legal</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-[-0.03em] text-white sm:text-5xl">Privacy Policy</h1>
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-white/60 sm:text-base">
              This policy describes how LinkedPush collects, uses, stores, and protects information when you use the
              product. This template should be reviewed and finalized by your legal/privacy owner before production use.
            </p>
            <p className="mt-5 text-xs text-white/45">Last updated: April 15, 2026</p>
          </div>
        </section>

        <section>
          <div className="mx-auto w-full max-w-5xl px-6 py-10 sm:py-14">
            <div className="space-y-4">
              {sections.map(section => (
                <article key={section.title} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-6 sm:p-7">
                  <h2 className="text-xl font-semibold tracking-[-0.01em] text-white sm:text-2xl">{section.title}</h2>
                  <div className="mt-4 space-y-3">
                    {section.body.map(paragraph => (
                      <p key={paragraph} className="text-sm leading-relaxed text-white/65 sm:text-[15px]">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>
      </div>
    </div>
  )
}
