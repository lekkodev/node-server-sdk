import { Value } from '@buf/lekkodev_sdk.bufbuild_es/lekko/client/v1beta1/configuration_service_pb';
import { ClientContext } from './context';
import { TransportClient } from './client';
import { ClientTransportBuilder, TransportProtocol } from './transport-builder';

function initApiClient(
  repositoryOwner: string,
  repositoryName: string,
  apiKey: string,
): TransportClient {
  const transport = (new ClientTransportBuilder("https://prod.api.lekko.dev", TransportProtocol.HTTP, apiKey));
  return new TransportClient(repositoryOwner, repositoryName, transport);
}

function createLekkoGRPCClient(
  repositoryOwner: string,
  repositoryName: string,
  hostname: string,
): TransportClient {
  const transport = new ClientTransportBuilder(hostname, TransportProtocol.gRPC, "");
  return new TransportClient(repositoryOwner, repositoryName, transport);
}

export { initApiClient, createLekkoGRPCClient, ClientContext, TransportClient, Value };
