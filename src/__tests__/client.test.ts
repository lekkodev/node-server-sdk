import {
  GetBoolValueRequest,
  GetBoolValueResponse,
  GetFloatValueRequest,
  GetFloatValueResponse,
  GetIntValueRequest,
  GetIntValueResponse,
  GetJSONValueRequest,
  GetJSONValueResponse,
  GetProtoValueRequest,
  GetProtoValueResponse,
  GetStringValueRequest,
  GetStringValueResponse,
  Any as LekkoAny,
} from '@buf/lekkodev_sdk.bufbuild_es/lekko/client/v1beta1/configuration_service_pb';
import { Any, BoolValue } from '@bufbuild/protobuf';
import { ClientContext } from '../context';
import { initAPIClient, initSidecarClient } from '../index';

test('build API client', async () => {
  const client = await initAPIClient({
    apiKey: "apiKey",
    repositoryOwner: "lekkodev",
    repositoryName: "config-test"
  });
  expect(client).not.toEqual(undefined);
});

test('build API client with hostname', async () => {
  const client = await initAPIClient({
    apiKey: "apiKey",
    hostname: "http://testhostname.com",
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
  const mockFn = jest.fn();
  Object.defineProperty(client.client, "getBoolValue", {
    value: mockFn,
    configurable: true,
    writable: true
  });
  jest.spyOn(client.client, "getBoolValue").mockImplementation(async () => GetBoolValueResponse.fromJson({
    value: true,
  }));
  expect(await client.getBoolFeature('types', 'bool', SAMPLE_CONTEXT)).toBe(true);
  expect(mockFn.mock.lastCall[0]).toEqual(GetBoolValueRequest.fromJson({
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
  const mockFn = jest.fn();
  Object.defineProperty(client.client, "getIntValue", {
    value: mockFn,
    configurable: true,
    writable: true
  });
  jest.spyOn(client.client, "getIntValue").mockImplementation(async () => GetIntValueResponse.fromJson({
    value: 42,
  }));
  expect(await client.getIntFeature('types', 'int', SAMPLE_CONTEXT)).toEqual(42);
  expect(mockFn.mock.lastCall[0]).toEqual(GetIntValueRequest.fromJson({
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
  const mockFn = jest.fn();
  Object.defineProperty(client.client, "getFloatValue", {
    value: mockFn,
    configurable: true,
    writable: true
  });
  jest.spyOn(client.client, "getFloatValue").mockImplementation(async () => GetFloatValueResponse.fromJson({
    value: 3.14,
  }));
  expect(await client.getFloatFeature('types', 'float', SAMPLE_CONTEXT)).toBeCloseTo(3.14);
  expect(mockFn.mock.lastCall[0]).toEqual(GetFloatValueRequest.fromJson({
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
  const mockFn = jest.fn();
  Object.defineProperty(client.client, "getJSONValue", {
    value: mockFn,
    configurable: true,
    writable: true
  });
  jest.spyOn(client.client, "getJSONValue").mockImplementation(async () => GetJSONValueResponse.fromJson({
    value: Buffer.from(JSON.stringify(mockedValue)).toString('base64'),
  }));
  expect(await client.getJSONFeature('types', 'json', SAMPLE_CONTEXT)).toEqual(mockedValue);
  expect(mockFn.mock.lastCall[0]).toEqual(GetJSONValueRequest.fromJson({
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
  const mockFn = jest.fn();
  Object.defineProperty(client.client, "getStringValue", {
    value: mockFn,
    configurable: true,
    writable: true
  });
  jest.spyOn(client.client, "getStringValue").mockImplementation(async () => GetStringValueResponse.fromJson({
    value: 'foobar',
  }));
  expect(await client.getStringFeature('types', 'string', SAMPLE_CONTEXT)).toBe('foobar');
  expect(mockFn.mock.lastCall[0]).toEqual(GetStringValueRequest.fromJson({
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

test('get proto feature', async () => {
  const a = Any.pack(new BoolValue({
    value: true
  }));
  const testWithResponse = async (resp: GetProtoValueResponse) => {
    const client = await initAPIClient({
      apiKey: "apiKey",
      repositoryOwner: "lekkodev",
      repositoryName: "config-test"
    });
    const mockFn = jest.fn();
    Object.defineProperty(client.client, "getProtoValue", {
      value: mockFn,
      configurable: true,
      writable: true
    });
    jest.spyOn(client.client, "getProtoValue").mockImplementation(async () => resp);
    expect(await client.getProtoFeature('types', 'proto', SAMPLE_CONTEXT)).toEqual(a);
    expect(mockFn.mock.lastCall[0]).toEqual(GetProtoValueRequest.fromJson({
      key: 'proto',
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
  };

  // test backwards compatibility
  await testWithResponse(new GetProtoValueResponse({
    value: a,
  }));

  // test dual-writing old and new any
  await testWithResponse(new GetProtoValueResponse({
    value: a,
    valueV2: new LekkoAny({
      ...a
    })
  }));
  
  // test new any only
  await testWithResponse(new GetProtoValueResponse({
    valueV2: new LekkoAny({
      ...a
    })
  }));
});

