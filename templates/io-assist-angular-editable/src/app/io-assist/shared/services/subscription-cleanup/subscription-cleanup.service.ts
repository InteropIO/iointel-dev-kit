import { DestroyRef, inject, Injectable } from "@angular/core";
import { IOConnectCore } from "@interopio/core";
import { UnsubscribeFunction } from "callback-registry";

import { LoggerService } from "../logger/logger.service";

type NamedSubscription = {
    name: string;
    fn: UnsubscribeFunction;
};

/**
 * Service to manage and clean up functions that require unsubscribing.
 *
 * Service is not provided in root to allow for scoped usage.
 * This means that the service lifecycle will be the same as the component or module that provides it which
 * means that once the component is destroyed the subscriptions will be cleaned up automatically.
 *
 * Usage:
 * 1. Inject the service in your component or module.
 * 2. Use the `add` method to register subscriptions with a unique name and their corresponding unsubscribe function.
 * 3. When the component or module is destroyed, all registered subscriptions will be automatically cleaned up.
 * 4. Additional manual cleanup by name can be performed using the `manualUnsubscribe` method.
 *
 */
@Injectable()
export class SubscriptionCleanupService {
    private _subscriptions: Map<string, NamedSubscription> = new Map<string, NamedSubscription>();
    private readonly _destroyRef: DestroyRef = inject(DestroyRef);
    private readonly _logger: LoggerService = inject(LoggerService);
    protected readonly LOGGER_NAME: string = "SubscriptionCleanupService";

    constructor() {
        this._destroyRef.onDestroy(() => {
            this.handleDestroy();
        });
    }

    public add(name: string, func: UnsubscribeFunction): void {
        if (!func) return;

        if (!name || name.trim() === "") {
            this.getLogger().warn("Subscription name is required.");

            return;
        }

        if (this._subscriptions.has(name)) {
            this.getLogger().warn(`Subscription with name "${name}" already exists. Unsubscribing and overwriting.`);

            this.manualUnsubscribe(name);
        }

        this._subscriptions.set(name, { name, fn: func });
    }

    public manualUnsubscribe(name: string): void {
        const subscription: NamedSubscription | undefined = this._subscriptions.get(name);

        if (!subscription) return;

        try {
            // Calling the unsubscribe function
            subscription.fn();
        } catch (error) {
            this.getLogger().error(`Error during subscription ${name} cleanup: ${error instanceof Error ? error.message : String(error)}`);
        }

        this._subscriptions.delete(name);
    }

    public handleDestroy(): void {
        const successfulUnsubscribes: string[] = [];
        const failedUnsubscribes: string[] = [];

        for (const [name, { fn }] of this._subscriptions) {
            try {
                fn();

                successfulUnsubscribes.push(name);
            } catch (error) {
                this.getLogger().error(`Error during subscription ${name} cleanup: ${error instanceof Error ? error.message : String(error)}`);

                failedUnsubscribes.push(name);
            }
        }

        this._subscriptions.clear();

        this.getLogger().info(`Successfully unsubscribed from [${successfulUnsubscribes.join(", ")}]`);

        if (failedUnsubscribes.length > 0) {
            this.getLogger().warn(`Failed to unsubscribe from subscriptions: [${failedUnsubscribes.join(", ")}]`);
        }
    }

    private getLogger(): IOConnectCore.Logger.API {
        return this._logger.get(this.LOGGER_NAME);
    }
}
