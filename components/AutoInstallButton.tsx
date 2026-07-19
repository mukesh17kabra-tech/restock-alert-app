"use client";

import { useState } from "react";

export function AutoInstallButton({ shop }: { shop: string }) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleClick() {
    setStatus("loading");
    try {
      const res = await fetch("/api/theme/install-widget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatus("success");
        setMessage(`Added to your theme (${data.file}). Visit a sold-out product to see it live.`);
      } else {
        setStatus("error");
        setMessage(data.error || "Something went wrong — try the manual method below.");
      }
    } catch {
      setStatus("error");
      setMessage("Network error — try the manual method below.");
    }
  }

  return (
    <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/[0.06] p-6">
      <p className="text-sm font-medium text-white mb-1">
        Don&apos;t want to touch any code?
      </p>
      <p className="text-sm text-white/60 mb-4 leading-relaxed">
        This adds the restock alert form to your product pages automatically — no copying,
        no theme editor. Safe to click even if you&apos;re not sure; it only adds new code,
        never removes anything.
      </p>
      <button
        onClick={handleClick}
        disabled={status === "loading" || status === "success"}
        className="rounded-md bg-emerald-400 px-4 py-2 text-sm font-medium text-black hover:bg-emerald-300 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {status === "loading"
          ? "Installing..."
          : status === "success"
          ? "Installed ✓"
          : "Automatically add to my store"}
      </button>
      {message && (
        <p
          className={`mt-3 text-sm ${
            status === "success" ? "text-emerald-400" : "text-red-400"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
