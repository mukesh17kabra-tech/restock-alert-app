"use client";

import { useState } from "react";

export function ConnectWhatsAppButton({ shop }: { shop: string }) {
  const [step, setStep] = useState<"number" | "otp">("number");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [message, setMessage] = useState("");

  async function submitNumber(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch("/api/whatsapp/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop, whatsappNumber }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStep("otp");
        setStatus("idle");
        setMessage("Check your phone for a verification code (SMS).");
      } else {
        setStatus("error");
        setMessage(data.error || "Couldn't start WhatsApp setup.");
      }
    } catch {
      setStatus("error");
      setMessage("Network error — please try again.");
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch("/api/whatsapp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop, code }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatus("success");
        setMessage("Verified! Your number is now connecting — this can take a few minutes.");
      } else {
        setStatus("error");
        setMessage(data.error || "That code didn't work — check it and try again.");
      }
    } catch {
      setStatus("error");
      setMessage("Network error — please try again.");
    }
  }

  if (step === "number") {
    return (
      <form onSubmit={submitNumber} className="space-y-3">
        <input
          type="tel"
          required
          placeholder="+91XXXXXXXXXX"
          value={whatsappNumber}
          onChange={(e) => setWhatsappNumber(e.target.value)}
          className="w-full max-w-xs rounded-md border border-white/15 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/30"
        />
        <div>
          <button
            type="submit"
            disabled={status === "loading"}
            className="rounded-md bg-emerald-400 px-4 py-2 text-sm font-medium text-black hover:bg-emerald-300 transition-colors disabled:opacity-60"
          >
            {status === "loading" ? "Sending code..." : "Send verification code"}
          </button>
        </div>
        {message && (
          <p className={`text-sm ${status === "error" ? "text-red-400" : "text-white/50"}`}>{message}</p>
        )}
      </form>
    );
  }

  return (
    <form onSubmit={submitCode} className="space-y-3">
      <input
        type="text"
        required
        placeholder="Enter 6-digit code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        className="w-full max-w-xs rounded-md border border-white/15 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/30"
      />
      <div>
        <button
          type="submit"
          disabled={status === "loading" || status === "success"}
          className="rounded-md bg-emerald-400 px-4 py-2 text-sm font-medium text-black hover:bg-emerald-300 transition-colors disabled:opacity-60"
        >
          {status === "loading" ? "Verifying..." : status === "success" ? "Verified ✓" : "Verify code"}
        </button>
      </div>
      {message && (
        <p className={`text-sm ${status === "error" ? "text-red-400" : "text-emerald-400"}`}>{message}</p>
      )}
    </form>
  );
}
