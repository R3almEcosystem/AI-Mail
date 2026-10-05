"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, Menu, PenLine, Search, ShieldCheck, X } from "lucide-react";
import { ComposeModal } from "@/components/compose-modal";
import { AlertsPanel } from "@/components/alerts-panel";
import { InboxWorkspace } from "@/components/inbox-workspace";
import { MailResearchModal, MailResearchPanel } from "@/components/mail-research-modal";
import { OverviewView } from "@/components/overview-view";
import { Sidebar, type DashboardSection } from "@/components/sidebar";
import { AccountsView, AiRulesView, SettingsView } from "@/components/settings-views";
import type { AiAction, AlertGroup, AppStatus, MailAccountSummary, MailListResponse, MailMessage, MailTag, SessionUser } from "@/lib/types";
import { initialAlerts, type AlertRecord } from "@/lib/alerts";
import { webPath } from "@/lib/web-path";

const mailTagLabels: Record<MailTag, string> = {
  "follow-up": "Follow Up",
  waiting: "Waiting",
  finance: "Finance",
  legal: "Legal",
  technology: "Technology",
  personal: "Personal",
};

function mailTagLabel(tag: MailTag) {
  return mailTagLabels[tag];
}

function mailTagsFromFlags(flags: readonly string[]): MailTag[] {
  const map: Array<[MailTag, string]> = [
    ["follow-up", "r3almfollowup"],
    ["waiting", "r3almwaiting"],
    ["finance", "r3almfinance"],
    ["legal", "r3almlegal"],
    ["technology", "r3almtechnology"],
    ["personal", "r3almpersonal"],
  ];
  const normalized = new Set(flags.map((flag) => flag.toLowerCase()));
  return map.filter(([, flag]) => normalized.has(flag)).map(([tag]) => tag);
}

const sectionTitles: Record<DashboardSection, { kicker: string; title: string }> = {
  overview: { kicker: "COMMAND CENTER", title: "Mail overview" },
  inbox: { kicker: "COMMUNICATIONS", title: "Executive inbox" },
  sent: { kicker: "OUTBOUND", title: "Sent messages" },
  research: { kicker: "MAILBOX INTELLIGENCE", title: "AI Mail Research" },
  ai: { kicker: "INTELLIGENCE", title: "AI automation" },
  accounts: { kicker: "INFRASTRUCTURE", title: "Connected services" },
  settings: { kicker: "ADMINISTRATION", title: "System settings" },
};

