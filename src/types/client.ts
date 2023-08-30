import { Any } from "@bufbuild/protobuf";
import { ClientContext } from "../context/context";

export interface Client {
    getBool(namespace: string, key: string, ctx?: ClientContext): Promise<boolean>;
    getInt(namespace: string, key: string, ctx?: ClientContext): Promise<bigint>;
    getFloat(namespace: string, key: string, ctx?: ClientContext): Promise<number>;
    getString(namespace: string, key: string, ctx?: ClientContext): Promise<string>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getJSON(namespace: string, key: string, ctx?: ClientContext): Promise<any>;
    getProto(namespace: string, key: string, ctx?: ClientContext): Promise<Any>;
    close(): Promise<void>;
}

