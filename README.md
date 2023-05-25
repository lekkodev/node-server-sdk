# Lekko Node Server SDK
The Lekko Server SDK for Node.js

## Getting Started
Initializing a Lekko client in API Provider mode
```
const lekko = require('@lekko/node-server-sdk');
const client = lekko.initApiClient("repo_owner", "repo_name", "lekko_api_key");
const stringFeature = await client.getStringFeature("my_namespace", "my_feature", new lekko.ClientContext().setString("my_context_key", "my_context_value"));
```

## Example
See: https://github.com/lekkodev/node-server-sdk/tree/main/example
