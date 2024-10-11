import Script from "next/script";
import styles from "./cookies.module.scss";
export default function Cookies() {
  if (!process.env.NEXT_PUBLIC_COOKIEBOT_ID) {
    return null;
  }
  return (
    <div className={styles.textContainer}>
      <h1>Cookies </h1>
      <div id="CookieDeclaration">
        <Script
          id="CookieDeclarationScript"
          src={`https://consent.cookiebot.com/${process.env.NEXT_PUBLIC_COOKIEBOT_ID}/cd.js`}
          type="text/javascript"
          strategy="afterInteractive"
        />
      </div>
    </div>
  );
}
