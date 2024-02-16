import { Value } from '@buf/lekkodev_sdk.bufbuild_es/lekko/client/v1beta1/configuration_service_pb';
import { Transport } from '@bufbuild/connect';
import { TransportClient } from './client';
import { ClientContext } from './context/context';
import { Backend } from './memory/backend';
import { Git } from './memory/git';
import { ClientTransportBuilder, TransportProtocol } from './transport-builder';
import { AsyncClient, Client } from './types/client';
import { version } from './version';
import { spawnSync } from 'child_process';

type APIOptions = {
  apiKey: string
  hostname? : string
  repositoryOwner: string
  repositoryName: string
  transportProtocol?: TransportProtocol
}

function initAPIClient(options: APIOptions): AsyncClient {
  const transport = new ClientTransportBuilder(
    {
      hostname: options.hostname ?? "https://prod.api.lekko.dev",
      protocol: options.transportProtocol ?? TransportProtocol.HTTP,
      apiKey: options.apiKey
    }).build();
  return new TransportClient(options.repositoryOwner, options.repositoryName, transport);
}

type SidecarOptions = {
  hostname?: string
  repositoryOwner: string
  repositoryName: string
  transportProtocol?: TransportProtocol
}

function initSidecarClient(options: SidecarOptions): AsyncClient {
  const transport = new ClientTransportBuilder(
    {
      hostname: options.hostname ?? "http://localhost:50051",
      protocol: options.transportProtocol ?? TransportProtocol.gRPC,
    }).build();
  return new TransportClient(options.repositoryOwner, options.repositoryName, transport);
}

type BackendOptions = {
  apiKey?: string
  hostname? : string
  repositoryOwner: string
  repositoryName: string
  updateIntervalMs?: number
  transportProtocol?: TransportProtocol
  serverPort?: number,
}

const defaultUpdateIntervalMs = 15 * 1000; // 15s

async function initCachedAPIClient(options: BackendOptions): Promise<Client> {
  const transport = new ClientTransportBuilder({
    hostname: options.hostname ?? "https://prod.api.lekko.dev",
    protocol: options.transportProtocol ?? TransportProtocol.HTTP,
    apiKey: options.apiKey
  }).build();
  const client = new Backend(
    transport, 
    options.repositoryOwner, 
    options.repositoryName, 
    sdkVersion(),
    options.updateIntervalMs ?? defaultUpdateIntervalMs, 
    options.serverPort,
  );
  await client.initialize();
  return client;
}

type GitOptions = {
  repositoryOwner: string
  repositoryName: string
  path: string // path to git directory on disk
  apiKey?: string
  hostname? : string
  transportProtocol?: TransportProtocol
  serverPort?: number,
}

// Initializes a cached lekko client that reads from a source of truth on disk.
// The provided `path` must be a path to a directory that contains a .git folder.
// The `apiKey` argument is optional while developing locally, but encouraged when 
// running in production.
async function initCachedGitClient(options: GitOptions): Promise<Client> {
  let transport: Transport | undefined;
  if (options.apiKey) {
    transport = new ClientTransportBuilder({
      hostname: options.hostname ?? "https://prod.api.lekko.dev",
      protocol: options.transportProtocol ?? TransportProtocol.HTTP,
      apiKey: options.apiKey
    }).build();
  }
  const client = new Git(
    options.repositoryOwner, 
    options.repositoryName, 
    options.path, 
    true,
    sdkVersion(),
    transport, 
    undefined, 
    options.serverPort,
  );
  await client.initialize();
  return client;
}

type LocalOptions = {
  path: string
  serverPort?: number
}

/**
 * Initializes a Lekko client that will read from a local or remote repository based on
 * the options provided.
 */
async function initClient(options?: LocalOptions | BackendOptions): Promise<Client> {
  if (options !== undefined && "apiKey" in options) {
    const transport = new ClientTransportBuilder({
      hostname: options.hostname ?? "https://prod.api.lekko.dev",
      protocol: options.transportProtocol ?? TransportProtocol.HTTP,
      apiKey: options.apiKey
    }).build();
    const client = new Backend(
      transport, 
      options.repositoryOwner, 
      options.repositoryName, 
      sdkVersion(),
      options.updateIntervalMs ?? defaultUpdateIntervalMs,
      options.serverPort,
    );
    await client.initialize();
    return client;
  } else {
    let path = "";
    if (options !== undefined && "path" in options && options.path !== undefined) {
      path = options.path;
    } else {
      // Invoke Lekko CLI to ensure default path location presence
      const defaultInit = spawnSync("lekko", ["repo", "init-default"], { encoding: "utf-8" });
      if (defaultInit.error !== undefined || defaultInit.status !== 0) {
        throw new Error("Failed to initialize default Lekko repo. Try upgrading the Lekko CLI.");
      }
      path = "~/Library/Application Support/Lekko/Config Repositories/default";
    } 
    const client = new Git(
      "", 
      "", 
      path, 
      true,
      sdkVersion(),
      undefined, 
      undefined, 
      options?.serverPort,
    );
    await client.initialize();
    return client;
  }
}

function sdkVersion() : string {
  const v = (version.startsWith('v')) ? version : `v${version}`;
  return 'node-' + v;
}

export { ClientContext, TransportClient, TransportProtocol, Value, initClient, initAPIClient, initCachedAPIClient, initCachedGitClient, initSidecarClient, type Client, type AsyncClient };

