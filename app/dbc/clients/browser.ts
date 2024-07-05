import puppeteer from "puppeteer";
// Or import puppeteer from 'puppeteer-core';
export type SearchResult = {
  content?: string;
  href?: string;
};
// TODO
// https://www.googleapis.com/customsearch/v1?key=AIzaSyAvucUXnOKAFoBVKzTG9umHLCflstQz1VM&cx=5749598af9fb34f25&q=site:bibliotek.dk%20Sjove%20b%C3%B8ger%20til%20voksne
export async function duckDuckGoSearch(
  query: any,
): Promise<SearchResult[] | string> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--proxy-server=http://dmzproxy.dbc.dk:3128", "--disable-ipv6"],
  });
  const page = await browser.newPage();

  page.setDefaultNavigationTimeout(15000);
  // Custom user agent
  const customUA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36";
  // Set custom user agent
  await page.setUserAgent(customUA);

  // Replace 'your search query' with your desired search query
  await page.goto("https://duckduckgo.com/");

  // Type the query into the search bar
  await page.type("input:nth-child(1)", query);

  page.keyboard.press("Enter");

  try {
    // Wait for the results to load
    await page.waitForSelector("li article", { timeout: 10000 });
  } catch (e) {
    return "TIMEOUT";
  }

  //   console.log(await page.content());

  // const htmlContent = await page.content();
  // console.log(htmlContent);
  // console.log("aval");
  // Extract the titles and URLs of the search results
  const results = (
    await page.evaluate(() => {
      const items = document.querySelectorAll("li article");
      return Array.from(items).map((item) => {
        const a = Array.from(document.querySelectorAll("a")).find(
          (a) => !a.href.includes("duckduck") && a.href.includes("http"),
        );

        const snippetDiv = item.querySelector('div[data-result="snippet"]') as {
          innerText: string;
        } | null;
        return {
          content: snippetDiv?.innerText,
          href: a?.href,
        };
      });
    })
  )?.filter((entry) => entry?.content && entry?.href);

  await browser.close();

  return results || [];
}
