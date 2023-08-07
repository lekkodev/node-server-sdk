import { Value } from '@buf/lekkodev_sdk.bufbuild_es/lekko/client/v1beta1/configuration_service_pb';
import { Transport } from '@bufbuild/connect';
import { TransportClient } from './client';
import { ClientContext } from './context/context';
import { Backend } from './memory/backend';
import { Git } from './memory/git';
import { ClientTransportBuilder, TransportProtocol } from './transport-builder';
import { Client } from './types/client';

type APIOptions = {
  apiKey: string
  hostname? : string
  repositoryOwner: string
  repositoryName: string
}

async function initAPIClient(options: APIOptions): Promise<Client> {
  const transport = await new ClientTransportBuilder(
    {
      hostname: options.hostname || "https://prod.api.lekko.dev",
      protocol: TransportProtocol.HTTP,
      apiKey: options.apiKey
    }).build();
  return new TransportClient(options.repositoryOwner, options.repositoryName, transport);
}

type SidecarOptions = {
  hostname?: string
  repositoryOwner: string
  repositoryName: string
}

async function initSidecarClient(options: SidecarOptions): Promise<Client> {
  const transport = await new ClientTransportBuilder(
    {
      hostname: options.hostname || "https://localhost:50051",
      protocol: TransportProtocol.gRPC
    }).build();
  return new TransportClient(options.repositoryOwner, options.repositoryName, transport);
}

type BackendOptions = {
  apiKey: string
  hostname? : string
  repositoryOwner: string
  repositoryName: string
  updateIntervalMs?: number
}

const defaultUpdateIntervalMs = 30 * 1000; // 30s

async function initBackendInMemoryClient(options: BackendOptions): Promise<Client> {
  const transport = await new ClientTransportBuilder({
    hostname: options.hostname || "https://prod.api.lekko.dev",
    protocol: TransportProtocol.HTTP,
    apiKey: options.apiKey
  }).build();
  const client = new Backend(transport, options.repositoryOwner, options.repositoryName, options.updateIntervalMs || defaultUpdateIntervalMs);
  await client.initialize();
  return client;
}

type GitOptions = {
  repositoryOwner: string
  repositoryName: string
  path: string // path to git directory on disk
  apiKey?: string
  hostname? : string
}

// Initializes a cached lekko client that reads from a source of truth on disk.
// The provided `path` must be a path to a directory that contains a .git folder.
// The `apiKey` argument is optional while developing locally, but encouraged when 
// running in production.
async function initGitInMemoryClient(options: GitOptions): Promise<Client> {
  let transport: Transport | undefined;
  if (options.apiKey) {
    transport = await new ClientTransportBuilder({
      hostname: options.hostname || "https://prod.api.lekko.dev",
      protocol: TransportProtocol.HTTP,
      apiKey: options.apiKey
    }).build();
  }
  const client = new Git(options.repositoryOwner, options.repositoryName, options.path, true, transport);
  await client.initialize();
  return client;
}

export { ClientContext, TransportClient, Value, initAPIClient, initBackendInMemoryClient, initGitInMemoryClient, initSidecarClient, type Client };

