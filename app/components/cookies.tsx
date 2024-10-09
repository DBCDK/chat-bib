import React, { useEffect, useState } from "react";

/**
 * This is the cookies page of the application
 */

const Cookies: React.FC = () => {
  const [cookiebotExecuted, setCookiebotExecuted] = useState<boolean>(false);

  // Alter DOM after load to avoid hydration errors.
  useEffect(() => {
    if (!cookiebotExecuted && process.env.NEXT_PUBLIC_COOKIEBOT_ID) {
      const script = document.createElement("script");
      script.src = `https://consent.cookiebot.com/${process.env.NEXT_PUBLIC_COOKIEBOT_ID}/cd.js`;
      script.async = true;
      script.id = "CookieDeclaration";
      const container = document.getElementById("CookieDeclarationContainer");
      if (container) {
        container.appendChild(script);
        setCookiebotExecuted(true);
      }
    }
  }, [cookiebotExecuted]);

  return (
    <>
      <div className="text-container">
        <h1 className="text-header1">Cookies</h1>
        <div id="CookieDeclarationContainer"></div>
      </div>
    </>
  );
};

export default Cookies;
