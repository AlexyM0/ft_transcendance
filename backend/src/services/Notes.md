What is a transaction ?

You don’t _always_ need a transaction. We add it here because **“accepting a friend request” actually involves _two SQL mutations_**:

1. Update the `friend_requests` table:

   ```sql
   UPDATE friend_requests SET status = 'accepted' WHERE id = ?
   ```

2. Insert a row into `friends`:

   ```sql
   INSERT INTO friends(user_a_id, user_b_id) VALUES(?, ?)
   ```

If you don’t wrap those two in a transaction, you risk **ending up in a half-finished state** if the process crashes or one query fails:

- ✅ Request marked as `accepted`,
- ❌ but no row in `friends` table,
- leaving data inconsistent.

---

### With a transaction

A transaction ensures **atomicity**: both queries succeed or neither does.

```ts
const tx = db.transaction(() => {
  friendsDao.acceptRequest(requestId);
  friendsDao.insertFriendPair(req.from_user_id, req.to_user_id);
});
tx();
```

- If `insertFriendPair` fails (say, constraint violation), the `acceptRequest` update is rolled back automatically.
- If everything passes, both changes are committed together.

---

### When to use transactions in your app

Use a transaction whenever:

- Multiple queries must succeed together (e.g. accept request, update stats, deduct balance).
- You need to guarantee consistency across tables.
- You want to avoid race conditions in multi-step updates.

---

👉 In this case, it’s not strictly catastrophic if you skip it (worst case: request shows as accepted but no friendship row), but it’s best practice because you’re crossing table boundaries.

Do you want me to show you a **minimal SQLite test** of what happens _with_ and _without_ a transaction if the second step fails?

\***\*\*\*\*\*** TOTP 2FA OTPAUTH **\*\*\*\***\*\*\***\*\*\*\***
The otpauth://… URI isn’t an HTTP link. Browsers don’t “visit” it. Authenticator apps consume it (via QR scan or pasting the URI/secret). So: show the QR (best), and optionally also return the raw otpauth string for copy-paste import. So it means an OTP auth app is an app set up to decode otpauth:// protocol links into a 6-digits code, following TOTP protocol ? Can you make this clear ?

Yep—that’s the idea. Here’s the crisp version:

### What `otpauth://` actually is

- It’s a **configuration string** (a URI) defined by the “Key URI Format” used by OTP apps.
- It doesn’t fetch anything over the internet. It just **encodes the settings** an authenticator app needs to create codes.

Example:

```
otpauth://totp/Transcendance:alice?secret=JBSWY3DPEHPK3PXP&issuer=Transcendance&digits=6&period=30&algorithm=SHA1
```

Breakdown:

- `otpauth://totp/...` → use the **TOTP** algorithm (time-based). There’s also `hotp` (counter-based).
- `label` (`Transcendance:alice`) → what the app shows to the user.
- Query params:

  - `secret` → the **Base32** shared secret (the important, sensitive bit).
  - `issuer` → your app name (for nicer display & account grouping).
  - Optional: `digits` (usually 6), `period` (usually 30s), `algorithm` (usually SHA1).

### What authenticator apps do with it

- They **parse** the `otpauth://` URI (from a QR code or pasted text).
- They **store the secret locally** on the device.
- Every `period` seconds (default 30), they compute a new 6-digit code using **TOTP** (RFC 6238):

  - Take current time step,
  - HMAC the step with the secret,
  - Truncate to a short number → that’s the code.

- No network calls. Codes are generated **offline**. The server just verifies codes using the same secret and clock.

### Why your QR matters

- The QR is just a convenient way to deliver that `otpauth://` string to the app.
- Scanning the QR == importing the secret. The QR itself **contains the secret in plaintext**, so treat it like a password:

  - Show it once, don’t log it, don’t email it, use HTTPS.

### How your flow maps

- Server creates secret → builds `otpauth://` → renders QR.
- User scans it in Google Authenticator / Authy / Microsoft Authenticator / 1Password / Aegis / etc.
- App starts showing rolling 6-digit codes.
- User types a code back to you → server verifies with the same secret → if valid, you encrypt & store the secret and mark 2FA enabled.

### Common gotchas

- **Clock drift**: if device/server clocks differ, codes can fail. Allow a small verification window (e.g., ±1 step).
- **URI isn’t a link**: browsers won’t “open” `otpauth://…`. It’s for OTP apps only. The browser shows the **QR image**; the OTP app scans it.
- **Secret stability**: once you store the (encrypted) secret, don’t change it unless doing a deliberate 2FA reset.

That’s the whole story: an OTP app is a little offline calculator for the TOTP algorithm that **understands `otpauth://` URIs** and turns them into those 6-digit codes.
