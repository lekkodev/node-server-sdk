import { Any } from "@bufbuild/protobuf";
import { ClientContext } from "../context/context";
import { ListContentsResponse } from '../gen/lekko/server/v1beta1/sdk_pb';

export interface AsyncClient {
    getBool(namespace: string, key: string, ctx?: ClientContext | { [key: string]: string | number | boolean }): Promise<boolean>;
    getInt(namespace: string, key: string, ctx?: ClientContext | { [key: string]: string | number | boolean }): Promise<bigint>;
    getFloat(namespace: string, key: string, ctx?: ClientContext | { [key: string]: string | number | boolean }): Promise<number>;
    getString(namespace: string, key: string, ctx?: ClientContext | { [key: string]: string | number | boolean }): Promise<string>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getJSON(namespace: string, key: string, ctx?: ClientContext | { [key: string]: string | number | boolean }): Promise<any>;
    getProto(namespace: string, key: string, ctx?: ClientContext | { [key: string]: string | number | boolean }): Promise<Any>;
    close(): Promise<void>;
}

export interface Client {
  getBool(namespace: string, key: string, ctx?: ClientContext | { [key: string]: string | number | boolean }): boolean;
  getInt(namespace: string, key: string, ctx?: ClientContext | { [key: string]: string | number | boolean }): bigint;
  getFloat(namespace: string, key: string, ctx?: ClientContext | { [key: string]: string | number | boolean }): number;
  getString(namespace: string, key: string, ctx?: ClientContext | { [key: string]: string | number | boolean }): string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getJSON(namespace: string, key: string, ctx?: ClientContext | { [key: string]: string | number | boolean }): any;
  getProto(namespace: string, key: string, ctx?: ClientContext | { [key: string]: string | number | boolean }): Any;
  close(): Promise<void>;
}

export interface DevClient {
    listContents(): ListContentsResponse;
    reinitialize(options: { path?: string, force?: boolean }): Promise<void>;
    createConfig(type: "bool" | "string" | "int" | "float" | "json", namespace: string, key: string): Promise<void>;
}
