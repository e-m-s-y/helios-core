import { Providers } from "@arkecosystem/core-kernel";

import { Database } from "./database";
import { startListeners } from "./listener";
import { startServer } from "./server";

export class ServiceProvider extends Providers.ServiceProvider {
    public async register(): Promise<void> {
        if (!this.config().get("enabled")) {
            this.app.log.info("Webhooks are disabled");
            return;
        }

        this.app
            .bind<Database>("webhooks.db")
            .to(Database)
            .inSingletonScope();

        startListeners(this.app);

        this.app.bind("webhooks").toConstantValue(await startServer(this.app, this.config().get("server")));
        this.app.bind("webhooks.options").toConstantValue(this.config().all());
    }

    public async dispose(): Promise<void> {
        if (this.config().get("enabled")) {
            this.app.log.info("Stopping Webhook API");

            await this.app.get<any>("webhooks").stop();
        }
    }
}
