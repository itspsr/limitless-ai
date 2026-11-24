// Test transport loaded ONLY by the isolated dev process. No provider network calls.
const original = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = new URL(input.url ?? input);
  if (!url.hostname.endsWith(".demo.invalid")) return original(input, init);
  if (url.hostname === "aster.demo.invalid")
    return new Response(null, {
      status: 429,
      headers: { "Retry-After": "3600" },
    });
  const { messages } = JSON.parse(init.body);
  if (!messages.some((m) => m.content.includes("two coastal monitoring sites")))
    throw Error("Demo history was lost");
  const encoder = new TextEncoder();
  const reply =
    "Sample both sites at the same tide stage. Record temperature and salinity, then compare the paired readings.";
  return new Response(
    new ReadableStream({
      async start(controller) {
        for (const word of reply.split(" ")) {
          controller.enqueue(
            encoder.encode(
              "data: " +
                JSON.stringify({
                  choices: [{ delta: { content: word + " " } }],
                }) +
                "\n\n",
            ),
          );
          await new Promise((resolve) => setTimeout(resolve, 140));
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    }),
    { headers: { "Content-Type": "text/event-stream" } },
  );
};
