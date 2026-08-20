"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, Menu, PenLine, Search, ShieldCheck, X } from "lucide-react";
import { ComposeModal } from "@/components/compose-modal";
import { AlertsPanel } from "@/components/alerts-panel";
import { InboxWorkspace } from "@/components/inbox-workspace";
import { OverviewView } from "@/components/overview-view";
import { Sidebar, type DashboardSection } from "@/components/sidebar";
import { AccountsView, AiRulesView, SettingsView } from "@/components/settings-views";
import type { AiAction, AlertGroup, AppStatus, MailListResponse, MailMessage, SessionUser } from "@/lib/types";
import { initialAlerts, type AlertRecord } from "@/lib/alerts";
import { webPath } from "@/lib/web-path";

const sectionTitles: Record<DashboardSection, { kicker: string; title: string }> = {
  overview: { kicker: "COMMAND CENTER", title: "Mail overview" },
  inbox: { kicker: "COMMUNICATIONS", title: "Executive inbox" },
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
  const [demo, setDemo] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [mailResponse, statusResponse, groupsResponse] = await Promise.all([
        fetch(`${webPath("/api/mail")}?limit=50`, { cache: "no-store" }),
        fetch(webPath("/api/status"), { cache: "no-store" }),
        fetch(webPath("/api/alert-groups"), { cache: "no-store" }),
      ]);
      if (!mailResponse.ok || !statusResponse.ok) throw new Error("Unable to load console data.");

      const [mailData, statusData] = (await Promise.all([
        mailResponse.json(),
        statusResponse.json(),
      ])) as [MailListResponse, AppStatus];

      setMessages(mailData.messages);
      setDemo(mailData.demo);
      setStatus(statusData);
      if (groupsResponse.ok) {
        const groupData = (await groupsResponse.json()) as { groups: AlertGroup[] };
        setAlertGroups(groupData.groups);
      }
      setSelected((current) => {
        if (!current) return mailData.messages[0] || null;
        return mailData.messages.find((message) => message.uid === current.uid) || mailData.messages[0] || null;
      });
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Unable to load AI-Mail.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 4200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const unread = messages.filter((message) => message.unread).length;
  const unreadAlerts = alerts.filter((alert) => alert.unread && alert.status === "active").length;
  const filteredMessages = useMemo(() => {
    const query = search.trim().toLowerCase();
    return messages.filter((message) => {
      if (filter === "unread" && !message.unread) return false;
      if (filter === "flagged" && !message.flagged) return false;
      if (!query) return true;
      return `${message.sender} ${message.senderEmail} ${message.subject} ${message.preview}`
        .toLowerCase()
        .includes(query);
    });
  }, [filter, messages, search]);

  async function selectMessage(message: MailMessage, openInbox = true) {
    setSelected(message);
    setAiResult("");
    if (openInbox) setSection("inbox");
    if (message.body) return;

    try {
      const response = await fetch(webPath(`/api/mail/${message.uid}`), { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to load the full message.");
      const data = (await response.json()) as { message: MailMessage };
      setMessages((current) =>
        current.map((item) => (item.uid === message.uid ? data.message : item)),
      );
      setSelected(data.message);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Unable to load the message.");
    }
  }

  async function applyAction(action: "read" | "unread" | "flag" | "unflag" | "archive") {
    if (!selected) return;
    const targetUid = selected.uid;

    try {
      const response = await fetch(webPath(`/api/mail/${targetUid}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!response.ok) throw new Error("The message could not be updated.");

      if (action === "archive") {
        const nextMessages = messages.filter((message) => message.uid !== targetUid);
        setMessages(nextMessages);
        setSelected(nextMessages[0] || null);
        setToast(demo ? "Archive preview completed." : "Message archived.");
        return;
      }

      const update = (message: MailMessage): MailMessage => {
        if (message.uid !== targetUid) return message;
        if (action === "read") return { ...message, unread: false };
        if (action === "unread") return { ...message, unread: true };
        if (action === "flag") return { ...message, flagged: true };
        return { ...message, flagged: false };
      };
      setMessages((current) => current.map(update));
      setSelected((current) => (current ? update(current) : current));
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Unable to update the message.");
    }
  }

  async function runAiAction(action: AiAction) {
    if (!selected) return;
    setAiLoading(true);
    setAiResult("");
    try {
      const response = await fetch(webPath("/api/ai"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, message: selected }),
      });
      const result = (await response.json().catch(() => null)) as { text?: string; error?: string; demo?: boolean } | null;
      if (!response.ok) throw new Error(result?.error || "AI processing failed.");
      setAiResult(result?.text || "No AI response was returned.");
      if (result?.demo) setToast("OpenAI preview shown. Add API credentials for live analysis.");
    } catch (error) {
      setAiResult(error instanceof Error ? error.message : "AI processing failed.");
    } finally {
      setAiLoading(false);
    }
  }

  function changeSection(nextSection: DashboardSection) {
    setSection(nextSection);
    setMobileNav(false);
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
          <div className="setup-banner"><ShieldCheck size={16} /><span><strong>Security setup required:</strong> add APP_ACCESS_PASSWORD and AUTH_SECRET before routing the production domain to this build.</span></div>
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
              demo={Boolean(demo || !status?.openai)}
              onFilterChange={setFilter}
              onSearchChange={setSearch}
              onSelect={(message) => void selectMessage(message, false)}
              onAction={(action) => void applyAction(action)}
              onAiAction={(action) => void runAiAction(action)}
              onCompose={() => setComposeOpen(true)}
              onRefresh={() => void loadData()}
            />
          ) : null}
          {section === "ai" ? <AiRulesView /> : null}
          {section === "accounts" ? <AccountsView status={status} /> : null}
          {section === "settings" ? <SettingsView status={status} /> : null}
        </div>
      </div>

      <ComposeModal
        open={composeOpen}
        replyTo={section === "inbox" ? selected : null}
        onClose={() => setComposeOpen(false)}
        onSent={(isDemo) => setToast(isDemo ? "Message preview completed. Configure SMTP for delivery." : "Message sent.")}
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
