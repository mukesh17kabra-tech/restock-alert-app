import { getMainThemeId, getAsset, putAsset } from "@/lib/shopify";

const MARKER_START = "{% comment %} restock-alert-widget:start {% endcomment %}";
const MARKER_END = "{% comment %} restock-alert-widget:end {% endcomment %}";

// Candidate files to inject into, in priority order. Online Store 2.0
// themes use `sections/main-product.liquid`; older "vintage" themes use
// `templates/product.liquid` directly.
const CANDIDATE_FILES = ["sections/main-product.liquid", "templates/product.liquid"];

function buildSnippetSource(host: string) {
  return `${MARKER_START}
<div id="restock-alert-widget"
     data-shop="{{ shop.permanent_domain }}"
     data-product-id="{{ product.id }}"
     data-variant-id="{{ product.selected_or_first_available_variant.id }}"
     data-product-title="{{ product.title | escape }}"
     data-variant-title="{{ product.selected_or_first_available_variant.title | escape }}">
</div>
<script src="${host}/widget.js" async></script>
${MARKER_END}`;
}

function buildInjectionBlock(host: string) {
  return `${MARKER_START}
{% unless product.selected_or_first_available_variant.available %}
  {% render 'restock-alert-widget' %}
{% endunless %}
${MARKER_END}`;
}

export type InstallResult =
  | { success: true; themeId: number; file: string }
  | { success: false; error: string };

export async function autoInstallWidget(
  shop: string,
  accessToken: string
): Promise<InstallResult> {
  const host = process.env.HOST!;

  let themeId: number;
  try {
    themeId = await getMainThemeId(shop, accessToken);
  } catch (err) {
    return { success: false, error: `Couldn't find the active theme: ${(err as Error).message}` };
  }

  // 1. Write (or overwrite) the reusable snippet file. Safe to always
  // overwrite — it's our own file, identified by a unique name.
  try {
    await putAsset(shop, accessToken, themeId, "snippets/restock-alert-widget.liquid", buildSnippetSource(host));
  } catch (err) {
    return { success: false, error: `Couldn't create the widget snippet: ${(err as Error).message}` };
  }

  // 2. Inject a render call into the first candidate product template that
  // exists, right before its closing tag — unless it's already there
  // (checked via the marker comment, so clicking the button twice is safe).
  for (const file of CANDIDATE_FILES) {
    const existing = await getAsset(shop, accessToken, themeId, file);
    if (existing === null) continue; // this theme doesn't have that file

    if (existing.includes(MARKER_START)) {
      // Already installed in this file — nothing to do, treat as success.
      return { success: true, themeId, file };
    }

    const updated = `${existing}\n${buildInjectionBlock(host)}\n`;

    try {
      await putAsset(shop, accessToken, themeId, file, updated);
    } catch (err) {
      return { success: false, error: `Couldn't update ${file}: ${(err as Error).message}` };
    }

    return { success: true, themeId, file };
  }

  return {
    success: false,
    error:
      "Couldn't find a product template to install into automatically. Your theme may use a non-standard structure — use the manual snippet below instead.",
  };
}
