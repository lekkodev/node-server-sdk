import {
  ConfigurationService,
} from '@buf/lekkodev_sdk.bufbuild_connect-es/lekko/client/v1beta1/configuration_service_connect';
import {
  GetBoolValueRequest,
  GetFloatValueRequest,
  GetIntValueRequest,
  GetJSONValueRequest,
  GetProtoValueRequest,
  GetStringValueRequest,
  //  RegisterRequest,
  RepositoryKey
} from '@buf/lekkodev_sdk.bufbuild_es/lekko/client/v1beta1/configuration_service_pb';
import { PromiseClient, Transport, createPromiseClient } from "@bufbuild/connect";
import { Any } from '@bufbuild/protobuf';
import { ClientContext } from './context/context';
import { Client } from './types/client';

export class TransportClient implements Client {
  baseContext: ClientContext;
  client: PromiseClient<typeof ConfigurationService>;
  repository: RepositoryKey;

  constructor(
    repositoryOwner: string,
    repositoryName: string,
    transport: Transport
  ) {
    this.baseContext = new ClientContext();
    this.repository = RepositoryKey.fromJson({
      'ownerName': repositoryOwner,
      'repoName': repositoryName,
    });
    this.client = createPromiseClient(ConfigurationService, transport);
  }

  async close(): Promise<void> {
    return;
  }

  async getBoolFeature(namespace: string, key: string, ctx: ClientContext): Promise<boolean> {
    if (!ctx) {
      ctx = new ClientContext();
    }
    const req = GetBoolValueRequest.fromJson({
      'namespace': namespace,
      'key': key,
    });
    req.repoKey = this.repository;
    Object.assign(req.context, this.baseContext.data, ctx.data);
    const res = await this.client.getBoolValue(req);
    return res.value;
  }

  async getIntFeature(namespace: string, key: string, ctx: ClientContext): Promise<bigint> {
    if (!ctx) {
      ctx = new ClientContext();
    }
    const req = GetIntValueRequest.fromJson({
      'namespace': namespace,
      'key': key,
    });
    req.repoKey = this.repository;
    Object.assign(req.context, this.baseContext.data, ctx.data);
    const res = await this.client.getIntValue(req);
    return res.value;
  }

  async getFloatFeature(namespace: string, key: string, ctx: ClientContext): Promise<number> {
    if (!ctx) {
      ctx = new ClientContext();
    }
    const req = GetFloatValueRequest.fromJson({
      'namespace': namespace,
      'key': key,
    });
    req.repoKey = this.repository;
    Object.assign(req.context, this.baseContext.data, ctx.data);
    const res = await this.client.getFloatValue(req);
    return res.value;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getJSONFeature(namespace: string, key: string, ctx: ClientContext): Promise<any> {
    if (!ctx) {
      ctx = new ClientContext();
    }
    const req = GetJSONValueRequest.fromJson({
      'namespace': namespace,
      'key': key,
    });
    req.repoKey = this.repository;
    Object.assign(req.context, this.baseContext.data, ctx.data);
    const res = await this.client.getJSONValue(req);
    try {
      const decoded = Buffer.from(res.value).toString();
      return JSON.parse(decoded);
    } catch (ex) {
      // Invalid encoding?
    }
    return {};
  }

  async getProtoFeature(namespace: string, key: string, ctx: ClientContext): Promise<Any> {
    if (!ctx) {
      ctx = new ClientContext();
    }
    const req = GetProtoValueRequest.fromJson({
      'namespace': namespace,
      'key': key,
    });
    req.repoKey = this.repository;
    Object.assign(req.context, this.baseContext.data, ctx.data);
    const res = await this.client.getProtoValue(req);
    if (res.valueV2 !== undefined) {
      return new Any({
        typeUrl: res.valueV2.typeUrl,
        value: res.valueV2.value,
      });
    }
    return new Any({
      ...res.value
    });
  }

  async getStringFeature(namespace: string, key: string, ctx: ClientContext): Promise<string> {
    if (!ctx) {
      ctx = new ClientContext();
    }
    const req = GetStringValueRequest.fromJson({
      'namespace': namespace,
      'key': key,
    });
    req.repoKey = this.repository;
    Object.assign(req.context, this.baseContext.data, ctx.data);
    const res = await this.client.getStringValue(req);
    return res.value;
  }
}
