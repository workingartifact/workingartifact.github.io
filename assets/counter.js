(function () {
  "use strict";

  const widgets = document.querySelectorAll("[data-download-counter]");
  if (!widgets.length) return;

  const isLocalPreview = /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);

  function formatCount(value) {
    const count = Number(value);
    if (!Number.isSafeInteger(count) || count < 0) throw new Error("Invalid counter response");
    return String(count).padStart(6, "0");
  }

  widgets.forEach(function (widget) {
    const artifact = widget.dataset.artifact;
    const value = widget.querySelector("[data-counter-value]");
    const status = widget.querySelector("[data-counter-status]");
    const configuredOrigin = document.documentElement.dataset.counterOrigin || "";
    const localOrigin = isLocalPreview ? widget.dataset.localCounterOrigin || "" : "";
    const origin = (configuredOrigin || localOrigin).replace(/\/$/, "");
    const downloadLinks = document.querySelectorAll("[data-counted-download]");

    widget.hidden = true;

    if (!artifact || !value || !status || !origin) {
      return;
    }

    const readUrl = origin + "/v1/count/" + encodeURIComponent(artifact);
    const downloadUrl = origin + "/download/" + encodeURIComponent(artifact);

    fetch(readUrl, {
      method: "GET",
      mode: "cors",
      credentials: "omit",
      cache: "no-store",
      referrerPolicy: "no-referrer"
    })
      .then(function (response) {
        if (!response.ok) throw new Error("Counter unavailable");
        return response.json();
      })
      .then(function (payload) {
        value.textContent = formatCount(payload.count);
        status.textContent = "Aggregate download requests; repeat requests may be included.";
        widget.classList.add("is-ready");
        widget.hidden = false;
        downloadLinks.forEach(function (link) {
          link.href = downloadUrl;
        });
      })
      .catch(function () {
        widget.classList.remove("is-ready");
        widget.hidden = true;
      });
  });
})();
