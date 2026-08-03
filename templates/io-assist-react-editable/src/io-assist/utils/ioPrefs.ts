// Centralised io.Connect preferences access. Mirrors ng's IOConnectService
// prefs handling: all io-assist prefs live under a single `ioAssist` namespace
// key, and writes are serialised through a module-level queue so concurrent
// callers cannot interleave a read with a write and silently lose updates.

import type { IOConnectBrowser } from "@interopio/browser";
import type { IOConnectDesktop } from "@interopio/desktop";

import { logger } from "./logger";

const PREFS_NAMESPACE = "ioAssist";
const LOGGER_NAME = "IoPrefs";
const log = logger.get(LOGGER_NAME);

type IoApi = IOConnectBrowser.API | IOConnectDesktop.API;

/**
 * Serial write queue — ensures concurrent calls cannot interleave reads and
 * writes, which would cause silently lost updates. Every write is chained onto
 * this promise before it executes, so writes always run one at a time in
 * arrival order.
 */
let writeQueue: Promise<void> = Promise.resolve();

export async function fetchPref<T>(IoApi: IoApi | null | undefined, key: string): Promise<T | undefined> {
    await writeQueue;

    const prefs = IoApi?.prefs;
    if (!prefs) {
        log.debug("io.Connect prefs API not available");
        return undefined;
    }

    try {
        const current = await prefs.get();
        const namespace = (current?.data?.[PREFS_NAMESPACE] ?? {}) as Record<string, unknown>;

        if (!(key in namespace)) {
            log.debug(`Prefs key "${key}" not found in namespace "${PREFS_NAMESPACE}"`);
            return undefined;
        }

        return namespace[key] as T;
    } catch (error) {
        log.warn(`Failed to fetch prefs key "${key}": ${error}`);
        return undefined;
    }
}

export function updatePref<T>(IoApi: IoApi | null | undefined, key: string, value: T): Promise<void> {
    const enqueued = writeQueue.then(async () => {
        const prefs = IoApi?.prefs;
        if (!prefs) {
            log.debug("io.Connect prefs API not available; skipping write");
            return;
        }

        const current = await prefs.get();
        const data = { ...current?.data };
        const namespace = { ...((data[PREFS_NAMESPACE] ?? {}) as Record<string, unknown>) };
        namespace[key] = value;
        data[PREFS_NAMESPACE] = namespace;
        await prefs.update(data);
    });

    // Keep writeQueue as a void-settled tail so it never rejects and stays chainable.
    writeQueue = enqueued.then(
        () => undefined,
        () => undefined
    );

    return enqueued;
}
