import { SDKService } from "../gen/lekko/server/v1beta1/sdk_connect";
import { ConfigurationService } from "../gen/lekko/client/v1beta1/configuration_service_connect";
import { Code, ConnectError, ConnectRouter } from "@connectrpc/connect";
import { connectNodeAdapter } from "@connectrpc/connect-node";
import { cors as connectCors } from "@connectrpc/connect";
import cors from "cors";
import { NotFoundError } from "./store";
import http from "http";
import {
  GetBoolValueResponse,
  GetFloatValueResponse,
  GetIntValueResponse,
  GetJSONValueResponse,
  GetProtoValueResponse,
  GetStringValueResponse,
} from "../gen/lekko/client/v1beta1/configuration_service_pb";
import { Client, DevClient } from "../types/client";
import { ClientContext } from "../context/context";

const LOCAL_PATH_HEADER = "localpath";
const API_KEY_HEADER = "apikey";

// Runs a simple vanilla nodejs web server for debugging.
// The server exposes the interface defined here:
//      https://buf.build/lekkodev/sdk/docs/main:lekko.server.v1beta1
export class SDKServer {
  client: Client & DevClient;
  server?: http.Server;
  createMissing: boolean;

  constructor(client: Client & DevClient, port?: number, createMissing = true) {
    this.client = client;
    this.createMissing = createMissing;
    if (!port) {
      return;
    }
    const corsHandler = cors({
      origin: true,
      methods: [...connectCors.allowedMethods],
      allowedHeaders: [
        LOCAL_PATH_HEADER,
        API_KEY_HEADER,
        ...connectCors.allowedHeaders,
      ],
      exposedHeaders: [...connectCors.exposedHeaders],
    });
    const routes = (router: ConnectRouter) => {
      router.service(SDKService, {
        listContents: async () => {
          return this.client.listContents();
        },
      });
      // TODO: Clean up code once interceptor support lands in connect-node
      router.service(ConfigurationService, {
        getBoolValue: async (req, context) => {
          await this.handleHeaders(context.requestHeader);
          for (;;) {
            try {
              const value = this.client.getBool(
                req.namespace,
                req.key,
                new ClientContext(req.context)
              );
              this.logEval("boolean", req.namespace, req.key);
              return new GetBoolValueResponse({ value });
            } catch (e) {
              if (e instanceof NotFoundError) {
                if (this.createMissing) {
                  await this.client.createConfig(
                    "bool",
                    req.namespace,
                    req.key
                  );
                  this.logCreate("boolean", req.namespace, req.key);
                  continue;
                }
                throw new ConnectError(e.message, Code.NotFound);
              }
              throw e;
            }
          }
        },
        getIntValue: async (req, context) => {
          await this.handleHeaders(context.requestHeader);
          for (;;) {
            try {
              const value = this.client.getInt(
                req.namespace,
                req.key,
                new ClientContext(req.context)
              );
              this.logEval("int", req.namespace, req.key);
              return new GetIntValueResponse({ value });
            } catch (e) {
              if (e instanceof NotFoundError) {
                if (this.createMissing) {
                  await this.client.createConfig(
                    "bool",
                    req.namespace,
                    req.key
                  );
                  this.logCreate("int", req.namespace, req.key);
                  continue;
                }
                throw new ConnectError(e.message, Code.NotFound);
              }
              throw e;
            }
          }
        },
        getFloatValue: async (req, context) => {
          await this.handleHeaders(context.requestHeader);
          for (;;) {
            try {
              const value = this.client.getFloat(
                req.namespace,
                req.key,
                new ClientContext(req.context)
              );
              this.logEval("float", req.namespace, req.key);
              return new GetFloatValueResponse({ value });
            } catch (e) {
              if (e instanceof NotFoundError) {
                if (this.createMissing) {
                  await this.client.createConfig(
                    "bool",
                    req.namespace,
                    req.key
                  );
                  this.logCreate("float", req.namespace, req.key);
                  continue;
                }
                throw new ConnectError(e.message, Code.NotFound);
              }
              throw e;
            }
          }
        },
        getStringValue: async (req, context) => {
          await this.handleHeaders(context.requestHeader);
          for (;;) {
            try {
              const value = this.client.getString(
                req.namespace,
                req.key,
                new ClientContext(req.context)
              );
              this.logEval("string", req.namespace, req.key);
              return new GetStringValueResponse({ value });
            } catch (e) {
              if (e instanceof NotFoundError) {
                if (this.createMissing) {
                  await this.client.createConfig(
                    "bool",
                    req.namespace,
                    req.key
                  );
                  this.logCreate("string", req.namespace, req.key);
                  continue;
                }
                throw new ConnectError(e.message, Code.NotFound);
              }
              throw e;
            }
          }
        },
        getJSONValue: async (req, context) => {
          await this.handleHeaders(context.requestHeader);
          for (;;) {
            try {
              const value = this.client.getJSON(
                req.namespace,
                req.key,
                new ClientContext(req.context)
              );
              this.logEval("JSON", req.namespace, req.key);
              return new GetJSONValueResponse({
                value: new TextEncoder().encode(JSON.stringify(value)),
              });
            } catch (e) {
              if (e instanceof NotFoundError) {
                if (this.createMissing) {
                  await this.client.createConfig(
                    "json",
                    req.namespace,
                    req.key
                  );
                  this.logCreate("JSON", req.namespace, req.key);
                  continue;
                }
                throw new ConnectError(e.message, Code.NotFound);
              }
              throw e;
            }
          }
        },
        getProtoValue: async (req, context) => {
          await this.handleHeaders(context.requestHeader);
          try {
            const value = this.client.getProto(
              req.namespace,
              req.key,
              new ClientContext(req.context)
            );
            this.logEval("proto", req.namespace, req.key);
            return new GetProtoValueResponse({ value });
          } catch (e) {
            // TODO: Also support auto-creation for proto configs
            if (e instanceof NotFoundError) {
              throw new ConnectError(e.message, Code.NotFound);
            }
            throw e;
          }
        },
      });
    };
    this.server = http
      .createServer((req, res) =>
        corsHandler(req, res, () => connectNodeAdapter({ routes })(req, res))
      )
      .listen(port);
  }

  logEval(type: string, namespace: string, key: string): void {
    // eslint-disable-next-line no-console
    console.log(`Served ${type} config ${namespace}/${key}`);
  }

  logCreate(type: string, namespace: string, key: string): void {
    // eslint-disable-next-line no-console
    console.log(`Created ${type} config ${namespace}/${key}`);
  }

  async handleHeaders(headers: Headers): Promise<void> {
    const localPath = headers.get(LOCAL_PATH_HEADER);
    if (localPath) {
      await this.client.reinitialize({ path: localPath });
    }
  }

  close() {
    if (this.server) {
      this.server.close((err) => {
        if (err) {
          // eslint-disable-next-line no-console
          console.error("Error closing SDK server", err);
        }
      });
    }
  }
}
