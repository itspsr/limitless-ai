"use client";
import { useState } from "react";
import Markdown from "react-markdown";
import type { Action, Snapshot } from "./types";
async function attachment(file: File) {
  if (file.size > 3_000_000) throw Error("Choose a file smaller than 3 MB.");
  if (!file.name.toLowerCase().endsWith(".pdf")) return file.text();
  const pdf = await import("pdfjs-dist");
  pdf.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const doc = await pdf.getDocument({ data: await file.arrayBuffer() }).promise;
  try {
    let text = "";
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      text +=
        (await page.getTextContent()).items
          .map((x) => ("str" in x ? x.str : ""))
          .join(" ") + "\n";
      if (text.length > 200000)
        throw Error("PDF exceeds the attachment limit.");
    }
    return text;
  } finally {
    await doc.destroy();
  }
}
export default function Chat({
  data,
  act,
  refresh,
}: {
  data: Snapshot;
  act: Action;
  refresh: () => Promise<void>;
}) {
  const [id, ID] = useState(""),
    [input, I] = useState(""),
    [draft, D] = useState(""),
    [pending, U] = useState(""),
    [busy, B] = useState(false),
    [banner, M] = useState(""),
    [model, P] = useState(""),
    [file, F] = useState<File | null>(null);
  const conv = data.conversations.find((c) => c.id === id),
    messages = conv?.messages ?? [];
  async function send() {
    B(true);
    D("");
    M("");
    try {
      const content =
        input +
        (file
          ? "\n\nAttachment: " + file.name + "\n" + (await attachment(file))
          : "");
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, conversation: id, preferred: model }),
      });
      if (!response.ok || !response.body)
        throw Error("Message could not be sent.");
      I("");
      F(null);
      U(content);
      const reader = response.body
        .pipeThrough(new TextDecoderStream())
        .getReader();
      let buffer = "";
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        buffer += part.value;
        let end;
        while ((end = buffer.indexOf("\n\n")) >= 0) {
          const event = JSON.parse(buffer.slice(6, end));
          buffer = buffer.slice(end + 2);
          if (event.type === "conversation") ID(event.id);
          if (event.type === "chunk" && event.chunk.text)
            D((old) => old + event.chunk.text);
          if (event.type === "switch") {
            D("");
            const name = (key: string) =>
              data.connections.find((c) => c.id === key)?.name;
            M(
              event.quota
                ? "Limit reached. Continuing with next provider. Context preserved."
                : name(event.from) +
                    " unavailable. Continuing with " +
                    name(event.to) +
                    ". Context preserved.",
            );
          }
          if (event.type === "exhausted") {
            D("");
            M(
              "All providers unavailable." +
                (event.resetAt && data.settings.exhausted === "notify"
                  ? " Earliest retry " +
                    new Date(event.resetAt).toLocaleTimeString()
                  : ""),
            );
          }
          if (event.type === "error") M(event.message);
        }
      }
    } catch (e) {
      M(e instanceof Error ? e.message : "Stream interrupted.");
    } finally {
      await refresh();
      B(false);
      U("");
      D("");
    }
  }
  function exportChat() {
    const text =
      "# " +
      conv?.title +
      "\n\n" +
      messages
        .map(
          (m) =>
            "## " +
            m.role +
            (m.source ? " · " + m.source : "") +
            "\n\n" +
            m.content,
        )
        .join("\n\n");
    const url = URL.createObjectURL(
      new Blob([text], { type: "text/markdown" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "conversation.md";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className="chatgrid">
      <aside className="stack">
        <h3>Conversations</h3>
        <button
          disabled={busy}
          onClick={() => {
            ID("");
            M("");
          }}
        >
          New conversation
        </button>
        {data.conversations.map((c) => (
          <button
            disabled={busy}
            key={c.id}
            onClick={() => {
              ID(c.id);
              M("");
            }}
          >
            {c.title}
          </button>
        ))}
      </aside>
      <section className="box">
        <div className="row">
          <h3>{conv?.title ?? "New conversation"}</h3>
          {conv && <button onClick={exportChat}>Export Markdown</button>}
        </div>
        {messages.map((m) => (
          <article key={m.id} className="reply">
            <small>{m.role}</small>
            <Markdown>{m.content}</Markdown>
            {m.source && (
              <>
                <small>{m.source}</small>
                <button
                  onClick={() =>
                    act({ action: "pin", id: m.id, pinned: !m.pinned })
                  }
                >
                  {m.pinned ? "Unpin" : "Pin answer"}
                </button>
              </>
            )}
          </article>
        ))}
        {busy && (
          <>
            <p>{pending}</p>
            <Markdown>{draft}</Markdown>
          </>
        )}
        {banner && (
          <p role="status" className="toast">
            {banner}
          </p>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <label>
            Message
            <textarea
              required
              rows={4}
              value={input}
              onChange={(e) => I(e.target.value)}
              placeholder="Ask a research question…"
            />
          </label>
          <label>
            Provider and model
            <select value={model} onChange={(e) => P(e.target.value)}>
              <option value="">Use fallback order</option>
              {data.connections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.model}
                </option>
              ))}
            </select>
          </label>
          <label>
            Attach text or PDF
            <input
              key={file?.name ?? "empty"}
              type="file"
              accept=".txt,.md,.csv,.pdf"
              onChange={(e) => F(e.target.files?.[0] ?? null)}
            />
          </label>
          <button
            className="primary"
            disabled={busy || !data.connections.length}
          >
            {busy ? "Streaming…" : "Send message"}
          </button>
          {!data.connections.length && (
            <p>Connect a provider from the dashboard to start.</p>
          )}
        </form>
      </section>
      <aside>
        <h3>Research notes</h3>
        {!messages.some((m) => m.pinned) && (
          <p>Pin an answer to keep it here.</p>
        )}
        {messages
          .filter((m) => m.pinned)
          .map((m) => (
            <div className="reply" key={m.id}>
              <Markdown>{m.content}</Markdown>
            </div>
          ))}
      </aside>
    </div>
  );
}
