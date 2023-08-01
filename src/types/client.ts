import { Any } from "@bufbuild/protobuf";
import { ClientContext } from "../context/context";

export interface Client {
    getBoolFeature(namespace: string, key: string, ctx: ClientContext): Promise<boolean>;
    getIntFeature(namespace: string, key: string, ctx: ClientContext): Promise<number>;
    getFloatFeature(namespace: string, key: string, ctx: ClientContext): Promise<number>;
    getStringFeature(namespace: string, key: string, ctx: ClientContext): Promise<string>
    getJSONFeature(namespace: string, key: string, ctx: ClientContext): Promise<object>;
    getProtoFeature(namespace: string, key: string, ctx: ClientContext): Promise<Any>;
    close(): Promise<void>;
}

