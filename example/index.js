const lekko = require('@lekko/node-server-sdk');
  
async function getFeature() {
  // Initialize the client, replace "repo_owner", "repo_name" and "lekko_api_key"
  const client = await lekko.initAPIClient(
    {
      apiKey: "lekko_apikey",
      repositoryOwner: "repo_owner",
      repositoryName: "repo_name"
    }
  );
  
  // Get a feature, replace "my_namespace", and "my_feature"
  return await client.getBoolFeature("default", "example", new lekko.ClientContext().setString("my_context_key", "my_context_value"));
}

getFeature().then(feature => console.log(feature));
