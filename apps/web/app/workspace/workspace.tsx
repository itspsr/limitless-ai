"use client";
import { useState, useEffect, useCallback } from "react";
import { signOut } from "next-auth/react";
import Chat from "./chat";
import Connect from "./connect";
import type { Snapshot } from "./types";
export default function Workspace({ single }: { single: boolean }) {
  const [data, S] = useState<Snapshot | null>(null),
    [tab, T] = useState("Dashboard"),
    [msg, M] = useState(""),
    [modal, Q] = useState<string | null>(null),
    [now, N] = useState(Date.now()),
    [drag, G] = useState("");
  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/workspace", { cache: "no-store" });
      if (!r.ok) throw Error();
      S(await r.json());
    } catch {
      M("Could not load the workspace.");
    }
  }, []);
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => N(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [refresh]);
  async function act(body: Record<string, unknown>) {
    try {
      const r = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw Error();
      await refresh();
      M(
        body.action === "test" || body.action === "probe"
          ? "Connection verified."
          : "Changes saved.",
      );
      return true;
    } catch {
      M("Action failed. Check your settings and try again.");
      return false;
    }
  }
  if (!data)
    return (
      <>
        <p role="status">{msg || "Loading workspace…"}</p>
        <div className="skeleton" />
        <button onClick={refresh}>Reload</button>
      </>
    );
  const cs = data.connections,
    active = cs.find((c) => !c.cooldown || +new Date(c.cooldown) <= now),
    hours = Array.from({ length: 24 }, (_, i) =>
      cs.reduce(
        (n, c) =>
          n +
          c.usage
            .filter((u) => new Date(u.minute).getUTCHours() === i)
            .reduce((a, b) => a + b.requests, 0),
        0,
      ),
    );
  function reorder(id: string, to: number) {
    const ids = cs.map((c) => c.id);
    if (!ids.includes(id) || to < 0 || to >= ids.length) return;
    ids.splice(ids.indexOf(id), 1);
    ids.splice(to, 0, id);
    void act({ action: "order", ids });
  }
  return (
    <>
      <header>
        <nav>
          {["Dashboard", "Chat", "Settings"].map((t) => (
            <button
              className={t === tab ? "active" : ""}
              key={t}
              onClick={() => T(t)}
            >
              {t}
            </button>
          ))}
        </nav>
        {!single && <button onClick={() => signOut()}>Sign out</button>}
      </header>
      <h1>{tab}</h1>
      {msg && (
        <div className="toast" role="status">
          {msg}{" "}
          <button onClick={() => M("")} aria-label="Dismiss message">
            ×
          </button>
        </div>
      )}
      {tab === "Chat" ? (
        <Chat data={data} act={act} refresh={refresh} />
      ) : tab === "Settings" ? (
        <section className="box">
          <h2>Fallback order</h2>
          <p>Drag a provider or use the arrow buttons.</p>
          {cs.map((c, i) => (
            <div
              className="row"
              key={c.id}
              draggable
              onDragStart={() => G(c.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => reorder(drag, i)}
            >
              <strong>
                {i + 1}. {c.name}
              </strong>
              <button
                aria-label={"Move " + c.name + " up"}
                disabled={!i}
                onClick={() => reorder(c.id, i - 1)}
              >
                ↑
              </button>
              <button
                aria-label={"Move " + c.name + " down"}
                disabled={i === cs.length - 1}
                onClick={() => reorder(c.id, i + 1)}
              >
                ↓
              </button>
              <button onClick={() => Q(c.id)}>{c.model}</button>
            </div>
          ))}
          {["autoSwitch", "warn"].map((key, i) => (
            <label key={key}>
              <span>
                <input
                  type="checkbox"
                  checked={data.settings[key]}
                  onChange={(e) =>
                    act({
                      action: "settings",
                      ...data.settings,
                      [key]: e.target.checked,
                    })
                  }
                />{" "}
                {
                  ["Automatically switch providers", "Warn at 80% daily usage"][
                    i
                  ]
                }
              </span>
            </label>
          ))}
          <label>
            When all providers are exhausted
            <select
              value={data.settings.exhausted}
              onChange={(e) =>
                act({
                  action: "settings",
                  ...data.settings,
                  exhausted: e.target.value,
                })
              }
            >
              <option value="notify">Show earliest retry time</option>
              <option value="stop">Stop with a brief notice</option>
            </select>
          </label>
        </section>
      ) : (
        <>
          <div className="grid">
            {[
              ["Requests today", cs.reduce((s, c) => s + c.requests, 0)],
              ["Tools connected", cs.length],
              ["Active tool", active?.name ?? "—"],
              [
                "Auto-switches today",
                data.activity.filter((a) => a.kind === "switch").length,
              ],
            ].map(([k, v]) => (
              <article className="metric" key={k}>
                <small>{k}</small>
                <strong>{v}</strong>
              </article>
            ))}
          </div>
          <section>
            <div className="row">
              <h2>Providers</h2>
              <button className="primary" onClick={() => Q("new")}>
                Connect provider
              </button>
            </div>
            {!cs.length && (
              <article>
                <h3>Connect your first provider</h3>
                <p>Your models, usage and fallback order will appear here.</p>
              </article>
            )}
            <div className="grid">
              {cs.map((c, i) => {
                const pct = c.limits.rpd
                    ? Math.min(
                        100,
                        Math.round((100 * c.requests) / c.limits.rpd),
                      )
                    : null,
                  reset = Math.max(
                    Number(new Date(c.cooldown ?? 0)),
                    c.headers.resetAt ?? 0,
                  );
                return (
                  <article key={c.id}>
                    <div className="row">
                      <h3>{c.name}</h3>
                      <span className="chip">#{i + 1}</span>
                    </div>
                    <small className="status">
                      {Number(new Date(c.cooldown ?? 0)) > now
                        ? "Cooling down"
                        : "Connected"}
                    </small>
                    <div
                      className="ring"
                      style={{
                        background:
                          "conic-gradient(var(--violet) " +
                          (pct ?? 0) +
                          "%,var(--line) 0)",
                      }}
                    >
                      <span>{pct === null ? "—" : pct + "%"}</span>
                    </div>
                    <p>
                      {c.model}
                      <br />
                      {c.requests} requests today · {c.tokens} reported tokens
                      <br />
                      {c.headers.remainingRequests ??
                        (c.limits.rpd
                          ? Math.max(0, c.limits.rpd - c.requests)
                          : "Unknown")}{" "}
                      requests remaining
                      <br />
                      {reset > now
                        ? "Resets in " + Math.ceil((reset - now) / 1000) + "s"
                        : "Reset time unknown"}
                    </p>
                    {data.settings.warn && pct !== null && pct >= 80 && (
                      <p role="status">Daily usage has reached {pct}%.</p>
                    )}
                    <div className="row">
                      <button onClick={() => Q(c.id)}>Edit</button>
                      <button onClick={() => act({ action: "test", id: c.id })}>
                        Test
                      </button>
                      <button
                        onClick={() => {
                          if (
                            confirm(
                              "Disconnect " +
                                c.name +
                                " and delete its stored key?",
                            )
                          )
                            void act({ action: "disconnect", id: c.id });
                        }}
                      >
                        Disconnect
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
          <section className="grid">
            <article>
              <h3>Hourly requests · UTC</h3>
              <div
                className="bars"
                role="img"
                aria-label={hours.map((n, i) => i + "h: " + n).join(", ")}
              >
                {hours.map((n, i) => (
                  <i
                    key={i}
                    title={i + "h · " + n}
                    style={{ height: (n / Math.max(1, ...hours)) * 100 + "%" }}
                  />
                ))}
              </div>
            </article>
            <article>
              <h3>Activity today</h3>
              {data.activity.length ? (
                data.activity.slice(0, 10).map((a) => (
                  <p key={a.id}>
                    {new Date(a.created).toLocaleTimeString()} · {a.detail}
                  </p>
                ))
              ) : (
                <p>No switches recorded today.</p>
              )}
            </article>
          </section>
        </>
      )}
      {modal && (
        <Connect
          data={data}
          edit={cs.find((c) => c.id === modal)}
          close={() => Q(null)}
          act={act}
        />
      )}
    </>
  );
}
