// Decodes the antigravityUnifiedStateSync.oauthToken value from state.vscdb
// and reports its JSON shape (keys only — never prints token values).
const initSqlJs = require("sql.js");
const fs = require("fs");
const path = require("path");

const dbPath = path.join(
  process.env.APPDATA,
  "Antigravity IDE",
  "User",
  "globalStorage",
  "state.vscdb"
);

(async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync(dbPath));
  const row = db.exec(
    "select value from ItemTable where key = 'antigravityUnifiedStateSync.oauthToken'"
  );
  if (!row[0]) throw new Error("oauthToken key not found");
  const raw = row[0].values[0][0];

  // SecretStorage stores base64-encoded UTF-8.
  const decoded = Buffer.from(raw, "base64").toString("utf8");
  let parsed;
  try {
    parsed = JSON.parse(decoded);
  } catch {
    console.log("Decoded value is not JSON. First 40 chars type:");
    console.log("  startsWith ey:", /^ey/.test(decoded));
    console.log("  length:", decoded.length);
    process.exit(0);
  }

  console.log("=== oauthToken JSON shape (keys + value types) ===");
  function describe(obj, prefix = "") {
    for (const [k, v] of Object.entries(obj)) {
      if (v && typeof v === "object" && !Array.isArray(v)) {
        console.log(`${prefix}${k}: {`);
        describe(v, prefix + "  ");
        console.log(`${prefix}}`);
      } else if (Array.isArray(v)) {
        console.log(`${prefix}${k}: array[${v.length}]`);
      } else {
        const t = typeof v;
        const len = t === "string" ? v.length : "";
        const hint =
          t === "string" && /^ey[\w-]+\./.test(v)
            ? " [JWT]"
            : t === "string" && v.length > 40 && /^4\/[a-zA-Z0-9_-]/.test(v)
            ? " [refresh-token-like]"
            : "";
        console.log(`${prefix}${k}: ${t}${len ? `(${len})` : ""}${hint}`);
      }
    }
  }
  describe(parsed);

  // Does it contain the fields our antigravity_remote adapter needs?
  const json = JSON.stringify(parsed);
  console.log("\n=== Adapter-readiness ===");
  console.log("has refresh_token field:", /refresh_token|refreshToken/i.test(json));
  console.log("has access_token field:", /access_token|accessToken/i.test(json));
  console.log("has expiry field:", /expiry|expires/i.test(json));

  // Write the token to a temp file the seeder can read (DO NOT log it).
  const tmp = path.join(__dirname, "antigravity-token.tmp.json");
  fs.writeFileSync(tmp, JSON.stringify(parsed, null, 2));
  console.log("\nWrote parsed token to", tmp, "(will be deleted after seeding)");

  db.close();
})().catch((e) => {
  console.error("ERR:", e.message);
  process.exit(1);
});
