import { SearchResult } from "./browser";
import { getServerSideConfig } from "@/app/config/server";
import { fetch, ProxyAgent } from "undici";
import { log } from "dbc-node-logger";

const serverConfig = getServerSideConfig();

const dispatcher =
  process.env.NODE_ENV === "development"
    ? undefined
    : new ProxyAgent("http://dmzproxy.dbc.dk:3128");
export async function search(q: string): Promise<SearchResult[]> {
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": serverConfig.braveKey || "",
      "cache-control": "no-cache",
    },
    dispatcher,
  });
  const text: any = await res.text();
  try {
    const json = JSON.parse(text);

    // console.log(JSON.stringify(json, null, 2));

    return (
      json?.web?.results?.map((r: any) => {
        return {
          href: r.url,
          content: r.description + r.extra_snippets?.join("\n"),
        };
      }) || []
    );
  } catch (e) {
    log.error(
      "ERROR from brave search api: " +
        JSON.stringify({
          url,
          text,
        }),
    );
    return [];
  }
}
