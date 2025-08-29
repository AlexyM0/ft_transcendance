// src/views/FriendsView.ts
import { domElem, mount, bind } from "../ui/DomElement";
import { Card } from "../ui/Card";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";
import * as Friends from "../store/friends";
import type { FriendRequest, PublicUser } from "../api/types";

const friendCard = (friend: PublicUser) => {
  const box = domElem("div", { class: "flex items-center gap-3" });
  const avatar = Avatar(friend.avatar_url);
  const pseudoBox = domElem("div", { class: "flex-1" });
  const pseudo = domElem("div", { class: "font-medium", text: friend.pseudo });
  const deleteBtn = Button("Remove", { variant: "danger", onClick: () => Friends.removeFriends(friend.id) });

  mount(pseudoBox, pseudo);
  return Card(mount(box, avatar, pseudoBox, deleteBtn));
};

const friendRequestCard = (r: FriendRequest) => {
  const box = domElem("div", { class: "flex items-center gap-3" });
  const request = domElem("div", { class: "text-sm flex-1", text: `Request #${r.id} from ${r.from_user_id} to ${r.to_user_id}` });
  const acceptBtn = Button("Accept", { onClick: () => Friends.acceptFriendRequest(r.id) });
  const declineBtn = Button("Decline", { variant: "ghost", onClick: () => Friends.declineFriendRequest(r.id) });

  return Card(mount(box, request, acceptBtn, declineBtn));
};

export const FriendsView = (root: HTMLElement) => {
  const list = domElem("div", { class: "grid md:grid-cols-2 gap-3" });
  const requests = domElem("div", { class: "mt-8" });

  mount(root, list, requests);
  Friends.loadFriends();
  Friends.loadFriendRequests();

  const unbindFriendsView = bind(Friends.friends, (s) => {
    list.replaceChildren();
    s.friends.forEach((f) => {
      const row = friendCard(f);
      list.appendChild(row);
    });

    requests.replaceChildren();
    const h = domElem("h3", { class: "text-lg font-semibold mb-2", text: "Requests" });
    requests.appendChild(h);
    s.requests.forEach((r) => {
      const row = friendRequestCard(r);
      requests.appendChild(row);
    });
  });

  return () => unbindFriendsView();
};
