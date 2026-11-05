import React from "react";

import { UI_STRINGS } from "../../constants/uiStrings";
import { useIoAssistStore } from "../../context/IoAssistContext";
import { respondPermissionRequest } from "../../utils/permissionRequest";
import { Icon } from "../shared/Icon";
import { HandIcon } from "../shared/icons";

/**
 * Inline permission-request card shown in the message thread for BOTH sampling and elicitation
 * flows (mirrors ng's `PermissionRequestCardComponent`). Backed by `permissionRequest` store
 * state, which is populated/cleared via `utils/permissionRequest.ts`.
 */
export const PermissionRequestCard: React.FC = () => {
    const request = useIoAssistStore((s) => s.permissionRequest);

    if (!request) return null;

    const description = request.description.trim();
    const text = description.endsWith("?") ? description : `${description} ${UI_STRINGS.PERMISSION_REQUEST_CARD_COMPONENT.PROCEED_QUESTION}`;

    return (
        <div data-testid="permission-request-card" className="flex flex-col items-stretch gap-2 w-full mt-4 p-4 bg-input-background border border-border-default rounded-xl">
            <div className="flex items-start gap-2">
                <div className="flex items-center justify-center flex-shrink-0 w-8 h-8 bg-[var(--app-permission-icon-background)] border border-[var(--app-blue)] rounded-lg">
                    <Icon size={16} className="text-[var(--app-permission-icon)]">
                        <HandIcon />
                    </Icon>
                </div>
                <p data-testid="permission-request-text" className="flex-1 text-[13px] leading-[18px] text-text-default pt-1">
                    {text}
                </p>
            </div>
            <div className="flex items-center justify-end gap-2">
                {request.buttons.map((button) => {
                    const isPrimary = button.variant === "primary";
                    return (
                        <button
                            key={button.id}
                            type="button"
                            data-testid={`permission-request-${button.id}`}
                            onClick={() => respondPermissionRequest(button.id)}
                            className={
                                isPrimary
                                    ? "flex justify-center items-center rounded-sm cursor-pointer gap-1 px-spacing-6 py-spacing-3 text-[12px] bg-button-submit-background text-white hover:opacity-95 transition-opacity"
                                    : "flex justify-center items-center rounded-sm cursor-pointer gap-1 px-spacing-6 py-spacing-3 text-[12px] border border-border-default text-text-default hover:text-text-states-active hover:border-border-hover transition-colors"
                            }
                        >
                            {button.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
