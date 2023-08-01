import { Value } from '@buf/lekkodev_sdk.bufbuild_es/lekko/client/v1beta1/configuration_service_pb';
import { TransportClient } from './client';
import { ClientContext } from './context/context';
import { ClientTransportBuilder, TransportProtocol } from './transport-builder';

type APIOptions = {
  apiKey: string
  hostname? : string
  repositoryOwner: string
  repositoryName: string
}

async function initAPIClient(options: APIOptions): Promise<TransportClient> {
  const transport = await new ClientTransportBuilder(
    {
      hostname: options.hostname || "https://prod.api.lekko.dev",
      protocol: TransportProtocol.HTTP,
      apiKey: options.apiKey
    }).build();
  return new TransportClient(options.repositoryOwner, options.repositoryName, transport);
}

type SidecarOptions = {
  hostname: string
  repositoryOwner: string
  repositoryName: string
}

async function initSidecarClient(options: SidecarOptions): Promise<TransportClient> {
  const transport = await new ClientTransportBuilder(
    {
      hostname: options.hostname,
      protocol: TransportProtocol.gRPC
    }).build();
  return new TransportClient(options.repositoryOwner, options.repositoryName, transport);
}

export { ClientContext, TransportClient, Value, initAPIClient, initSidecarClient };

