import "server-only";

export type SupabasePasswordUser = {
  id: string;
  email: string;
};

const AI_MAIL_SUPABASE_URL = "https://cvrihauikkflnvunmvma.supabase.co";
const AI_MAIL_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_iW6JYQBMR_DoWptPrd4KUQ_6HGK4zNI";

function configuration() {
  const url =
    process.env.AI_MAIL_SUPABASE_URL
    || process.env.SUPABASE_URL
    || AI_MAIL_SUPABASE_URL;
  const publishableKey =
    process.env.AI_MAIL_SUPABASE_PUBLISHABLE_KEY
    || process.env.SUPABASE_PUBLISHABLE_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    || process.env.SUPABASE_ANON_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    || AI_MAIL_SUPABASE_PUBLISHABLE_KEY;

  return { url: url.replace(/\/$/, ""), publishableKey };
}

export function supabasePasswordAuthConfigured(): boolean {
  return Boolean(configuration());
}

export async function verifySupabasePassword(
  email: string,
  password: string,
): Promise<SupabasePasswordUser | null> {
  const config = configuration();
  if (!config) throw new Error("AUTH_UNAVAILABLE");

  const response = await fetch(`${config.url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: config.publishableKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });

  if (response.status === 400 || response.status === 401) return null;
  if (!response.ok) throw new Error(`SUPABASE_AUTH_${response.status}`);

  const payload = await response.json() as {
    user?: { id?: unknown; email?: unknown } | null;
  };
  const id = typeof payload.user?.id === "string" ? payload.user.id : "";
  const returnedEmail = typeof payload.user?.email === "string"
    ? payload.user.email.toLowerCase()
    : "";

  if (!id || !returnedEmail) return null;
  return { id, email: returnedEmail };
}
