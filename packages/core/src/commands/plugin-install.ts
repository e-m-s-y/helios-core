import { Commands, Container, Contracts } from "@solar-network/core-cli";
import { Networks } from "@solar-network/crypto";
import Joi from "joi";

/**
 * @export
 * @class Command
 * @extends {Commands.Command}
 */
@Container.injectable()
export class Command extends Commands.Command {
    @Container.inject(Container.Identifiers.PluginManager)
    private readonly pluginManager!: Contracts.PluginManager;

    /**
     * The console command signature.
     *
     * @type {string}
     * @memberof Command
     */
    public signature: string = "plugin:install";

    /**
     * The console command description.
     *
     * @type {string}
     * @memberof Command
     */
    public description: string = "Installs a package, and any packages that it depends on";

    /**
     * Configure the console command.
     *
     * @returns {void}
     * @memberof Command
     */
    public configure(): void {
        this.definition
            .setFlag("token", "The name of the token", Joi.string().default("solar"))
            .setFlag("network", "The name of the network", Joi.string().valid(...Object.keys(Networks)))
            .setFlag("version", "The version of the package", Joi.string())
            .setArgument("package", "The name of the package", Joi.string().required());
    }

    /**
     * Execute the console command.
     *
     * @returns {Promise<void>}
     * @memberof Command
     */
    public async execute(): Promise<void> {
        return await this.pluginManager.install(
            this.getFlag("token"),
            this.getFlag("network"),
            this.getArgument("package"),
            this.getFlag("version"),
        );
    }
}
