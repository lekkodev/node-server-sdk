import { Any } from "@bufbuild/protobuf";
import { ClientContext } from "../context/context";

export interface Client {
    getBoolFeature(namespace: string, key: string, ctx: ClientContext): Promise<boolean>;
    getIntFeature(namespace: string, key: string, ctx: ClientContext): Promise<bigint>;
    getFloatFeature(namespace: string, key: string, ctx: ClientContext): Promise<number>;
    getStringFeature(namespace: string, key: string, ctx: ClientContext): Promise<string>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getJSONFeature(namespace: string, key: string, ctx: ClientContext): Promise<any>;
    getProtoFeature(namespace: string, key: string, ctx: ClientContext): Promise<Any>;
    close(): Promise<void>;
}

