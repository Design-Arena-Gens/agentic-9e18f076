import { CTA_SCENE, INTRO_SCENE } from "./data/resolutions";
import { ResolutionsList } from "./components/resolutions-list";
import { VideoComposer } from "./components/video-composer";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-16 px-6 pb-24 pt-16 md:px-12 lg:px-20">
        <header className="relative overflow-hidden rounded-3xl border border-slate-800/60 bg-slate-900/60 px-8 py-14 shadow-[0_40px_120px_-40px_rgba(15,23,42,0.8)]">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-sky-500/10 via-transparent to-purple-500/10" />
          <div className="relative flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
            <div className="max-w-3xl space-y-6">
              <p className="text-xs uppercase tracking-[0.38em] text-slate-400">
                Agentic Studio Reel
              </p>
              <h1 className="text-4xl font-semibold leading-tight md:text-5xl lg:text-6xl">
                {INTRO_SCENE.title}
              </h1>
              <p className="text-lg text-slate-300 md:text-xl">
                {INTRO_SCENE.subtitle}
              </p>
              <div className="flex flex-wrap gap-4 text-sm font-medium text-slate-200 md:text-base">
                <span className="rounded-full border border-white/10 px-4 py-2">
                  720p canvas ready
                </span>
                <span className="rounded-full border border-white/10 px-4 py-2">
                  Scripted storyline
                </span>
                <span className="rounded-full border border-white/10 px-4 py-2">
                  MediaRecorder export
                </span>
              </div>
            </div>
            <div className="relative isolate flex max-w-xs flex-col items-start gap-4 rounded-2xl border border-slate-800/70 bg-slate-950/70 p-6 shadow-inner shadow-black/40">
              <div className="absolute -right-10 -top-10 h-24 w-24 rounded-full bg-sky-500/20 blur-3xl" />
              <p className="text-xs uppercase tracking-[0.26em] text-slate-400">
                Final beat
              </p>
              <h2 className="text-xl font-semibold text-white">
                {CTA_SCENE.title}
              </h2>
              <p className="text-sm text-slate-300">{CTA_SCENE.action}</p>
            </div>
          </div>
        </header>

        <VideoComposer />

        <section className="grid gap-10 lg:grid-cols-[1.25fr_0.75fr]">
          <div>
            <h2 className="text-2xl font-semibold text-white md:text-3xl">
              Your resolution storyboard
            </h2>
            <p className="mt-2 max-w-xl text-sm text-slate-400 md:text-base">
              Each beat is scripted for motion graphics, presenter notes, and a
              metric hook. Hit record to export the full sequence, or remix the
              copy before rendering.
            </p>
            <div className="mt-8">
              <ResolutionsList />
            </div>
          </div>
          <aside className="flex flex-col gap-6 rounded-3xl border border-slate-800/70 bg-slate-900/40 p-6 shadow-lg shadow-black/40">
            <div>
              <h3 className="text-lg font-semibold text-white">
                Production flow
              </h3>
              <ul className="mt-3 space-y-3 text-sm text-slate-300">
                <li>
                  1. Press <span className="text-sky-400">Play preview</span> to
                  rehearse the on-screen kinetic motion.
                </li>
                <li>
                  2. Hit <span className="text-emerald-400">Render video</span>{" "}
                  to capture a browser-quality WebM clip.
                </li>
                <li>
                  3. Drop the clip into your editor for voiceover layering or
                  soundtrack mixing.
                </li>
              </ul>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/40 p-5 text-sm text-slate-200 shadow-inner shadow-black/50">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                Presenter notes
              </p>
              <p className="mt-3 text-base text-slate-300">
                Anchor each resolution with a customer story, then quantify the
                before and after with the momentum metric. Close by inviting the
                team to pilot one ritual this week.
              </p>
            </div>
            <div className="rounded-2xl border border-sky-500/40 bg-sky-500/10 p-5 text-sm text-sky-100 shadow-lg shadow-sky-500/30">
              <p className="font-semibold text-sky-200">
                Tip: Run the canvas at 1280×720 for fast renders. Switch your
                browser to 4K capture when you need broadcast quality.
              </p>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}
