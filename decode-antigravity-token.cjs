// Decodes the antigravityUnifiedStateSync.oauthToken value from state.vscdb
// and reports its JSON shape (keys only — never prints token values).
//
// Storage format (reverse-engineered from the IDE's state.vscdb):
//   raw  = base64( UTF-8 bytes )            <- SecretStorage base64 wrapper
//   root = protobuf Map<string, Any>        <- the decoded bytes are a protobuf
//                                               "map" message, NOT UTF-8 JSON.
// Two entries live in the map:
//   - "authStateWithContextSentinelKey"  -> JSON { state, context } (signed-in state)
//   - "oauthTokenInfoSentinelKey"        -> value is ANOTHER base64 string whose
//                                            decoded bytes are a protobuf with
//                                            the OAuth fields as length-delimited
//                                            leaves:
//                                              f1 = access_token  ("ya29...")
//                                              f3 = refresh_token ("1//...")
//                                              f4 = nested message with an expiry
//                                                   varint (unix seconds)
// We extract refresh_token (required by the adapter) plus access_token/expires_at
// when present, classify leaves by *value* so field-number shifts across IDE
// versions don't silently break us, and write a JSON blob for the Add Account
// wizard. Token values are never logged.

const initSqlJs = require("sql.js");
const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(
  process.env.APPDATA,
  "Antigravity IDE",
  "User",
  "globalStorage",
  "state.vscdb"
);
const OAUTH_KEY = "antigravityUnifiedStateSync.oauthToken";
const SENTINEL = "oauthTokenInfoSentinelKey";

// --- minimal protobuf reader (only the wire types we need) -----------------

function readVarint(buf, pos) {
  let result = 0;
  let shift = 0;
  while (pos < buf.length) {
    const byte = buf[pos++];
    result |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) break;
    shift += 7;
    if (shift > 35) throw new Error("varint too long");
  }
  return { value: result >>> 0, next: pos };
}

// Parse one "level" of a protobuf buffer. Returns [] if the bytes don't form a
// self-consistent message (so callers can fall back to treating it as a leaf).
function parseLevel(buf) {
  let pos = 0;
  const fields = [];
  while (pos < buf.length) {
    const tag = readVarint(buf, pos);
    pos = tag.next;
    const fieldNum = tag.value >> 3;
    const wireType = tag.value & 0x7;
    if (fieldNum === 0) return [];
    if (wireType === 0) {
      const v = readVarint(buf, pos);
      pos = v.next;
      fields.push({ fieldNum, wireType, varint: v.value });
    } else if (wireType === 2) {
      const len = readVarint(buf, pos);
      pos = len.next;
      if (len.value > buf.length - pos) return [];
      fields.push({ fieldNum, wireType, payload: buf.slice(pos, pos + len.value) });
      pos += len.value;
    } else if (wireType === 5) {
      pos += 4;
      fields.push({ fieldNum, wireType });
    } else if (wireType === 1) {
      pos += 8;
      fields.push({ fieldNum, wireType });
    } else {
      return [];
    }
  }
  return pos === buf.length ? fields : [];
}

// --- leaf classification (value-based, so field order changes don't matter) -

function classifyLeaf(buf) {
  const s = buf.toString("utf8");
  if (/^ya29\.[A-Za-z0-9_-]+$/.test(s)) return { kind: "access_token", value: s };
  if (/^1\/\/[A-Za-z0-9_-]+$/.test(s) || /^1\/\/[A-Za-z0-9_\-]+$/.test(s))
    return { kind: "refresh_token", value: s };
  // Google OAuth refresh tokens are occasionally seen without the "1//" prefix
  // in some flows; treat long opaque url-safe blobs as refresh candidates only
  // if nothing else matched (kept conservative to avoid false positives).
  if (/^[A-Za-z0-9_-]{40,}$/.test(s)) return { kind: "opaque_token?", value: s };
  if (/^[0-9]+-[a-z0-9]{32}\.apps\.googleusercontent\.com$/.test(s))
    return { kind: "client_id", value: s };
  return null;
}

// Walk a protobuf buffer, collecting classified leaves. Each length-delimited
// field is tried first as nested protobuf; if that fails it is treated as a
// leaf. varints are recorded so we can spot an expiry timestamp.
function collectLeaves(buf, out, depth) {
  if (depth > 8) return;
  const fields = parseLevel(buf);
  if (fields.length === 0) {
    const leaf = classifyLeaf(buf);
    if (leaf) out.leaves.push(leaf);
    return;
  }
  for (const f of fields) {
    if (f.wireType === 0) {
      out.varints.push(f.varint);
    } else if (f.wireType === 2) {
      collectLeaves(f.payload, out, depth + 1);
    }
  }
}

// A varint in the seconds-since-epoch range plausibly an access-token expiry.
function pickExpiry(varints, nowSec) {
  for (const v of varints) {
    if (v > nowSec - 10 * 365 * 24 * 3600 && v < nowSec + 10 * 365 * 24 * 3600) {
      return v;
    }
  }
  return undefined;
}

