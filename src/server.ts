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
  .name("lekko-server")
  .description(
    "A dev server for interacting with locally stored Lekko config repositories"
  )
  .option(
    "-p, --port <number>",
    "port to start config dev server on",
    parsePort,
    50051
  )
  .option("-r, --repo-path <string>", "path to config repo")
  .option(
    "--autocreate",
    "whether to use the Lekko CLI to automatically create missing requested resources (repo, configs)",
    true
  )
  .option("--no-autocreate", "disable autocreate behavior");
program.parse();

const opts = program.opts();
const port = parseInt(opts.port);
const createMissing = opts.autocreate;

initClient({
  path: opts.repoPath,
  serverPort: port,
  createMissing,
})
  .then(() =>
    // eslint-disable-next-line no-console
    console.log(`Started Lekko config dev server on localhost:${port}`)
  )
  .catch(() => {
    // eslint-disable-next-line no-console
    console.error(
      "Error starting dev server. Make sure --repo-path or --autocreate are specified."
    );
  });
