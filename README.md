# Lekko Node Server SDK

The Lekko Server SDK for Node.js

## Getting Started

### Installation

You can install `@lekko/node-server-sdk` using NPM or Yarn.

### Usage

#### Initializing a cached Lekko client

Creates a client that fetches configs from Lekko backend and caches them in memory. Configs are kept up to date via polling.

```javascript
const lekko = require("@lekko/node-server-sdk");

const client = await lekko.initCachedAPIClient({
    apiKey: <API_KEY>,
    repositoryOwner: <REPOSITORY_OWNER>,
    repositoryName: <REPOSITORY_NAME>,
});

const context = new lekko.ClientContext().setString("my_context_key", "my_context_value");
const stringConfig = await client.getString("my_namespace", "my_config", context);
console.log(stringConfig);
```

#### Initializing a cached Lekko client in git mode

Creates a client that reads configs from a git repository on disk and caches them in memory. Configs are kept up to date via a file watcher.

```javascript
const lekko = require("@lekko/node-server-sdk");

const client = await lekko.initCachedGitClient({
    apiKey: <API_KEY>,
    repositoryOwner: <REPOSITORY_OWNER>,
    repositoryName: <REPOSITORY_NAME>,
    path: 'path/to/config/repo',
});

const context = new lekko.ClientContext().setString("my_context_key", "my_context_value");
const boolConfig = await client.getBool("default", "example", context);
console.log(boolConfig);
```

#### Note on using ES modules

In a traditional Node.js environment, you initialize the Lekko client using CommonJS modules:

```javascript
const lekko = require("@lekko/node-server-sdk");
```

Modern versions of Node also support ES (ECMAScript) modules, using the `import` syntax:

```javascript
import * as lekko from "@lekko/node-server-sdk"; // or
import { initAPIClient, initSidecarClient } from "@lekko/node-server-sdk";
```

The SDK is packaged as a CommonJS module. To use it as an ES module like the above example, add the following to your `package.json`:

```json
{
  "type": "module"
}
```

To learn more about the Node.js module system, refer to their docs [here](https://nodejs.org/api/packages.html#determining-module-system).

## Example

See: https://github.com/lekkodev/node-server-sdk/tree/main/example-ts
