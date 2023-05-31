import { ClientContext } from '../context';
import { TransportClient } from '../client';
import { ClientTransportBuilder, TransportProtocol } from '../transport-builder';
import {
  GetBoolValueRequest,
  GetBoolValueResponse,
  GetIntValueRequest,
  GetIntValueResponse,
  GetFloatValueRequest,
  GetFloatValueResponse,
  GetJSONValueRequest,
  GetJSONValueResponse,
  GetStringValueRequest,
  GetStringValueResponse,
} from '@buf/lekkodev_sdk.bufbuild_es/lekko/client/v1beta1/configuration_service_pb';

test('build default client', async () => {
  process.env.LEKKO_API_KEY = 'foobar';
  const transport = await new ClientTransportBuilder("localhost:8080", TransportProtocol.HTTP, "").build();
  const client = new TransportClient('lekkodev', 'config-test', transport);
  expect(client.client).not.toEqual(undefined);
});

test('build gRPC client', async () => {
  const transport = await new ClientTransportBuilder("localhost:8080", TransportProtocol.gRPC, "").build();
  const client = new TransportClient('lekkodev', 'config-test', transport);
  expect(client.client).not.toEqual(undefined);
});

const SAMPLE_CONTEXT = new ClientContext();
SAMPLE_CONTEXT.setString('sample_key', 'sample_value');

test('get bool feature', async () => {
  const transport = await new ClientTransportBuilder("localhost:8080", TransportProtocol.HTTP, "").build();
  const client = new TransportClient('lekkodev', 'config-test', transport);
  client.client.getBoolValue = jest.fn().mockReturnValue(GetBoolValueResponse.fromJson({
    value: true,
  }));
  expect(await client.getBoolFeature('types', 'bool', SAMPLE_CONTEXT)).toBe(true);
  expect(client.client.getBoolValue.mock.lastCall[0]).toEqual(GetBoolValueRequest.fromJson({
    key: 'bool',
    context: {
      sample_key: {
        stringValue: 'sample_value',
      },
    },
    namespace: 'types',
    repoKey: {
      ownerName: 'lekkodev',
      repoName: 'config-test',
    },
  }));
});

test('get int feature', async () => {
  const transport = await new ClientTransportBuilder("localhost:8080", TransportProtocol.HTTP, "").build();
  const client = new TransportClient('lekkodev', 'config-test', transport);
  client.client.getIntValue = jest.fn().mockReturnValue(GetIntValueResponse.fromJson({
    value: 42,
  }));
  expect(await client.getIntFeature('types', 'int', SAMPLE_CONTEXT)).toEqual(BigInt(42));
  expect(client.client.getIntValue.mock.lastCall[0]).toEqual(GetIntValueRequest.fromJson({
    key: 'int',
    context: {
      sample_key: {
        stringValue: 'sample_value',
      },
    },
    namespace: 'types',
    repoKey: {
      ownerName: 'lekkodev',
      repoName: 'config-test',
    },
  }));
});

test('get float feature', async () => {
  const transport = await new ClientTransportBuilder("localhost:8080", TransportProtocol.HTTP, "").build();
  const client = new TransportClient('lekkodev', 'config-test', transport);
  client.client.getFloatValue = jest.fn().mockReturnValue(GetFloatValueResponse.fromJson({
    value: 3.14,
  }));
  expect(await client.getFloatFeature('types', 'float', SAMPLE_CONTEXT)).toBeCloseTo(3.14);
  expect(client.client.getFloatValue.mock.lastCall[0]).toEqual(GetFloatValueRequest.fromJson({
    key: 'float',
    context: {
      sample_key: {
        stringValue: 'sample_value',
      },
    },
    namespace: 'types',
    repoKey: {
      ownerName: 'lekkodev',
      repoName: 'config-test',
    },
  }));
});

test('get json feature', async () => {
  const transport = await new ClientTransportBuilder("localhost:8080", TransportProtocol.HTTP, "").build();
  const client = new TransportClient('lekkodev', 'config-test', transport);
  const mockedValue = {
    a: 1,
    b: {
      c: 'foobar',
    }
  };
  client.client.getJSONValue = jest.fn().mockReturnValue(GetJSONValueResponse.fromJson({
    value: Buffer.from(JSON.stringify(mockedValue)).toString('base64'),
  }));
  expect(await client.getJSONFeature('types', 'json', SAMPLE_CONTEXT)).toEqual(mockedValue);
  expect(client.client.getJSONValue.mock.lastCall[0]).toEqual(GetJSONValueRequest.fromJson({
    key: 'json',
    context: {
      sample_key: {
        stringValue: 'sample_value',
      },
    },
    namespace: 'types',
    repoKey: {
      ownerName: 'lekkodev',
      repoName: 'config-test',
    },
  }));
});

test('get string feature', async () => {
  const transport = await new ClientTransportBuilder("localhost:8080", TransportProtocol.HTTP, "").build();
  const client = new TransportClient('lekkodev', 'config-test', transport);
  client.client.getStringValue = jest.fn().mockReturnValue(GetStringValueResponse.fromJson({
    value: 'foobar',
  }));
  expect(await client.getStringFeature('types', 'string', SAMPLE_CONTEXT)).toBe('foobar');
  expect(client.client.getStringValue.mock.lastCall[0]).toEqual(GetStringValueRequest.fromJson({
    key: 'string',
    context: {
      sample_key: {
        stringValue: 'sample_value',
      },
    },
    namespace: 'types',
    repoKey: {
      ownerName: 'lekkodev',
      repoName: 'config-test',
    },
  }));
});

