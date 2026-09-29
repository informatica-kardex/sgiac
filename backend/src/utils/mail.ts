import { ApiError } from "./apiError";
import nodemailer from "nodemailer";
import tls from "node:tls";

interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

// Mailtrap Sandbox admite API o SMTP; SMTP tambien permite proveedores de envio real.
export async function sendMail(message: MailMessage): Promise<void> {
  const provider = process.env.MAIL_PROVIDER || "resend";
  const from = provider === "mailtrap-sending"
    ? process.env.MAILTRAP_SENDING_FROM
    : process.env.MAIL_FROM || process.env.LOGIN_MAIL_FROM;
  const configurationError = () => new ApiError(
    503, "El envio de correos no esta configurado. Contacta al administrador."
  );
  if (!from) throw configurationError();

  if (provider === "smtp") {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || "587");
    const user = process.env.SMTP_USERNAME;
    const pass = process.env.SMTP_PASSWORD;
    const encryption = process.env.SMTP_ENCRYPTION || "tls";
    if (!host || !user || !pass || !Number.isInteger(port) || port < 1 || port > 65535 ||
        (encryption !== "tls" && encryption !== "ssl")) throw configurationError();

    try {
      // Node reciente permite usar la confianza del sistema (p. ej. Windows)
      // junto a sus CA predeterminadas y NODE_EXTRA_CA_CERTS. Nunca omitir TLS.
      const getCACertificates = (tls as typeof tls & {
        getCACertificates?: (type: "default" | "system") => string[];
      }).getCACertificates;
      const ca = getCACertificates
        ? [...new Set([...getCACertificates("default"), ...getCACertificates("system")])]
        : undefined;
      const transport = nodemailer.createTransport({
        host, port,
        secure: encryption === "ssl",
        requireTLS: encryption === "tls",
        auth: { user, pass },
        tls: { ca, rejectUnauthorized: true },
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 10_000,
        dnsTimeout: 10_000,
      });
      await transport.sendMail({ from, ...message });
    } catch {
      throw new ApiError(503, "No se pudo enviar el correo. Intenta nuevamente mas tarde.");
    }
    return;
  }

  let url: string;
  let apiKey: string;
  let body: object;
  if (provider === "mailtrap-sending") {
    const token = process.env.MAILTRAP_SENDING_TOKEN;
    if (!token) throw configurationError();
    const sender = /^(.*?)\s*<([^<>]+)>$/.exec(from.trim());
    url = "https://send.api.mailtrap.io/api/send";
    apiKey = token;
    body = {
      from: sender ? { email: sender[2], name: sender[1].trim() } : { email: from.trim() },
      to: [{ email: message.to }], subject: message.subject, text: message.text, html: message.html,
    };
  } else if (provider === "mailtrap") {
    const inboxId = process.env.MAILTRAP_INBOX_ID;
    const token = process.env.MAILTRAP_API_TOKEN;
    if (!token || !inboxId || !/^[1-9]\d*$/.test(inboxId)) throw configurationError();
    const sender = /^(.*?)\s*<([^<>]+)>$/.exec(from.trim());
    url = `https://sandbox.api.mailtrap.io/api/send/${inboxId}`;
    apiKey = token;
    body = {
      from: sender ? { email: sender[2], name: sender[1].trim() } : { email: from.trim() },
      to: [{ email: message.to }], subject: message.subject, text: message.text, html: message.html,
    };
  } else if (provider === "resend") {
    if (!process.env.RESEND_API_KEY) throw configurationError();
    url = "https://api.resend.com/emails";
    apiKey = process.env.RESEND_API_KEY;
    body = { from, to: [message.to], subject: message.subject, text: message.text, html: message.html };
  } else {
    throw configurationError();
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error("Email delivery failed");
  } catch {
    throw new ApiError(503, "No se pudo enviar el correo. Intenta nuevamente mas tarde.");
  }
}
