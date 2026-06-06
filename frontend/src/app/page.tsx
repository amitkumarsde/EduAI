import Link from "next/link";
import {
  LuFileText,
  LuScanLine,
  LuBrain,
  LuMessageCircle,
  LuTriangleAlert,
  LuTrophy,
  LuArrowRight,
  LuSparkles,
  LuCheck,
} from "react-icons/lu";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const FEATURES = [
  { icon: LuFileText, title: "AI paper generation", text: "Generate exam-ready question papers with Gemini and export them to PDF in seconds." },
  { icon: LuScanLine, title: "Exam analysis", text: "Upload an answer sheet and get instant AI grading with chapter-wise feedback." },
  { icon: LuBrain, title: "Adaptive exams", text: "Timed exams that adjust difficulty in real time to match every learner." },
  { icon: LuMessageCircle, title: "24/7 AI tutor", text: "A Socratic tutor that explains concepts step by step, personalized to you." },
  { icon: LuTriangleAlert, title: "Predictive insights", text: "Spot at-risk topics early with AI-driven risk scoring and proactive alerts." },
  { icon: LuTrophy, title: "Leaderboards", text: "Class rankings and streaks that keep learners motivated and engaged." },
];

const STEPS = [
  { n: "01", title: "Create your space", text: "Sign up as a learner or a school in under a minute — no setup required." },
  { n: "02", title: "Generate & assess", text: "Build papers, run adaptive quizzes, and let AI grade and analyze instantly." },
  { n: "03", title: "Act on insights", text: "Follow personalized recommendations and track mastery over time." },
];

const AUDIENCE = [
  {
    tag: "For students",
    title: "Learn smarter, not harder",
    points: ["Adaptive practice tuned to you", "Step-by-step AI tutoring", "Personalized recommendations", "Track mastery and streaks"],
  },
  {
    tag: "For schools",
    title: "Insight for every classroom",
    points: ["Generate papers in seconds", "Auto-grade answer sheets", "Class-wide analytics", "Early at-risk detection"],
  },
];

const FAQ = [
  { q: "Is EduAI free to start?", a: "Yes. You can create a free account and explore the core features as a learner or a school right away." },
  { q: "Which AI powers EduAI?", a: "EduAI is built on Google's Gemini models for paper generation, grading, tutoring, and insights." },
  { q: "Can teachers and students both use it?", a: "Absolutely — EduAI serves individual learners (B2C) and schools (B2B) with role-specific experiences." },
  { q: "Do I need to install anything?", a: "No installation needed. EduAI runs entirely in your browser on any device." },
];

const STATS = [
  { value: "15+", label: "AI features" },
  { value: "B2C + B2B", label: "Learners & schools" },
  { value: "Gemini", label: "Powered" },
  { value: "24/7", label: "AI tutor" },
];

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 -top-32 mx-auto h-72 max-w-3xl rounded-full opacity-40 blur-3xl"
            style={{ background: "radial-gradient(closest-side, var(--accent-soft), transparent)" }}
          />
          <div className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6 sm:py-28">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border-default bg-surface px-3 py-1 text-xs font-medium text-muted">
              <LuSparkles className="h-3.5 w-3.5 text-accent" />
              AI quiz & performance analytics
            </span>
            <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-fg sm:text-6xl">
              Turn every exam into{" "}
              <span className="text-accent">actionable insight</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-muted">
              Generate quizzes, analyze performance, predict risks, and deliver personalized
              learning paths — for individual learners and schools alike.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/signup">
                <Button size="lg" className="gap-2">
                  Create free account <LuArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline">I already have an account</Button>
              </Link>
            </div>

            <div className="mx-auto mt-16 grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
              {STATS.map((stat) => (
                <div key={stat.label} className="rounded-xl border border-border-default bg-surface px-4 py-5">
                  <div className="text-2xl font-semibold tracking-tight text-fg">{stat.value}</div>
                  <div className="mt-1 text-sm text-muted">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="border-t border-border-default bg-surface/40">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
                Everything you need to learn smarter
              </h2>
              <p className="mt-3 text-muted">
                A complete AI toolkit for assessment, analysis, and personalized learning.
              </p>
            </div>
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, text }) => (
                <Card key={title} hover className="p-6">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent-soft text-accent">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-fg">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{text}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="border-t border-border-default">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
                Up and running in three steps
              </h2>
              <p className="mt-3 text-muted">From sign-up to insight in minutes.</p>
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {STEPS.map((step) => (
                <div key={step.n} className="relative rounded-xl border border-border-default bg-surface p-6">
                  <span className="text-sm font-semibold text-accent">{step.n}</span>
                  <h3 className="mt-2 text-lg font-semibold text-fg">{step.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{step.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Audience */}
        <section id="audience" className="border-t border-border-default bg-surface/40">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <div className="grid gap-6 md:grid-cols-2">
              {AUDIENCE.map((group) => (
                <Card key={group.tag} className="p-8">
                  <span className="inline-flex rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
                    {group.tag}
                  </span>
                  <h3 className="mt-4 text-2xl font-semibold tracking-tight text-fg">{group.title}</h3>
                  <ul className="mt-5 space-y-3">
                    {group.points.map((point) => (
                      <li key={point} className="flex items-center gap-3 text-sm text-muted">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success-soft text-success">
                          <LuCheck className="h-3.5 w-3.5" />
                        </span>
                        {point}
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="border-t border-border-default">
          <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
            <div className="text-center">
              <h2 className="text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
                Frequently asked questions
              </h2>
            </div>
            <div className="mt-10 divide-y divide-border-default rounded-xl border border-border-default bg-surface">
              {FAQ.map((item) => (
                <details key={item.q} className="group px-5 py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-fg">
                    {item.q}
                    <span className="text-subtle transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-border-default bg-surface/40">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <div className="relative overflow-hidden rounded-2xl border border-border-default bg-surface px-6 py-14 text-center">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-40 blur-3xl"
                style={{ background: "radial-gradient(40% 60% at 50% 0%, var(--accent-soft), transparent)" }}
              />
              <div className="relative">
                <h2 className="text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
                  Ready to get started?
                </h2>
                <p className="mx-auto mt-3 max-w-xl text-muted">
                  Join EduAI and turn every exam into actionable insight.
                </p>
                <Link href="/signup" className="mt-7 inline-block">
                  <Button size="lg" className="gap-2">
                    Get started free <LuArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
