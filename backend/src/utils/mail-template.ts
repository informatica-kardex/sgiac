const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char]!));

export function academicCodeMail(input: { title: string; description: string; code: string; minutes: number; name?: string }) {
  const greeting = input.name ? `Hola, ${input.name}.` : "Hola, comunidad universitaria.";
  const note = "Este código es personal y de un solo uso. No lo compartas. Si no solicitaste esta acción, puedes ignorar este correo.";
  return {
    text: `${greeting}\n\n${input.title}\n${input.description}\n\nTu código es: ${input.code}\nVence en ${input.minutes} minutos.\n\n${note}\n\nSGIAC · Servicios académicos · Kardex`,
    html: `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(input.title)}</title></head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:Arial,Helvetica,sans-serif;color:#1e293b">
<div style="display:none;max-height:0;overflow:hidden">${escapeHtml(input.title)}. Tu código vence en ${input.minutes} minutos.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef2f7"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:580px;background:#ffffff;border-radius:18px;overflow:hidden">
<tr><td style="padding:28px 32px;background:#172554;border-bottom:5px solid #d4a84b;color:#ffffff"><div style="font-size:25px;font-weight:800;letter-spacing:3px">SGIAC</div><div style="margin-top:8px;font-size:13px;color:#dbeafe">SERVICIOS ACADÉMICOS &nbsp; / &nbsp; KARDEX</div></td></tr>
<tr><td style="padding:32px"><p style="margin:0 0 16px;font-size:15px">${escapeHtml(greeting)}</p><h1 style="font-size:25px;line-height:1.3;margin:0 0 16px;color:#172554">${escapeHtml(input.title)}</h1><p style="font-size:16px;line-height:1.7;margin:0 0 24px;color:#475569">${escapeHtml(input.description)}</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px"><tr><td align="center" style="padding:24px 8px"><div style="font-size:11px;font-weight:700;letter-spacing:2px;color:#475569">TU CÓDIGO DE VERIFICACIÓN</div><div style="font-family:Consolas,monospace;font-size:36px;font-weight:700;letter-spacing:6px;line-height:1.8;color:#1e3a8a">${escapeHtml(input.code)}</div><div style="font-size:13px;color:#475569">Válido durante <strong>${input.minutes} minutos</strong></div></td></tr></table>
<p style="font-size:14px;line-height:1.7;margin:24px 0 0">Regresa a la pantalla del sistema e ingresa este código para continuar.</p><p style="font-size:12px;line-height:1.7;color:#64748b;margin:16px 0 0">${note}</p></td></tr>
<tr><td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.7;color:#64748b">Tu acceso seguro a los servicios universitarios.<br>Mensaje automático de SGIAC · Kardex</td></tr></table>
</td></tr></table></body></html>`,
  };
}
