import { DistributionService } from "@buf/lekkodev_cli.bufbuild_connect-es/lekko/backend/v1beta1/distribution_service_connect";
import { ContextKey, FlagEvaluationEvent, SendFlagEvaluationMetricsRequest } from "@buf/lekkodev_cli.bufbuild_es/lekko/backend/v1beta1/distribution_service_pb";
import { Value } from "@buf/lekkodev_sdk.bufbuild_es/lekko/client/v1beta1/configuration_service_pb";
import { PromiseClient } from "@bufbuild/connect";
import { BackoffOptions, backOff } from 'exponential-backoff';
import { SetIntervalAsyncTimer, clearIntervalAsync, setIntervalAsync } from 'set-interval-async';
import { ClientContext } from "../context/context";

// A class that allows callers to batch flag evaluation events. 
// It will asynchronously send those events to lekko.
export class EventsBatcher {
    distClient: PromiseClient<typeof DistributionService>;
    sessionKey?: string;
    batch: FlagEvaluationEvent[];
    batchSize: number;
    interval?: SetIntervalAsyncTimer<unknown[]>;
    sendPromise?: Promise<void>;
    backoffOptions: BackoffOptions;

    constructor(
        distClient: PromiseClient<typeof DistributionService>,
        batchSize: number,
    ) {
        this.distClient = distClient;
        this.batch = [];
        this.batchSize = batchSize;
        this.backoffOptions = {
            numOfAttempts: 4,
            maxDelay: 500 // 500 ms
        };
    }

    async init(sessionKey: string) {
        this.sessionKey = sessionKey;
        this.interval = setIntervalAsync(async () => {
            await this.sendBatch();
        }, 15 * 1000 /* 15s */);
    }

    track(event: FlagEvaluationEvent) {
        this.batch.push(event);
        if (this.batch.length >= this.batchSize) {
            this.sendPromise = this.sendBatch();
        }
    }

    // Sends the current batch to remote, resetting it to 0.
    async sendBatch() {
        if (this.batch.length == 0) {
            return;
        }
        if (this.sendPromise) { // wait for any existing send to complete
            await this.sendPromise;
        }
        const events = this.batch;
        this.batch = [];
        try {
            await backOff(() => this.distClient.sendFlagEvaluationMetrics(new SendFlagEvaluationMetricsRequest({
                events,
                sessionKey: this.sessionKey
            })), this.backoffOptions);
        } catch (e) {
            // eslint-disable-next-line no-console
            console.log(`failed to send metrics batch: ${e}`);
            this.batch.unshift(...events);
        }
    }

    async close() {
        if (this.interval) {
            await clearIntervalAsync(this.interval);
        }
        if (this.sendPromise) {
            await this.sendPromise;
        }
        await this.sendBatch();
    }
}

export function toContextKeysProto(context?: ClientContext) : ContextKey[] {
    const result: ContextKey[] = [];
    if (!context) {
        return result;
    }
    for (const key in context.data) {
        result.push(new ContextKey({
            key,
            type: lekkoValueToType(context.get(key)),
        }));
    }
    return result;
}

function lekkoValueToType(val : Value | undefined) : string {
    if (!val) {
        return '';
    }
    switch (val.kind.case) {
        case 'boolValue': return 'bool';
        case 'doubleValue': return 'float';
        case 'intValue': return 'int';
        case 'stringValue': return 'string';
    }
    return '';
}


