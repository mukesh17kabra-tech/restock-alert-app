/**
 * Restock Alert Widget
 * Add this to your product template (or via theme app extension):
 *
 * <div id="restock-alert-widget"
 *      data-shop="{{ shop.permanent_domain }}"
 *      data-product-id="{{ product.id }}"
 *      data-variant-id="{{ product.selected_or_first_available_variant.id }}"
 *      data-product-title="{{ product.title | escape }}"
 *      data-variant-title="{{ product.selected_or_first_available_variant.title | escape }}">
 * </div>
 * <script src="https://YOUR-APP-DOMAIN.vercel.app/widget.js" async></script>
 *
 * The form shown (email / phone / both) is controlled per-shop from the
 * merchant's dashboard (Notification channels setting) — fetched below.
 */
(function () {
  const API_BASE = document.currentScript?.src
    ? new URL(document.currentScript.src).origin
    : "";

  async function render(el) {
    const { shop, productId, variantId, productTitle, variantTitle } = el.dataset;

    // Ask the backend which fields to show for this shop.
    let channels = "email";
    try {
      const res = await fetch(`${API_BASE}/api/shop/channels?shop=${encodeURIComponent(shop)}`);
      if (res.ok) {
        const data = await res.json();
        channels = data.notifyChannels || "email";
      }
    } catch {
      // Fall back to email-only if this lookup fails for any reason.
    }

    const showEmail = channels === "email" || channels === "both";
    const showPhone = channels === "whatsapp" || channels === "both";

    el.innerHTML = `
      <div style="font-family:inherit;max-width:320px;">
        <p style="margin:0 0 8px;font-size:14px;color:#555;">This variant is out of stock.</p>
        <form style="display:flex;flex-direction:column;gap:8px;">
          <input type="text" name="name" placeholder="Your name"
                 style="padding:8px;border:1px solid #ccc;border-radius:6px;font-size:14px;" />
          ${
            showEmail
              ? `<input type="email" name="email" ${showPhone ? "" : "required"} placeholder="you@email.com"
                   style="padding:8px;border:1px solid #ccc;border-radius:6px;font-size:14px;" />`
              : ""
          }
          ${
            showPhone
              ? `<input type="tel" name="phone" ${showEmail ? "" : "required"} placeholder="+91XXXXXXXXXX (WhatsApp)"
                   style="padding:8px;border:1px solid #ccc;border-radius:6px;font-size:14px;" />`
              : ""
          }
          <button type="submit"
                  style="padding:8px 14px;background:#111;color:#fff;border:none;border-radius:6px;font-size:14px;cursor:pointer;">
            Notify me
          </button>
        </form>
        <p class="ra-status" style="margin:8px 0 0;font-size:13px;"></p>
      </div>
    `;

    const form = el.querySelector("form");
    const status = el.querySelector(".ra-status");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = form.querySelector('[name="name"]')?.value || undefined;
      const email = form.querySelector('[name="email"]')?.value || undefined;
      const phone = form.querySelector('[name="phone"]')?.value || undefined;

      if (!email && !phone) {
        status.textContent = "Please enter an email or phone number.";
        status.style.color = "red";
        return;
      }

      status.textContent = "Submitting...";

      try {
        const res = await fetch(`${API_BASE}/api/subscribe`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shop,
            productId,
            variantId,
            productTitle,
            variantTitle,
            name,
            email,
            phone,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          status.textContent = "You're on the list! We'll notify you when it's back.";
          status.style.color = "green";
          form.style.display = "none";
        } else {
          status.textContent = data.error || "Something went wrong.";
          status.style.color = "red";
        }
      } catch {
        status.textContent = "Network error, please try again.";
        status.style.color = "red";
      }
    });
  }

  document.querySelectorAll("#restock-alert-widget").forEach(render);
})();
