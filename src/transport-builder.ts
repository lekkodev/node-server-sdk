import {type Transport} from "@bufbuild/connect";
import {createConnectTransport, createGrpcTransport} from "@bufbuild/connect-node";

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
      return await createConnectTransport({
        baseUrl: this.hostname,
        httpVersion: '2',
        interceptors: [APIKEY_INTERCEPTOR(this.apiKey)],
      });
    }
    if (this.protocol == TransportProtocol.gRPC) {
      return await createGrpcTransport({
          baseUrl: this.hostname,
          httpVersion: '2',
        });
    }
    throw new Error("Unknown transport type");
  }
}
