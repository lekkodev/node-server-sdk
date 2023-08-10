import { DeregisterClientResponse, RegisterClientResponse, SendFlagEvaluationMetricsResponse } from '@buf/lekkodev_cli.bufbuild_es/lekko/backend/v1beta1/distribution_service_pb';
import { Any, proto3 } from '@bufbuild/protobuf';
import git from 'isomorphic-git';
import { dump } from 'js-yaml';
import { createFsFromVolume, memfs } from 'memfs';
import { ClientContext } from '../../context/context';
import { protoAny, testContents } from "../../fixtures/contents";
import { ClientTransportBuilder, TransportProtocol } from "../../transport-builder";
import { Git, RootConfigMetadata } from "../git";

async function setupFS() {
    const contents = testContents();
    const md : RootConfigMetadata = {
        version: 'v1',
        namespaces: contents.namespaces.map((ns) => ns.name)
    };
    const mdStr = dump(md);
    const { vol } = memfs();
    vol.mkdirSync('/config', { recursive: true});
    const fs = createFsFromVolume(vol);
    await git.init({fs, dir: '/config'});
    vol.writeFileSync('/config/lekko.root.yaml', mdStr);
    for (const ns of contents.namespaces) {
        for (const cfg of ns.features) {
            if (cfg.feature) {
                const dir = `/config/${ns.name}/gen/proto`;
                vol.mkdirSync(dir, { recursive: true });
                const path = `${dir}/${cfg.name}.proto.bin`;
                vol.writeFileSync(path, cfg.feature.toBinary());
            }
        }
    }
    
    await git.add({fs, dir: '/config', filepath: '.'});
    const sha = await git.commit({
        fs, 
        dir: '/config', 
        author: {name: 'test', email: 'test@lekko.com'}, 
        message: 'initial commit',
    });
    
    return {
        fs,
        sha
    };
}

async function setupClient() {
    const transport = await new ClientTransportBuilder({
        hostname: "http://localhost:8000",
        protocol: TransportProtocol.HTTP,
        apiKey: 'apikey'
    }).build();
    const sessionKey = 'session-key';
    const { fs, sha } = await setupFS();
    // Exp for use of 'any': https://github.com/streamich/unionfs/issues/453
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = new Git('owner', 'repo', '/config', false, transport, fs as any);
    if (client.distClient) {
        const mockRegister = jest.fn();
        Object.defineProperty(client.distClient, "registerClient", { value: mockRegister });
        jest.spyOn(client.distClient, "registerClient").mockImplementation(async () => {
            return new RegisterClientResponse({sessionKey});
        });
        const mockDeregister = jest.fn();
        Object.defineProperty(client.distClient, "deregisterClient", { value: mockDeregister });
        jest.spyOn(client.distClient, "deregisterClient").mockImplementation(async () => {
            return new DeregisterClientResponse();
        });
        const mockSendEvents = jest.fn();
        Object.defineProperty(client.distClient, "sendFlagEvaluationMetrics", { value: mockSendEvents });
        jest.spyOn(client.distClient, "sendFlagEvaluationMetrics").mockImplementation(async () => {
            return new SendFlagEvaluationMetricsResponse();
        });
    }
    return { client, sha };
}

test('test git', async () => {
    const { client, sha } = await setupClient();
    await client.initialize();
    expect(client.store.getCommitSHA()).toEqual(sha);
    expect(await client.getBoolFeature('ns-1', 'bool', new ClientContext().setBoolean('key', true))).toEqual(true);
    expect(await client.getIntFeature('ns-1', 'int', new ClientContext().setInt('key', 12))).toEqual(BigInt(12));
    expect(await client.getFloatFeature('ns-1', 'float', new ClientContext().setDouble('key', 12.12))).toEqual(12.28);
    expect(await client.getStringFeature('ns-1', 'string', new ClientContext().setString('key', 'foo'))).toEqual('hello');
    expect(await client.getJSONFeature('ns-1', 'json', new ClientContext())).toEqual({a: 1});
    expect(proto3.util.equals(Any, await client.getProtoFeature('ns-1', 'proto', new ClientContext()), protoAny())).toBeTruthy();
    await client.close();
});



