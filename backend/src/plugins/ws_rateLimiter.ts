// ws_rateLimiter.ts
import type { WebSocket } from "@fastify/websocket";

/**
 * - `count`: Number of allowed events in this window
 * - `resetAt`: Epoch milliseconds when this window resets
 */
type Bucket = {
  count: number;
  resetAt: number;
};

/**
 * Simple token-bucket rate limiter keyed by Websocket:
 * - Each socket has its own bucket
 * - Bucket resets after `windowMs`
 * - Each allowed event increments `count`
 * - Once `count` exceeds `limit`, allow() returns false until reset
 */
export class RateLimiter {
  constructor(private limit: number, private windowMs: number) {}

  /**
   * Mapping between a WebSocket and current bucket state
   */
  private buckets = new WeakMap<WebSocket, Bucket>();

  /**
   * Attempt to allow an action for this socket.
   * Returns true if allowed, false if rate limit exceeded
   */
  allow(ws: WebSocket) {
    const now = Date.now();
    let bucket = this.buckets.get(ws);

    // First event or window exprired -> reset bucket
    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + this.windowMs };
      this.buckets.set(ws, bucket);
    }

    // Actions limit exceeded -> reject
    if (bucket.count >= this.limit) return false;

    // Otherwise, increment and allow
    bucket.count++;
    return true;
  }
}
