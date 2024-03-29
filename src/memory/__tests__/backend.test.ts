import { DeregisterClientResponse, GetRepositoryVersionResponse, RegisterClientResponse, SendFlagEvaluationMetricsRequest, SendFlagEvaluationMetricsResponse } from "../../gen/lekko/backend/v1beta1/distribution_service_pb";
import { ClientContext } from "../../context/context";
import { jsonConfigType, protoAny, testContents } from '../../fixtures/contents';
import { ClientTransportBuilder, TransportProtocol } from "../../transport-builder";
import { Backend } from "../backend";
import { defaultVersion } from "./git.test";

async function setupBackend()  {
    const transport = await new ClientTransportBuilder({
        hostname: "http://localhost:8000",
        protocol: TransportProtocol.HTTP,
        apiKey: 'apikey'
    }).build();
    const sessionKey = 'session-key';
    const backend = new Backend(transport, 'owner', 'repo', defaultVersion, 30 * 1000);
    backend.eventsBatcher.backoffOptions = { numOfAttempts: 1 };
    const mockRegister = jest.fn();
    Object.defineProperty(backend.distClient, "registerClient", { value: mockRegister });
    jest.spyOn(backend.distClient, "registerClient").mockImplementation(async () => {
        return new RegisterClientResponse({sessionKey});
    });
    

    const resp = testContents();

    const mockVersion = jest.fn();
    Object.defineProperty(backend.distClient, "getRepositoryVersion", { value: mockVersion });
    jest.spyOn(backend.distClient, "getRepositoryVersion").mockImplementation(async () => {
        return new GetRepositoryVersionResponse({commitSha: 'sha'});
    });

    const mockContents = jest.fn();
    Object.defineProperty(backend.distClient, "getRepositoryContents", { value: mockContents });
    jest.spyOn(backend.distClient, "getRepositoryContents").mockImplementation(async () => {
        return resp;
    });

    const mockDeregister = jest.fn();
    Object.defineProperty(backend.distClient, "deregisterClient", { value: mockDeregister });
    jest.spyOn(backend.distClient, "deregisterClient").mockImplementation(async () => {
        return new DeregisterClientResponse();
    });

    return {
        backend,
        mockRegister,
    };
}


test('test backend', async () => {

    const testBackend = await setupBackend();
    const backend = testBackend.backend;
    const mockRegister = testBackend.mockRegister;

    const mockSendEvents = jest.fn();
    Object.defineProperty(backend.distClient, "sendFlagEvaluationMetrics", { value: mockSendEvents });
    jest.spyOn(backend.distClient, "sendFlagEvaluationMetrics").mockImplementation(async () => {
        return new SendFlagEvaluationMetricsResponse();
    });

    await backend.initialize();

    const registerCalls = mockRegister.mock.calls;
    expect(registerCalls.length).toEqual(1);
    expect(registerCalls[0].length).toEqual(1);
    expect(registerCalls[0][0].sidecarVersion).toEqual(defaultVersion);

    expect(backend.getBool('ns-1', 'bool', new ClientContext().setBoolean('key', true))).toEqual(true);
    expect(backend.getInt('ns-1', 'int', new ClientContext().setInt('key', 12))).toEqual(BigInt(12));
    expect(backend.getFloat('ns-1', 'float', new ClientContext().setDouble('key', 12.12))).toEqual(12.28);
    expect(backend.getString('ns-1', 'string', new ClientContext().setString('key', 'foo'))).toEqual('hello');
    expect(backend.getJSON('ns-1', 'json', new ClientContext())).toEqual({a: 1});
    expect(backend.getProto('ns-1', 'proto', new ClientContext())).toEqual(protoAny());

    expect(async () => {
        backend.getBool('ns-1', 'int', new ClientContext()); // type mismatch
    }).rejects.toThrow();

    const listResp = backend.store.listContents();
    expect(listResp.commitSha).toEqual('sha');

    await backend.close();

    const calls = mockSendEvents.mock.calls;
    expect(calls.length).toEqual(1);
    expect(calls[0].length).toEqual(1);
    const sendRequest = calls[0][0] as SendFlagEvaluationMetricsRequest;
    expect(sendRequest.events.length).toEqual(6);
    expect(sendRequest.sessionKey).toEqual('session-key');
    for (const event of sendRequest.events) {
        expect(event.namespaceName).toEqual('ns-1');
        expect(event.repoKey?.ownerName).toEqual('owner');
        expect(event.repoKey?.repoName).toEqual('repo');
        switch (event.featureName) {
            case 'bool':
                expect(event.contextKeys.length).toEqual(1);
                expect(event.contextKeys[0].key).toEqual('key');
                expect(event.contextKeys[0].type).toEqual('bool');
                break;
            case 'int':
                expect(event.contextKeys.length).toEqual(1);
                expect(event.contextKeys[0].key).toEqual('key');
                expect(event.contextKeys[0].type).toEqual('int');
                break;
            case 'float':
                expect(event.contextKeys.length).toEqual(1);
                expect(event.contextKeys[0].key).toEqual('key');
                expect(event.contextKeys[0].type).toEqual('float');
                break;
            case 'string':
                expect(event.contextKeys.length).toEqual(1);
                expect(event.contextKeys[0].key).toEqual('key');
                expect(event.contextKeys[0].type).toEqual('string');
                break;
        }
    }
});

