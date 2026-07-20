/**
 * Restock Alert Widget — Theme App Extension version.
 * Loaded automatically by blocks/restock-alert.liquid when a merchant adds
 * the "Restock Alert" app block via the theme editor. Not meant to be
 * included manually — Shopify serves this from its own asset CDN.
 *
 * If the shopper is logged in as a Shopify customer, their name/email/phone
 * (from block.liquid's data-customer-* attributes) prefill the form —
 * still editable, and nothing is auto-submitted.
 */
(function () {
  async function render(el) {
    const {
      shop,
      productId,
      variantId,
      productTitle,
      variantTitle,
      apiBase,
      customerName,
      customerEmail,
      customerPhone,
    } = el.dataset;

    // Ask the backend which fields to show for this shop.
    let channels = "email";
    try {
      const res = await fetch(`${apiBase}/api/shop/channels?shop=${encodeURIComponent(shop)}`);
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
          <input type="text" name="name" placeholder="Your name" value="${customerName || ""}"
                 style="padding:8px;border:1px solid #ccc;border-radius:6px;font-size:14px;" />
          ${
            showEmail
              ? `<input type="email" name="email" ${showPhone ? "" : "required"} placeholder="you@email.com" value="${customerEmail || ""}"
                   style="padding:8px;border:1px solid #ccc;border-radius:6px;font-size:14px;" />`
              : ""
          }
          ${
            showPhone
              ? `<input type="tel" name="phone" ${showEmail ? "" : "required"} placeholder="+91XXXXXXXXXX (WhatsApp)" value="${customerPhone || ""}"
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
        const res = await fetch(`${apiBase}/api/subscribe`, {
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

  document.querySelectorAll(".restock-alert-widget").forEach(render);
})();
