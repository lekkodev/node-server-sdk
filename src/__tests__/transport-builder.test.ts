import { ClientTransportBuilder, TransportProtocol } from '../transport-builder';

test('build default transport', () => {
  const transport = new ClientTransportBuilder({hostname: "localhost:8080", protocol: TransportProtocol.HTTP, apiKey: "foobar"})
    .build();
  expect(transport).not.toEqual(undefined);
});

test('build gRPC transport', () => {
  const transport = new ClientTransportBuilder({hostname: "localhost:8080", protocol: TransportProtocol.gRPC})
    .build();
  expect(transport).not.toEqual(undefined);
});
