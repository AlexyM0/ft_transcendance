// navigation.ts


import { renderHomeView } 		from "./home.ts";
import { renderLoginView }		from "./login.ts";
import { renderSignupView }		from "./signup.ts";
import { renderSettingsView }	from "./settings.ts";
import { renderUserView  } 		from "./userview.ts";
import { renderGameView }		from "./game.ts";

let app: HTMLElement;

export	function setupNavigation()
{
	window.addEventListener("load", () => {
		app = document.getElementById("app")!;
		if (!app) throw new Error("No #app container found");
		const hash = location.hash.replace("#", "");
		showView(hash || "home");
		if (!history.state) history.replaceState({ page: hash || "home" }, "", location.href);
	});

	window.addEventListener("popstate", e => showView(e.state?.page || "home"));
}

export	function navigateTo(page: string)
{
	history.pushState({ page }, "", page);
	dispatchEvent(new PopStateEvent("popstate", { state: { page } }));
}


function showView(view: string)
{
	app.innerHTML = "";

	switch (view)
	{
		case "home":		renderHomeView(app);	break;
		case "login":		renderLoginView(app);	break;
		case "signup":		renderSignupView(app);	break;
		case "settings":	renderSettingsView(app);	break;
		case "game":		renderGameView(app);		break;
		case "user":		renderUserView(app);		break;
		default:			renderHomeView(app);		break;
	}
}