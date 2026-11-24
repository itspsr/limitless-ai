import Link from "next/link";
import { owner } from "../../auth";
import Workspace from "./workspace";
import Login from "./login";
export const dynamic = "force-dynamic";
export default async function Page() {
  return (
    <main className="site workspace">
      <header>
        <Link className="brand" href="/">
          <b>∞</b> LimitLess AI
        </Link>
      </header>
      {(await owner()) ? (
        <Workspace single={process.env.SINGLE_USER === "true"} />
      ) : (
        <Login />
      )}
    </main>
  );
}
