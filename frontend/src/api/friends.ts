// src/api/friends.ts

export type SearchHit = {
  id: number;
  email: string;
  pseudo: string;
  avatar_url: string | null;
  relation: "friend" | "outgoing_request" | "incoming_request" | "none";
  incoming_request_id?: number;
  outgoing_request_id?: number;
};

export type PublicUserRow = {
  id: number;
  email: string;
  pseudo: string;
  avatar_url: string | null;
};

export type FriendRequestRow = {
  id: number;
  from_user_id: number;
  to_user_id: number;
  status: string;
  created_at: string;
};

export async function getFriends(): Promise<PublicUserRow[]> {
  const res = await fetch("/api/friends", { credentials: "include" });
  if (!res.ok) throw new Error(`Friends failed (${res.status})`);
  const data = await res.json();
  return data.friends as PublicUserRow[];
}

export async function getRequestsReceived(): Promise<FriendRequestRow[]> {
  const res = await fetch("/api/friends/requests/received", { credentials: "include" });
  if (!res.ok) throw new Error(`Requests(received) failed (${res.status})`);
  const data = await res.json();
  return data.friendRequests;
}

export async function getRequestsSent(): Promise<FriendRequestRow[]> {
  const res = await fetch("/api/friends/requests/sent", { credentials: "include" });
  if (!res.ok) throw new Error(`Requests(sent) failed (${res.status})`);
  const data = await res.json();
  return data.friendRequests;
}

export async function getPublicUser(id: number): Promise<PublicUserRow> {
  const res = await fetch(`/api/users/${id}`, { credentials: "include" });
  if (!res.ok) throw new Error(`User ${id} failed (${res.status})`);
  return res.json() as Promise<PublicUserRow>;
}

export async function searchUsers(q: string, limit = 8): Promise<SearchHit[]> {
  const url = `/api/users/search?q=${encodeURIComponent(q)}&limit=${limit}`;
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  const data = await res.json();
  return data.users as SearchHit[];
}

// --- Friend actions mapped to your controllers ---

// Send a request (or show error if one exists)
export async function sendFriendRequest(toUserId: number) {
  const res = await fetch(`/api/friends/requests`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to_user_id: toUserId }),
  });
  if (!res.ok) throw new Error(`Friend request failed (${res.status})`);
  return res.json(); // { id }
}

// Accept incoming request by requestId
export async function acceptFriendRequest(requestId: number) {
  const res = await fetch(`/api/friends/requests/${requestId}`, {
    method: "PUT",
    credentials: "include",
  });
  if (!res.ok) throw new Error(`Accept failed (${res.status})`);
  return res.json(); // { success: true }
}

// Decline/cancel request by requestId
export async function declineFriendRequest(requestId: number) {
  const res = await fetch(`/api/friends/requests/${requestId}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error(`Decline failed (${res.status})`);
  return res.json(); // { success: true }
}

// Unfriend a user
export async function unfriend(userId: number) {
  const res = await fetch(`/api/friends/${userId}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error(`Unfriend failed (${res.status})`);
  return res.json(); // { success: true }
}
