import { ClientTransportBuilder, TransportProtocol } from '../transport-builder';

test('build default transport', () => {
  process.env.LEKKO_API_KEY = 'foobar';
  const transport = (new ClientTransportBuilder('localhost:8080', TransportProtocol.HTTP, ""))
    .build();
  expect(transport).not.toEqual(undefined);
});

test('build gRPC transport', () => {
  process.env.LEKKO_API_KEY = 'foobar';
  const transport = (new ClientTransportBuilder('localhost:8080', TransportProtocol.gRPC, ""))
    .build();
  expect(transport).not.toEqual(undefined);
});
