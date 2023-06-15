import { ClientContext } from '../context';
import { initAPIClient, initSidecarClient } from '../index';
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
  const client = await initAPIClient({
    apiKey: "apiKey",
    repositoryOwner: "lekkodev",
    repositoryName: "config-test"
  });
  expect(client).not.toEqual(undefined);
});

test('build gRPC client', async () => {
  const client = await initSidecarClient({
    repositoryOwner: "lekkodev", repositoryName: "config-test",
    hostname: "localhost:8080"
  });
  expect(client).not.toEqual(undefined);
});

const SAMPLE_CONTEXT = new ClientContext();
SAMPLE_CONTEXT.setString('sample_key', 'sample_value');

test('get bool feature', async () => {
  const client = await initAPIClient({
    apiKey: "apiKey",
    repositoryOwner: "lekkodev",
    repositoryName: "config-test"
  });
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
  const client = await initAPIClient({
    apiKey: "apiKey",
    repositoryOwner: "lekkodev",
    repositoryName: "config-test"
  });
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
  const client = await initAPIClient({
    apiKey: "apiKey",
    repositoryOwner: "lekkodev",
    repositoryName: "config-test"
  });
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
  const client = await initAPIClient({
    apiKey: "apiKey",
    repositoryOwner: "lekkodev",
    repositoryName: "config-test"
  });
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
  const client = await initAPIClient({
    apiKey: "apiKey",
    repositoryOwner: "lekkodev",
    repositoryName: "config-test"
  });
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

