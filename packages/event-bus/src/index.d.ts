import { MfeEventType, MfeEventPayloads } from '@lyria-studio/shared-types';
type EventCallback<T extends MfeEventType> = (payload: MfeEventPayloads[T]) => void;
declare class GlobalEventBus {
    private target;
    emit<T extends MfeEventType>(eventType: T, payload: MfeEventPayloads[T]): void;
    on<T extends MfeEventType>(eventType: T, callback: EventCallback<T>): () => void;
}
export declare const eventBus: GlobalEventBus;
export {};
