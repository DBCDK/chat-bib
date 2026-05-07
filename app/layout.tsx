/* eslint-disable @next/next/no-page-custom-font */
import "./styles/markdown.scss";
import "./styles/highlight.scss";
import { getClientConfig } from "./config/client";
import { type Metadata } from "next";
import { getServerSideConfig } from "./config/server";
import { env } from "./utils/appsettings";
import Script from "next/script";
const serverConfig = getServerSideConfig();
const runtimeAppSettings = Buffer.from(
  JSON.stringify({
    APP: process.env.APP ?? "chatbib",
    LLMTOKEN: process.env.LLMTOKEN ?? "",
  }),
).toString("base64");

export const metadata: Metadata = {
  title: env.APP_TITLE ?? "ChatBib",
  description: "Bibliotekets AI-chat",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
  },
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#151515" },
  ],
  appleWebApp: {
    title: env.APP_TITLE ?? "ChatBib",
    statusBarStyle: "default",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const styleName = env.STYLE ?? "chatbib";
  const stylesheetHref = `/styles/globals-${styleName}.css`;

  return (
    <html lang="da">
      <head>
        <link rel="stylesheet" href={stylesheetHref} />
        <script
          dangerouslySetInnerHTML={{
            __html: `appsettings = "${runtimeAppSettings}"; window.appsettings = appsettings;`,
          }}
        />
        {env.INJECT_ANALYTICS ? (
          ""
        ) : (
          <script
            dangerouslySetInnerHTML={{
              __html: `   var _paq = window._paq = window._paq || [];
        //  _paq.push(['trackPageView']);
            _paq.push(["requireCookieConsent"]);     // <--- Add this line to the script
          _paq.push(['enableLinkTracking']);
          (function() {
            var u="https://stats.dbc.dk/";
            _paq.push(['setTrackerUrl', u+'matomo.php']);
            _paq.push(['setSiteId', '42']);
            var d=document, g=d.createElement('script'), s=d.getElementsByTagName('script')[0];
            g.async=true; g.src=u+'matomo.js'; s.parentNode.insertBefore(g,s);
            })();`,
            }}
          />
        )}

        {env.INJECT_ANALYTICS ? (
          ""
        ) : (
          <Script
            id="Cookiebot"
            src="https://consent.cookiebot.eu/uc.js"
            data-cbid={process.env.NEXT_PUBLIC_COOKIEBOT_ID}
            data-blockingmode="auto"
            type="text/javascript"
          ></Script>
        )}
        <meta name="config" content={JSON.stringify(getClientConfig())} />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
        />
        <link rel="icon" href={`/${styleName}/favicon.ico`}></link>
        <link rel="manifest" href={`/${styleName}/site.webmanifest`}></link>
        <script src="/serviceWorkerRegister.js" defer></script>

        {env.INJECT_ANALYTICS ? (
          ""
        ) : (
          <script
            dangerouslySetInnerHTML={{
              __html: `
// Cookiebot consent and Matomo connector
  var waitForTrackerCount = 0;
  function matomoWaitForTracker() {
    if (typeof _paq === "undefined" || typeof Cookiebot === "undefined") {
      if (waitForTrackerCount < 40) {
        setTimeout(matomoWaitForTracker, 250);
        waitForTrackerCount++;
        return;
      }
    } else {
      window.addEventListener("CookiebotOnAccept", function (e) {
        consentSet();
      });
      window.addEventListener("CookiebotOnDecline", function (e) {
        consentSet();
      });
    }
  }
  function consentSet() {
    if (Cookiebot.consent.statistics) {
      _paq.push(["setCookieConsentGiven"]);
    } else {
      _paq.push(["forgetCookieConsentGiven"]);
    }
  }
  document.addEventListener("DOMContentLoaded", matomoWaitForTracker());`,
            }}
          ></script>
        )}
      </head>
      <body>
        {children}
        {env.INJECT_ANALYTICS && (
          <div
            dangerouslySetInnerHTML={{
              __html: env.INJECT_ANALYTICS,
            }}
          ></div>
        )}
      </body>
    </html>
  );
}
