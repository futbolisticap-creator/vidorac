import type { ReactNode } from "react";
import MediaToolForm, { type ToolMode } from "./media-tool-form";

type ToolPageProps = {
  mode: ToolMode;
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
};

function ToolIcon({ mode }: { mode: ToolMode }) {
  const paths = {
    compress: <path strokeLinecap="round" strokeLinejoin="round" d="M8 3v5H3m13-5v5h5M8 21v-5H3m13 5v-5h5" />,
    convert: <path strokeLinecap="round" strokeLinejoin="round" d="m16 3 4 4-4 4M4 7h16M8 21l-4-4 4-4m12 4H4" />,
    trim: <path strokeLinecap="round" strokeLinejoin="round" d="m4 4 16 16M4 20 20 4M8.5 8.5 5 5m10.5 10.5L19 19" />,
  };
  return (
    <svg aria-hidden="true" className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      {paths[mode]}
    </svg>
  );
}

export default function ToolPage({ mode, eyebrow, title, description, children }: ToolPageProps) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#07080c] px-5 pb-16 pt-32 text-white sm:px-8 sm:pt-36">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <div className="grid-overlay" />
      <section className="relative z-10 mx-auto w-full max-w-4xl">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mx-auto mb-6 flex size-14 items-center justify-center rounded-2xl border border-[#258cff]/25 bg-[#1682ff]/10 text-[#75d1ff] shadow-[0_0_35px_rgba(22,130,255,0.12)]">
            <ToolIcon mode={mode} />
          </div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-[#7acfff]/65">{eyebrow}</p>
          <h1 className="mt-3 text-balance text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">{title}</h1>
          <p className="mx-auto mt-4 max-w-xl text-pretty text-base leading-7 text-white/50">{description}</p>
          {children}
        </div>
        <MediaToolForm mode={mode} />
      </section>
    </main>
  );
}