// --- main ------------------------------------------------------------------

async function main() {
  if (!fs.existsSync(DB_PATH)) {
    throw new Error(
      `state.vscdb not found at ${DB_PATH} — is the Antigravity IDE installed and signed in?`
    );
  }

  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync(DB_PATH));
  try {
    const row = db.exec(
      `select value from ItemTable where key = '${OAUTH_KEY}'`
    );
    if (!row[0]) {
      throw new Error(
        `${OAUTH_KEY} key not found — sign in to Google in the Antigravity IDE first.`
      );
    }
    const raw = row[0].values[0][0];

    // SecretStorage wraps the stored bytes as base64. The decoded bytes are a
    // protobuf Map, not UTF-8 text.
    const root = Buffer.from(raw, "base64");

    // Find the oauthTokenInfoSentinelKey entry in the top-level map.
    const entries = parseLevel(root);
    if (entries.length === 0) {
      throw new Error("decoded value is not a protobuf map — storage format may have changed");
    }

    let tokenPayload = null;
    for (const entry of entries) {
      const sub = parseLevel(entry.payload);
      const keyField = sub.find((f) => f.fieldNum === 1 && f.wireType === 2);
      if (!keyField) continue;
      const keyName = keyField.payload.toString("utf8");
      if (keyName !== SENTINEL) continue;
      const valField = sub.find((f) => f.fieldNum === 2 && f.wireType === 2);
      if (!valField) continue;
      const valInner = parseLevel(valField.payload);
      const innerPayload = valInner.find((f) => f.fieldNum === 1 && f.wireType === 2);
      if (!innerPayload) continue;
      tokenPayload = innerPayload.payload;
      break;
    }

    if (!tokenPayload) {
      throw new Error(
        `"${SENTINEL}" entry not found in oauthToken map — is the IDE signed in?`
      );
    }

    // The token entry's payload is itself a base64 string whose bytes are the
    // OAuth protobuf. Decode base64, then walk for leaves.
    const tokenAscii = tokenPayload.toString("utf8");
    if (!/^[A-Za-z0-9+/=_-]+$/.test(tokenAscii)) {
      throw new Error("token entry payload is not base64 — storage format may have changed");
    }
    const tokenProto = Buffer.from(
      tokenAscii.replace(/-/g, "+").replace(/_/g, "/"),
      "base64"
    );

    const collected = { leaves: [], varints: [] };
    collectLeaves(tokenProto, collected, 0);

    const refresh = collected.leaves.find((l) => l.kind === "refresh_token");
    const access = collected.leaves.find((l) => l.kind === "access_token");
    const expiresAt = pickExpiry(collected.varints, Math.floor(Date.now() / 1000));

    if (!refresh) {
      // Diagnostic (no secret values): show what kinds we *did* find.
      const kinds = collected.leaves.map((l) => l.kind).join(", ") || "none";
      throw new Error(
        `no refresh_token found. leaf kinds seen: ${kinds}. ` +
          "Storage format may have changed."
      );
    }

    // Build the JSON the Add Account wizard / Rust adapter expects.
    // refresh_token is required; the rest are optional cached fields.
    const token = { refresh_token: refresh.value };
    if (access) {
      token.access_token = access.value;
      if (expiresAt) token.expires_at = expiresAt;
    }

    const tmp = path.join(__dirname, "antigravity-token.tmp.json");
    fs.writeFileSync(tmp, JSON.stringify(token, null, 2));

    // Report shape only — never the values.
    console.log("=== decoded OAuth token shape ===");
    console.log("refresh_token:", `<${refresh.value.length} chars, 1//...>`);
    if (access) {
      console.log("access_token:", `<${access.value.length} chars, ya29...>`);
    }
    if (expiresAt) {
      const human = new Date(expiresAt * 1000).toISOString();
      const stale = expiresAt * 1000 < Date.now();
      console.log(
        `expires_at: ${expiresAt} (${human}) — ${stale ? "EXPIRED (will refresh)" : "valid"}`
      );
    }
    console.log("\nWrote parsed token to", tmp, "(gitignored)");
    console.log(
      "Paste the file's contents into the Add Account wizard.\n"
    );
    console.log(
      "NOTE: The Antigravity IDE does not store client_secret.\n" +
        "      You must supply it separately:\n" +
        "        Option 1: Add \"client_secret\": \"YOUR_SECRET\" to the JSON.\n" +
        "        Option 2: Set TOKENMAXXER_GOOGLE_CLIENT_SECRET env var\n" +
        "                  before launching TokenMaxxer."
    );
  } finally {
    // Close the DB before the process exits so libuv has no open handles.
    // (The old code force-exited from a catch while sql.js still held async
    // handles, which tripped libuv's UV_HANDLE_CLOSING assertion on Windows.)
    db.close();
  }
}

main().catch((e) => {
  console.error("ERR:", e.message);
  process.exitCode = 1;
});
