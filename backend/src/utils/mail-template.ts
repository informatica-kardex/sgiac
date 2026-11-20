const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char]!));

const lines = (value: string) => escapeHtml(value).replace(/\r\n|\r|\n/g, "<br>");
const paragraph = (value: string) => `<p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#475569">${lines(value)}</p>`;

// Tablas y estilos en línea: el contenido sigue siendo legible sin imágenes ni CSS externo.
function academicMailLayout(input: { title: string; preheader: string; category: string; body: string }) {
  return `<!doctype html>
<html lang="es" xmlns:o="urn:schemas-microsoft-com:office:office"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="format-detection" content="telephone=no,date=no,address=no,email=no">
<title>${escapeHtml(input.title)}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<style>
  table { border-collapse:collapse; mso-table-lspace:0pt; mso-table-rspace:0pt; }
  @media only screen and (max-width:600px) {
    .mail-outer { padding:16px 8px !important; }
    .mail-padding { padding:24px 20px !important; }
    .mail-title { font-size:25px !important; }
    .mail-detail-label, .mail-detail-value { display:block !important; width:auto !important; }
    .mail-detail-label { padding:14px 16px 4px !important; border-bottom:0 !important; }
    .mail-detail-value { padding:0 16px 14px !important; }
  }
</style></head>
<body style="margin:0;padding:0;width:100%;background-color:#edf1f7;font-family:Arial,Helvetica,sans-serif;color:#172554;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%">
<div aria-hidden="true" style="display:none!important;visibility:hidden;max-height:0;max-width:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;mso-hide:all">${escapeHtml(input.preheader)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#edf1f7"><tr><td class="mail-outer" align="center" style="padding:40px 16px">
<!--[if mso]><table role="presentation" width="600" align="center" cellspacing="0" cellpadding="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#ffffff" style="width:100%;max-width:600px;table-layout:fixed;border:1px solid #dde4ef;border-collapse:separate;border-spacing:0;border-radius:16px;overflow:hidden">
  <tr><td class="mail-padding" bgcolor="#172554" style="padding:30px 36px;background-color:#172554;border-bottom:4px solid #d4a84b;border-radius:15px 15px 0 0">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
      <td style="color:#ffffff;font-size:28px;font-weight:700;letter-spacing:4px;line-height:1.2">SGIAC</td>
      <td align="right" style="color:#ecd39d;font-size:11px;font-weight:700;letter-spacing:2px">KARDEX</td>
    </tr></table>
    <p style="margin:12px 0 0;color:#c9d5ee;font-size:12px;line-height:1.6;letter-spacing:1px">SERVICIOS ACADÉMICOS</p>
  </td></tr>
  <tr><td class="mail-padding" style="padding:32px 36px;overflow-wrap:anywhere;word-wrap:break-word">
    <p style="margin:0 0 12px;color:#64748b;font-size:11px;font-weight:700;line-height:1.6;letter-spacing:1.6px">${escapeHtml(input.category.toUpperCase())}</p>
    <h1 class="mail-title" style="margin:0 0 24px;color:#172554;font-size:28px;font-weight:700;line-height:1.25">${escapeHtml(input.title)}</h1>
    ${input.body}
  </td></tr>
  <tr><td class="mail-padding" bgcolor="#f8fafc" style="padding:22px 36px;background-color:#f8fafc;border-top:1px solid #e2e8f0;border-radius:0 0 15px 15px">
    <p style="margin:0 0 5px;color:#475569;font-size:12px;font-weight:700;line-height:1.6">SGIAC · Servicios académicos · Kardex</p>
    <p style="margin:0;color:#64748b;font-size:12px;line-height:1.7">Mensaje automático. Consulta tus servicios y avisos en el sistema.</p>
  </td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
<p style="margin:18px 12px 0;color:#64748b;font-size:11px;line-height:1.6">Carrera de Informática · Información para tu comunidad universitaria</p>
</td></tr></table></body></html>`;
}

function notice(title: string, text: string) {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:22px"><tr><td bgcolor="#fffbeb" style="padding:16px 18px;background-color:#fffbeb;border-left:3px solid #d4a84b">
    <p style="margin:0 0 6px;color:#784b0d;font-size:13px;font-weight:700;line-height:1.5">${escapeHtml(title)}</p>
    <p style="margin:0;color:#665333;font-size:13px;line-height:1.7">${lines(text)}</p>
  </td></tr></table>`;
}

function actionButton(action?: { label: string; url: string }) {
  if (!action) return "";
  // Una URL de configuración inválida no debe impedir que se envíe el aviso.
  let url: URL;
  try { url = new URL(action.url); } catch { return ""; }
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return "";
  const href = escapeHtml(url.href);
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top:24px"><tr><td align="center" bgcolor="#172554" style="background-color:#172554;border-radius:8px;mso-padding-alt:14px 24px">
    <a href="${href}" style="display:inline-block;padding:14px 24px;border:1px solid #172554;border-radius:8px;color:#ffffff;font-size:14px;font-weight:700;line-height:1.5;text-decoration:none">${escapeHtml(action.label)} &rarr;</a>
  </td></tr></table>
  <p style="margin:14px 0 0;color:#64748b;font-size:11px;line-height:1.7">Si el botón no abre, copia este enlace en tu navegador:<br><a href="${href}" style="color:#315c95;word-break:break-all;text-decoration:underline">${href}</a></p>`;
}

