import { MfeEventType, MfeEventPayloads } from '@lyria-studio/shared-types';

type EventCallback<T extends MfeEventType> = (payload: MfeEventPayloads[T]) => void;


// To maintain architectural integrity without prop-drilling or tightly coupling separate repositories, LyriaStudio uses a lightweight CustomEvent pub/sub bus wrapped in TypeScript generics.
class GlobalEventBus {
  private target = new EventTarget();

  emit<T extends MfeEventType>(eventType: T, payload: MfeEventPayloads[T]): void {
    const customEvent = new CustomEvent(eventType, {
      detail: payload,
      bubbles: true,
      cancelable: true,
    });
    this.target.dispatchEvent(customEvent);
    console.debug(`[EventBus] Emitted: ${eventType}`, payload);
  }

  on<T extends MfeEventType>(eventType: T, callback: EventCallback<T>): () => void {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<MfeEventPayloads[T]>;
      callback(customEvent.detail);
    };

    this.target.addEventListener(eventType, handler);
    return () => this.target.removeEventListener(eventType, handler);
  }
}

// Singleton export shared across all federated modules via Vite shared config
export const eventBus = new GlobalEventBus();