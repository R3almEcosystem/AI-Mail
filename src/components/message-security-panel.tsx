import { ShieldAlert, Shield } from "lucide-react";
import type { SecurityAssessment } from "../security/email-security";
import styles from "./message-security-panel.module.css";

export function MessageSecurityPanel({ assessment, demo = false }: { assessment?: SecurityAssessment; demo?: boolean }) {
  const inspected = !demo && assessment !== undefined;
  const highRisk = inspected && assessment.disposition === "block";
  const review = inspected && assessment.disposition === "review";
  const title = demo ? "Demo message — no live inspection" : !inspected ? "Message inspection not available yet"
    : highRisk ? "High-risk indicators detected" : review ? "Review this message carefully" : "No local rule matched";
  return (
    <section className={`${styles.panel} ${highRisk ? styles.highRisk : ""}`} aria-label="Email security" aria-live="polite">
      <div className={styles.heading}>
        {highRisk || review ? <ShieldAlert size={22} aria-hidden="true" /> : <Shield size={22} aria-hidden="true" />}
        <div><span className={styles.label}>EMAIL SECURITY · LOCAL RULES</span><h2>{title}</h2></div>
      </div>
      <p>{highRisk ? "Do not open links or attachments until independently reviewed. This message has not been quarantined."
        : "Local indicators are not a guarantee of safety. Verify unexpected requests through a separate, trusted channel."}</p>
      {inspected && assessment.findings.length > 0 ? (
        <details open={highRisk}>
          <summary>{assessment.findings.length} security {assessment.findings.length === 1 ? "finding" : "findings"}</summary>
          <ul>{assessment.findings.map(finding => <li key={finding.code}><strong>{finding.severity === "block" ? "High risk" : "Review"}:</strong> {finding.message}</li>)}</ul>
        </details>
      ) : null}
      <dl className={styles.coverage}>
        <div><dt>Sender authentication</dt><dd>Not verified</dd></div>
        <div><dt>Malware scanning</dt><dd>Not scanned</dd></div>
        <div><dt>Link reputation</dt><dd>Not checked</dd></div>
        <div><dt>Attachment contents</dt><dd>Not scanned</dd></div>
      </dl>
    </section>
  );
}
