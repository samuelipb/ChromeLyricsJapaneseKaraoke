// fetch JSON con timeout (AbortController) para que una fuente lenta no bloquee la
// cadena de proveedores. Degrada a null ante error/timeout/red. Ver rules/lyrics-providers.md.
export async function fetchJson(url: string, init?: RequestInit, timeoutMs = 6000): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null; // timeout / red caída / JSON inválido → degradación elegante
  } finally {
    clearTimeout(timer);
  }
}
