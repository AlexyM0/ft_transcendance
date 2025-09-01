Models :
Purpose: only SQL here. Models return plain JS objects. No business logic

Questions
UserRow : Does it mean the getter will return all the elements of the row ? Is there a security concern to explicitly retrieve the hash password and twofa secret ?
Why we do not have an object for Friends model ? Because we are mainly playing with ids references to users ?
In SQL, what does fr.\* syntax do ? Is it a way to access the fields of a selected row ?
For declined friend requests, should we delete the request instead of having a declined status ?
What do the db functions do like .run(), .get(), .all() etc ? which one to use in which case ?

---

## 1) `UserRow`: are we returning the whole row? Any security risks?

`UserRow` is just a TypeScript shape for _whatever columns you selected_. In my DAO snippet I used:

```ts
SELECT id, email, pseudo, pwd_hash, is_2fa_enabled, twofa_secret_enc, avatar_url
```

Yes, that includes **sensitive fields** (`pwd_hash`, `twofa_secret_enc`). That’s fine **inside the server** when you actually need them (e.g., verifying a password or a TOTP code), but:

- Never send these to the client.
- Don’t select them unless the operation needs them.

### Practical pattern

Define **multiple projections**:

```ts
// Internal, sensitive
export type UserAuthRow = {
  id: number;
  email: string;
  pseudo: string;
  pwd_hash: string;
  is_2fa_enabled: 0 | 1;
  twofa_secret_enc: string | null;
};

// Public/safe
export type UserPublicRow = {
  id: number;
  pseudo: string;
  avatar_url: string | null;
};
```

And have separate queries:

```ts
const selAuth = db.prepare(`
  SELECT id,email,pseudo,pwd_hash,is_2fa_enabled,twofa_secret_enc
  FROM users WHERE email = ? OR pseudo = ? LIMIT 1
`);

const selPublicById = db.prepare(`
  SELECT id,pseudo,avatar_url FROM users WHERE id = ?
`);
```

This keeps you from “accidentally” leaking secrets up the call stack.

---

## 2) Why no “Friends model” object?

We _can_ define types for friend requests and friendships; we just didn’t wrap them in a fancy class.

Friends are basically **edges between users**:

- `friend_requests`: one row per request, with status.
- `friendships`: one row per accepted pair (canonical order).

You can absolutely type them:

```ts
export type FriendRequestRow = {
  id: number;
  from_user_id: number;
  to_user_id: number;
  status: "pending" | "accepted" | "declined";
  created_at: string;
};

export type FriendshipRow = {
  user_id: number;
  friend_id: number;
  created_at: string;
};
```

And your DAO returns these shapes. The reason we “mainly play with IDs” is because friendship state is a **relationship**, not a rich entity.

---

## 3) What does `fr.*` mean in SQL?

`fr` is a **table alias**. `fr.*` expands to “all columns of the `friend_requests` row selected as alias `fr`”.

Example:

```sql
SELECT fr.*        -- all columns from friend_requests
FROM friend_requests AS fr
WHERE fr.to_user_id = ?
```

Same as explicitly listing `fr.id, fr.from_user_id, fr.to_user_id, fr.status, fr.created_at …`. Using `*` is convenient but less explicit; for API responses prefer explicit columns.

---

## 4) Declined friend requests: delete or keep?

Both are valid; pick based on UX/analytics:

- **Keep with `status='declined'`** (my default):

  - Pros: audit/history (“you declined Bob on 2025-08-19”), rate-limit logic (“stop spamming requests”), potential UI (“request already declined”).
  - Cons: table grows a bit over time.

- **Delete on decline**:

  - Pros: smaller table, simpler queries.
  - Cons: you lose history; spammers can retry endlessly unless you add other checks.

Middle ground: keep declined for N days, then purge with a cron/maintenance job.

---

## 5) `better-sqlite3` methods: `.run()`, `.get()`, `.all()`, etc.

You call `.prepare(sql)` once, then use one of these per execution:

- `.run(params…)`
  Executes statements that **don’t return rows** (INSERT/UPDATE/DELETE/DDL).
  Returns `{ changes: number, lastInsertRowid: number }`.

  ```ts
  const stmt = db.prepare("UPDATE users SET pseudo=? WHERE id=?");
  const res = stmt.run("neo", 42);
  // res.changes === 1
  ```

