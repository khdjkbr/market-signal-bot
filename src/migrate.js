import { migrate } from "./database.js";

try {
  const migrated = await migrate();
  if (migrated) {
    console.log("Database migration completed");
  }
} catch (error) {
  console.error(`Database migration failed: ${error.message}`);
  process.exitCode = 1;
}

if (process.env.NODE_ENV === "production") {
  const { spawn } = await import("node:child_process");
  const child = spawn("node", ["src/server.js"], { stdio: "inherit" });
  child.on("exit", (code) => { process.exitCode = code ?? 0; });
}
