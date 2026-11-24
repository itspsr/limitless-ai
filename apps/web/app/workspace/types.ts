import type { state } from "../../lib/state";
export type Snapshot = Awaited<ReturnType<typeof state>>;
export type Action = (body: Record<string, unknown>) => Promise<boolean>;
