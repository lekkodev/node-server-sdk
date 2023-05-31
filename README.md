# Lekko Node Server SDK
The Lekko Server SDK for Node.js

## Getting Started
Initializing a Lekko client in API Provider mode
```
const lekko = require('@lekko/node-server-sdk');
const client = await lekko.initApiClient(
{
    hostname: "hostname",
    apiKey: "lekko_apikey",
    repositoryOwner: "repo_owner",
    repositoryName: "repo_name"
}
)
const stringFeature = await client.getStringFeature("my_namespace", "my_feature", new lekko.ClientContext().setString("my_context_key", "my_context_value"));
```

## Example
See: https://github.com/lekkodev/node-server-sdk/tree/main/example
