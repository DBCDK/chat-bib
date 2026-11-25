import { NextRequest, NextResponse } from "next/server";

// Kun JSON-filer fra skolegpt.dk's uploads-mappe må indlæses.
// Uden denne allowlist kan alle lave et link, der indsætter en fremmed systemprompt.
const ALLOWED_HOSTS = ["skolegpt.dk", "www.skolegpt.dk"];
const ALLOWED_PATH_PREFIX = "/wp-content/uploads/";
const MAX_BYTES = 100_000;
const ROLES = ["system", "user", "assistant"] as const;
type Role = (typeof ROLES)[number];

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

// Tilladte modelConfig-felter og deres grænser (alt andet i filen ignoreres)
const NUM_FIELDS: Record<string, [number, number]> = {
  temperature: [0, 2],
  top_p: [0, 1],
  max_tokens: [1, 32000],
  presence_penalty: [-2, 2],
  frequency_penalty: [-2, 2],
  historyMessageCount: [0, 64],
  compressMessageLengthThreshold: [0, 100000],
};
const BOOL_FIELDS = ["sendMemory", "enableInjectSystemPrompts"];

function sanitizeModelConfig(raw: any) {
  if (!raw || typeof raw !== "object") return undefined;
  const out: Record<string, unknown> = {};

  if (typeof raw.model === "string" && raw.model.length <= 100) {
    out.model = raw.model;
  }
  for (const [key, [min, max]] of Object.entries(NUM_FIELDS)) {
    const n = Number(raw[key]);
    if (raw[key] !== undefined && Number.isFinite(n) && n >= min && n <= max) {
      out[key] = n;
    }
  }
  for (const key of BOOL_FIELDS) {
    if (typeof raw[key] === "boolean") out[key] = raw[key];
  }
  if (typeof raw.template === "string" && raw.template.length <= 2000) {
    out.template = raw.template;
  }
  return Object.keys(out).length ? out : undefined;
}

function sanitize(raw: any) {
  if (!raw || typeof raw !== "object") return null;

  let context: { role: Role; content: string }[] = (
    Array.isArray(raw.context) ? raw.context : []
  )
    .filter(
      (m: any) =>
        m && ROLES.includes(m.role) && typeof m.content === "string",
    )
    .slice(0, 20)
    .map((m: any) => ({ role: m.role, content: m.content.slice(0, 20000) }));

  // Genvej: { "systemprompt": "..." } i stedet for et fuldt context-array
  if (context.length === 0 && typeof raw.systemprompt === "string") {
    context = [{ role: "system", content: raw.systemprompt.slice(0, 20000) }];
  }
  if (context.length === 0) return null;

  return {
    name: typeof raw.name === "string" ? raw.name.slice(0, 100) : "Assistent",
    avatar: typeof raw.avatar === "string" ? raw.avatar.slice(0, 40) : "gpt-bot",
    lang: typeof raw.lang === "string" ? raw.lang.slice(0, 10) : undefined,
    hideContext: raw.hideContext === true,
    syncGlobalConfig:
      typeof raw.syncGlobalConfig === "boolean" ? raw.syncGlobalConfig : undefined,
    context,
    modelConfig: sanitizeModelConfig(raw.modelConfig),
  };
}

export async function GET(req: NextRequest) {
  const src = req.nextUrl.searchParams.get("src");
  if (!src) return fail("Mangler src", 400);

  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return fail("Ugyldig URL", 400);
  }

  if (
    url.protocol !== "https:" ||
    !ALLOWED_HOSTS.includes(url.hostname) ||
    !url.pathname.startsWith(ALLOWED_PATH_PREFIX) ||
    !url.pathname.toLowerCase().endsWith(".json")
  ) {
    return fail("Kilden er ikke tilladt", 403);
  }

  let text: string;
  try {
    // redirect: "error" forhindrer omdirigering til et andet domæne
    const res = await fetch(url.toString(), {
      redirect: "error",
      next: { revalidate: 300 },
    });
    if (!res.ok) return fail("Filen kunne ikke hentes", 502);
    text = await res.text();
  } catch {
    return fail("Filen kunne ikke hentes", 502);
  }
  if (text.length > MAX_BYTES) return fail("Filen er for stor", 413);

  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    return fail("Ugyldig JSON", 422);
  }

  // Accepterer både ét objekt og NextChats mask-eksport (array)
  const mask = sanitize(Array.isArray(data) ? data[0] : data);
  if (!mask) return fail("JSON-filen mangler en prompt", 422);

  return NextResponse.json(mask, {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}