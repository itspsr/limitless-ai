export default {
  agentRules: false,
  ...(process.env.LIMITLESS_SCREENSHOTS === "1"
    ? { devIndicators: false, distDir: ".next-screenshots" }
    : {}),
  poweredByHeader: false,
  serverExternalPackages: [
    "@prisma/client",
    "@prisma/adapter-libsql",
    "@prisma/adapter-pg",
  ],
};
