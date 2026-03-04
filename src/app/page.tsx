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
      <main className="relative z-2 flex flex-col items-center py-6 px-8">
        {/* two vertical bordered rectangles */}
        <div className="animate-fade-up flex gap-6">
          <div className="h-[88vh] w-64 rounded-lg border-[8px] border-rule bg-background/30 p-6 overflow-y-auto scrollbar-hidden">
            <p className="font-serif text-[0.85rem] leading-loose tracking-[0.02em] text-fg-dim">
              <span className="text-foreground font-bold text-[1rem]">Hey!</span> My name is Manav Kaushik, welcome to my page!
            </p>
            <p className="font-serif text-[0.85rem] leading-loose tracking-[0.02em] text-fg-dim mt-4">
              I&apos;m a backend software engineer currently working at UBS with 4 years of experience.
            </p>
            <p className="font-serif text-[0.85rem] leading-loose tracking-[0.02em] text-fg-dim mt-4">
              I&apos;m experimenting a ton these days with agentic flows, harnesses and various other things.
            </p>
            <hr className="my-5 w-8 border-0 h-px bg-rule" />
            <p className="font-serif text-[0.85rem] leading-loose tracking-[0.02em] text-fg-dim italic">
              Do reach out to me if you have any inquiries!
            </p>
          </div>
          <div className="h-[88vh] w-64 rounded-lg border-[8px] border-rule bg-background/30 p-6 overflow-y-auto scrollbar-hidden">
            <div className="space-y-5">
              <div>
                <h3 className="font-mono text-[0.75rem] tracking-[0.08em] uppercase text-foreground mb-2">Languages</h3>
                <p className="font-serif text-[0.82rem] leading-relaxed text-fg-dim">Java, Python, C++, Go, SQL, JavaScript, HTML/CSS</p>
              </div>
              <hr className="w-6 border-0 h-px bg-rule" />
              <div>
                <h3 className="font-mono text-[0.75rem] tracking-[0.08em] uppercase text-foreground mb-2">Frameworks</h3>
                <p className="font-serif text-[0.82rem] leading-relaxed text-fg-dim">Kubernetes, Spring Boot, React, Node.js</p>
              </div>
              <hr className="w-6 border-0 h-px bg-rule" />
              <div>
                <h3 className="font-mono text-[0.75rem] tracking-[0.08em] uppercase text-foreground mb-2">Technologies</h3>
                <p className="font-serif text-[0.82rem] leading-relaxed text-fg-dim">OracleDB, Apache Kafka, Helm, IBM MessageQueue, Tibco EMS, GraphQL, RESTful API</p>
              </div>
              <hr className="w-6 border-0 h-px bg-rule" />
              <div>
                <h3 className="font-mono text-[0.75rem] tracking-[0.08em] uppercase text-foreground mb-2">Cloud</h3>
                <p className="font-serif text-[0.82rem] leading-relaxed text-fg-dim">Azure (AKS, Functions, Storage, Monitoring), AWS (AgentCore, Bedrock, Lambda, S3, Alexa Skills)</p>
              </div>
              <hr className="w-6 border-0 h-px bg-rule" />
              <div>
                <h3 className="font-mono text-[0.75rem] tracking-[0.08em] uppercase text-foreground mb-2">Developer Tools</h3>
                <p className="font-serif text-[0.82rem] leading-relaxed text-fg-dim">Claude Code, Copilot, Git, Docker</p>
              </div>
            </div>
          </div>
        </div>

        {/* nav links below the rectangles */}
        <nav className="animate-fade-up-1 mt-6 flex justify-center gap-8">
          <a
            href="https://github.com/HiImManav"
            target="_blank"
            rel="noopener noreferrer"
            className="link-rustic font-mono text-[0.8rem] tracking-[0.06em] lowercase text-accent hover:text-foreground transition-colors"
          >
            github
          </a>
          <a
            href="mailto:manavkprivate@gmail.com"
            className="link-rustic font-mono text-[0.8rem] tracking-[0.06em] lowercase text-accent hover:text-foreground transition-colors"
          >
            email
          </a>
          <a
            href="https://www.linkedin.com/in/manav-kaushik-cs/"
            target="_blank"
            rel="noopener noreferrer"
            className="link-rustic font-mono text-[0.8rem] tracking-[0.06em] lowercase text-accent hover:text-foreground transition-colors"
          >
            linkedin
          </a>
          <a
            href="/manav_resume.pdf"
            download="manav_resume.pdf"
            className="link-rustic font-mono text-[0.8rem] tracking-[0.06em] lowercase text-accent hover:text-foreground transition-colors"
          >
            resume
          </a>
        </nav>
      </main>
    </div>
  );
}
