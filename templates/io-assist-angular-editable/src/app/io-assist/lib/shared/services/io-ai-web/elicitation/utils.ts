import { IoAiWeb } from "@interopio/ai-web";
import { IOConnectCore } from "@interopio/core";

export const validateElicitationRequest = (request: IoAiWeb.ElicitationRequestParams, logger: IOConnectCore.Logger.API): boolean => {
    // Basic meta tags validation of the elicitation request
    if (!isElicitRequestForIOToolResult(request._meta, logger)) {
        return false;
    }

    // Other validations can be added here as needed
    // if (...) {
    //     return false;
    // }

    return true;
};

const isElicitRequestForIOToolResult = (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _meta: Record<string, any> | undefined,
    logger: IOConnectCore.Logger.API
): boolean => {
    if (!_meta || !_meta["toolName"]) {
        logger.warn("Elicitation request is missing required _meta.toolName field.");

        return false;
    }

    const toolName: string = _meta["toolName"];

    if (typeof toolName !== "string" || toolName.trim().length === 0) {
        logger.warn("Elicitation request has invalid _meta.toolName field.");

        return false;
    }

    if (!toolName.startsWith("io_connect")) {
        logger.warn("Elicitation request is not intended for io_connect.");

        return false;
    }

    return true;
};
