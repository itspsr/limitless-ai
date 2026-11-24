import "./styles.css";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-700.css";
import type { ReactNode } from "react";
export const metadata = {
  title: "LimitLess AI",
  description: "A self-hosted workspace for your AI providers.",
};
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
