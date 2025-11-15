import { RESOLUTION_SCENES } from "../data/resolutions";

export function ResolutionsList() {
  return (
    <section className="grid gap-5 md:grid-cols-2">
      {RESOLUTION_SCENES.map((scene) => (
        <article
          key={scene.id}
          className="group relative overflow-hidden rounded-3xl border border-slate-800/60 bg-slate-900/40 p-6 shadow-lg shadow-black/30 backdrop-blur"
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-40 transition duration-500 group-hover:opacity-70"
            style={{
              background: `linear-gradient(135deg, ${scene.gradient[0]}, ${scene.gradient[1]})`,
            }}
          />
          <div className="relative flex h-full flex-col gap-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-300">
                Resolution
              </span>
              <span className="rounded-full bg-slate-900/60 px-3 py-1 text-xs font-medium text-slate-200 ring-1 ring-white/10">
                {scene.metric.label}
              </span>
            </div>
            <div>
              <h3 className="text-2xl font-semibold text-slate-50 md:text-3xl">
                {scene.title}
              </h3>
              <p className="mt-2 text-sm text-slate-300 md:text-base">
                {scene.subtitle}
              </p>
            </div>
            <ul className="flex flex-col gap-3 text-sm text-slate-200/90 md:text-base">
              {scene.bullets.map((bullet) => (
                <li
                  key={bullet}
                  className="flex items-start gap-3 rounded-xl bg-slate-900/60 px-4 py-3 ring-1 ring-white/5 transition group-hover:ring-white/15"
                >
                  <span
                    className="mt-1 h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: scene.accent }}
                  />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
            <div className="flex items-baseline justify-between rounded-2xl border border-white/5 bg-black/40 px-4 py-3 text-slate-200 shadow-inner shadow-black/40">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                  Metric lift
                </p>
                <p className="text-3xl font-semibold text-slate-50">
                  {scene.metric.value}
                </p>
              </div>
              <p className="max-w-[180px] text-right text-xs text-slate-400">
                {scene.metric.caption}
              </p>
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}
