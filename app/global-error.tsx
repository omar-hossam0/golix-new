"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/api/errors";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    reportClientError(error, {
      source: "next_global_error_boundary",
      digest: error.digest,
    });
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          minHeight: "100vh",
          margin: 0,
          display: "grid",
          placeItems: "center",
          padding: 24,
          color: "#edf7ff",
          background: "#06111f",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <main style={{ maxWidth: 520, textAlign: "center" }}>
          <h1>Goalix could not load</h1>
          <p style={{ color: "#a8b7c8", lineHeight: 1.6 }}>
            A critical interface error occurred. Please try loading the
            application again.
          </p>
          {error.digest && (
            <p style={{ color: "#7f91a5", fontSize: 12 }}>
              Support reference: {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={() => unstable_retry()}
            style={{
              marginTop: 16,
              padding: "12px 20px",
              border: 0,
              borderRadius: 10,
              cursor: "pointer",
              color: "#06111f",
              background: "#b6ff00",
              fontWeight: 700,
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
