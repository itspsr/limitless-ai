"use client";
import { useEffect, useRef, useState } from "react";
import type { Action, Snapshot } from "./types";
export default function Connect({
  data,
  close,
  act,
  edit,
}: {
  data: Snapshot;
  close: () => void;
  act: Action;
  edit?: Snapshot["connections"][number];
}) {
  const ref = useRef<HTMLDialogElement>(null),
    [provider, P] = useState(edit?.provider ?? data.registry[0].id),
    [busy, B] = useState(false);
  const entry = data.registry.find((p) => p.id === provider);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog ref={ref} onCancel={close} aria-labelledby="connect-title">
      <h2 id="connect-title">
        {edit ? "Edit " + edit.name : "Connect a provider"}
      </h2>
      <form
        key={provider}
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget),
            values = Object.fromEntries(f);
          B(true);
          try {
            if (
              await act(
                edit
                  ? {
                      action: "edit",
                      id: edit.id,
                      model: values.model,
                      limits: Object.fromEntries(
                        ["rpm", "rpd", "tokensDay", "context"].map((k) => [
                          k,
                          values[k] ? Number(values[k]) : null,
                        ]),
                      ),
                    }
                  : { action: "connect", provider, ...values },
              )
            )
              close();
          } finally {
            B(false);
          }
        }}
      >
        {!edit && (
          <>
            <label>
              Provider
              <select value={provider} onChange={(e) => P(e.target.value)}>
                {data.registry.map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.name}
                  </option>
                ))}
                <option value="custom">Custom OpenAI-compatible</option>
              </select>
            </label>
            {entry?.auth_type.includes("oauth") && (
              <a className="button" href={"/api/connect/" + provider}>
                Connect with login
              </a>
            )}
            {!entry && (
              <>
                <label>
                  Name
                  <input required name="name" />
                </label>
                <label>
                  HTTPS API base URL
                  <input required name="base" type="url" />
                </label>
              </>
            )}
            {provider === "cloudflare" && (
              <label>
                Cloudflare account ID
                <input name="account" required pattern="[a-fA-F0-9]{32}" />
              </label>
            )}
            <label>
              Paste API key
              <input required type="password" autoComplete="off" name="key" />
            </label>
            {entry && (
              <a href={entry.signup} target="_blank" rel="noreferrer">
                Get an API key ↗
              </a>
            )}
          </>
        )}
        <label>
          Model
          <input
            name="model"
            required
            defaultValue={edit?.model ?? entry?.models[0]}
          />
        </label>
        {edit &&
          ["rpm", "rpd", "tokensDay", "context"].map((k, i) => (
            <label key={k}>
              {
                [
                  "Requests per minute",
                  "Requests per day",
                  "Tokens per day",
                  "Context window",
                ][i]
              }
              <input
                type="number"
                min="1"
                name={k}
                defaultValue={edit.limits[k] ?? ""}
                placeholder="Unknown"
              />
            </label>
          ))}
        <p>Last verified · {entry?.last_verified ?? "Unverified"}</p>
        <div className="row">
          <button className="primary" disabled={busy}>
            {edit ? "Save changes" : "Save connection"}
          </button>
          {!edit && (
            <button
              type="button"
              onClick={async (e) => {
                const form = e.currentTarget.form!;
                if (!form.reportValidity()) return;
                B(true);
                try {
                  await act({
                    action: "probe",
                    provider,
                    ...Object.fromEntries(new FormData(form)),
                  });
                } finally {
                  B(false);
                }
              }}
              disabled={busy}
            >
              Test connection
            </button>
          )}
          {edit && (
            <button
              type="button"
              onClick={() => act({ action: "test", id: edit.id })}
            >
              Test connection
            </button>
          )}
          <button type="button" onClick={close}>
            Cancel
          </button>
        </div>
      </form>
    </dialog>
  );
}
