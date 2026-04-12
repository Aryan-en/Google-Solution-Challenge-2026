import Link from "next/link";

const features = [
  {
    title: "Bias Detection",
    description:
      "Upload hiring data and instantly detect disparate impact across demographic groups using the EEOC 4/5ths rule.",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    title: "AI Explanations",
    description:
      "Get clear, non-technical explanations of detected bias powered by Google's Gemini AI model.",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  },
  {
    title: "What-If Simulator",
    description:
      "Adjust hiring thresholds interactively and see how changes affect fairness metrics in real time.",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
      </svg>
    ),
  },
  {
    title: "Actionable Fixes",
    description:
      "Receive concrete, data-driven recommendations to reduce bias and build a more equitable hiring process.",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
];

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden py-24 sm:py-32">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(45%_40%_at_50%_60%,var(--accent)_0%,transparent_100%)] opacity-[0.07]" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-card-border px-4 py-1.5 text-sm text-muted mb-8">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            Powered by Gemini AI
          </div>
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight max-w-4xl mx-auto leading-tight">
            Detect and eliminate{" "}
            <span className="text-accent">hiring bias</span> with AI
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-muted max-w-2xl mx-auto">
            Upload your hiring data, uncover hidden bias patterns, and get
            actionable recommendations to build a fairer recruitment process.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link
              href="/upload"
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-3 text-sm font-medium text-white hover:bg-accent-light shadow-lg shadow-accent/25"
            >
              Get Started
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-lg border border-card-border px-6 py-3 text-sm font-medium hover:bg-card"
            >
              View Demo
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 border-t border-card-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold">How it works</h2>
            <p className="mt-4 text-muted max-w-2xl mx-auto">
              Four steps to a fairer hiring process
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, i) => (
              <div
                key={feature.title}
                className="relative rounded-xl border border-card-border bg-card p-6 hover:border-accent/50 transition-colors group"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent/10 text-accent mb-4 group-hover:bg-accent group-hover:text-white transition-colors">
                  {feature.icon}
                </div>
                <div className="absolute top-4 right-4 text-xs font-mono text-muted">
                  0{i + 1}
                </div>
                <h3 className="font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 border-t border-card-border">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready to audit your hiring process?
          </h2>
          <p className="text-muted mb-8">
            Upload a CSV dataset and get bias analysis results in seconds.
          </p>
          <Link
            href="/upload"
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-8 py-3.5 text-sm font-medium text-white hover:bg-accent-light shadow-lg shadow-accent/25"
          >
            Upload Your Data
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-card-border py-8">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between text-sm text-muted">
          <span>HireLens &mdash; Google Solution Challenge 2026</span>
          <span>Built with Next.js, FastAPI & Gemini</span>
        </div>
      </footer>
    </div>
  );
}
