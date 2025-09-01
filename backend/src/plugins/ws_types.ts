// ws_types.ts
export type Incoming =
  | { type: "ping" }
  | { type: "subscribe"; chatId: number }
  | { type: "unsubscribe"; chatId: number }
  | { type: "typing"; chatId: number; isTyping: boolean }
  | { type: "send"; chatId: number; body: string };

export type Outgoing =
  | { type: "ready"; userId: number }
  | { type: "message"; chatId: number; message: any }
  | { type: "typing"; chatId: number; userId: number; isTyping: boolean; at: string }
  | { type: "error"; code: string; message: string }
  | { type: "pong"; at: string };
