# Lekko Node Server SDK Typescript Example

## Install and run the server
```
npm install
```

```
example script to demonstrate usage of the node-server-sdk

Options:
  -t, --type [type]                     type of lekko client to instantiate (default: "cached")
  -a, --apikey [apikey]                 api key to communicate with lekko (default: "")
  -o, --owner-name [ownername]          configuration repository owner (default: "lekkodev")
  -r, --repo-name [reponame]            configuration repository name (default: "example")
  -n, --namespace [namespace]           namespace of configuration to fetch (default: "default")
  -c, --config [name]                   name of configuration to fetch (default: "example")
  -ct, --config-type [configtype]       type of configuration fetch (default: "bool")
  -p, --path [path]                     path to config repository on disk (default: "")
  -sp, --server-port [port]             port to use for debug server (default: "3003")
  -s, --sleep [seconds]                 duration in seconds to sleep after fetching (default: "0")
  -h, --hostname [url]                  url to fetch configuration from (default: "")
  -tp, --transport-protocol [protocol]  protocol to use for communicating with the server (http, grpc)
                                        (default: "")
  --help                                display help for command
```

To run the example with the in-memory client that hits lekko backend, you will need to provide an API key.

```bash
npm run start -- \
    --apikey $LEKKO_API_KEY \
    --owner-name myowner \
    --repo-name myrepo \
    --namespace myns \
    --config myconfig
```
