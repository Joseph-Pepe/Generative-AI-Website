import { MfeEventType, MfeEventPayloads } from '@lyria-studio/shared-types';

export type EventCallback<T extends MfeEventType> = (payload: Readonly<MfeEventPayloads[T]>) => void;

const GLOBAL_BUS_KEY = '__LYRIA_STUDIO_EVENT_BUS__' as const;

/**
 * To maintain architectural integrity without prop-drilling or tightly coupling separate repositories, LyriaStudio uses a lightweight CustomEvent pub/sub bus wrapped in TypeScript generics.
 * Browser-wide CustomEvent pub/sub bus anchored to globalThis.
 * Guarantees a single zero-copy EventTarget across all Module Federation remotes and protects payloads with Object.freeze() to prevent cross-MFE state mutation.
 */

export class GlobalEventBus {
  private readonly target = new EventTarget();
  private readonly isDev: boolean;

  constructor() {
    const metaEnv = (import.meta as unknown as { env?: { DEV?: boolean } }).env;
    this.isDev = Boolean(metaEnv?.DEV);
  }

  emit<T extends MfeEventType>(eventType: T, payload: MfeEventPayloads[T]): void {
    const frozenPayload = Object.freeze({ ...payload });
    const customEvent = new CustomEvent(eventType, {
      detail: frozenPayload,
    });
    this.target.dispatchEvent(customEvent);

    if (this.isDev) {
      console.debug(`[EventBus] Emitted: ${eventType}`, frozenPayload);
    }
  }

  on<T extends MfeEventType>(eventType: T, callback: EventCallback<T>): () => void {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<Readonly<MfeEventPayloads[T]>>;
      callback(customEvent.detail);
    };

    this.target.addEventListener(eventType, handler);
    return () => this.target.removeEventListener(eventType, handler);
  }
}

// Singleton export shared across all federated modules via Vite shared config
const globalScope = globalThis as unknown as Record<string, GlobalEventBus | undefined>;
export const eventBus: GlobalEventBus =
  globalScope[GLOBAL_BUS_KEY] ?? (globalScope[GLOBAL_BUS_KEY] = new GlobalEventBus());