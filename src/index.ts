import { Value } from './gen/lekko/client/v1beta1/configuration_service_pb';
import { Transport } from '@connectrpc/connect';
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
  _global.lekkoClient ||= client;
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
  _global.lekkoClient ||= client;
  return client;
}

type LocalOptions = {
  /**
   * Path to Lekko config repositories stored locally. If path is omitted
   * and createMissing is enabled, a blank repository will be created in a
   * OS-dependent default location.
   */
  path?: string
  /**
   * Port for local dev server. Other SDKs can connect to the dev server
   * based on this port.
   */
  serverPort?: number
  /**
   * Additional option for local dev server. Whether to automatically create
   * missing resources if they are requested (repo, configs). Requires the
   * Lekko CLI to be available based on the system's PATH. Defaults to true.
   */
  createMissing?: boolean
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
    _global.lekkoClient ||= client;
    return client;
  } else {
    let path = "";
    const createMissing = options === undefined || !("createMissing" in options) || options.createMissing !== false;
    if (options !== undefined && "path" in options && options.path !== undefined) {
      path = options.path;
    } else if (createMissing) {
      // Invoke Lekko CLI to ensure default path location presence
      const defaultInit = spawnSync("lekko", ["repo", "init-default"], { encoding: "utf-8" });
      if (defaultInit.error !== undefined || defaultInit.status !== 0) {
        throw new Error("Failed to initialize default Lekko repo. Try upgrading the Lekko CLI.");
      }
      path = "~/Library/Application Support/Lekko/Config Repositories/default";
    } else {
      throw new Error("Either `path` or `createMissing` must be specified for local mode");
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
      createMissing,
    );
    await client.initialize();
    _global.lekkoClient ||= client;
    return client;
  }
}

type LekkoGlobal = {
  lekkoClient?: Client;
};

const _global = globalThis as LekkoGlobal;

async function getClient(): Promise<Client> {
  let client = _global.lekkoClient;
  if (client === undefined) {
    client = await initClient();
    _global.lekkoClient = client;
  }
  return client;
}

async function setupClient(options?: LocalOptions | BackendOptions): Promise<void> {
  let _options = options;
  if (_options === undefined) {
    const fullRepoName = process.env.LEKKO_REPO_NAME;
    const repoPath = process.env.LEKKO_REPO_PATH;
    const apiKey = process.env.LEKKO_API_KEY;
    if (fullRepoName !== undefined) {
      const parts = fullRepoName.split('/');
      if (parts.length != 2) {
        throw new Error(
          `Invalid format for LEKKO_REPO_NAME: ${fullRepoName}, should be <owner>/<repo>.`,
        );
      }
      const [repoOwner, repoName] = parts;
      _options = {
        repositoryOwner: repoOwner,
        repositoryName: repoName,
        apiKey: apiKey,
      };
    } else if (repoPath !== undefined) {
      _options = {
        path: repoPath,
      };
    }
  }
  _global.lekkoClient = await initClient(_options);
}

function sdkVersion(): string {
  const v = version.startsWith('v') ? version : `v${version}`;
  return 'node-' + v;
}

export {
  ClientContext,
  TransportClient,
  TransportProtocol,
  Value,
  initClient,
  initAPIClient,
  initCachedAPIClient,
  initCachedGitClient,
  initSidecarClient,
  type Client,
  type AsyncClient,
  getClient,
  setupClient,
};
