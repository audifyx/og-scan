// One-off: register Grim's global slash commands with your Discord application.
// Run locally:
//   DISCORD_APP_ID=... DISCORD_BOT_TOKEN=... deno run -A register-commands.ts
// Global commands can take a few minutes to appear. For instant testing in a
// single server, set DISCORD_GUILD_ID to register guild-scoped commands.

const APP_ID = Deno.env.get("DISCORD_APP_ID");
const BOT_TOKEN = Deno.env.get("DISCORD_BOT_TOKEN");
const GUILD_ID = Deno.env.get("DISCORD_GUILD_ID"); // optional

if (!APP_ID || !BOT_TOKEN) {
  console.error("Set DISCORD_APP_ID and DISCORD_BOT_TOKEN env vars.");
  Deno.exit(1);
}

const commands = [
  {
    name: "chat",
    description: "Chat with Grim, the OG Scan AI analyst",
    options: [
      { name: "message", description: "What do you want to ask Grim?", type: 3, required: true },
    ],
  },
  { name: "migrations", description: "Pump.fun graduations (last 24h)" },
];

const url = GUILD_ID
  ? `https://discord.com/api/v10/applications/${APP_ID}/guilds/${GUILD_ID}/commands`
  : `https://discord.com/api/v10/applications/${APP_ID}/commands`;

const res = await fetch(url, {
  method: "PUT",
  headers: { "Content-Type": "application/json", Authorization: `Bot ${BOT_TOKEN}` },
  body: JSON.stringify(commands),
});

console.log("status", res.status);
console.log(await res.text());
