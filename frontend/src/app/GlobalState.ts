// src/app/GlobalState.ts

import { createStore } from "./createStore";
import { AuthAPI } from "../api/auth";
import { ChatsAPI } from "../api/chats";
import { FriendsAPI } from "../api/friends";
import { MatchesAPI } from "../api/matches";
import { TournamentsAPI } from "../api/tournaments";
import { UsersAPI } from "../api/users";
import * as APITypes from "../api/types";

type Session = {
  me: APITypes.Me | null;
  loading: boolean;
  twofaRequired: boolean;
  error: string | null;
};

type AppState = {
  session: Session;
  usersById: Record<number, APITypes.PublicUser>;
};
