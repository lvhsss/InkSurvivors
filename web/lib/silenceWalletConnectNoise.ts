// On websocket close, `@walletconnect/core`'s `onProviderErrorHandler` emits an
// `error` event with an empty `{}` payload. Pino's browser logger then forwards
// that payload to `console.error`, which Next.js's dev overlay surfaces as a
// red error toast. The payload carries no actionable signal — disconnect/close
// is already handled by the provider's normal lifecycle — so suppress only
// that specific noise without masking real WalletConnect errors.

const PINO_META_KEYS = new Set([
  "time",
  "level",
  "context",
  "name",
  "msg",
  "v",
  "pid",
  "hostname",
]);

let installed = false;

export function silenceWalletConnectNoise(): void {
  if (installed) return;
  if (typeof window === "undefined") return;
  installed = true;

  const originalError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    if (isEmptyWcLogPayload(args) && isFromWalletConnect()) return;
    originalError(...args);
  };
}

function isEmptyWcLogPayload(args: unknown[]): boolean {
  if (args.length === 0) return false;
  return args.every((arg) => {
    if (arg == null) return true;
    if (typeof arg === "string") return arg.trim().length === 0;
    if (typeof arg !== "object" || Array.isArray(arg)) return false;
    const record = arg as Record<string, unknown>;
    const meaningful = Object.keys(record).filter(
      (k) => !PINO_META_KEYS.has(k),
    );
    if (meaningful.length > 0) return false;
    const msg = record.msg;
    return msg == null || (typeof msg === "string" && msg.trim().length === 0);
  });
}

function isFromWalletConnect(): boolean {
  const stack = new Error().stack ?? "";
  return /@?walletconnect|pino\/browser/.test(stack);
}
