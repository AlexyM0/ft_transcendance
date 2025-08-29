// main.ts
import "./styles/tailwind.css";
import "@fortawesome/fontawesome-free/css/all.min.css";
import { Router } from "./router/router";
import { Routes, guard } from "./router/routes";
import { bootstrapSession } from "./store/auth";

const app = document.getElementById("app") as HTMLElement;

const router = new Router(Routes, "#app", {
  defaultPath: "/login",
  onBeforeEach: guard,
});

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await bootstrapSession();
  } finally {
    router.start();
  }
});
