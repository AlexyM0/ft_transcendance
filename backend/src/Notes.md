clear && (cat db/migrations/_ db/migrate.ts src/controllers/_ src/models/_ src/plugins/_ src/routes/_ src/services/_ src/types/_ src/utils/_ src/index.ts) > out

TODO :
Add to git repo
OAuth
2FA routes
Tournament rounds

0. The three big Fastify concepts

register(plugin, opts?)
Attaches a plugin (or a function that acts like a plugin) to a Fastify instance. Everything inside that plugin is encapsulated (scoped) to that subtree of routes.

Encapsulation
Each register(...) creates a new “child” instance with its own plugins, hooks, and decorations. That’s how you can protect a whole group of routes with one guard.

Decorators (decorate, decorateRequest, decorateReply)
Add custom properties/functions to fastify, req, or rep. This is how we add fastify.authenticate() or req.user.

Think of your Fastify app as an object. Two families of operations exist:

register(...) → install & configure plugins or sub-apps (and optionally add hooks/routes) under an encapsulated scope.

decorate(name, value) → add methods/properties to that Fastify instance (or to req/rep) so your code can call them later.

They solve different problems. You often need both.

1. register(cookie) and register(jwt) — installing capabilities

This does two essential things you cannot get with decorate:
Cookie parsing & helpers
Adds an early hook to parse Cookie header → req.cookies.
Adds rep.setCookie(...) / rep.clearCookie(...).
JWT primitives
Adds rep.jwtSign(...) to mint tokens.
Adds req.jwtVerify(...) to verify tokens.
When configured with cookie: { cookieName }, req.jwtVerify() reads from that cookie automatically.
If you don’t register these plugins, none of the above exists. You can’t “decorate” your way to cookie parsing or JWT verification — those are implemented internally by those plugins and wired into the request lifecycle via hooks. decorate doesn’t attach lifecycle behavior by itself.

2. decorate(...) — exposing your own helpers

These are your convenience methods:
issueSessionCookie calls the installed primitives:
uses rep.jwtSign (from @fastify/jwt) to create the token
uses rep.setCookie (from @fastify/cookie) to write it safely
authenticate is your guard that calls req.jwtVerify (from @fastify/jwt).
So decorate is how you compose installed capabilities into app-specific helpers with your cookie name, expiry, flags, etc. It also gives you a nice typed, reusable API anywhere in that scope (e.g., privateScope.authenticate).

Analogy:
register = install & configure a library (adds features and hooks).
decorate = add your own convenience functions on top of those features.

fp() (fastify-plugin)
Wraps your plugin function so decorations are visible to parents/siblings as needed and to control plugin metadata (name, dependencies). Without fp, a decoration made in a child might not be visible where you expect it.

-

Questions

- Can you tell me if each match in tournaments has a unique ID ? (i.e /tournaments/:matchId/result won't cause undefined behaviour)
- Currently, error management is tedious with hardcoded strings. Is there a workaround ? (defined string const, or using enums or anything else)
