const { 
  ClientContext,
  initAPIClient,
  initSidecarClient,
  initBackendInMemoryClient,
  initGitInMemoryClient,
} = require('../');
const { program } = require('commander');

program
  .name('example')
  .description('example script to demonstrate usage of the node-server-sdk')
  .option('-t, --type [type]', 'type of lekko client to instantiate', 'backend')
  .option('-a, --apikey [apikey]', 'api key to communicate with lekko', '')
  .option('-o, --owner-name [ownername]', 'configuration repository owner', 'lekkodev')
  .option('-r, --repo-name [reponame]', 'configuration repository name', 'example')
  .option('-n, --namespace [namespace]', 'namespace of configuration to fetch', 'default')
  .option('-c, --config [name]', 'name of configuration to fetch', 'example')
  .option('-ct, --config-type [configtype]', 'type of configuration fetch', 'bool')
  .option('-p, --path [path]', 'path to config repository on disk', '');

program.parse(process.argv);
const opts = program.opts();

async function initClient() {
  var client;
  switch (opts.type) {
    case 'api':
      if (opts.apiKey.length == 0) {
        throw new Error('no apikey provided');
      }
      client = initAPIClient({
        apiKey: opts.apikey,
        repositoryOwner: opts.ownerName,
        repositoryName: opts.repoName,
      });
      break;
    case 'sidecar':
      client = initSidecarClient({
        repositoryOwner: opts.ownerName,
        repositoryName: opts.repoName,
      });
      break;
    case 'backend':
      if (!opts.apikey || opts.apikey.length == 0) {
        throw new Error('no apikey provided');
      }
      client = initBackendInMemoryClient({
        apiKey: opts.apikey,
        repositoryOwner: opts.ownerName,
        repositoryName: opts.repoName,
        updateIntervalMs: 3 * 1000,
      });
      break;
    case 'git':
      if (opts.path.length == 0) {
        throw new Error('no path provided');
      }
      client = initGitInMemoryClient({
        apiKey: opts.apikey,
        repositoryOwner: opts.ownerName,
        repositoryName: opts.repoName,
        path: opts.path,
      });
      break;
    default:
      throw new Error(`unknown lekko client type '${opts.type}'`);
  }
  return client;
}

async function getConfig(client) {
  const ns = opts.namespace;
  const key = opts.config;
  const ctx = new ClientContext();
  switch (opts.configType) {
    case 'bool': return await client.getBoolFeature(ns, key, ctx);
    case 'string': return await client.getStringFeature(ns, key, ctx);
    case 'int': return await client.getIntFeature(ns, key, ctx);
    case 'float': return await client.getFloatFeature(ns, key, ctx);
    case 'json': return await client.getJSONFeature(ns, key, ctx);
    case 'proto': return await client.getProtoFeature(ns, key, ctx);
  }
  throw new Error(`unknown config type '${opts.configType}' `);
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

initClient()
  .then((c) => {
    console.log('a' || 'b');
    getConfig(c)
    .then(config => {
      console.log(`${opts.ownerName}/${opts.repoName}/${opts.namespace}/${opts.config} [${opts.configType}]: ${config}`);
      c.close().then(() => {return;});
    });
  });

