"use client";

import { useState } from "react";

const OPTIONS = [
  { value: "email", label: "Email only" },
  { value: "whatsapp", label: "WhatsApp only" },
  { value: "both", label: "Email + WhatsApp" },
] as const;

export function ChannelToggle({
  shop,
  current,
  whatsappConnected,
}: {
  shop: string;
  current: string;
  whatsappConnected: boolean;
}) {
  const [value, setValue] = useState(current);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleChange(next: string) {
    setValue(next);
    setSaving(true);
    setSaved(false);
    try {
      await fetch("/api/shop/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop, notifyChannels: next }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      {OPTIONS.map((opt) => {
        const disabled = opt.value !== "email" && !whatsappConnected;
        return (
          <label
            key={opt.value}
            className={`flex items-center gap-3 rounded-md border px-4 py-3 text-sm cursor-pointer transition-colors ${
              value === opt.value
                ? "border-emerald-400/50 bg-emerald-400/[0.06]"
                : "border-white/10 bg-white/[0.02]"
            } ${disabled ? "opacity-40 cursor-not-allowed" : "hover:border-white/20"}`}
          >
            <input
              type="radio"
              name="notifyChannels"
              value={opt.value}
              checked={value === opt.value}
              disabled={disabled}
              onChange={() => handleChange(opt.value)}
              className="accent-emerald-400"
            />
            {opt.label}
            {disabled && (
              <span className="ml-auto text-xs text-white/30">Connect WhatsApp first</span>
            )}
          </label>
        );
      })}
      {saving && <p className="text-xs text-white/40">Saving...</p>}
      {saved && <p className="text-xs text-emerald-400">Saved</p>}
    </div>
  );
}