export function MailDashboard({ initialUser }: { initialUser: SessionUser }) {
  const [section, setSection] = useState<DashboardSection>("overview");
  const [messages, setMessages] = useState<MailMessage[]>([]);
  const [selected, setSelected] = useState<MailMessage | null>(null);
  const [status, setStatus] = useState<AppStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [inboxUnread, setInboxUnread] = useState(0);
  const [mailboxTotal, setMailboxTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [nextBeforeUid, setNextBeforeUid] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeFolder, setActiveFolder] = useState<"INBOX" | "INBOX.Sent">("INBOX");
  const [filter, setFilter] = useState<"all" | "unread" | "flagged">("all");
  const [search, setSearch] = useState("");
  const [aiResult, setAiResult] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [alerts, setAlerts] = useState<AlertRecord[]>(() => initialAlerts.map((alert) => ({ ...alert })));
  const [alertGroups, setAlertGroups] = useState<AlertGroup[]>([]);
  const [toast, setToast] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [researchOpen, setResearchOpen] = useState(false);
  const [researchScope, setResearchScope] = useState<"inbox" | "sent" | "both">("both");
  const [demo, setDemo] = useState(true);
  const [mailAccounts, setMailAccounts] = useState<MailAccountSummary[]>([]);
  const [activeAccountId, setActiveAccountId] = useState("all");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const selectionVersion = useRef(0);
  const aiVersion = useRef(0);
  const loadVersion = useRef(0);
  const autoSummarySeen = useRef<Set<string>>(new Set());
  const mailActionInFlight = useRef(false);

  const loadData = useCallback(async (folder = "INBOX", accountId = "all") => {
    const version = ++loadVersion.current;
    const selectionAtStart = ++selectionVersion.current;
    aiVersion.current++; setAiLoading(false); setAiResult("");
    setLoading(true);
    try {
      const [mailResponse, statusResponse, groupsResponse] = await Promise.all([
        fetch(`${webPath("/api/mail")}?limit=50&folder=${encodeURIComponent(folder)}&accountId=${encodeURIComponent(accountId)}`, { cache: "no-store" }),
        fetch(webPath("/api/status"), { cache: "no-store" }),
        fetch(webPath("/api/alert-groups"), { cache: "no-store" }),
      ]);
      if (!mailResponse.ok || !statusResponse.ok) throw new Error("Unable to load console data.");

      const [mailData, statusData] = (await Promise.all([
        mailResponse.json(),
        statusResponse.json(),
      ])) as [MailListResponse, AppStatus];

      if (version !== loadVersion.current) return;
      setMessages(mailData.messages);
      setMailboxTotal(mailData.total);
      setHasMore(mailData.hasMore);
      setNextBeforeUid(mailData.nextBeforeUid);
      setNextCursor(mailData.nextCursor || null);
      setMailAccounts(mailData.accounts || []);
      setActiveAccountId(mailData.accountId || accountId);
      setActiveFolder(folder === "INBOX.Sent" ? "INBOX.Sent" : "INBOX");
      if (folder === "INBOX") setInboxUnread(mailData.unread);
      setDemo(mailData.demo);
      setStatus(statusData);
      if (groupsResponse.ok) {
        const groupData = (await groupsResponse.json()) as { groups: AlertGroup[] };
        setAlertGroups(groupData.groups);
      }
      setSelected((current) => {
        if (selectionAtStart !== selectionVersion.current) return current;
        if (!current) return mailData.messages[0] || null;
        return mailData.messages.find((message) => message.uid === current.uid && (message.accountId || "primary") === (current.accountId || "primary")) || mailData.messages[0] || null;
      });
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Unable to load AI-Mail.");
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData("INBOX", "all");
  }, [loadData]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !hasMore || (activeAccountId === "all" ? !nextCursor : nextBeforeUid === null)) return;
    const folder = activeFolder;
    const cursor = activeAccountId === "all" ? nextCursor : String(nextBeforeUid);
    const version = loadVersion.current;
    setLoadingMore(true);
    try {
      const response = await fetch(
        `${webPath("/api/mail")}?limit=50&folder=${encodeURIComponent(folder)}&accountId=${encodeURIComponent(activeAccountId)}&${activeAccountId === "all" ? "cursor=" + encodeURIComponent(cursor || "") : "beforeUid=" + cursor}`,
        { cache: "no-store" },
      );
      const data = (await response.json().catch(() => null)) as MailListResponse | { error?: string } | null;
      if (!response.ok || !data || !("messages" in data)) {
        throw new Error(data && "error" in data && data.error ? data.error : "Unable to load older messages.");
      }
      if (version !== loadVersion.current) return;
      setMessages((current) => {
        const seen = new Set(current.map((message) => `${message.accountId || "primary"}:${message.folder || folder}:${message.uid}`));
        const older = data.messages.filter((message) => !seen.has(`${message.accountId || "primary"}:${message.folder || folder}:${message.uid}`));
        return [...current, ...older];
      });
      setMailboxTotal(data.total);
      setHasMore(data.hasMore);
      setNextBeforeUid(data.nextBeforeUid);
      setNextCursor(data.nextCursor || null);
      if (data.accounts) setMailAccounts(data.accounts);
      if (folder === "INBOX") setInboxUnread(data.unread);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Unable to load older messages.");
    } finally {
      setLoadingMore(false);
    }
  }, [activeAccountId, activeFolder, hasMore, loading, loadingMore, nextBeforeUid, nextCursor]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 4200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    const body = selected?.body?.trim();
    if (!body || !selected || !status?.openai || (!status.aiAutoSummarize && !selected.aiAutoSummary) || aiLoading || aiResult) return;
    const ruleRequestedSummary = Boolean(selected.aiAutoSummary);
    const summaryKey = `${selected.accountId || "primary"}:${selected.folder || "INBOX"}:${selected.uid}`;
    if ((!ruleRequestedSummary && body.split(/\s+/).length <= 250) || autoSummarySeen.current.has(summaryKey)) return;
    autoSummarySeen.current.add(summaryKey);
    void runAiAction("summarize");
  }, [selected, status?.openai, status?.aiAutoSummarize, aiLoading, aiResult]);

  const unread = inboxUnread;
  const unreadAlerts = alerts.filter((alert) => alert.unread && alert.status === "active").length;
  const filteredMessages = useMemo(() => {
    const query = search.trim().toLowerCase();
    return messages.filter((message) => {
      if (filter === "unread" && !message.unread) return false;
      if (filter === "flagged" && !message.flagged) return false;
      if (!query) return true;
      return `${message.sender} ${message.senderEmail} ${message.recipientLabel || ""} ${message.subject} ${message.preview}`
        .toLowerCase()
        .includes(query);
    });
  }, [filter, messages, search]);

  async function selectMessage(message: MailMessage, openInbox = true) {
    const version = ++selectionVersion.current;
    aiVersion.current++; setAiLoading(false);
    setSelected(message);
    setAiResult("");
    if (openInbox) setSection(message.direction === "outbound" ? "sent" : "inbox");
    if (message.bodyLoaded || message.body) return;

    try {
      const folder = message.folder || (message.direction === "outbound" ? "INBOX.Sent" : "INBOX");
      const accountId = message.accountId || "primary";
      const response = await fetch(`${webPath(`/api/mail/${message.uid}`)}?folder=${encodeURIComponent(folder)}&accountId=${encodeURIComponent(accountId)}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to load the full message.");
      const data = (await response.json()) as { message: MailMessage };
      if (version !== selectionVersion.current) return;
      if (data?.message?.uid !== message.uid) throw new Error("The message identity could not be confirmed.");
      setMessages((current) =>
        current.map((item) => (item.uid === message.uid && (item.accountId || "primary") === (message.accountId || "primary") ? data.message : item)),
      );
      setSelected(data.message);
    } catch (error) {
      if (version === selectionVersion.current) setToast(error instanceof Error ? error.message : "Unable to load the message.");
    }
  }

  async function applyAction(action: "read" | "unread" | "flag" | "unflag" | "archive" | "tag" | "untag", tag?: MailTag) {
    if (!selected || mailActionInFlight.current) return;
    const targetUid = selected.uid;
    const targetAccountId = selected.accountId || "primary";
    const selectionAtAction = selectionVersion.current;
    const wasUnread = selected.unread;
    const folder = selected.folder || (selected.direction === "outbound" ? "INBOX.Sent" : "INBOX");
    mailActionInFlight.current = true;

    try {
      const response = await fetch(webPath(`/api/mail/${targetUid}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, folder, accountId: targetAccountId, ...(tag ? { tag } : {}) }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        demo?: boolean;
        result?: { uid?: number; flags?: string[] };
      } | null;
      if (!response.ok) throw new Error(payload?.error || "The message could not be updated.");
      if (payload?.result?.uid !== undefined && payload.result.uid !== targetUid) {
        throw new Error("The mailbox update could not be matched to this message.");
      }

      if (action === "archive") {
        if (selected.direction !== "outbound" && wasUnread) setInboxUnread((current) => Math.max(0, current - 1));
        setMailboxTotal((current) => Math.max(0, current - 1));
        const nextMessages = messages.filter((message) => !(message.uid === targetUid && (message.accountId || "primary") === targetAccountId));
        setMessages(nextMessages);
        if (selectionAtAction === selectionVersion.current) {
          selectionVersion.current++; aiVersion.current++; setAiLoading(false); setAiResult("");
          setSelected(nextMessages[0] || null);
        }
        setToast(demo ? "Archive preview completed." : folder === "INBOX.Sent" ? "Sent message archived." : "Message archived.");
        return;
      }

      const canonicalFlags = payload?.result?.flags;
      const update = (message: MailMessage): MailMessage => {
        if (message.uid !== targetUid || (message.accountId || "primary") !== targetAccountId) return message;
        if (canonicalFlags) {
          return {
            ...message,
            unread: !canonicalFlags.includes("\\Seen"),
            flagged: canonicalFlags.includes("\\Flagged"),
            tags: mailTagsFromFlags(canonicalFlags),
          };
        }
        if (action === "read") return { ...message, unread: false };
        if (action === "unread") return { ...message, unread: true };
        if (action === "flag") return { ...message, flagged: true };
        if (action === "unflag") return { ...message, flagged: false };
        if (action === "tag" && tag) return { ...message, tags: [...new Set([...(message.tags || []), tag])] };
        if (action === "untag" && tag) return { ...message, tags: (message.tags || []).filter((item) => item !== tag) };
        return message;
      };

      const updatedSelected = update(selected);
      if (selected.direction !== "outbound" && updatedSelected.unread !== wasUnread) {
        setInboxUnread((current) => Math.max(0, current + (updatedSelected.unread ? 1 : -1)));
      }
      setMessages((current) => current.map(update));
      setSelected((current) => (current && current.uid === targetUid && (current.accountId || "primary") === targetAccountId ? update(current) : current));

      if (action === "read") setToast("Message marked as read.");
      else if (action === "unread") setToast("Message marked as unread.");
      else if (action === "flag") setToast("Message flagged.");
      else if (action === "unflag") setToast("Message flag removed.");
      else if (action === "tag" && tag) setToast(`${mailTagLabel(tag)} tag added.`);
      else if (action === "untag" && tag) setToast(`${mailTagLabel(tag)} tag removed.`);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Unable to update the message.");
    } finally {
      mailActionInFlight.current = false;
    }
  }

  async function runAiAction(action: AiAction) {
    if (!selected || aiLoading) return;
    const uid = selected.uid;
    const version = ++aiVersion.current;
    const selectionAtStart = selectionVersion.current;
    setAiLoading(true);
    setAiResult("");
    try {
      const response = await fetch(webPath("/api/ai"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, uid, folder: selected.folder || (selected.direction === "outbound" ? "INBOX.Sent" : "INBOX"), accountId: selected.accountId || "primary" }),
      });
      const result = (await response.json().catch(() => null)) as { text?: string; error?: string; demo?: boolean; uid?: number; truncated?: boolean } | null;
      if (version !== aiVersion.current || selectionAtStart !== selectionVersion.current) return;
      if (!response.ok) throw new Error(result?.error || "AI processing failed.");
      if (result?.uid !== uid) throw new Error("The AI response could not be matched to this message.");
      setAiResult((result?.truncated ? "Analysis uses an excerpt of this message.\n\n" : "") + (result?.text || "No AI response was returned."));
      if (result?.demo) setToast("OpenAI preview shown. Add API credentials for live analysis.");
    } catch (error) {
      if (version === aiVersion.current && selectionAtStart === selectionVersion.current) setAiResult(error instanceof Error ? error.message : "AI processing failed.");
    } finally {
      if (version === aiVersion.current) setAiLoading(false);
    }
  }

  function changeSection(nextSection: DashboardSection) {
    setSection(nextSection);
    setMobileNav(false);
    if (nextSection === "inbox" || nextSection === "overview") {
      setFilter("all");
      setSearch("");
      void loadData("INBOX", activeAccountId);
    } else if (nextSection === "sent") {
      setFilter("all");
      setSearch("");
      void loadData("INBOX.Sent", activeAccountId);
    }
  }

  function changeMailAccount(accountId: string) {
    setActiveAccountId(accountId);
    setFilter("all");
    setSearch("");
    setSelected(null);
    setNextBeforeUid(null);
    setNextCursor(null);
    void loadData(activeFolder, accountId);
  }

  const closeAlerts = useCallback(() => setAlertsOpen(false), []);

  function updateAlert(id: string, update: Partial<AlertRecord>) {
    setAlerts((current) => current.map((alert) => alert.id === id ? { ...alert, ...update } : alert));
  }

  function openAlertMessage(uid: number) {
    const message = messages.find((item) => item.uid === uid);
    if (!message) {
      setToast("The linked email is not available in the current mailbox view.");
      return;
    }
    closeAlerts();
    void selectMessage(message);
  }

  function openAlertSettings() {
    closeAlerts();
    setSection("settings");
  }

  const heading = sectionTitles[section];

  return (
    <main className="app-shell">
      <div className={mobileNav ? "mobile-sidebar mobile-sidebar--open" : "mobile-sidebar"}>
        <button type="button" className="mobile-close" onClick={() => setMobileNav(false)} aria-label="Close navigation"><X size={20} /></button>
        <Sidebar section={section} onSectionChange={changeSection} unread={unread} user={initialUser} />
      </div>
      <div className="desktop-sidebar"><Sidebar section={section} onSectionChange={changeSection} unread={unread} user={initialUser} /></div>

      <div className="app-main">
        <header className="topbar">
          <div className="topbar-title">
            <button type="button" className="menu-button" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu size={20} /></button>
            <div><p className="eyebrow">{heading.kicker}</p><h1>{heading.title}</h1></div>
          </div>
          <div className="topbar-actions">
            <label className="global-search"><Search size={16} /><input placeholder="Search AI-Mail" aria-label="Search AI-Mail" /></label>
            <span className={status?.mode === "live" ? "live-status" : "live-status live-status--demo"}>
              <i />{status?.mode === "live" ? "Live mail" : "Demo data"}
            </span>
            <button
              type="button"
              className="icon-button notification-button"
              aria-label={`Open alerts${unreadAlerts ? `, ${unreadAlerts} unread` : ""}`}
              aria-expanded={alertsOpen}
              aria-controls="alerts-panel"
              onClick={() => setAlertsOpen(true)}
            ><Bell size={18} />{unreadAlerts ? <span>{unreadAlerts}</span> : null}</button>
            <button type="button" className="primary-button" onClick={() => setComposeOpen(true)}><PenLine size={16} /> Compose</button>
          </div>
        </header>

        {!status?.authentication ? (
          <div className="setup-banner"><ShieldCheck size={16} /><span><strong>Security setup required:</strong> configure individual administrator access, AUTH_SECRET and the session database before routing the production domain to this build.</span></div>
        ) : null}

        <div className={`page-content page-content--${section}`}>
          {section === "overview" ? (
            <OverviewView
              messages={messages}
              status={status}
              userName={initialUser.name}
              onOpenInbox={() => setSection("inbox")}
              onSelect={(message) => void selectMessage(message)}
            />
          ) : null}
          {section === "inbox" ? (
            <InboxWorkspace
              messages={filteredMessages}
              selected={selected}
              filter={filter}
              search={search}
              loading={loading}
              aiLoading={aiLoading}
              aiResult={aiResult}
              demo={demo}
              aiConfigured={Boolean(status?.openai)}
              mailboxLabel="Inbox"
              mailboxEyebrow={activeAccountId === "all" ? "ALL ACCOUNTS" : (mailAccounts.find((account) => account.id === activeAccountId)?.label || "MAILBOX")}
              accounts={mailAccounts}
              activeAccountId={activeAccountId}
              onAccountChange={changeMailAccount}
              loadedCount={messages.length}
              totalCount={mailboxTotal}
              hasMore={hasMore}
              loadingMore={loadingMore}
              onFilterChange={setFilter}
              onSearchChange={setSearch}
              onSelect={(message) => void selectMessage(message, false)}
              onAction={(action, tag) => void applyAction(action, tag)}
              onAiAction={(action) => void runAiAction(action)}
              onCompose={() => setComposeOpen(true)}
              onRefresh={() => void loadData("INBOX", activeAccountId)}
              onLoadMore={() => void loadMore()}
              onOpenResearch={() => { setResearchScope("both"); setResearchOpen(true); }}
            />
          ) : null}
          {section === "sent" ? (
            <InboxWorkspace
              messages={filteredMessages}
              selected={selected}
              filter={filter}
              search={search}
              loading={loading}
              aiLoading={aiLoading}
              aiResult={aiResult}
              demo={demo}
              aiConfigured={Boolean(status?.openai)}
              mailboxLabel="Sent"
              mailboxEyebrow={activeAccountId === "all" ? "ALL ACCOUNTS" : (mailAccounts.find((account) => account.id === activeAccountId)?.label || "OUTBOUND")}
              accounts={mailAccounts}
              activeAccountId={activeAccountId}
              onAccountChange={changeMailAccount}
              loadedCount={messages.length}
              totalCount={mailboxTotal}
              hasMore={hasMore}
              loadingMore={loadingMore}
              sentMode
              onFilterChange={setFilter}
              onSearchChange={setSearch}
              onSelect={(message) => void selectMessage(message, false)}
              onAction={(action, tag) => void applyAction(action, tag)}
              onAiAction={(action) => void runAiAction(action)}
              onCompose={() => setComposeOpen(true)}
              onRefresh={() => void loadData("INBOX.Sent", activeAccountId)}
              onLoadMore={() => void loadMore()}
              onOpenResearch={() => { setResearchScope("both"); setResearchOpen(true); }}
            />
          ) : null}
          {section === "research" ? <MailResearchPanel defaultScope="both" defaultAccountId={activeAccountId} /> : null}
          {section === "ai" ? <AiRulesView /> : null}
          {section === "accounts" ? <AccountsView status={status} /> : null}
          {section === "settings" ? <SettingsView status={status} /> : null}
        </div>
      </div>

      <ComposeModal
        open={composeOpen}
        replyTo={section === "inbox" ? selected : null}
        accounts={mailAccounts}
        defaultAccountId={selected?.accountId || (activeAccountId === "all" ? "primary" : activeAccountId)}
        onClose={() => setComposeOpen(false)}
        onSent={(isDemo) => setToast(isDemo ? "Message preview completed. Configure SMTP for delivery." : "Message sent.")}
      />
      <MailResearchModal
        open={researchOpen}
        defaultScope={researchScope}
        defaultAccountId={activeAccountId}
        onClose={() => setResearchOpen(false)}
      />
      <div id="alerts-panel">
        <AlertsPanel
          open={alertsOpen}
          alerts={alerts}
          groups={alertGroups}
          onClose={closeAlerts}
          onUpdate={updateAlert}
          onOpenMessage={openAlertMessage}
          onOpenSettings={openAlertSettings}
        />
      </div>
      {toast ? <div className="toast" role="status">{toast}</div> : null}
    </main>
  );
}