- `.get(params…)`
  Executes a SELECT and returns **a single row** (or `undefined` if none).

  ```ts
  const stmt = db.prepare("SELECT id,email FROM users WHERE id=?");
  const row = stmt.get(42); // { id: 42, email: '...' } | undefined
  ```

- `.all(params…)`
  Executes a SELECT and returns **all rows** as an array.

  ```ts
  const stmt = db.prepare("SELECT id,pseudo FROM users LIMIT ?");
  const rows = stmt.all(50); // Array<{id:number; pseudo:string}>
  ```

- `.iterate(params…)`
  A generator you can loop over (good for very large result sets without loading all into memory).

  ```ts
  for (const row of db.prepare("SELECT * FROM big").iterate()) {
    // stream style
  }
  ```

- Extras (opt-in on statements):

  - `.pluck(true)` → returns only the first column of each row.
  - `.raw(true)` → returns arrays instead of objects.
  - `.expand(true)` → turns `table__col` into `{ table: { col: … } }` objects.

- Transactions:

  ```ts
  const txn = db.transaction((inputs: Item[]) => {
    for (const i of inputs) insertStmt.run(i.foo, i.bar);
  });
  txn(items);
  ```

### Which to use when?

- **INSERT/UPDATE/DELETE/DDL:** `.run()`
- **SELECT (one row expected):** `.get()`
- **SELECT (list):** `.all()` (or `.iterate()` for large scans)
- **Multi-step atomic work:** wrap them in a `db.transaction()`.

---

### TL;DR guardrails

- **Never** select `pwd_hash` or `twofa_secret_enc` unless you’re in the _auth_ path. Use separate projections.
- Define **types** for each table’s rows (requests, friendships, messages) so controllers/services are strongly typed without guessing shapes.
- Use explicit column lists for API responses; reserve `*` for quick internal queries.
- Keep declined requests in DB (status) unless you have a reason to prune; you can always add a cleanup later.
- `.run()` for writes, `.get()` for single-row reads, `.all()` for lists; transactions for multi-step invariants.

If you want, I can refactor the DAO snippets to show **safe projections** (auth vs public) so you don’t even _have the option_ to leak secrets in controllers.

Question :
In user stats, why do we wrap arguments of applyMatchResultDelta inside an object, instead of passing 4 arguments ?

---

### 1. Passing 4 positional arguments

You could absolutely write it like:

```ts
export function applyMatchResultDelta(winnerId: number, loserId: number, winnerScore: number, loserScore: number) {
  // logic here
}
```

and then call it as:

```ts
applyMatchResultDelta(12, 45, 10, 7);
```

This is shorter, but has a **big downside**:
if you ever swap argument order in a call site (e.g. winner/loser IDs flipped, or scores swapped), TypeScript won’t catch it because they’re all just `number`.

---

### 2. Using an object parameter

With the object style:

```ts
export function applyMatchResultDelta(args: { winnerId: number; loserId: number; winnerScore: number; loserScore: number }) {
  const { winnerId, loserId, winnerScore, loserScore } = args;
  // logic here
}
```

You call it like:

```ts
applyMatchResultDelta({
  winnerId: 12,
  loserId: 45,
  winnerScore: 10,
  loserScore: 7,
});
```

Advantages:

- **Self-documenting**: at the call site, you see clearly which number is which.
- **Order doesn’t matter**: you can write `loserId` before `winnerId` and it’s still fine.
- **Safer refactors**: if you add another property later (say `tournamentId`), you don’t have to change the order everywhere.

---

### 3. Rule of thumb

- **Primitive-heavy functions (like `number, number, number`)** → prefer an object wrapper, because it prevents mixing up arguments.
- **Distinct types (like `string, boolean, UserRow`)** → positional is fine, because TypeScript can distinguish them.

---

👉 In your case:
All four arguments are plain `number`, so using an object prevents subtle bugs like:

```ts
// Oops, swapped score order
applyMatchResultDelta(12, 45, 7, 10); // Winner’s score < loser’s score 😬
```

That’s why I wrapped them in an object.

---

Do you want me to rewrite it in **positional style** (simpler but riskier), or keep the **object style** (slightly verbose but safer)?
