"use client";
import { useEffect } from "react";

const AUTHORIZATION_STORAGE_KEY = "r3alm-ai-mail-authorization-id";
export function OAuthResume() {
  useEffect(() => {
    // Preserve callback data on this origin until Supabase consumes it. Never log it.
    try {
      if (window.localStorage.getItem(AUTHORIZATION_STORAGE_KEY)) {
        window.location.replace(`/oauth/consent${window.location.search}${window.location.hash}`);
      }
    } catch { /* Storage-disabled browsers can restart authorization from the client. */ }
  }, []);
  return null;
}
