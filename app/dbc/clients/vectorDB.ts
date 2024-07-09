import { SearchResult } from "./browser";
import { getServerSideConfig } from "@/app/config/server";
import { fetch, ProxyAgent } from "undici";
import { log } from "dbc-node-logger";

const serverConfig = getServerSideConfig();
interface FormatedWork {
  title: string;
  cover: string;
  abstract: string;
  workId: string;
}
//const dispatcher = new ProxyAgent("http://dmzproxy.dbc.dk:3128");
export async function searchWorks(q: string): Promise<FormatedWork[]> {
  const url = `http://blurb-quest-1-0.mi-prod.svc.cloud.dbc.dk/?q=${encodeURIComponent(q)}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "cache-control": "no-cache",
    },
  });
  const json: any = await res.json();
  console.log("\n\n\n\n\n\n url", url);

  console.log("\n\n\n\n\n\njson", json);
  try {
    // const json = JSON.parse(text);

    //   console.log(JSON.stringify(json, null, 2));
    return json.response || [];
  } catch (e) {
    log.error(
      "ERROR from vector database client: " +
        JSON.stringify({
          url,
          json,
        }),
    );
    return [];
  }
}
