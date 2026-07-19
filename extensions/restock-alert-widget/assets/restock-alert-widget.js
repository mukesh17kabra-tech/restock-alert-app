/**
 * Restock Alert Widget — Theme App Extension version.
 * Loaded automatically by blocks/restock-alert.liquid when a merchant adds
 * the "Restock Alert" app block via the theme editor. Not meant to be
 * included manually — Shopify serves this from its own asset CDN.
 */
(function () {
  function render(el) {
    const { shop, productId, variantId, productTitle, variantTitle, apiBase } = el.dataset;

    el.innerHTML = `
      <div style="font-family:inherit;max-width:320px;">
        <p style="margin:0 0 8px;font-size:14px;color:#555;">This variant is out of stock.</p>
        <form style="display:flex;gap:8px;">
          <input type="email" required placeholder="you@email.com"
                 style="flex:1;padding:8px;border:1px solid #ccc;border-radius:6px;font-size:14px;" />
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
      const email = form.querySelector("input").value;
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
            email,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          status.textContent = "You're on the list! We'll email you when it's back.";
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
