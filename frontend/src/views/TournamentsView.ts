// src/views/TournamentView.ts
import { domElem, mount, bind } from "../ui/DomElement";
import * as tournamentStore from "../store/tournaments";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import type { Tournament } from "../api/types";

const createTournamentCard = (t: Tournament) => {
  const box = domElem("div");
  const title = domElem("div", { class: "font-semibold", text: t.title });
  const status = domElem("div", { class: "text-xs text-gray-500 mb-2", text: `Status: ${t.status}` });
  const detailsBtn = Button("Details", { variant: "ghost", onClick: () => alert(`Open details for #${t.id}`) });

  const tournamentCard = mount(box, title, status, detailsBtn);
  return Card(tournamentCard);
};

export const TournamentsView = (root: HTMLElement) => {
  const list = domElem("div", { class: "grid md:grid-cols-2 gap-3" });

  const bar = domElem("div", { class: "mb-3 flex gap-2" });
  const newBtn = Button("New Tournament", {
    onClick: async () => {
      const title = prompt("Title ?");
      if (!title) return;
      await tournamentStore.createTournament(title, null, 8);
      await tournamentStore.listTournaments();
    },
  });
  bar.appendChild(newBtn);

  mount(root, bar, list);
  tournamentStore.listTournaments();

  const unbindTournament = bind(tournamentStore.tournaments, (s) => {
    list.replaceChildren();
    s.listing.items.forEach((t) => {
      const card = createTournamentCard(t);
      list.appendChild(card);
    });
  });

  return () => unbindTournament();
};
