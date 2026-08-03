import type { IOConnectCore } from "@interopio/core";

const LIB_NAME = "io-assist";

/**
 * Centralized logging service for the io-assist React clone.
 *
 * Wraps the IO Connect Logger API (`IOConnectCore.Logger.API`) and provides
 * namespaced sub-loggers per subsystem. Before IO Connect is initialized,
 * calls to `get()` fall back to `console`.
 *
 * The handle returned by `get()` is stable — call sites may cache it at
 * module scope and it will transparently switch from the console fallback
 * to the real IO Connect sub-logger once `setLogger()` runs.
 *
 * Initialized automatically by `initIoConnect` when IO Connect becomes ready.
 *
 * @example
 * ```ts
 * import { logger } from '../utils/logger';
 *
 * const LOGGER_NAME = 'Sampling';
 * const log = logger.get(LOGGER_NAME);
 * log.info('Processing message stream');
 * log.warn('Unexpected chunk type');
 * log.error('Stream failed', error);
 * ```
 */
class Logger {
    private _logger: IOConnectCore.Logger.API | undefined;
    private readonly _subLoggers = new Map<string, IOConnectCore.Logger.API>();

    public setLogger(ioLogger: IOConnectCore.Logger.API): void {
        this._logger = ioLogger;
        this._subLoggers.clear();
    }

    public get isInitialized(): boolean {
        return this._logger !== undefined;
    }

    public get(subSystem: string): IOConnectCore.Logger.API {
        const fullName = `${LIB_NAME}.${subSystem}`;
        const resolve = (): IOConnectCore.Logger.API => {
            if (!this._logger) {
                return console as unknown as IOConnectCore.Logger.API;
            }
            let cached = this._subLoggers.get(fullName);
            if (!cached) {
                cached = this._logger.subLogger(fullName);
                this._subLoggers.set(fullName, cached);
            }
            return cached;
        };

        return new Proxy({} as IOConnectCore.Logger.API, {
            get: (_, prop) => {
                const target = resolve() as unknown as Record<string | symbol, unknown>;
                const value = target[prop];
                return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(target) : value;
            },
        });
    }
}

export const logger = new Logger();
