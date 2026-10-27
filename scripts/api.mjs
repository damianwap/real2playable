import { existsSync } from "node:fs";
import { spawn } from "node:child_process";

const environmentPython =
  process.platform === "win32"
    ? ".venv/Scripts/python.exe"
    : ".venv/bin/python";
const executable = existsSync(environmentPython)
  ? environmentPython
  : process.platform === "win32"
    ? "python"
    : "python3";
const server = spawn(
  executable,
  [
    "-m",
    "uvicorn",
    "apps.api.app:app",
    "--host",
    "127.0.0.1",
    "--port",
    "8000",
  ],
  { stdio: "inherit" },
);
server.on("error", (error) => {
  console.error(
    `Cannot start API: ${error.message}. Install requirements.txt in .venv first.`,
  );
  process.exitCode = 1;
});
server.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
process.on("SIGINT", () => server.kill("SIGINT"));
process.on("SIGTERM", () => server.kill("SIGTERM"));
