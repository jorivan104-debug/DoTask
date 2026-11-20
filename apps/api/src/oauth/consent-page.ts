const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const SCOPE_TEXT: Record<string, string> = {
  'tasks:read': 'Ver tus espacios de trabajo, listas, tareas y comentarios',
  'tasks:write':
    'Crear proyectos, listas y tareas, y editar o completar tareas (pasos, Mi día, fechas, vínculos) en tus espacios de trabajo. Nunca borra nada',
};

const layout = (title: string, body: string) => `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} — DoTask</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,-apple-system,sans-serif;background:#f9fafb;color:#111827}
  main{width:100%;max-width:420px;margin:24px;padding:32px;background:#fff;border-radius:16px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
  h1{font-size:20px;margin:0 0 8px} p{color:#4b5563;line-height:1.6;margin:0 0 16px}
  ul{padding-left:20px;color:#374151;line-height:1.6;margin:0 0 16px} .who{font-size:13px;color:#6b7280}
  .actions{display:flex;gap:8px;margin-top:24px} button{flex:1;padding:10px 16px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;border:1px solid #d1d5db;background:#fff;color:#374151}
  button.primary{background:#2563eb;border-color:#2563eb;color:#fff}
</style>
</head>
<body><main>${body}</main></body>
</html>`;

export function renderConsentPage(params: {
  clientName: string;
  userEmail: string;
  scope: string;
  ticket: string;
}): string {
  const scopes = params.scope
    .split(' ')
    .map((s) => `<li>${escapeHtml(SCOPE_TEXT[s] ?? s)}</li>`)
    .join('');
  return layout(
    'Autorizar acceso',
    `<h1>${escapeHtml(params.clientName)} quiere acceder a tu DoTask</h1>
<p>Si lo permites, podrá:</p>
<ul>${scopes}</ul>
<p class="who">Has iniciado sesión como ${escapeHtml(params.userEmail)}. Puedes retirar el acceso desconectando el conector en ${escapeHtml(params.clientName)}.</p>
<form method="post" action="/oauth/authorize/decision">
  <input type="hidden" name="ticket" value="${escapeHtml(params.ticket)}">
  <div class="actions">
    <button type="submit" name="decision" value="deny">Cancelar</button>
    <button type="submit" name="decision" value="allow" class="primary">Permitir</button>
  </div>
</form>`,
  );
}

export function renderErrorPage(message: string): string {
  return layout(
    'No se pudo autorizar',
    `<h1>No se pudo autorizar</h1><p>${escapeHtml(message)}</p>`,
  );
}
