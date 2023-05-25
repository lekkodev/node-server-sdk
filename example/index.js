const express = require('express');
const lekko = require('@lekko/node-server-sdk');
const app = express();
const port = 3000;

app.listen(port, async () => {
  console.log(`Example app listening on port ${port}`);
  
  // Initialize the client, replace "repo_owner", "repo_name" and "lekko_api_key"
  const client = lekko.initApiClient("repo_owner", "repo_name", "lekko_api_key");

  // Get a feature, replace "my_namespace", and "my_feature"
  const stringFeature = await client.getStringFeature("my_namespace", "my_feature", new lekko.ClientContext().setString("my_context_key", "my_context_value"));
  console.log(stringFeature);
  process.exit();
})
