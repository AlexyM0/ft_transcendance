// src/store/friends.ts
import { createStore } from "./createStore";
import { FriendsAPI } from "../api/friends";
import type { PublicUser, FriendRequest } from "../api/types";

export type FriendsState = {
  loading: boolean;
  friends: PublicUser[];
  requestsLoading: boolean;
  requests: FriendRequest[];
  error: string | null;
};

export const friends = createStore<FriendsState>({
  loading: false,
  friends: [],
  requestsLoading: false,
  requests: [],
  error: null,
});

export async function loadFriends() {
  friends.set((s) => ({ ...s, loading: true, error: null }));
  try {
    const res = await FriendsAPI.listFriends();
    friends.set((s) => ({ ...s, friends: res.friends, loading: false }));
  } catch (e: any) {
    friends.set((s) => ({ ...s, loading: false, error: e?.message ?? "Failed to load friends" }));
  }
}

export async function loadFriendRequests() {
  friends.set((s) => ({ ...s, requestsLoading: true, error: null }));
  try {
    const res = await FriendsAPI.listFriendRequests();
    friends.set((s) => ({ ...s, requests: res.friendRequests, requestsLoading: false }));
  } catch (e: any) {
    friends.set((s) => ({ ...s, requestsLoading: false, error: e?.message ?? "Failed to load requests" }));
  }
}

export async function sendFriendRequest(toUserId: number) {
  await FriendsAPI.sendRequest(toUserId);
  await Promise.allSettled([loadFriends(), loadFriendRequests()]);
}

export async function acceptFriendRequest(requestId: number) {
  friends.set((s) => ({ ...s, requests: s.requests.filter((r) => r.id !== requestId) }));
  try {
    await FriendsAPI.acceptRequest(requestId);
    await loadFriends();
  } catch (e: any) {
    await loadFriendRequests();
    throw e;
  }
}

export async function declineFriendRequest(requestId: number) {
  friends.set((s) => ({ ...s, requests: s.requests.filter((r) => r.id !== requestId) }));
  try {
    await FriendsAPI.declineRequest(requestId);
  } catch (e: any) {
    await loadFriendRequests();
    throw e;
  }
}

export async function removeFriends(friendId: number) {
  friends.set((s) => ({ ...s, friends: s.friends.filter((f) => f.id !== friendId) }));
  try {
    await FriendsAPI.removeFriend(friendId);
  } catch (e: any) {
    await loadFriends();
    throw e;
  }
}
