import { DeregisterClientResponse, GetRepositoryVersionResponse, RegisterClientResponse } from "@buf/lekkodev_cli.bufbuild_es/lekko/backend/v1beta1/distribution_service_pb";
import { Any, Int32Value, Value } from "@bufbuild/protobuf";
import { ClientContext } from "../../context/context";
import { contents, namespace } from '../../fixtures/contents';
import { simpleConfig } from "../../fixtures/eval";
import { ClientTransportBuilder, TransportProtocol } from "../../transport-builder";
import { Backend } from "../backend";


test('test backend', async () => {
    const transport = await new ClientTransportBuilder({
        hostname: "http://localhost:8000",
        protocol: TransportProtocol.HTTP,
        apiKey: 'apikey'
    }).build();
    const backend = new Backend(transport, 'owner', 'repo', 30 * 1000);
    const mockRegister = jest.fn();
    Object.defineProperty(backend.distClient, "registerClient", {
        value: mockRegister,
        configurable: true,
        writable: true
    });
    jest.spyOn(backend.distClient, "registerClient").mockImplementation(async () => {
        return new RegisterClientResponse({sessionKey: 'session-key'});
    });

    
    const jsonVal = Value.fromJsonString(JSON.stringify({
        a: 1
    }));
    const protoVal = new Int32Value({
        value: 42,
    });
    const protoAny = Any.pack(protoVal);

    const resp = contents(
        'sha', 
        namespace(
            'ns-1',
            simpleConfig('bool', true),
            simpleConfig('int', BigInt(12)),
            simpleConfig('float', 12.28),
            simpleConfig('string', 'hello'),
            simpleConfig('json', Any.pack(jsonVal)),
            simpleConfig('proto', protoAny),
        ),
    );

    const mockVersion = jest.fn();
    Object.defineProperty(backend.distClient, "getRepositoryVersion", {
        value: mockVersion,
        configurable: true,
        writable: true
    });
    jest.spyOn(backend.distClient, "getRepositoryVersion").mockImplementation(async () => {
        return new GetRepositoryVersionResponse({commitSha: 'sha'});
    });

    const mockContents = jest.fn();
    Object.defineProperty(backend.distClient, "getRepositoryContents", {
        value: mockContents,
        configurable: true,
        writable: true
    });
    jest.spyOn(backend.distClient, "getRepositoryContents").mockImplementation(async () => {
        return resp;
    });

    const mockDeregister = jest.fn();
    Object.defineProperty(backend.distClient, "deregisterClient", {
        value: mockDeregister,
        configurable: true,
        writable: true
    });
    jest.spyOn(backend.distClient, "deregisterClient").mockImplementation(async () => {
        return new DeregisterClientResponse();
    });

    await backend.initialize();

    expect(await backend.getBoolFeature('ns-1', 'bool', new ClientContext())).toEqual(true);
    expect(await backend.getIntFeature('ns-1', 'int', new ClientContext())).toBe(12);
    expect(await backend.getFloatFeature('ns-1', 'float', new ClientContext())).toEqual(12.28);
    expect(await backend.getStringFeature('ns-1', 'string', new ClientContext())).toEqual('hello');
    expect(await backend.getJSONFeature('ns-1', 'json', new ClientContext())).toEqual({a: 1});
    expect(await backend.getProtoFeature('ns-1', 'proto', new ClientContext())).toEqual(protoAny);

    expect(async () => {
        await backend.getBoolFeature('ns-1', 'int', new ClientContext()); // type mismatch
    }).rejects.toThrow();

    await backend.close();
    
});



