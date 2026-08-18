import type { AppConfig } from '../config.js';

function jsValue(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export function renderConsentPage(config: AppConfig): string {
  const allowedEmail = config.oauth.allowedEmails[0] ?? 'key@r3alm.com';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="robots" content="noindex,nofollow" />
  <title>Authorize r3alm AI-Mail</title>
  <style>
    :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; background: #07090d; color: #f4f6f8; display: grid; place-items: center; padding: 24px; }
    main { width: min(560px, 100%); border: 1px solid #252a34; border-radius: 22px; padding: 32px; background: #0d1118; box-shadow: 0 24px 80px rgba(0,0,0,.45); }
    .eyebrow { font-size: 12px; letter-spacing: .16em; text-transform: uppercase; color: #8f99a8; margin-bottom: 12px; }
    h1 { margin: 0 0 10px; font-size: 28px; font-weight: 650; letter-spacing: -.025em; }
    p { color: #aeb6c2; line-height: 1.55; }
    .card { margin: 24px 0; padding: 18px; border: 1px solid #252a34; border-radius: 14px; background: #10151e; }
    .row { margin: 10px 0; }
    .label { display: block; color: #7f8998; font-size: 12px; margin-bottom: 4px; }
    .value { word-break: break-word; }
    button { border: 0; border-radius: 10px; padding: 12px 18px; font: inherit; font-weight: 600; cursor: pointer; }
    button.primary { background: #f2f5f7; color: #090b0f; }
    button.secondary { background: #202733; color: #f4f6f8; }
    button:disabled { opacity: .55; cursor: wait; }
    .actions { display: flex; gap: 10px; flex-wrap: wrap; }
    .error { display: none; margin-top: 16px; padding: 12px; border: 1px solid #68333a; background: #2b1518; border-radius: 10px; color: #ffbbc3; white-space: pre-wrap; }
    .notice { display: none; margin-top: 16px; padding: 12px; border: 1px solid #34506f; background: #101f31; border-radius: 10px; color: #c7e0ff; white-space: pre-wrap; }
    .muted { font-size: 13px; color: #788291; }
    #consent, #login { display: none; }
    ul { padding-left: 20px; color: #c2c9d2; }
  </style>
</head>
<body>
<main>
  <div class="eyebrow">r3alm secure authorization</div>
  <h1>Authorize AI-Mail</h1>
  <p>Authenticate with the approved r3alm identity, review the requesting client, and explicitly approve access.</p>

  <section id="loading" class="card">Checking authorization request…</section>

  <section id="login">
    <div class="card">
      <div class="row"><span class="label">Approved identity</span><span class="value" id="approved-email"></span></div>
    </div>
    <button id="send-link" class="primary" type="button">Email me a secure sign-in link</button>
    <p class="muted">No Supabase password is required. The sign-in link is sent only to the approved r3alm address.</p>
  </section>

  <section id="consent">
    <div class="card">
      <div class="row"><span class="label">Signed in as</span><span class="value" id="signed-in-email"></span></div>
      <div class="row"><span class="label">Requesting client</span><span class="value" id="client-name"></span></div>
      <div class="row"><span class="label">Redirect URI</span><span class="value" id="redirect-uri"></span></div>
      <div class="row"><span class="label">Requested scopes</span><ul id="scope-list"></ul></div>
    </div>
    <div class="actions">
      <button id="approve" class="primary" type="button">Approve ChatGPT access</button>
      <button id="deny" class="secondary" type="button">Deny</button>
      <button id="signout" class="secondary" type="button">Sign out</button>
    </div>
  </section>

  <div id="notice" class="notice"></div>
  <div id="error" class="error"></div>
</main>

<script type="module">
  import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.105.0';

  const SUPABASE_URL = ${jsValue(config.oauth.supabaseUrl)};
  const PUBLISHABLE_KEY = ${jsValue(config.oauth.publishableKey)};
  const ALLOWED_EMAIL = ${jsValue(allowedEmail)};
  const AUTH_STORAGE_KEY = 'r3alm-ai-mail-authorization-id';
  const urlAuthorizationId = new URLSearchParams(window.location.search).get('authorization_id');
  if (urlAuthorizationId) localStorage.setItem(AUTH_STORAGE_KEY, urlAuthorizationId);
  const AUTHORIZATION_ID = urlAuthorizationId || localStorage.getItem(AUTH_STORAGE_KEY);

  const loading = document.getElementById('loading');
  const login = document.getElementById('login');
  const consent = document.getElementById('consent');
  const errorBox = document.getElementById('error');
  const noticeBox = document.getElementById('notice');
  const sendLinkButton = document.getElementById('send-link');
  document.getElementById('approved-email').textContent = ALLOWED_EMAIL;

  const supabase = createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  function showError(message) {
    noticeBox.style.display = 'none';
    errorBox.textContent = String(message || 'Authorization failed');
    errorBox.style.display = 'block';
  }

  function showNotice(message) {
    errorBox.style.display = 'none';
    noticeBox.textContent = String(message || '');
    noticeBox.style.display = 'block';
  }

  function clearMessages() {
    errorBox.textContent = '';
    errorBox.style.display = 'none';
    noticeBox.textContent = '';
    noticeBox.style.display = 'none';
  }

  async function loadAuthorization() {
    clearMessages();
    if (!AUTHORIZATION_ID) {
      loading.style.display = 'none';
      showError('Missing authorization request. Start this flow from ChatGPT.');
      return;
    }

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      loading.style.display = 'none';
      showError(sessionError.message);
      return;
    }

    const session = sessionData.session;
    if (!session) {
      loading.style.display = 'none';
      login.style.display = 'block';
      consent.style.display = 'none';
      return;
    }

    const email = (session.user?.email || '').toLowerCase();
    if (email !== ALLOWED_EMAIL) {
      await supabase.auth.signOut();
      loading.style.display = 'none';
      login.style.display = 'block';
      consent.style.display = 'none';
      showError('This Supabase identity is not authorized for r3alm AI-Mail.');
      return;
    }

    const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(AUTHORIZATION_ID);
    if (error) {
      loading.style.display = 'none';
      showError(error.message);
      return;
    }

    if (data && !('authorization_id' in data) && data.redirect_url) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      window.location.assign(data.redirect_url);
      return;
    }

    document.getElementById('signed-in-email').textContent = email;
    document.getElementById('client-name').textContent = data?.client?.name || 'ChatGPT — r3alm AI-Mail';
    document.getElementById('redirect-uri').textContent = data?.redirect_uri || '';
    const scopes = String(data?.scope || '').split(/\\s+/).filter(Boolean);
    const scopeList = document.getElementById('scope-list');
    scopeList.replaceChildren(...scopes.map((scope) => {
      const li = document.createElement('li');
      li.textContent = scope;
      return li;
    }));

    loading.style.display = 'none';
    login.style.display = 'none';
    consent.style.display = 'block';
  }

  sendLinkButton.addEventListener('click', async () => {
    clearMessages();
    if (!AUTHORIZATION_ID) {
      showError('Missing authorization request. Start this flow from ChatGPT.');
      return;
    }
    sendLinkButton.disabled = true;
    const { error } = await supabase.auth.signInWithOtp({
      email: ALLOWED_EMAIL,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: window.location.origin
      }
    });
    sendLinkButton.disabled = false;
    if (error) {
      showError(error.message);
      return;
    }
    showNotice('Secure sign-in link sent to ' + ALLOWED_EMAIL + '. Open that email in this browser and follow the link to continue.');
  });

  async function decide(decision) {
    clearMessages();
    const result = decision === 'approve'
      ? await supabase.auth.oauth.approveAuthorization(AUTHORIZATION_ID)
      : await supabase.auth.oauth.denyAuthorization(AUTHORIZATION_ID);
    if (result.error) {
      showError(result.error.message);
      return;
    }
    localStorage.removeItem(AUTH_STORAGE_KEY);
    if (result.data?.redirect_url) window.location.assign(result.data.redirect_url);
  }

  document.getElementById('approve').addEventListener('click', () => void decide('approve'));
  document.getElementById('deny').addEventListener('click', () => void decide('deny'));
  document.getElementById('signout').addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.reload();
  });

  void loadAuthorization();
</script>
</body>
</html>`;
}
