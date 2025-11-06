import fs from "node:fs";
import path from "node:path";
import Link from "next/link";

type Asset = {
  name: string;
  href: string;
  size: number;
};

function listPublicRegistry(): Asset[] {
  const dir = path.join(process.cwd(), "public", "r");
  try {
    const files = fs.readdirSync(dir);
    return files
      .filter((f) => !f.startsWith("."))
      .map((f) => {
        const stat = fs.statSync(path.join(dir, f));
        return { name: f, href: `/r/${f}`, size: stat.size } as Asset;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

const TITLE = "Formlink Registry — Public Artifacts";

export default function RegistryPublicIndex() {
  const assets = listPublicRegistry();
  const json = assets.filter((a) => a.name.endsWith(".json"));
  const txt = assets.filter((a) => a.name.endsWith(".txt"));

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-xl font-semibold">{TITLE}</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Static files under{" "}
        <code className="px-1 rounded bg-zinc-100">/public/r</code>
        are served at <code className="px-1 rounded bg-zinc-100">/r/*</code>.
      </p>

      <section className="mt-6">
        <h2 className="text-sm font-medium text-zinc-800">JSON</h2>
        <ul className="mt-2 list-disc pl-5 text-sm">
          {json.length === 0 && (
            <li className="list-none text-zinc-500">No JSON assets</li>
          )}
          {json.map((a) => (
            <li key={a.name}>
              <Link href={a.href} className="text-blue-600 hover:underline">
                {a.href}
              </Link>
              <span className="ml-2 text-zinc-400">
                ({a.size.toLocaleString()} bytes)
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-medium text-zinc-800">
          TXT (source snapshots)
        </h2>
        <ul className="mt-2 list-disc pl-5 text-sm">
          {txt.length === 0 && (
            <li className="list-none text-zinc-500">No TXT assets</li>
          )}
          {txt.map((a) => (
            <li key={a.name}>
              <Link href={a.href} className="text-blue-600 hover:underline">
                {a.href}
              </Link>
              <span className="ml-2 text-zinc-400">
                ({a.size.toLocaleString()} bytes)
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
