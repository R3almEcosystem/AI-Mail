export type MailConnectionFailure = {
  code: string;
  status: number;
  message: string;
};

function errorText(error: unknown): string {
  if (error instanceof Error) {
    const cause = (error as Error & { cause?: unknown }).cause;
    return [error.name, error.message, cause instanceof Error ? cause.message : String(cause || "")].filter(Boolean).join(" ").toLowerCase();
  }
  return String(error || "").toLowerCase();
}

function errorCode(error: unknown): string {
  if (!error || typeof error !== "object") return "";
  const record = error as Record<string, unknown>;
  const nested = record.cause && typeof record.cause === "object" ? record.cause as Record<string, unknown> : null;
  return String(record.code || nested?.code || "").toUpperCase();
}

export function mailConnectionFailure(error: unknown, service: "imap" | "smtp"): MailConnectionFailure {
  const text = errorText(error);
  const code = errorCode(error);
  const protocol = service.toUpperCase();

  if (
    code === "AUTHENTICATIONFAILED"
    || code === "EAUTH"
    || /auth(?:entication)?\s*(?:failed|failure|rejected|invalid)|invalid credentials|login failed|credentials rejected|username and password not accepted/.test(text)
  ) {
    return {
      code: "MAIL_AUTH_REJECTED",
      status: 422,
      message: protocol + " authentication was rejected by the mail server. Verify the username and password; if the provider requires an app-specific password, use that password here.",
    };
  }

  if (
    code === "CERT_HAS_EXPIRED"
    || code === "DEPTH_ZERO_SELF_SIGNED_CERT"
    || code === "SELF_SIGNED_CERT_IN_CHAIN"
    || code === "ERR_TLS_CERT_ALTNAME_INVALID"
    || code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE"
    || /certificate|self[- ]signed|hostname.*does not match|tls.*handshake|ssl.*handshake/.test(text)
  ) {
    return {
      code: "MAIL_TLS_FAILED",
      status: 422,
      message: protocol + " reached the server, but the TLS certificate or secure handshake could not be verified. Check the mail host, TLS setting, and certificate for that hostname.",
    };
  }

  if (
    code === "ENOTFOUND"
    || code === "EAI_AGAIN"
    || /getaddrinfo|dns|host not found|name or service not known/.test(text)
  ) {
    return {
      code: "MAIL_HOST_NOT_FOUND",
      status: 422,
      message: "The mail host could not be resolved. Check the " + protocol + " hostname for spelling or DNS configuration.",
    };
  }

  if (
    code === "ECONNREFUSED"
    || /connection refused/.test(text)
  ) {
    return {
      code: "MAIL_CONNECTION_REFUSED",
      status: 422,
      message: "The mail server refused the " + protocol + " connection. Check the host, port, TLS mode, and whether that service is enabled on the server.",
    };
  }

  if (
    code === "ETIMEDOUT"
    || code === "ESOCKETTIMEDOUT"
    || /timed?\s*out|timeout/.test(text)
  ) {
    return {
      code: "MAIL_CONNECTION_TIMEOUT",
      status: 504,
      message: "The " + protocol + " server did not respond before the connection timed out. Check the host, port, firewall, and mail-server availability.",
    };
  }

  if (
    code === "ECONNRESET"
    || code === "EPIPE"
    || /connection reset|socket hang up|unexpected socket close/.test(text)
  ) {
    return {
      code: "MAIL_CONNECTION_RESET",
      status: 502,
      message: "The " + protocol + " connection was closed unexpectedly by the mail server. Check the port/TLS combination and server-side connection policy.",
    };
  }

  return {
    code: "MAIL_CONNECTION_FAILED",
    status: 502,
    message: "The " + protocol + " connection could not be verified. Check the account credentials, host, port, and TLS setting.",
  };
}

export function safeMailConnectionLog(error: unknown) {
  const record = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const cause = record.cause && typeof record.cause === "object" ? record.cause as Record<string, unknown> : {};
  return {
    name: error instanceof Error ? error.name : "UnknownError",
    code: String(record.code || cause.code || "").slice(0, 80),
    errno: String(record.errno || cause.errno || "").slice(0, 80),
    syscall: String(record.syscall || cause.syscall || "").slice(0, 80),
    responseStatus: String(record.responseStatus || "").slice(0, 80),
  };
}
