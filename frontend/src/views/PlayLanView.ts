// frontend/src/views/PlayLanView.ts
import { domElem as h, mount } from "../ui/DomElement";
import { Realtime } from "../helpers/ws";
import type { AllWsIncoming } from "../helpers/ws_types";

export function PlayLanView(root: HTMLElement) {
  const wrap = h("div", { class: "max-w-3xl mx-auto p-6" });

  const title = h("h2", { class: "text-2xl font-semibold mb-4", text: "Play (LAN / quick host)" });
  const info = h("p", { class: "mb-4 text-sm text-gray-700", text: "Start the local LAN server (see lan-ws-server.js), then enter the server address here. Default port: 8081." });

  const form = h("div", { class: "flex gap-2 mb-4" });
  const hostInput = h("input", { class: "flex-1 p-2 border rounded", attributes: { placeholder: "server address (ip or hostname)", value: location.hostname } });
  const portInput = h("input", { class: "w-24 p-2 border rounded", attributes: { placeholder: "port", value: "8081" } });
  const connectBtn = h("button", { class: "px-4 py-2 rounded bg-emerald-600 text-white", text: "Connect" });

  const status = h("div", { class: "text-sm mt-2 text-gray-600", text: "Not connected." });
  const log = h("pre", { class: "mt-4 p-3 bg-gray-50 border rounded max-h-64 overflow-auto text-xs" });

  mount(form, hostInput, portInput, connectBtn);
  mount(wrap, title, info, form, status, log);
  root.replaceChildren(wrap);

  let rt: Realtime | null = null;
  let connUrl = "";

  function appendLog(s: string) {
    log.textContent = (log.textContent || "") + s + "\n";
    log.scrollTop = log.scrollHeight;
  }

  connectBtn.addEventListener("click", () => {
    const host = (hostInput.attributes?.value ?? "").toString().trim() || location.hostname;
    const port = (portInput.attributes?.value ?? "").toString().trim() || "8081";
    connUrl = `ws://${host}:${port}/api/ws`;
    status.textContent = `Connecting to ${connUrl} ...`;
    appendLog(`Connecting to ${connUrl}`);

    sessionStorage.setItem("play:online:ws", connUrl);

    try {
      rt = new Realtime(connUrl);
      rt.on((msg: AllWsIncoming) => {
        appendLog(`<= ${JSON.stringify(msg)}`);
        if (msg.type === "match_created") {
          const payload = { matchId: msg.matchId, side: msg.side, snapshot: msg.snapshot };
          sessionStorage.setItem("play:online:current", JSON.stringify(payload));
          sessionStorage.setItem("play:online:ws", connUrl);
          appendLog(`Match created #${msg.matchId} side=${msg.side} — entering match view...`);
          location.hash = "/match/online";
        }
      });
      rt.connect();
    } catch (e) {
      appendLog("Error connecting: " + String(e));
      status.textContent = "Connection failed.";
    }
  });
}
