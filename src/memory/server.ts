import { SDKService } from "@buf/lekkodev_sdk.bufbuild_connect-es/lekko/server/v1beta1/sdk_connect";
import { ConnectRouter } from "@bufbuild/connect";
import { connectNodeAdapter } from "@bufbuild/connect-node";
import { Http2Server, createServer } from 'http2';
import { Store } from "./store";

// Runs a simple vanilla nodejs web server for debugging. 
// The server exposes the interface defined here: 
//      https://buf.build/lekkodev/sdk/docs/main:lekko.server.v1beta1
export class SDKServer {
    server?: Http2Server;

    constructor(store: Store, port?: number) {
        if (!port) {
            return;
        }
        const routes = (router: ConnectRouter) => 
            router.service(SDKService, {
                async listContents() {
                    return store.listContents();
                }
            });
        this.server = createServer(connectNodeAdapter({ routes })).listen(port);
    }

    close() {
        if (this.server) {
            this.server.close((err) => {
                if (err) {
                    console.error('Error closing sdk server', err);
                }
            });
        }
    }
}
