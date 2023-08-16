import { type Transport } from "@bufbuild/connect";
import { createConnectTransport, createGrpcTransport } from "@bufbuild/connect-node";

export enum TransportProtocol {
  HTTP,
  gRPC,
}

const APIKEY_INTERCEPTOR = (apiKey?: string) => (next: any) => async (req: any) => {
  if (apiKey) {
    req.header.set('apikey', apiKey);
  }
  return await next(req);
};

export class ClientTransportBuilder {
  hostname: string;
  protocol: TransportProtocol;
  apiKey?: string;

  constructor({hostname, protocol, apiKey} : {hostname: string, protocol: TransportProtocol, apiKey?: string}) {
    this.hostname = hostname;
    this.protocol = protocol;
    this.apiKey = apiKey;
  }

  async build(): Promise<Transport> {
    if (this.protocol == TransportProtocol.HTTP) {
      if (this.apiKey === undefined) {
        throw new Error("API Key required");
      }
      return createConnectTransport({
        baseUrl: this.hostname,
        httpVersion: '2',
        interceptors: [APIKEY_INTERCEPTOR(this.apiKey)],
      });
    }
    if (this.protocol == TransportProtocol.gRPC) {
      return createGrpcTransport({
        baseUrl: this.hostname,
        httpVersion: '2',
        interceptors: [APIKEY_INTERCEPTOR(this.apiKey)],
      });
    }
    throw new Error("Unknown transport type");
  }
}
