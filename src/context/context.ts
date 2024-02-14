import { Value } from "@buf/lekkodev_sdk.bufbuild_es/lekko/client/v1beta1/configuration_service_pb";

type ContextKey = string;

class ClientContext {
  data: { [key: ContextKey]: Value };

  constructor() {
    this.data = {};
  }

  get(key: string): Value | undefined {
    return key in this.data ? this.data[key] : undefined;
  }

  setBoolean(key: string, val: boolean): this {
    this.data[key] = Value.fromJson({
      boolValue: val,
    });
    return this;
  }

  setInt(key: string, val: number): this {
    this.data[key] = Value.fromJson({
      intValue: val,
    });
    return this;
  }

  setDouble(key: string, val: number): this {
    this.data[key] = Value.fromJson({
      doubleValue: val,
    });
    return this;
  }

  setString(key: string, val: string): this {
    this.data[key] = Value.fromJson({
      stringValue: val,
    });
    return this;
  }

  static fromJson(jsonContext?: {
    [key: string]: string | number | boolean;
  }): ClientContext {
    const ctx = new ClientContext();
    if (jsonContext === undefined) {
      return ctx;
    }
    Object.entries(jsonContext).forEach(([k, v]) => {
      switch (typeof v) {
        case "number":
          // TODO: `1.0` is still integer in js :(
          if (Number.isInteger(v)) {
            ctx.setInt(k, v);
          } else {
            ctx.setDouble(k, v);
          }
          break;
        case "string":
          ctx.setString(k, v);
          break;
        case "boolean":
          ctx.setBoolean(k, v);
          break;
      }
    });
    return ctx;
  }

  toString(): string {
    const pairs: string[] = [];
    for (const k in this.data) {
      pairs.push(`${k}: ${this.data[k].kind.value}`);
    }
    return pairs.join(", ");
  }
}

export { ClientContext };
