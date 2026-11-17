"use client";

import { useEffect } from "react";

const CONSENT_KEY = "moonlit-garden:cookie-consent";

export function Analytics() {
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN) return;

    const load = () => {
      if (localStorage.getItem(CONSENT_KEY) !== "accepted" || document.querySelector("[data-plausible]")) return;
      const script = document.createElement("script");
      script.defer = true;
      script.dataset.plausible = "true";
      script.src = "https://plausible.io/js/script.js";
      script.dataset.domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
      document.head.appendChild(script);
    };

    load();
    window.addEventListener("cookie-consent", load);
    return () => window.removeEventListener("cookie-consent", load);
  }, []);

  return null;
}