test('send metrics error', async () => {
    const testBackend = await setupBackend();
    const backend = testBackend.backend;

    const mockSendEvents = jest.fn();
    Object.defineProperty(backend.distClient, "sendFlagEvaluationMetrics", { value: mockSendEvents });
    jest.spyOn(backend.distClient, "sendFlagEvaluationMetrics").mockImplementation(async () => {
        throw new Error('error');
    });

    await backend.initialize();
    expect(backend.getBool('ns-1', 'bool', new ClientContext().setBoolean('key', true))).toEqual(true);
    await backend.close();

    expect(mockSendEvents.mock.calls.length).toEqual(1);
    expect(backend.eventsBatcher.batch.length).toEqual(1);
});

test('send metrics batch size', async () => {
    const testBackend = await setupBackend();
    const backend = testBackend.backend;
    backend.eventsBatcher.batchSize = 1;

    const mockSendEvents = jest.fn();
    Object.defineProperty(backend.distClient, "sendFlagEvaluationMetrics", { value: mockSendEvents });
    jest.spyOn(backend.distClient, "sendFlagEvaluationMetrics").mockImplementation(async () => {
        return new SendFlagEvaluationMetricsResponse();
    });

    await backend.initialize();
    expect(backend.getBool('ns-1', 'bool', new ClientContext().setBoolean('key', true))).toEqual(true);
    expect(backend.getBool('ns-1', 'bool', new ClientContext().setBoolean('key', true))).toEqual(true);
    await backend.close();
    expect(mockSendEvents.mock.calls.length).toEqual(2);
    expect(backend.eventsBatcher.batch.length).toEqual(0);
});

test('test json return type', async () => {
    const testBackend = await setupBackend();
    const backend = testBackend.backend;

    const mockSendEvents = jest.fn();
    Object.defineProperty(backend.distClient, "sendFlagEvaluationMetrics", { value: mockSendEvents });
    jest.spyOn(backend.distClient, "sendFlagEvaluationMetrics").mockImplementation(async () => {
        return new SendFlagEvaluationMetricsResponse();
    });

    await backend.initialize();

    const result: jsonConfigType = backend.getJSON('ns-1', 'json', new ClientContext());
    expect(result).toEqual({a: 1});

    await backend.close();
});

test('test empty context', async () => {
    const testBackend = await setupBackend();
    const backend = testBackend.backend;

    const mockSendEvents = jest.fn();
    Object.defineProperty(backend.distClient, "sendFlagEvaluationMetrics", { value: mockSendEvents });
    jest.spyOn(backend.distClient, "sendFlagEvaluationMetrics").mockImplementation(async () => {
        return new SendFlagEvaluationMetricsResponse();
    });

    await backend.initialize();

    const result = backend.getBool('ns-1', 'bool');
    expect(result).toEqual(true);

    await backend.close();
});
