Set up a Vite + Tailwind CSS project

1 - Create + Run Vite project
cd project_root/
npm create vite@latest frontend // specifying frontend will create the frontend/ folder
cd frontend
npm i
npm run dev // for testing

2 - Install tailwind as a Vite plugin
npm install tailwindcss @tailwindcss/vite
Add the plugin to the vite config file

3 - Create Vite config file
Vite config file is optional unless we need plugins or a dev proxy.
In our case we need:

- plugin for tailwind
- proxy for backend

// vite.config.ts
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
plugins: [tailwindcss()],
server: {
port: 5173,
proxy: {
"/api": { target: "http://localhost:5000", changeOrigin: true },
"/api/ws":{ target: "ws://localhost:5000", ws: true },
},
},
});

4 - Import tailwind in the main .css file (or in a dedicated .css file)
// src/tailwind.css
@import "tailwindcss";

// main.ts
import "./styles/tailwind.css

5 - Dev environment : Launch the dev live server to see tailwind in action
npm run dev // "dev":"vite"

6 - Prod environment : emit files to the /dist folder
npm run build
// package.json
{
"scripts": {
"dev": "vite",
"build": "vite build",
"typecheck": "tsc --noEmit",
"preview": "vite preview"
}
}

---

Project architecture

1 - main.ts

    - Initializes everything. Does not render UI itself
    - One file (main.ts) wires: load session -> start router -> connect ws

2 - router

    - routes.ts : The rulebook. For each route, say which view to load and whether it needs auth
    - router.ts : Listens to hash changes; resolves and mounts a view (a function returning a root HTMLElement)
    - Translates location.hash (or History API) -> which view to render
    - Enforces guards (guest vs auth)
    - Route table + guards
    - Hash/history listener, view mounting

3 - store

    - slices/*.ts : Each slice owns its shape state, synchronous mutations, and async actions that call api/ or realtime/
    - Holds app state in memory
    - Exposes get/set/subscribe
    - Actions live next to state slices (auth, chats, friends...), calls services, and update state

4 - api

    - api/*.ts : One file per backend route family. Never import DOM from here
    - Thin, typed wrappers around HTTP endpoints; one file per backend domain
    - No DOM. No Tailwind. Just IO and data conversion

5 - realtime

    - ws.ts : One ws connection, auto-reconnect, type-safe send/receive; exposes onWs() to subscribe
    - WebSocket client; subscribe/send methods; emits parsed events to listeners

6 - views

    - *.ts : Glue layers that reads state and builds DOM; binds events to store actions
    - Render DOM from the current state
    - Capture user intent (clicks/forms) -> dispatch actions
    - No direct fetch calls, no business logic

7 - ui

    - Tiny reusable DOM builders
    - Pure styling + minimal behavior. Zero app logic
    - Tailwind lives here

8 - lib

    - Utilities : DOM helpers, form helpers, and little pure functions

9 - styles

    - Tailwind css file
    - Optional other css file (no use here but whatever lol)
