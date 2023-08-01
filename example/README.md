# Lekko Node Server SDK Example

## Install and run the server
```
npm install
```

```
example script to demonstrate usage of the node-server-sdk

Options:
  -t, --type [type]                type of lekko client to instantiate (default: "backend")
  -a, --apikey [apikey]            api key to communicate with lekko (default: "")
  -o, --owner-name [ownername]     configuration repository owner (default: "lekkodev")
  -r, --repo-name [reponame]       configuration repository name (default: "example")
  -n, --namespace [namespace]      namespace of configuration to fetch (default: "default")
  -c, --config [name]              name of configuration to fetch (default: "example")
  -ct, --config-type [configtype]  type of configuration fetch (default: "bool")
  -h, --help                       display help for command
```

To run the example with the in-memory client that hits lekko backend, you will need to provide an API key.

```bash
node index \
    --apikey $LEKKO_API_KEY \
    --owner-name myowner \
    --repo-name myrepo \
    --namespace myns \
    --config myconfig
```