export function academicNoticeHtml(input: {
  title: string; category: string; description: string; name?: string;
  status: string; tone: "info" | "success" | "warning";
  highlight: { label: string; value: string; caption?: string };
  details: { label: string; value: string }[];
  note?: { title: string; text: string };
  instructions: string;
  action?: { label: string; url: string };
}) {
  const palette = {
    info: { background: "#eff6ff", border: "#bfdbfe", ink: "#1e40af" },
    success: { background: "#ecfdf5", border: "#a7f3d0", ink: "#16654d" },
    warning: { background: "#fffbeb", border: "#fde68a", ink: "#854d0e" },
  }[input.tone];
  const details = input.details.map(({ label, value }, index) => {
    const border = index < input.details.length - 1 ? "border-bottom:1px solid #e2e8f0;" : "";
    return `<tr><th scope="row" class="mail-detail-label" width="38%" align="left" valign="top" style="width:38%;padding:14px 16px;font-size:12px;font-weight:400;line-height:1.6;color:#64748b;${border}">${escapeHtml(label)}</th>
      <td class="mail-detail-value" valign="top" style="padding:14px 16px;font-size:14px;font-weight:700;line-height:1.6;color:#334155;overflow-wrap:anywhere;${border}">${lines(value)}</td></tr>`;
  }).join("");
  return academicMailLayout({ title: input.title, category: input.category, preheader: input.description,
    body: `${input.name ? paragraph(`Hola, ${input.name}.`) : ""}${paragraph(input.description)}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:separate;border-spacing:0"><tr><td bgcolor="${palette.background}" style="padding:22px;background-color:${palette.background};border:1px solid ${palette.border};border-radius:10px">
      <p style="margin:0 0 18px;color:${palette.ink};font-size:12px;font-weight:700;line-height:1.5">&#9679; ${escapeHtml(input.status)}</p>
      <p style="margin:0 0 6px;color:#475569;font-size:11px;font-weight:700;line-height:1.5;letter-spacing:1px">${escapeHtml(input.highlight.label.toUpperCase())}</p>
      <p style="margin:0;color:${palette.ink};font-size:24px;font-weight:700;line-height:1.35;overflow-wrap:anywhere;word-break:break-word">${escapeHtml(input.highlight.value)}</p>
      ${input.highlight.caption ? `<p style="margin:10px 0 0;color:#475569;font-size:13px;line-height:1.6">${lines(input.highlight.caption)}</p>` : ""}
    </td></tr></table>
    <table aria-label="Detalles del aviso" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:20px;table-layout:fixed;background-color:#f8fafc;border:1px solid #e2e8f0">${details}</table>
    ${input.note ? notice(input.note.title, input.note.text) : ""}
    <p style="margin:24px 0 0;color:#475569;font-size:14px;line-height:1.7">${lines(input.instructions)}</p>
    ${actionButton(input.action)}`,
  });
}

export function academicCodeMail(input: { title: string; description: string; code: string; minutes: number; name?: string }) {
  const greeting = input.name ? `Hola, ${input.name}.` : "Hola, comunidad universitaria.";
  const note = "Este código es personal y de un solo uso. No lo compartas. Si no solicitaste esta acción, puedes ignorar este correo.";
  return {
    text: `${greeting}\n\n${input.title}\n${input.description}\n\nTu código es: ${input.code}\nVence en ${input.minutes} minutos.\n\n${note}\n\nSGIAC · Servicios académicos · Kardex`,
    html: academicMailLayout({ title: input.title, category: "Seguridad de tu cuenta",
      preheader: `${input.title}. Tu código vence en ${input.minutes} minutos.`,
      body: `${paragraph(greeting)}${paragraph(input.description)}
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:separate;border-spacing:0"><tr><td align="center" bgcolor="#eff6ff" style="padding:24px 12px;background-color:#eff6ff;border:1px solid #bfdbfe;border-radius:10px">
        <p style="margin:0 0 12px;color:#475569;font-size:11px;font-weight:700;line-height:1.5;letter-spacing:1.4px">TU CÓDIGO DE VERIFICACIÓN</p>
        <p style="margin:0;color:#1e3a8a;font-family:Consolas,'Courier New',monospace;font-size:36px;font-weight:700;letter-spacing:6px;line-height:1.5">${escapeHtml(input.code)}</p>
        <p style="margin:12px 0 0;color:#475569;font-size:13px;line-height:1.6">Válido durante <strong>${input.minutes} minutos</strong></p>
      </td></tr></table>
      <p style="margin:24px 0 0;color:#475569;font-size:14px;line-height:1.7">Regresa a la pantalla del sistema e ingresa este código para continuar.</p>
      ${notice("Cuida tu cuenta", note)}`,
    }),
  };
}
