import { cookies } from "next/headers";
import { randomBytes, createHash } from "node:crypto";
import { owner } from "../../../../auth";
import { seal, unseal } from "../../../../lib/crypto";
import { registry } from "../../../../lib/state";
import { db } from "../../../../lib/db";
export async function GET(
  req: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const uid = await owner();
  if (!uid) return new Response(null, { status: 401 });
  const { provider } = await params,
    google = provider === "gemini";
  if (!google && provider !== "openrouter")
    return new Response(null, { status: 404 });
  if (
    google &&
    !(
      process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_PROJECT_ID
    )
  )
    return new Response(
      "Configure Google OAuth credentials and project on this host.",
      { status: 400 },
    );
  const url = new URL(req.url),
    jar = await cookies(),
    name = "ll-connect-" + provider;
  const origin = process.env.AUTH_URL
    ? new URL(process.env.AUTH_URL).origin
    : url.origin;
  const callback = origin + url.pathname;
  try {
    if (!url.searchParams.has("code")) {
      const verifier = randomBytes(32).toString("base64url"),
        state = randomBytes(24).toString("hex");
      jar.set(name, seal(JSON.stringify({ verifier, state }), uid), {
        httpOnly: true,
        sameSite: "lax",
        secure: url.protocol === "https:",
        path: url.pathname,
        maxAge: 600,
      });
      const target = new URL(
        google
          ? "https://accounts.google.com/o/oauth2/v2/auth"
          : "https://openrouter.ai/auth",
      );
      const params: Record<string, string> = google
        ? {
            client_id: process.env.GOOGLE_CLIENT_ID!,
            redirect_uri: callback,
            response_type: "code",
            scope: "https://www.googleapis.com/auth/cloud-platform",
            access_type: "offline",
            prompt: "consent",
            state,
          }
        : { callback_url: callback + "?state=" + state };
      for (const [k, v] of Object.entries({
        ...params,
        code_challenge: createHash("sha256")
          .update(verifier)
          .digest("base64url"),
        code_challenge_method: "S256",
      }))
        target.searchParams.set(k, v);
      return Response.redirect(target);
    }
    const session = JSON.parse(unseal(jar.get(name)?.value ?? "", uid));
    jar.set(name, "", { path: url.pathname, maxAge: 0 });
    if (session.state !== url.searchParams.get("state")) throw Error();
    const code = url.searchParams.get("code")!;
    const exchange = await fetch(
      google
        ? "https://oauth2.googleapis.com/token"
        : "https://openrouter.ai/api/v1/auth/keys",
      {
        method: "POST",
        headers: {
          "Content-Type": google
            ? "application/x-www-form-urlencoded"
            : "application/json",
        },
        body: google
          ? new URLSearchParams({
              code,
              code_verifier: session.verifier,
              client_id: process.env.GOOGLE_CLIENT_ID!,
              client_secret: process.env.GOOGLE_CLIENT_SECRET!,
              grant_type: "authorization_code",
              redirect_uri: callback,
            })
          : JSON.stringify({
              code,
              code_verifier: session.verifier,
              code_challenge_method: "S256",
            }),
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!exchange.ok) throw Error();
    const data = await exchange.json(),
      credential = google ? data.refresh_token : data.key;
    if (!credential) throw Error();
    const entry = registry.find((p) => p.id === provider)!;
    const ciphertext = seal(
      google ? "google-refresh:" + credential : credential,
      uid,
    );
    await db().connection.upsert({
      where: { owner_provider: { owner: uid, provider } },
      create: {
        owner: uid,
        provider,
        name: entry.name,
        base: entry.base,
        limits: JSON.stringify(entry.limits),
        model: entry.models[0],
        ciphertext,
        priority: await db().connection.count({ where: { owner: uid } }),
      },
      update: { ciphertext },
    });
    return Response.redirect(origin + "/workspace");
  } catch {
    return new Response("Provider login could not be completed.", {
      status: 400,
    });
  }
}
