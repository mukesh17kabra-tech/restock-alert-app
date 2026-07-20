"use client";

import { useState } from "react";

export function ConnectWhatsAppButton({ shop }: { shop: string }) {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleConnect() {
    setStatus("loading");
    try {
      const res = await fetch("/api/whatsapp/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.onboardingUrl) {
        // Send the merchant to Twilio's hosted onboarding page. They just
        // confirm their WhatsApp number there — no account creation needed
        // on their end, on Twilio or Meta.
        window.location.href = data.onboardingUrl;
      } else {
        setStatus("error");
        setMessage(data.error || "Couldn't start WhatsApp setup.");
      }
    } catch {
      setStatus("error");
      setMessage("Network error — please try again.");
    }
  }

  return (
    <div>
      <button
        onClick={handleConnect}
        disabled={status === "loading"}
        className="rounded-md bg-emerald-400 px-4 py-2 text-sm font-medium text-black hover:bg-emerald-300 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {status === "loading" ? "Starting..." : "Connect WhatsApp"}
      </button>
      {message && <p className="mt-3 text-sm text-red-400">{message}</p>}
    </div>
  );
}
