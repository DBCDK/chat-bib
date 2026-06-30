import { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Path } from "../constant";

// This page is what SkoleTube shows inside its iframe.
// Instead of running the chat in that small box, we just show one big button
// that opens SkoleGPT in a new tab. The name and prompt stay in the link,
// so the new tab can build the same assistant again.
export function SkoletubeLaunch() {
  const location = useLocation();
  const name = new URLSearchParams(location.search).get("name")?.trim();

  // The link the button opens: the normal new-chat page with the same assistant name and systemprompt.
  const assistantHref = `${Path.NewChat}${location.search}`;

  // Check if this page is inside an iframe (done once when it loads).
  // If this window is not the top window, we are in an iframe.
  const [isEmbedded] = useState(() => {
    try {
      return typeof window !== "undefined" ? window.self !== window.top : true;
    } catch {
      return true;
    }
  });

  // Page opened directly (not inside an iframe)? Then the "Open in SkoleGPT" button should not show
  // so just send the user to the assistant.
  if (!isEmbedded) {
    return <Navigate to={assistantHref} replace />;
  }

  // Fill the whole window so what's behind it (like the sidebar) doesn't show.
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: "20px 16px",
        textAlign: "center",
        background: "var(--white, #ffffff)",
        color: "var(--black, #1a1a1a)",
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 700 }}>
        {name ? `Assistent Navn: ${name}` : "SkoleGPT-assistent"}
      </div>
      <div style={{ maxWidth: 440, fontSize: 14, lineHeight: 1.4, opacity: 0.75 }}>
        Chatten åbnes på SkoleGPT i en ny fane.
      </div>
      <a
        href={assistantHref}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "inline-block",
          padding: "12px 24px",
          fontSize: 16,
          fontWeight: 700,
          color: "#ffffff",
          background: "#16a34a",
          borderRadius: 12,
          textDecoration: "none",
          boxShadow: "0 4px 14px rgba(0, 0, 0, 0.18)",
        }}
      >
        Åbn i SkoleGPT ↗
      </a>
    </div>
  );
}
