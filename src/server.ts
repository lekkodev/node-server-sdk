#!/usr/bin/env node
import { program, InvalidArgumentError } from "commander";
import { initClient } from ".";

function parsePort(value: string): number {
  const port = parseInt(value, 10);
  if (isNaN(port)) {
    throw new InvalidArgumentError("Invalid port");
  }
  return port;
}

program
  .option(
    "-p, --port <number>",
    "port to start config dev server on",
    parsePort,
    50051
  )
  .option("-r, --repo-path <string>", "path to config repo");
program.parse();

const opts = program.opts();
const port = parseInt(opts.port);

initClient({
  path: opts.repoPath,
  serverPort: port,
}).then(() =>
  // eslint-disable-next-line no-console
  console.log(`Started Lekko config dev server on localhost:${port}`)
);
