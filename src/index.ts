import { Value } from '@buf/lekkodev_sdk.bufbuild_es/lekko/client/v1beta1/configuration_service_pb';
import { TransportClient } from './client';
import { ClientContext } from './context/context';
import { Backend } from './memory/backend';
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

export { ClientContext, TransportClient, Value, initAPIClient, initBackendInMemoryClient, initSidecarClient, type Client };

