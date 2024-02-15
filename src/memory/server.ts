import { SDKService } from "@buf/lekkodev_sdk.bufbuild_connect-es/lekko/server/v1beta1/sdk_connect";
import { ConfigurationService } from "@buf/lekkodev_sdk.bufbuild_connect-es/lekko/client/v1beta1/configuration_service_connect";
import { Code, ConnectError, ConnectRouter } from "@bufbuild/connect";
import { connectNodeAdapter } from "@bufbuild/connect-node";
import { cors as connectCors } from "@bufbuild/connect";
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
  Value,
} from "@buf/lekkodev_sdk.bufbuild_es/lekko/client/v1beta1/configuration_service_pb";
import { Client, DevClient } from "../types/client";
import { ClientContext } from "../context/context";

const LOCAL_PATH_HEADER = "localpath";

// Runs a simple vanilla nodejs web server for debugging.
// The server exposes the interface defined here:
//      https://buf.build/lekkodev/sdk/docs/main:lekko.server.v1beta1
export class SDKServer {
  client: Client & DevClient;
  server?: http.Server;

  constructor(client: Client & DevClient, port?: number) {
    this.client = client;
    if (!port) {
      return;
    }
    const corsHandler = cors({
      origin: true,
      methods: [...connectCors.allowedMethods],
      allowedHeaders: [
        LOCAL_PATH_HEADER,
        "apikey",
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
          try {
            const value = this.client.getBool(
              req.namespace,
              req.key,
              this.fromReqContext(req.context)
            );
            this.logEval("boolean", req.namespace, req.key);
            return new GetBoolValueResponse({ value });
          } catch (e) {
            if (e instanceof NotFoundError) {
              throw new ConnectError(e.message, Code.NotFound);
            }
            throw e;
          }
        },
        getIntValue: async (req, context) => {
          await this.handleHeaders(context.requestHeader);
          try {
            const value = this.client.getInt(
              req.namespace,
              req.key,
              this.fromReqContext(req.context)
            );
            this.logEval("int", req.namespace, req.key);
            return new GetIntValueResponse({ value });
          } catch (e) {
            if (e instanceof NotFoundError) {
              throw new ConnectError(e.message, Code.NotFound);
            }
            throw e;
          }
        },
        getFloatValue: async (req, context) => {
          await this.handleHeaders(context.requestHeader);
          try {
            const value = this.client.getFloat(
              req.namespace,
              req.key,
              this.fromReqContext(req.context)
            );
            this.logEval("float", req.namespace, req.key);
            return new GetFloatValueResponse({ value });
          } catch (e) {
            if (e instanceof NotFoundError) {
              throw new ConnectError(e.message, Code.NotFound);
            }
            throw e;
          }
        },
        getStringValue: async (req, context) => {
          await this.handleHeaders(context.requestHeader);
          try {
            const value = this.client.getString(
              req.namespace,
              req.key,
              this.fromReqContext(req.context)
            );
            this.logEval("string", req.namespace, req.key);
            return new GetStringValueResponse({ value });
          } catch (e) {
            if (e instanceof NotFoundError) {
              throw new ConnectError(e.message, Code.NotFound);
            }
            throw e;
          }
        },
        getJSONValue: async (req, context) => {
          await this.handleHeaders(context.requestHeader);
          try {
            const value = this.client.getJSON(
              req.namespace,
              req.key,
              this.fromReqContext(req.context)
            );
            this.logEval("JSON", req.namespace, req.key);
            return new GetJSONValueResponse({
              value: new TextEncoder().encode(JSON.stringify(value)),
            });
          } catch (e) {
            if (e instanceof NotFoundError) {
              throw new ConnectError(e.message, Code.NotFound);
            }
            throw e;
          }
        },
        getProtoValue: async (req, context) => {
          await this.handleHeaders(context.requestHeader);
          try {
            const value = this.client.getProto(
              req.namespace,
              req.key,
              this.fromReqContext(req.context)
            );
            this.logEval("proto", req.namespace, req.key);
            return new GetProtoValueResponse({ value });
          } catch (e) {
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

  fromReqContext(context: { [key: string]: Value }): ClientContext {
    const clientContext = new ClientContext();
    Object.entries(context).forEach(([key, value]) => {
      switch (value.kind.case) {
        case "boolValue": {
          clientContext.setBoolean(key, value.kind.value);
          break;
        }
        case "intValue": {
          // TODO: SDKs should correctly handle near-64-bit cases
          clientContext.setInt(key, Number(value.kind.value));
          break;
        }
        case "doubleValue": {
          clientContext.setDouble(key, value.kind.value);
          break;
        }
        case "stringValue": {
          clientContext.setString(key, value.kind.value);
        }
      }
    });
    return clientContext;
  }

  logEval(type: string, namespace: string, key: string): void {
    // eslint-disable-next-line no-console
    console.log(`Served ${type} config ${namespace}/${key}`);
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
