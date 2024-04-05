import { ConfigurationService } from './gen/lekko/client/v1beta1/configuration_service_connect';
import {
    GetBoolValueRequest,
    GetFloatValueRequest,
    GetIntValueRequest,
    GetJSONValueRequest,
    GetProtoValueRequest,
    GetStringValueRequest,
    //  RegisterRequest,
    RepositoryKey,
} from './gen/lekko/client/v1beta1/configuration_service_pb';
import { PromiseClient, Transport, createPromiseClient } from '@connectrpc/connect';
import { Any } from '@bufbuild/protobuf';
import { ClientContext } from './context/context';
import { AsyncClient } from './types/client';

export class TransportClient implements AsyncClient {
    baseContext: ClientContext;
    client: PromiseClient<typeof ConfigurationService>;
    repository: RepositoryKey;

    constructor(repositoryOwner: string, repositoryName: string, transport: Transport) {
        this.baseContext = new ClientContext();
        this.repository = RepositoryKey.fromJson({
            ownerName: repositoryOwner,
            repoName: repositoryName,
        });
        this.client = createPromiseClient(ConfigurationService, transport);
    }

    async close(): Promise<void> {
        return;
    }

    async getBool(
        namespace: string,
        key: string,
        ctx?: ClientContext | { [key: string]: string | number | boolean },
    ): Promise<boolean> {
        if (!ctx) {
            ctx = new ClientContext();
        } else if (!(ctx instanceof ClientContext)) {
            ctx = ClientContext.fromJSON(ctx);
        }
        const req = GetBoolValueRequest.fromJson({
            namespace: namespace,
            key: key,
        });
        req.repoKey = this.repository;
        Object.assign(req.context, this.baseContext.data, ctx.data);
        const res = await this.client.getBoolValue(req);
        return res.value;
    }

    async getInt(
        namespace: string,
        key: string,
        ctx?: ClientContext | { [key: string]: string | number | boolean },
    ): Promise<bigint> {
        if (!ctx) {
            ctx = new ClientContext();
        } else if (!(ctx instanceof ClientContext)) {
            ctx = ClientContext.fromJSON(ctx);
        }
        const req = GetIntValueRequest.fromJson({
            namespace: namespace,
            key: key,
        });
        req.repoKey = this.repository;
        Object.assign(req.context, this.baseContext.data, ctx.data);
        const res = await this.client.getIntValue(req);
        return res.value;
    }

    async getFloat(
        namespace: string,
        key: string,
        ctx?: ClientContext | { [key: string]: string | number | boolean },
    ): Promise<number> {
        if (!ctx) {
            ctx = new ClientContext();
        } else if (!(ctx instanceof ClientContext)) {
            ctx = ClientContext.fromJSON(ctx);
        }
        const req = GetFloatValueRequest.fromJson({
            namespace: namespace,
            key: key,
        });
        req.repoKey = this.repository;
        Object.assign(req.context, this.baseContext.data, ctx.data);
        const res = await this.client.getFloatValue(req);
        return res.value;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async getJSON(
        namespace: string,
        key: string,
        ctx?: ClientContext | { [key: string]: string | number | boolean },
    ): Promise<any> {
        if (!ctx) {
            ctx = new ClientContext();
        } else if (!(ctx instanceof ClientContext)) {
            ctx = ClientContext.fromJSON(ctx);
        }
        const req = GetJSONValueRequest.fromJson({
            namespace: namespace,
            key: key,
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

    async getProto(
        namespace: string,
        key: string,
        ctx?: ClientContext | { [key: string]: string | number | boolean },
    ): Promise<Any> {
        if (!ctx) {
            ctx = new ClientContext();
        } else if (!(ctx instanceof ClientContext)) {
            ctx = ClientContext.fromJSON(ctx);
        }
        const req = GetProtoValueRequest.fromJson({
            namespace: namespace,
            key: key,
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
            ...res.value,
        });
    }

    async getString(
        namespace: string,
        key: string,
        ctx?: ClientContext | { [key: string]: string | number | boolean },
    ): Promise<string> {
        if (!ctx) {
            ctx = new ClientContext();
        } else if (!(ctx instanceof ClientContext)) {
            ctx = ClientContext.fromJSON(ctx);
        }
        const req = GetStringValueRequest.fromJson({
            namespace: namespace,
            key: key,
        });
        req.repoKey = this.repository;
        Object.assign(req.context, this.baseContext.data, ctx.data);
        const res = await this.client.getStringValue(req);
        return res.value;
    }
}
