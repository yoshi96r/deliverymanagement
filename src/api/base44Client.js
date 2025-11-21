import { createClient } from '@base44/sdk';

const appId = (import.meta.env.VITE_BASE44_APP_ID || "").trim();
const baseUrl = (import.meta.env.VITE_BASE44_API_URL || "https://api.base44.app").trim();

if (!appId) {
  const message = "[Base44] Missing VITE_BASE44_APP_ID. Add it to your .env.local to avoid 404s.";
  console.error(message);
  throw new Error(message);
}

export const base44 = createClient({
  appId,
  baseUrl,
  requiresAuth: true,
});
