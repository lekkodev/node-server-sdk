import { program } from 'commander';
import {
    Client,
    TransportProtocol,
    initAPIClient,
    initCachedAPIClient,
    initCachedGitClient,
    initSidecarClient
} from '../';

program
    .name('example')
    .description('example script to demonstrate usage of the node-server-sdk')
    .option('-t, --type [type]', 'type of lekko client to instantiate', 'cached')
    .option('-a, --apikey [apikey]', 'api key to communicate with lekko', '')
    .option('-o, --owner-name [ownername]', 'configuration repository owner', 'lekkodev')
    .option('-r, --repo-name [reponame]', 'configuration repository name', 'example')
    .option('-n, --namespace [namespace]', 'namespace of configuration to fetch', 'default')
    .option('-c, --config [name]', 'name of configuration to fetch', 'example')
    .option('-ct, --config-type [configtype]', 'type of configuration fetch', 'bool')
    .option('-p, --path [path]', 'path to config repository on disk', '')
    .option('-sp, --server-port [port]', 'port to use for debug server', '3003')
    .option('-s, --sleep [seconds]', 'duration in seconds to sleep after fetching', '0')
    .option('-h, --hostname [url]', 'url to fetch configuration from', '')
    .option('-tp, --transport-protocol [protocol]', 'protocol to use for communicating with the server (http, grpc)', '');

program.parse(process.argv);
const opts = program.opts();
const sleepMs = parseInt(opts.sleep);

async function initClient() {
    let client: Client;
    const hostname = opts.hostname.length > 0 ? opts.hostname : undefined;
    const serverPort = parseInt(opts.serverPort);
    switch (opts.type) {
        case 'api':
            if (opts.apikey.length == 0) {
                throw new Error('no apikey provided');
            }
            client = await initAPIClient({
                apiKey: opts.apikey,
                repositoryOwner: opts.ownerName,
                repositoryName: opts.repoName,
                hostname: hostname,
                transportProtocol: transportProtocol(),
            });
            break;
        case 'sidecar':
            client = await initSidecarClient({
                repositoryOwner: opts.ownerName,
                repositoryName: opts.repoName,
                hostname: hostname,
                transportProtocol: transportProtocol(),
            });
            break;
        case 'cached':
            client = await initCachedAPIClient({
                apiKey: opts.apikey,
                repositoryOwner: opts.ownerName,
                repositoryName: opts.repoName,
                updateIntervalMs: 3 * 1000,
                serverPort: serverPort,
                hostname: hostname,
                transportProtocol: transportProtocol(),
            });
            break;
        case 'git':
            if (opts.path.length == 0) {
                throw new Error('no path provided');
            }
            client = await initCachedGitClient({
                apiKey: opts.apikey,
                repositoryOwner: opts.ownerName,
                repositoryName: opts.repoName,
                path: opts.path,
                serverPort: serverPort,
                hostname: hostname,
                transportProtocol: transportProtocol(),
            });
            break;
        default:
            throw new Error(`unknown lekko client type '${opts.type}'`);
    }
    return client;
}

function transportProtocol() {
    if (opts.transportProtocol.length > 0) {
        switch (opts.transportProtocol) {
            case 'http': return TransportProtocol.HTTP;
            case 'grpc': return TransportProtocol.gRPC;
        }
    }
    return undefined;
}

async function getConfig(client: Client) {
    const ns = opts.namespace;
    const key = opts.config;
    switch (opts.configType) {
        case 'bool': return await client.getBoolFeature(ns, key);
        case 'string': return await client.getStringFeature(ns, key);
        case 'int': return await client.getIntFeature(ns, key);
        case 'float': return await client.getFloatFeature(ns, key);
        case 'json': return await client.getJSONFeature(ns, key);
        case 'proto': return await client.getProtoFeature(ns, key);
    }
    throw new Error(`unknown config type '${opts.configType}' `);
}

async function sleep(ms: number) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

async function main() {
    const client = await initClient();
    const config = await getConfig(client);
    // eslint-disable-next-line no-console
    console.log(`${opts.ownerName}/${opts.repoName}/${opts.namespace}/${opts.config} [${opts.configType}]: ${config}`);
    await sleep(sleepMs * 1000);
    await client.close();
}

main().finally(() => {
    process.exit();
});
