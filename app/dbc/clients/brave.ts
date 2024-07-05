import { SearchResult } from "./browser";
import { getServerSideConfig } from "@/app/config/server";
import { fetch, ProxyAgent } from "undici";
import { log } from "dbc-node-logger";

const serverConfig = getServerSideConfig();

const dispatcher = new ProxyAgent("http://dmzproxy.dbc.dk:3128");
export async function search(q: string): Promise<SearchResult[]> {
  const res = await fetch(
    `https://api.search.brave.com/res/v1/web/search?q=${q}`,
    {
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": serverConfig.braveKey || "",
        "cache-control": "no-cache",
      },
      dispatcher,
    },
  );
  try {
    const json: any = await res.json();
    //   console.log(JSON.stringify(json, null, 2));

    return (
      json?.web?.results?.map((r: any) => {
        return { href: r.url, content: r.description };
      }) || []
    );
  } catch (e) {
    log.error(
      "ERROR from brave search api: " +
        JSON.stringify({
          text: await res.text(),
        }),
    );
    return [];
  }
}
