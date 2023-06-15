# Lekko Node Server SDK
The Lekko Server SDK for Node.js

## Getting Started
### Initializing a Lekko client in Sidecar provider mode
```
const client = await initSidecarClient({
    hostname: "http://localhost:50051",
    repositoryOwner: "<REPOSITORY_OWNER>", 
    repositoryName: "<REPOSITORY_NAME>",
});
const stringFeature = await client.getStringFeature("my_namespace", "my_feature", new lekko.ClientContext().setString("my_context_key", "my_context_value"));
```
### Initializing a Lekko client in API provider mode
```
const client = await lekko.initAPIClient(
    {
      apiKey: "<API_KEY>",
      repositoryOwner: "<REPOSITORY_OWNER>",
      repositoryName: "<REPOSITORY_NAME>"
    }
  )
  
  const boolFeature = await client.getBoolFeature("default", "example", new lekko.ClientContext().setString("my_context_key", "my_context_value"));
```

## Example
See: https://github.com/lekkodev/node-server-sdk/tree/main/example
