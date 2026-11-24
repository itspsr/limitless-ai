import Link from "next/link";
import { Button } from "../components/ui/button";
import providers from "../../../packages/providers/providers.json";
export default function Home() {
  return (
    <main className="site">
      <header>
        <Link className="brand" href="/">
          <b>∞</b> LimitLess AI
        </Link>
        <nav>
          <a href="#providers">Providers</a>
          <a href="#faq">FAQ</a>
          <Link href="/workspace">Workspace ↗</Link>
        </nav>
      </header>
      <section className="hero">
        <div>
          <h1>
            Never hit an AI <em>limit</em> again
          </h1>
          <p>
            Keep a research thread going across your AI providers. Bring your
            keys, choose the order, and take the whole conversation with you.
          </p>
          <Button asChild>
            <Link href="/workspace">Open workspace →</Link>
          </Button>
        </div>
        <figure className="diagram">
          <figcaption>Fallback preview</figcaption>
          {["Google Gemini", "Groq", "OpenRouter"].map((n, i) => (
            <div key={n}>
              <span>0{i + 1}</span>
              <strong>{n}</strong>
              <small>{["Quota reached", "Continuing", "Ready"][i]}</small>
            </div>
          ))}
        </figure>
      </section>
      <section>
        <h2>How it works</h2>
        <div className="grid">
          {[
            ["Connect", "Use your own official API credentials."],
            [
              "Prioritize",
              "Choose which model answers first and edit your quota estimates.",
            ],
            [
              "Research",
              "Stream replies, pin findings and export your conversation.",
            ],
          ].map(([h, p]) => (
            <article key={h}>
              <h3>{h}</h3>
              <p>{p}</p>
            </article>
          ))}
        </div>
      </section>
      <section id="providers">
        <h2>Supported providers</h2>
        <div className="chips">
          {providers.map((p) => (
            <span key={p.id}>{p.name}</span>
          ))}
        </div>
      </section>
      <section id="faq">
        <h2>Frequently asked questions</h2>
        <details>
          <summary>Is it free?</summary>
          <p>
            The software is free. Each provider sets its own API pricing and
            quotas.
          </p>
        </details>
        <details>
          <summary>Where do my messages go?</summary>
          <p>
            Each selected provider receives the full thread, including attached
            text. Keys are encrypted on your host.
          </p>
        </details>
        <details>
          <summary>Can I host it myself?</summary>
          <p>
            Run the Docker Compose project locally with SQLite, or configure
            PostgreSQL.
          </p>
        </details>
      </section>
      <footer>
        MIT licensed · Open source{" "}
        <a href="https://github.com/itspsr/limitless-ai">View on GitHub ↗</a>
      </footer>
    </main>
  );
}
