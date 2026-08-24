"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body style={{ margin: 0, background: "#0a0a0a", color: "#ffffff", fontFamily: "ui-monospace, monospace" }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 16px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              border: "1px solid #ff3366",
              color: "#ff3366",
              padding: "6px 12px",
              letterSpacing: "0.18em",
              fontSize: 10,
              textTransform: "uppercase",
            }}
          >
            something broke
          </div>
          <h1
            style={{
              marginTop: 24,
              fontSize: "clamp(2rem, 8vw, 4.5rem)",
              lineHeight: 1.05,
              fontWeight: 800,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              maxWidth: 720,
            }}
          >
            THE CRYPT CRACKED
          </h1>
          <p style={{ marginTop: 24, maxWidth: 520, opacity: 0.7, fontSize: 18, lineHeight: 1.35 }}>
            Something went sideways while we were rolling that ink. Try
            again — the chain is fine.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 40,
              border: "1px solid #00e5ff",
              color: "#00e5ff",
              background: "transparent",
              padding: "16px 24px",
              fontSize: 12,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            try again
          </button>
        </div>
      </body>
    </html>
  );
}
