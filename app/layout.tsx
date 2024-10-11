/* eslint-disable @next/next/no-page-custom-font */
import "./styles/globals.scss";
import "./styles/markdown.scss";
import "./styles/highlight.scss";
import { getClientConfig } from "./config/client";
import { type Metadata } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { getServerSideConfig } from "./config/server";
import { GoogleTagManager } from "@next/third-parties/google";
import Script from "next/script";
const serverConfig = getServerSideConfig();

export const metadata: Metadata = {
  title: "ChatBib",
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
    title: "NextChat",
    statusBarStyle: "default",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="da">
      <head>
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
        <Script
          id="Cookiebot"
          src="https://consent.cookiebot.eu/uc.js"
          data-cbid={process.env.NEXT_PUBLIC_COOKIEBOT_ID}
          data-blockingmode="auto"
          type="text/javascript"
        ></Script>
        <meta name="config" content={JSON.stringify(getClientConfig())} />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
        />
        <link rel="manifest" href="/site.webmanifest"></link>
        <script src="/serviceWorkerRegister.js" defer></script>

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
      </head>
      <body>
        {children}
        {serverConfig?.isVercel && (
          <>
            <SpeedInsights />
          </>
        )}
        {serverConfig?.gtmId && (
          <>
            <GoogleTagManager gtmId={serverConfig.gtmId} />
          </>
        )}
      </body>
    </html>
  );
}
