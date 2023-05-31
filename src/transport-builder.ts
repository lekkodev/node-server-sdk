import {isNode} from "browser-or-node";
import {type Transport} from "@bufbuild/connect";
import {createConnectTransport} from "@bufbuild/connect-web";

export enum TransportProtocol {
  HTTP,
  gRPC,
}

const APIKEY_INTERCEPTOR = (apiKey: string) => (next: any) => async (req: any) => {
  req.header.set('apikey', apiKey);
  return await next(req);
};

export class ClientTransportBuilder {
  hostname: string;
  protocol: TransportProtocol;
  apiKey: string;

  constructor(hostname: string, protocol: TransportProtocol, apiKey: string) {
    this.hostname = hostname;
    this.protocol = protocol;
    this.apiKey = apiKey;
  }

  async build(): Promise<Transport> {
    if (this.protocol == TransportProtocol.HTTP) {
      if (isNode) {
        const connectNode = await import("@bufbuild/connect-node");
        return await connectNode.createConnectTransport({
          baseUrl: this.hostname,
          httpVersion: '2',
          interceptors: [APIKEY_INTERCEPTOR(this.apiKey)],
        });
      } else {
        // transport for connect-web
        return createConnectTransport({
          baseUrl: this.hostname,
          interceptors: [APIKEY_INTERCEPTOR(this.apiKey)],
        });
      }
    }
    if (this.protocol == TransportProtocol.gRPC) {
      if (isNode){
        const connectNode = await import("@bufbuild/connect-node");
        return await connectNode.createGrpcTransport({
            baseUrl: this.hostname,
            httpVersion: '2',
          });
      }
    }
    throw new Error("Unknown transport type");
  }
}
