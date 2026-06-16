// Reads the Antigravity IDE's state.vscdb (SQLite) to find the OAuth token
// storage keys. VS Code SecretStorage keeps secrets as base64 in the ItemTable.
// Throwaway verification helper — does NOT print token values, only key names
// and whether a value looks like a JWT/refresh token.
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
const buf = fs.readFileSync(dbPath);

(async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database(buf);

  // List all keys, then filter to auth/token/google/codeium-related ones.
  const all = db.exec("select key from ItemTable");
  const keys = all[0] ? all[0].values.map((r) => r[0]) : [];
  console.log("Total keys:", keys.length);

  const interesting = keys.filter((k) =>
    /google|oauth|codeium|aicompanion|cloudcode|gemini|securecoder|credential|token|secret|auth|refresh/i.test(
      k
    )
  );
  console.log("\n=== Interesting keys ===");
  interesting.forEach((k) => console.log(" -", k));

  // For each interesting key, show value type (length + whether it decodes).
  console.log("\n=== Value inspection (no secrets printed) ===");
  for (const k of interesting) {
    const row = db.exec(`select value from ItemTable where key = '${k.replace(/'/g, "''")}'`);
    if (!row[0]) continue;
    const val = row[0].values[0][0];
    let desc;
    if (typeof val === "string") {
      // SecretStorage values are base64 of UTF-8.
      try {
        const decoded = Buffer.from(val, "base64").toString("utf8");
        const looksJwt = /^ey[\w-]+\./.test(decoded);
        const looksRefresh = decoded.length > 40 && /^4\//.test(decoded);
        desc = `string(${val.length}b) -> b64decode len ${decoded.length}${
          looksJwt ? " [JWT!]" : looksRefresh ? " [refresh-token-like!]" : ""
        }`;
      } catch {
        desc = `string(${val.length}b, not base64)`;
      }
    } else {
      desc = `${typeof val}(${val && val.length}b)`;
    }
    console.log(` ${k}: ${desc}`);
  }

  db.close();
})().catch((e) => {
  console.error("ERR:", e.message);
  process.exit(1);
});
