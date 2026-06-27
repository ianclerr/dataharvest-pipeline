import { EventEmitter } from "events";

class SseEmitter extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(0); 
  }

  emitBook(book: unknown) {
    this.emit("event", { type: "book:upserted", data: book, timestamp: new Date().toISOString() });
  }

  emitStory(story: unknown) {
    this.emit("event", { type: "story:upserted", data: story, timestamp: new Date().toISOString() });
  }
}

export const sseEmitter = new SseEmitter();