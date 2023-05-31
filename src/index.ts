import { Value } from '@buf/lekkodev_sdk.bufbuild_es/lekko/client/v1beta1/configuration_service_pb';
import { ClientContext } from './context';
import { TransportClient } from './client';
import { ClientTransportBuilder, TransportProtocol } from './transport-builder';

type ClientOptions = {
  hostname: string
  apiKey?: string
  repositoryOwner: string
  repositoryName: string
}

async function initApiClient(options: ClientOptions): Promise<TransportClient> {
  if (!options.apiKey) {
    throw new Error("apiKey is required for API Client");
  }
  const transport = await new ClientTransportBuilder(options.hostname, TransportProtocol.HTTP, options.apiKey).build();
  return new TransportClient(options.repositoryOwner, options.repositoryName, transport);
}

async function initGrpcClient(
  repositoryOwner: string,
  repositoryName: string,
  hostname: string,
): Promise<TransportClient> {
  const transport = await new ClientTransportBuilder(hostname, TransportProtocol.gRPC, "").build();
  return new TransportClient(repositoryOwner, repositoryName, transport);
}

export { initApiClient, initGrpcClient, ClientContext, TransportClient, Value };
