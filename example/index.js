const lekko = require('@lekko/node-server-sdk');
  
async function getFeature() {
  // Initialize the client, replace "repo_owner", "repo_name" and "lekko_api_key"
  const client = await lekko.initAPIClient(
    {
      apiKey: "lekko_e43fc617-7788-4f1f-9c20-cf7302d8bd5a_0c58fed2-f88e-4991-9bc8-ad38b1d267b7",
      repositoryOwner: "lekkodev",
      repositoryName: "dan-prod-test"
    }
  )
  
  // Get a feature, replace "my_namespace", and "my_feature"
  return await client.getBoolFeature("default", "example", new lekko.ClientContext().setString("asdf", "my_context_value"));
}

getFeature().then(feature => console.log(feature))
