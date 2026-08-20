"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BellRing,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  ExternalLink,
  Inbox,
  ShieldAlert,
  Sparkles,
  UsersRound,
  X,
} from "lucide-react";
import type { AlertRecord } from "@/lib/alerts";
import type { AlertGroup } from "@/lib/types";

type AlertFilter = "all" | "unread";

function AlertIcon({ alert }: { alert: AlertRecord }) {
  if (alert.severity === "critical") return <ShieldAlert size={17} />;
  if (alert.severity === "success") return <CheckCircle2 size={17} />;
  if (alert.destination === "message") return <Inbox size={17} />;
  return <Sparkles size={17} />;
}

export function AlertsPanel({
  open,
  alerts,
  groups,
  onClose,
  onUpdate,
  onOpenMessage,
  onOpenSettings,
}: {
  open: boolean;
  alerts: AlertRecord[];
  groups: AlertGroup[];
  onClose: () => void;
  onUpdate: (id: string, update: Partial<AlertRecord>) => void;
  onOpenMessage: (uid: number) => void;
  onOpenSettings: () => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [escalatingId, setEscalatingId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [filter, setFilter] = useState<AlertFilter>("all");
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        drawerRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]):not([tabindex="-1"]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => element.getClientRects().length > 0);
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      returnFocusRef.current?.focus();
    };
  }, [onClose, open]);

  const visibleAlerts = useMemo(
    () => alerts.filter((alert) => filter === "all" || alert.unread),
    [alerts, filter],
  );
  const unreadCount = alerts.filter((alert) => alert.unread && alert.status === "active").length;

  function toggleAlert(alert: AlertRecord) {
    const nextExpanded = expandedId === alert.id ? null : alert.id;
    setExpandedId(nextExpanded);
    if (!nextExpanded) setEscalatingId(null);
    if (nextExpanded && alert.unread) onUpdate(alert.id, { unread: false });
  }

  function showEscalation(alert: AlertRecord) {
    if (escalatingId === alert.id) {
      setEscalatingId(null);
      return;
    }
    setEscalatingId(alert.id);
    setSelectedGroupId(alert.escalatedToGroupId && groups.some((group) => group.id === alert.escalatedToGroupId)
      ? alert.escalatedToGroupId
      : groups[0]?.id || "");
  }

  function escalateAlert(alert: AlertRecord) {
    if (!selectedGroupId) return;
    onUpdate(alert.id, {
      escalatedToGroupId: selectedGroupId,
      escalatedAt: new Date().toISOString(),
      unread: false,
    });
    setEscalatingId(null);
  }

  function openDestination(alert: AlertRecord) {
    if (alert.destination === "message" && alert.messageUid) {
      onOpenMessage(alert.messageUid);
    } else if (alert.destination === "settings") {
      onOpenSettings();
    } else {
      onClose();
    }
  }

  return (
    <div className={open ? "alerts-layer alerts-layer--open" : "alerts-layer"} aria-hidden={!open}>
      <button className="alerts-scrim" type="button" onClick={onClose} aria-label="Close alerts" tabIndex={open ? 0 : -1} />
      <aside ref={drawerRef} className="alerts-drawer" role="dialog" aria-modal="true" aria-labelledby="alerts-title">
        <header className="alerts-header">
          <div className="alerts-heading-icon"><BellRing size={20} /></div>
          <div><p className="eyebrow">ACTIVITY CENTER</p><h2 id="alerts-title">Alerts</h2><span>{unreadCount ? `${unreadCount} require attention` : "You’re all caught up"}</span></div>
          <button ref={closeButtonRef} className="alerts-close" type="button" onClick={onClose} aria-label="Close alerts panel"><X size={19} /></button>
        </header>

        <div className="alerts-toolbar">
          <div role="tablist" aria-label="Alert filters">
            <button type="button" role="tab" aria-selected={filter === "all"} className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>All <span>{alerts.length}</span></button>
            <button type="button" role="tab" aria-selected={filter === "unread"} className={filter === "unread" ? "active" : ""} onClick={() => setFilter("unread")}>Unread <span>{alerts.filter((alert) => alert.unread).length}</span></button>
          </div>
          <button type="button" className="mark-read-button" onClick={() => alerts.forEach((alert) => alert.unread && onUpdate(alert.id, { unread: false }))}><Check size={14} /> Mark all read</button>
        </div>

        <div className="alerts-table" aria-label="Workspace alerts">
          <div className="alerts-table-head" aria-hidden="true">
            <span>Alert</span><span>Source</span><span>Time</span>
          </div>
          <div className="alerts-table-body">
            {visibleAlerts.map((alert) => {
              const expanded = expandedId === alert.id;
              const detailId = `alert-detail-${alert.id}`;
              const escalatedGroup = groups.find((group) => group.id === alert.escalatedToGroupId);
              const escalationOpen = escalatingId === alert.id;
              return (
                <article className={`alert-entry alert-entry--${alert.severity}`} key={alert.id}>
                  <button className="alert-row" type="button" aria-expanded={expanded} aria-controls={detailId} onClick={() => toggleAlert(alert)}>
                    <span className="alert-main-cell"><span className="alert-severity-icon"><AlertIcon alert={alert} /></span><span><strong>{alert.title}</strong><small>{alert.summary}</small></span>{alert.unread ? <i className="alert-unread-dot" aria-label="Unread" /> : null}</span>
                    <span className="alert-source-cell">{alert.source}</span>
                    <span className="alert-time-cell">{alert.time}<ChevronDown size={15} /></span>
                  </button>
                  <div id={detailId} className={expanded ? "alert-detail alert-detail--open" : "alert-detail"} aria-hidden={!expanded}>
                    <div>
                      <p>{alert.detail}</p>
                      <dl><div><dt>Priority</dt><dd>{alert.severity}</dd></div><div><dt>Status</dt><dd>{alert.status}</dd></div><div><dt>Source</dt><dd>{alert.source}</dd></div></dl>
                      {escalatedGroup ? <div className={`alert-escalated-badge alert-group-color--${escalatedGroup.color}`}><UsersRound size={14} /><span>Escalated to <strong>{escalatedGroup.name}</strong></span></div> : null}
                      <div className="alert-actions">
                        <button className="primary-button" type="button" tabIndex={expanded ? 0 : -1} onClick={() => openDestination(alert)}><ExternalLink size={14} />{alert.destination === "message" ? "Open email" : alert.destination === "settings" ? "Review settings" : "Open inbox"}</button>
                        <button className="alert-escalate-button" type="button" tabIndex={expanded ? 0 : -1} aria-expanded={escalationOpen} onClick={() => showEscalation(alert)}><UsersRound size={14} />{escalatedGroup ? "Reassign" : "Escalate"}</button>
                        <button className="secondary-button" type="button" tabIndex={expanded ? 0 : -1} onClick={() => onUpdate(alert.id, { status: "resolved", unread: false })}><CheckCircle2 size={14} /> Resolve</button>
                        <button className="alert-snooze-button" type="button" tabIndex={expanded ? 0 : -1} onClick={() => onUpdate(alert.id, { status: "snoozed", unread: false })}><Clock3 size={14} /> Snooze</button>
                      </div>
                      {escalationOpen ? <div className="alert-escalation-form" role="group" aria-label={`Escalate ${alert.title}`}>
                        {groups.length ? <>
                          <label><span>Escalate to group</span><select value={selectedGroupId} onChange={(event) => setSelectedGroupId(event.target.value)}>{groups.map((group) => <option value={group.id} key={group.id}>{group.name} · {group.memberIds.length} members</option>)}</select></label>
                          <div><button type="button" className="secondary-button" onClick={() => setEscalatingId(null)}>Cancel</button><button type="button" className="primary-button" disabled={!selectedGroupId} onClick={() => escalateAlert(alert)}><UsersRound size={14} /> Confirm escalation</button></div>
                        </> : <p>No active escalation groups are available. An administrator can create one in the Admin Console.</p>}
                      </div> : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          {visibleAlerts.length === 0 ? <div className="alerts-empty"><CheckCircle2 size={24} /><strong>No unread alerts</strong><span>New alerts will appear here when something needs your attention.</span></div> : null}
        </div>

        <footer className="alerts-footer"><ShieldAlert size={15} /><span>Alert actions in this preview are local to your session.</span></footer>
      </aside>
    </div>
  );
}
