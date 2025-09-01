// src/api/friends.ts

import { getRequest, postRequest, putRequest, deleteRequest } from "./http";
import type { PublicUser, FriendRequest } from "./types";

export const FriendsAPI = {
  /**
   * GET /api/friends -> { friends }
   */
  listFriends: () => {
    return getRequest<{ friends: PublicUser[] }>("/api/friends");
  },

  /**
   * GET /api/friends/requests -> { friendRequests }
   */
  listFriendRequests: () => {
    return getRequest<{ friendRequests: FriendRequest[] }>("/api/friends/requests");
  },

  /**
   * POST /api/friends/requests -> { id } (body: {to_user_id})
   */
  sendRequest: (toUserId: number) => {
    return postRequest<{ id: number }>("/api/friends/requests", { to_user_id: toUserId });
  },

  /**
   * PUT /api/friends/:requestId -> { success: true }
   */
  acceptRequest: (requestId: number) => {
    return putRequest<{ success: true }>(`/api/friends/requests/${requestId}`);
  },

  /**
   * DELETE /api/friends/requests/:requestId -> { success: true }
   */
  declineRequest: (requestId: number) => {
    return deleteRequest<{ success: true }>(`/api/friends/requests/${requestId}`);
  },

  /**
   * DELETE /api/friends/:friendId -> { success: true }
   */
  removeFriend: (friendId: number) => {
    return deleteRequest<{ success: true }>(`/api/friends/${friendId}`);
  },
};
