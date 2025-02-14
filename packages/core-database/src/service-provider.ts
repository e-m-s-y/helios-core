import { Container, Contracts, Enums, Providers } from "@solar-network/core-kernel";
import { sync } from "execa";
import { existsSync, readFileSync, unlinkSync } from "fs";
import Joi from "joi";
import { Connection, createConnection, getCustomRepository } from "typeorm";

import { BlockFilter } from "./block-filter";
import { BlockHistoryService } from "./block-history-service";
import { DatabaseService } from "./database-service";
import { ModelConverter } from "./model-converter";
import { BlockRepository, RoundRepository, TransactionRepository } from "./repositories";
import { TransactionFilter } from "./transaction-filter";
import { TransactionHistoryService } from "./transaction-history-service";
import { SnakeNamingStrategy } from "./utils/snake-naming-strategy";
import { WalletsTableService } from "./wallets-table-service";

export class ServiceProvider extends Providers.ServiceProvider {
    public async register(): Promise<void> {
        const logger: Contracts.Kernel.Logger = this.app.get(Container.Identifiers.LogService);

        logger.info("Connecting to database: " + (this.config().all().connection as any).database);

        this.app.bind(Container.Identifiers.DatabaseConnection).toConstantValue(await this.connect());

        logger.debug("Connection established");

        this.app.bind(Container.Identifiers.DatabaseRoundRepository).toConstantValue(this.getRoundRepository());

        this.app.bind(Container.Identifiers.DatabaseBlockRepository).toConstantValue(this.getBlockRepository());
        this.app.bind(Container.Identifiers.DatabaseBlockFilter).to(BlockFilter);
        this.app.bind(Container.Identifiers.BlockHistoryService).to(BlockHistoryService);

        this.app
            .bind(Container.Identifiers.DatabaseTransactionRepository)
            .toConstantValue(this.getTransactionRepository());
        this.app.bind(Container.Identifiers.DatabaseTransactionFilter).to(TransactionFilter);
        this.app.bind(Container.Identifiers.TransactionHistoryService).to(TransactionHistoryService);

        this.app.bind(Container.Identifiers.DatabaseModelConverter).to(ModelConverter);
        this.app.bind(Container.Identifiers.DatabaseService).to(DatabaseService).inSingletonScope();
        this.app.bind(Container.Identifiers.DatabaseWalletsTableService).to(WalletsTableService);
    }

    public async boot(): Promise<void> {
        await this.app.get<DatabaseService>(Container.Identifiers.DatabaseService).initialize();
    }

    public async dispose(): Promise<void> {
        await this.app.get<DatabaseService>(Container.Identifiers.DatabaseService).disconnect();
    }

    public async required(): Promise<boolean> {
        return true;
    }

    public async connect(): Promise<Connection> {
        const connection: Record<string, any> = this.config().all().connection as any;
        this.app
            .get<Contracts.Kernel.EventDispatcher>(Container.Identifiers.EventDispatcherService)
            .dispatch(Enums.DatabaseEvent.PreConnect);

        if (this.app.isBound(Container.Identifiers.DatabaseLogger)) {
            connection.logging = "all";
            connection.logger = this.app.get(Container.Identifiers.DatabaseLogger);
        }

        try {
            const pidFile: string = `${connection.extra.host}/postmaster.pid`;
            let startPostgres: boolean = true;

            if (existsSync(pidFile)) {
                const pid = +readFileSync(pidFile).toString().split("\n")[0];
                try {
                    process.kill(pid, 0);
                    startPostgres = false;
                } catch {
                    unlinkSync(pidFile);
                }
            }

            if (startPostgres) {
                sync(`${process.env.POSTGRES_DIR}/bin/pg_ctl -D ${connection.extra.host} start >/dev/null`, {
                    shell: true,
                });
            }
        } catch (error) {
            this.app.terminate(error.stderr || error.shortMessage);
        }

        return createConnection({
            ...(connection as any),
            namingStrategy: new SnakeNamingStrategy(),
            migrations: [__dirname + "/migrations/*.js"],
            migrationsRun: true,
            // TODO: expose entities to allow extending the models by plugins
            entities: [__dirname + "/models/*.js"],
        });
    }

    public getRoundRepository(): RoundRepository {
        return getCustomRepository(RoundRepository);
    }

    public getBlockRepository(): BlockRepository {
        return getCustomRepository(BlockRepository);
    }

    public getTransactionRepository(): TransactionRepository {
        return getCustomRepository(TransactionRepository);
    }

    public configSchema(): object {
        return Joi.object({
            connection: Joi.object({
                database: Joi.string().required(),
                entityPrefix: Joi.string().required(),
                extra: Joi.object({
                    host: Joi.string().required(),
                }),
                logging: Joi.bool().required(),
                synchronize: Joi.bool().required(),
                type: Joi.string().required(),
                username: Joi.string().required(),
            }).required(),
        }).unknown(true);
    }
}
