"use client";

import { useState } from "react";

export function CopySnippet({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can fail in some embedded/iframe contexts — fail
      // silently, the code is still selectable/copyable by hand.
    }
  }

  return (
    <div className="relative rounded-lg border border-white/10 bg-white/[0.02]">
      <button
        onClick={handleCopy}
        className="absolute right-3 top-3 rounded-md bg-white/10 px-3 py-1 text-xs font-medium text-white hover:bg-white/20 transition-colors"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
      <pre className="overflow-x-auto p-4 pr-20 text-xs text-white/80 leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}
