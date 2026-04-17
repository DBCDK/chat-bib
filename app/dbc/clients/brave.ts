import { getServerSideConfig } from "@/app/config/server";
import { fetch, ProxyAgent } from "undici";
import { log } from "dbc-node-logger";

export type SearchResult = {
  content?: string;
  href?: string;
};

const serverConfig = getServerSideConfig();

const dispatcher =
  process.env.NODE_ENV === "development"
    ? undefined
    : new ProxyAgent("http://dmzproxy.dbc.dk:3128");
export async function search(q: string): Promise<SearchResult[]> {
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}`;

  let res;
  let text: string = "";
  try {
    res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": serverConfig.braveKey || "",
        "cache-control": "no-cache",
      },
      dispatcher,
    });
    text = await res.text();
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
  } catch (e: any) {
    log.error(
      "ERROR from brave search api: " +
        JSON.stringify({
          url,
          text,
          stacktrace: e.stack,
        }),
    );
    return [];
  }
}
