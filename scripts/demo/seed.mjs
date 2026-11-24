// Only accepts a fresh database allocated by the screenshot runner.
import { createRequire } from "node:module";
import { seal } from "../../apps/web/lib/crypto.ts";
const web = createRequire(
  new URL("../../apps/web/package.json", import.meta.url),
);
export async function seed(url) {
  const { PrismaClient } = web("@prisma/client");
  const { PrismaLibSQL } = web("@prisma/adapter-libsql");
  const db = new PrismaClient({ adapter: new PrismaLibSQL({ url }) });
  try {
    if (await db.user.count())
      throw Error("Expected an empty capture database.");
    const user = await db.user.create({
      data: { email: "local@localhost.invalid", password: "disabled" },
    });
    const names = ["Aster", "Cirrus", "Vela"];
    for (const [i, name] of names.entries()) {
      const id = name.toLowerCase();
      const c = await db.connection.create({
        data: {
          owner: user.id,
          name,
          provider: id,
          priority: i,
          base: "https://" + id + ".demo.invalid/v1",
          model: ["aster-research", "cirrus-chat", "vela-mini"][i],
          ciphertext: seal("", user.id),
          limits: JSON.stringify({ rpd: [50, 100, 80][i] }),
        },
      });
      const requests = [49, 32, 12][i];
      const day = new Date();
      day.setUTCHours(0, 0, 0, 0);
      await db.usage.create({
        data: {
          connectionId: c.id,
          minute: day,
          requests,
          tokens: requests * 128,
        },
      });
    }
    const topic = "Coastal field study";
    await db.conversation.create({
      data: {
        title: topic,
        owner: user.id,
        messages: {
          create: [
            {
              role: "user",
              content: "We are comparing two coastal monitoring sites.",
            },
            {
              role: "assistant",
              source: "Aster / aster-research",
              content:
                "Track the same indicators at both sites: water temperature, salinity, and tide level.",
            },
          ],
        },
      },
    });
  } finally {
    await db.$disconnect();
  }
}
