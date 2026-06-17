// Shim mínimo de 'path' para kuromoji en el navegador/Worker.
// kuromoji solo usa path.join(dic_path, archivo) para construir la URL del diccionario.
// El path.join de Node colapsa "chrome-extension://" → "chrome-extension:/" (rompe la URL),
// así que aquí hacemos una unión URL-safe que preserva el "//".
export function join(...parts: string[]): string {
  return parts
    .filter((p) => p && p.length > 0)
    .map((p, i) => (i === 0 ? p.replace(/\/+$/, '') : p.replace(/^\/+|\/+$/g, '')))
    .join('/');
}

export default { join };
