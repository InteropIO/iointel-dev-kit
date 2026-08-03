import { Injectable } from "@angular/core";
import { IOConnectCore } from "@interopio/core";

const LIB_NAME = "io-assist";

/**
 * Centralized logging service for the io-assist Angular app.
 *
 * Wraps the IO Connect Logger API (`IOConnectCore.Logger.API`) and provides
 * namespaced sub-loggers per subsystem. Before IO Connect is initialized,
 * calls to `get()` will throw — call `setLogger()` first.
 *
 * Initialized automatically by `IOConnectService` when IO Connect becomes ready.
 *
 * @example
 * ```ts
 * private readonly _logger = inject(LoggerService);
 *
 * someMethod(): void {
 *     const logger = this._logger.get('message.effects');
 *     logger.info('Processing message stream');
 *     logger.warn('Unexpected chunk type');
 *     logger.error('Stream failed', error);
 * }
 * ```
 */
@Injectable({ providedIn: "root" })
export class LoggerService {
    private _logger: IOConnectCore.Logger.API | undefined;

    /**
     * Initialize the logger with the IO Connect Logger API.
     * Should be called once after IO Connect is ready.
     */
    public setLogger(ioLogger: IOConnectCore.Logger.API): void {
        this._logger = ioLogger;
    }

    /**
     * Returns true if the logger has been initialized with IO Connect.
     */
    public get isInitialized(): boolean {
        return this._logger !== undefined;
    }

    /**
     * Get a namespaced sub-logger for a specific subsystem.
     *
     * @param subSystem - Dot-separated subsystem name (e.g. 'message.effects', 'agent.service').
     * @returns An `IOConnectCore.Logger.API` instance with methods: log, trace, debug, info, warn, error.
     */
    public get(subSystem: string): IOConnectCore.Logger.API {
        if (!this._logger) {
            console.warn("Logger is not configured. Please call setLogger() first. Falling back to console.");

            return console as unknown as IOConnectCore.Logger.API;
        }

        return this._logger.subLogger(`${LIB_NAME}.${subSystem}`);
    }
}
