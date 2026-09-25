import { ShieldAlert, Shield } from "lucide-react";
import type { SecurityAssessment } from "../security/email-security";
import type { AttachmentInspection } from "../security/attachment-scan";
import styles from "./message-security-panel.module.css";

export function MessageSecurityPanel({ assessment, inspection, demo = false }: { assessment?: SecurityAssessment; inspection?: AttachmentInspection; demo?: boolean }) {
  const inspected = !demo && assessment !== undefined;
  const scan = demo ? undefined : inspection;
  const scanBlocked = scan?.status === "blocked" || (scan?.required && scan.status === "error");
  const highRisk = Boolean((inspected && assessment.disposition === "block") || scanBlocked);
  const review = inspected && assessment.disposition === "review";
  const title = demo ? "Demo message — no live inspection" : !inspected ? "Message inspection not available yet"
    : highRisk ? "Security review required" : review ? "Review this message carefully" : "No local rule matched";
  const scanLabel = !scan ? "Not inspected" : scan.status === "no_attachments" ? "No attachments"
    : scan.status === "not_scanned" ? "Not enabled" : scan.status === "clean" ? `Passed for ${scan.files.length} file(s)`
    : scan.status === "blocked" ? "Threat or unsupported content" : "Incomplete — access remains restricted";
  const findings = inspected ? assessment.findings.filter(finding => !(scan?.status === "clean" && finding.code === "attachment_unscanned")) : [];
  return (
    <section className={`${styles.panel} ${highRisk ? styles.highRisk : ""}`} aria-label="Email security" aria-live="polite">
      <div className={styles.heading}>
        {highRisk || review ? <ShieldAlert size={22} aria-hidden="true" /> : <Shield size={22} aria-hidden="true" />}
        <div><span className={styles.label}>EMAIL SECURITY · LOCAL RULES &amp; SCAN EVIDENCE</span><h2>{title}</h2></div>
      </div>
      <p>{highRisk ? "Do not open links or attachments until independently reviewed. This message has not been quarantined."
        : "Local indicators and file scans are not a guarantee of safety. Verify unexpected requests through a separate, trusted channel."}</p>
      {scan?.status === "error" ? <p role="status">Required attachment inspection did not complete. AI processing is withheld; reading this text does not release any attachment.</p> : null}
      {findings.length > 0 ? (
        <details open={highRisk}>
          <summary>{findings.length} security {findings.length === 1 ? "finding" : "findings"}</summary>
          <ul>{findings.map(finding => <li key={finding.code}><strong>{finding.severity === "block" ? "High risk" : "Review"}:</strong> {finding.message}</li>)}</ul>
        </details>
      ) : null}
      <dl className={styles.coverage}>
        <div><dt>Sender authentication</dt><dd>Not verified</dd></div>
        <div><dt>Attachment inspection</dt><dd>{scanLabel}</dd></div>
        <div><dt>Link reputation</dt><dd>Not checked</dd></div>
        <div><dt>Scanner provider</dt><dd>{scan?.provider || "Not active"}</dd></div>
      </dl>
    </section>
  );
}
