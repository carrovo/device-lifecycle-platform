export function createClientId(...parts) {
  const suffix = globalThis.crypto?.randomUUID?.()
    || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return [...parts.filter(Boolean), suffix].join('-');
}
