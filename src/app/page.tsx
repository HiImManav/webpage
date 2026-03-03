import BouncingFruits from "./BouncingFruits";
import Croc from "./Croc";

export default function Home() {
  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden">
      {/* bouncing fruits — behind everything */}
      <BouncingFruits />

      {/* croc mascot */}
      <Croc />

      {/* aged stone patina — large-scale weathering */}
      <div className="stone-patina" aria-hidden="true" />

      {/* rough stone surface texture */}
      <div className="stone-texture" aria-hidden="true" />

      {/* fine sand grain */}
      <div className="grain-overlay" aria-hidden="true" />

      {/* vignette */}
      <div className="vignette-overlay" aria-hidden="true" />

      {/* content */}
      <main className="relative z-2 text-center px-8 max-w-[600px]">
        <h1 className="animate-fade-up font-serif text-[clamp(3rem,8vw,5.5rem)] font-bold leading-none tracking-[0.04em] text-foreground">
          Manav
        </h1>

        <hr className="animate-fade-up-1 mx-auto my-6 w-12 border-0 h-px bg-rule" />

        <p className="animate-fade-up-2 font-serif text-[0.95rem] italic tracking-[0.02em] text-fg-dim">
          welcome, stranger.
        </p>

        <nav className="animate-fade-up-3 mt-12 flex justify-center gap-8 max-sm:flex-col max-sm:gap-4">
          <a
            href="https://github.com/yourusername"
            target="_blank"
            rel="noopener noreferrer"
            className="link-rustic font-mono text-[0.8rem] tracking-[0.06em] lowercase text-accent hover:text-foreground transition-colors"
          >
            github
          </a>
          <a
            href="mailto:you@example.com"
            className="link-rustic font-mono text-[0.8rem] tracking-[0.06em] lowercase text-accent hover:text-foreground transition-colors"
          >
            email
          </a>
          <a
            href="https://linkedin.com/in/yourprofile"
            target="_blank"
            rel="noopener noreferrer"
            className="link-rustic font-mono text-[0.8rem] tracking-[0.06em] lowercase text-accent hover:text-foreground transition-colors"
          >
            linkedin
          </a>
        </nav>
      </main>
    </div>
  );
}
