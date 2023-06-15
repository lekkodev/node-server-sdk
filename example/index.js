const lekko = require('@lekko/node-server-sdk');
  
async function getFeature() {
  // Initialize the client, replace "repo_owner", "repo_name" and "lekko_api_key"
  const client = await lekko.initAPIClient(
    {
      apiKey: "<API_KEY>",
      repositoryOwner: "<REPOSITORY_OWNER>",
      repositoryName: "<REPOSITORY_NAME>"
    }
  )
  
  // Get a feature, replace "my_namespace", and "my_feature"
  return await client.getBoolFeature("default", "example", new lekko.ClientContext().setString("my_context_key", "my_context_value"));
}

getFeature().then(feature => console.log(feature))
