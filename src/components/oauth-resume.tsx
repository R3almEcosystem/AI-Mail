"use client";

import { useEffect } from "react";

const AUTHORIZATION_STORAGE_KEY = "r3alm-ai-mail-authorization-id";

export function OAuthResume() {
  useEffect(() => {
    if (window.localStorage.getItem(AUTHORIZATION_STORAGE_KEY)) {
      window.location.replace("/oauth/consent");
    }
  }, []);

  return null;
}
