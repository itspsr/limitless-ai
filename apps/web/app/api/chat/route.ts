import { sameOrigin } from "../../../lib/origin";
import { owner } from "../../../auth";
import { db } from "../../../lib/db";
import { connectedAdapter } from "../../../lib/adapter";
import { minute, today } from "../../../lib/state";
import { route, type History } from "../../../../../packages/core/src/index";
export async function POST(req: Request) {
  if (!sameOrigin(req)) return new Response(null, { status: 403 });
  const uid = await owner();
  if (!uid) return new Response(null, { status: 401 });
  const b = await req.json(),
    content = b.content;
  if (typeof content !== "string" || !content.trim() || content.length > 300000)
    return new Response("Invalid message", { status: 400 });
  const conv = b.conversation
    ? await db().conversation.findFirst({
        where: { id: String(b.conversation), owner: uid },
      })
    : await db().conversation.create({
        data: { owner: uid, title: content.slice(0, 70) },
      });
  if (!conv) return new Response(null, { status: 404 });
  await db().message.create({
    data: { conversationId: conv.id, role: "user", content },
  });
  const messages = await db().message.findMany({
    where: { conversationId: conv.id },
    orderBy: [{ created: "asc" }, { id: "asc" }],
    select: { role: true, content: true },
  });
  const user = await db().user.findUniqueOrThrow({ where: { id: uid } });
  const rows = await db().connection.findMany({
    where: { owner: uid },
    orderBy: [{ priority: "asc" }, { id: "asc" }],
    include: { usage: { where: { minute: { gte: today() } } } },
  });
  if (b.preferred)
    rows.sort(
      (a, c) => Number(c.id === b.preferred) - Number(a.id === b.preferred),
    );
  const candidates = rows.map((c) => {
    const limits = JSON.parse(c.limits),
      headers = JSON.parse(c.headers);
    let availableAt = Number(c.cooldown ?? 0);
    if (headers.remainingRequests === 0 && headers.resetAt > Date.now())
      availableAt = Math.max(availableAt, headers.resetAt);
    if (
      limits.rpm &&
      c.usage.some((u) => +u.minute === +minute() && u.requests >= limits.rpm)
    )
      availableAt = Math.max(availableAt, +minute() + 60000);
    if (
      (limits.rpd &&
        c.usage.reduce((n, u) => n + u.requests, 0) >= limits.rpd) ||
      (limits.tokensDay &&
        c.usage.reduce((n, u) => n + u.tokens, 0) >= limits.tokensDay)
    )
      availableAt = Math.max(availableAt, +today() + 86400000);
    const adapter = connectedAdapter(c, uid);
    const upstream = adapter.stream.bind(adapter);
    adapter.stream = async function* (history, signal) {
      const bucket = minute(),
        where = { connectionId_minute: { connectionId: c.id, minute: bucket } };
      await db().usage.upsert({
        where,
        create: { connectionId: c.id, minute: bucket, requests: 1 },
        update: { requests: { increment: 1 } },
      });
      for await (const chunk of upstream(history, signal)) {
        if (chunk.limits)
          await db().connection.update({
            where: { id: c.id },
            data: { headers: JSON.stringify(chunk.limits) },
          });
        if (chunk.totalTokens)
          await db().usage.update({
            where,
            data: { tokens: { increment: chunk.totalTokens } },
          });
        yield chunk;
      }
    };
    return { id: c.id, model: c.model, adapter, availableAt };
  });
  const encoder = new TextEncoder(),
    abort = new AbortController();
  return new Response(
    new ReadableStream({
      async start(controller) {
        const send = (value: unknown) =>
          controller.enqueue(
            encoder.encode("data: " + JSON.stringify(value) + "\n\n"),
          );
        let answer = "";
        try {
          send({ type: "conversation", id: conv.id });
          for await (const event of route(candidates, messages as History, {
            signal: AbortSignal.any([abort.signal, req.signal]),
            timeoutMs: 90000,
            autoSwitch: JSON.parse(user.settings).autoSwitch !== false,
            async cooldown(id, until) {
              await db().connection.update({
                where: { id },
                data: { cooldown: new Date(until) },
              });
            },
          })) {
            if (event.type === "switch") {
              answer = "";
              await db().activity.create({
                data: {
                  owner: uid,
                  kind: "switch",
                  detail:
                    rows.find((c) => c.id === event.from)?.name +
                    " → " +
                    rows.find((c) => c.id === event.to)?.name,
                },
              });
            }
            if (event.type === "chunk") answer += event.chunk.text ?? "";
            if (event.type === "done") {
              const source =
                rows.find((c) => c.id === event.provider)?.name +
                " / " +
                event.model;
              await db().$transaction([
                db().message.create({
                  data: {
                    conversationId: conv.id,
                    role: "assistant",
                    content: answer,
                    source,
                  },
                }),
                db().conversation.update({
                  where: { id: conv.id },
                  data: { updated: new Date() },
                }),
              ]);
            }
            send(event);
          }
        } catch {
          if (!abort.signal.aborted)
            send({
              type: "error",
              message: "Reply interrupted. Your conversation is saved.",
            });
        } finally {
          if (!abort.signal.aborted) controller.close();
        }
      },
      cancel() {
        abort.abort();
      },
    }),
    {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-store, no-transform",
        "X-Accel-Buffering": "no",
      },
    },
  );
}
