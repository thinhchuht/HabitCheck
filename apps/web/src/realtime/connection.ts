import {
  HubConnection,
  HubConnectionBuilder,
  LogLevel,
} from "@microsoft/signalr";
import { HUB_URL } from "@/lib/constants";
import { useAuthStore } from "@/store/auth";

/** All server -> client events for the group (contract §4). */
export type RealtimeEvent =
  | "CheckInCreated"
  | "CheckOutCompleted"
  | "SessionStarted"
  | "ProofRejected"
  | "DailyResultUpdated"
  | "MemberPresence"
  | "ProfileUpdated";

type Handler = (payload: unknown) => void;

const REALTIME_EVENTS: RealtimeEvent[] = [
  "CheckInCreated",
  "CheckOutCompleted",
  "SessionStarted",
  "ProofRejected",
  "DailyResultUpdated",
  "MemberPresence",
  "ProfileUpdated",
];

const handlers: Record<RealtimeEvent, Set<Handler>> = {
  CheckInCreated: new Set(),
  CheckOutCompleted: new Set(),
  SessionStarted: new Set(),
  ProofRejected: new Set(),
  DailyResultUpdated: new Set(),
  MemberPresence: new Set(),
  ProfileUpdated: new Set(),
};

const connectionSubscribers = new Set<() => void>();
let connection: HubConnection | null = null;
let connectionToken: string | null = null;
let startPromise: Promise<HubConnection> | null = null;

function emitConnectionChange(): void {
  connectionSubscribers.forEach((cb) => cb());
}

/** Subscribe to a server event. Returns an unsubscribe function. */
export function onRealtimeEvent<T>(
  event: RealtimeEvent,
  handler: (payload: T) => void,
): () => void {
  const h: Handler = (payload) => handler(payload as T);
  handlers[event].add(h);
  return () => {
    handlers[event].delete(h);
  };
}

/** Subscribe to connection state changes (open / reconnect / close). */
export function onConnectionChange(cb: () => void): () => void {
  connectionSubscribers.add(cb);
  return () => {
    connectionSubscribers.delete(cb);
  };
}

export function getRealtimeConnection(): HubConnection | null {
  return connection;
}

/**
 * Start (or return the existing) hub connection.
 * Rebuilds the connection when the access token changed (JWT expires after 15 min).
 */
export async function startRealtime(): Promise<HubConnection> {
  const token = useAuthStore.getState().accessToken;
  if (!token) throw new Error("Chưa đăng nhập");

  if (
    connection &&
    connectionToken === token &&
    (connection.state === "Connected" || connection.state === "Connecting")
  ) {
    return connection;
  }
  if (startPromise) return startPromise;

  startPromise = (async () => {
    const previous = connection;
    connection = null;
    if (previous) {
      try {
        await previous.stop();
      } catch {
        // ignore stop errors
      }
    }

    const conn = new HubConnectionBuilder()
      .withUrl(`${HUB_URL}?access_token=${encodeURIComponent(token)}`)
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();

    for (const event of REALTIME_EVENTS) {
      conn.on(event, (payload: unknown) => {
        handlers[event].forEach((h) => h(payload));
      });
    }
    conn.onreconnected(() => emitConnectionChange());
    conn.onclose(() => {
      emitConnectionChange();
      // If our JWT was refreshed while disconnected, restart with the new token.
      const current = useAuthStore.getState().accessToken;
      if (current && current !== connectionToken && connection === conn) {
        void startRealtime().catch(() => undefined);
      }
    });

    connection = conn;
    connectionToken = token;
    await conn.start();
    emitConnectionChange();
    return conn;
  })();

  try {
    return await startPromise;
  } finally {
    startPromise = null;
  }
}

/** Call a hub method (JoinGroup / LeaveGroup). Best-effort: never throws. */
export async function invokeHub(
  method: string,
  ...args: unknown[]
): Promise<unknown> {
  const conn = connection;
  if (!conn || conn.state !== "Connected") return undefined;
  try {
    return await conn.invoke(method, ...args);
  } catch (err) {
    console.warn(`[realtime] invoke ${method} thất bại`, err);
    return undefined;
  }
}

/** Stop the hub connection (logout). */
export async function stopRealtime(): Promise<void> {
  const conn = connection;
  connection = null;
  connectionToken = null;
  if (conn) {
    try {
      await conn.stop();
    } catch {
      // ignore
    }
  }
}
