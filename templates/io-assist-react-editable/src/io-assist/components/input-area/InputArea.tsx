import React, { useState, useRef, useCallback, useEffect, type KeyboardEvent, type ChangeEvent } from "react";

import { UI_STRINGS } from "../../constants/uiStrings";
import { useIoAssistStore } from "../../context/IoAssistContext";
import { useIoConnectApi } from "../../hooks/useIoConnectApi";
import { PERMISSION_MODE, type PermissionMode } from "../../stores/permission-mode";
import { UI_MESSAGE_ROLES } from "../../types/message";
import { PANEL_CONTENT } from "../../types/panel";
import type { SelectOption } from "../../types/select";
import { RESPONSE_STREAM_STATUS } from "../../types/stream";
import { Icon } from "../shared/Icon";
import { IconButton } from "../shared/IconButton";
import { ArrowUpIcon, PaperPlaneIcon, StopIcon, PromptPanelIcon, PromptPanelFilledIcon, ToolPanelIcon, ToolPanelFilledIcon } from "../shared/icons";
import { Select } from "../shared/Select";

const PERMISSION_OPTIONS: SelectOption<PermissionMode>[] = [
    {
        title: "Ask permissions",
        miniTitle: "Ask",
        description: "Always ask for action permissions",
        value: PERMISSION_MODE.ASK,
    },
    {
        title: "Auto accept permissions",
        miniTitle: "Auto",
        description: "Auto-approve all action permissions",
        value: PERMISSION_MODE.AUTO_ACCEPT,
    },
];

type Props = {
    onSend: (text: string) => void;
    onAbort: () => void;
    className?: string;
};

const MIN_HEIGHT = 17;
const MAX_HEIGHT = 260;

export const InputArea: React.FC<Props> = ({ onSend, onAbort, className }) => {
    const [inputValue, setInputValue] = useState("");
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const currentMsgIndexRef = useRef<number | null>(null);

    const isGenerating = useIoAssistStore((s) => {
        const id = s.activeThreadId;
        return !!id && s.streamsByThreadId[id]?.status === RESPONSE_STREAM_STATUS.STREAMING;
    });
    const messages = useIoAssistStore((s) => s.messages);
    const selectedPrompt = useIoAssistStore((s) => s.selectedPrompt);
    const setSelectedPrompt = useIoAssistStore((s) => s.setSelectedPrompt);

    const userMessages = messages.filter((m) => m.role === UI_MESSAGE_ROLES.USER);

    const updateValue = useCallback((value: string) => {
        setInputValue(value);

        requestAnimationFrame(() => {
            const el = textareaRef.current;
            if (!el) return;
            el.style.height = `${MIN_HEIGHT}px`;
            if (value.trim() !== "") {
                el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
            }
        });
    }, []);

    const updateInputValue = (e: ChangeEvent<HTMLTextAreaElement>) => {
        updateValue(e.target.value);
        currentMsgIndexRef.current = null;
    };

    useEffect(() => {
        if (selectedPrompt?.description) {
            updateValue(selectedPrompt.description);
            setSelectedPrompt(null);
        }
    }, [selectedPrompt, updateValue, setSelectedPrompt]);

    const handleSend = useCallback(() => {
        const trimmed = inputValue.trim();
        if (!trimmed || isGenerating) return;

        onSend(trimmed);
        updateValue("");
        currentMsgIndexRef.current = null;
    }, [inputValue, isGenerating, onSend, updateValue]);

    const handleSendOrStop = useCallback(() => {
        if (isGenerating) {
            onAbort();
        } else {
            handleSend();
        }
    }, [isGenerating, onAbort, handleSend]);

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
            return;
        }

        if (e.key === "ArrowUp" && e.shiftKey) {
            e.preventDefault();
            browseMessages("up");
            return;
        }

        if (e.key === "ArrowDown" && e.shiftKey) {
            e.preventDefault();
            browseMessages("down");
            return;
        }
    };

    const browseMessages = (direction: "up" | "down") => {
        if (userMessages.length === 0) return;

        const currentMsgIndex = currentMsgIndexRef.current;
        let nextIndex: number;

        if (currentMsgIndex === null) {
            nextIndex = direction === "up" ? userMessages.length - 1 : 0;
        } else {
            if (direction === "up" && currentMsgIndex > 0) {
                nextIndex = currentMsgIndex - 1;
            } else if (direction === "down" && currentMsgIndex < userMessages.length - 1) {
                nextIndex = currentMsgIndex + 1;
            } else {
                return;
            }
        }

        currentMsgIndexRef.current = nextIndex;
        updateValue(userMessages[nextIndex].content ?? "");
    };

    const buttonState: "disabled" | "send" | "stop" = isGenerating ? "stop" : inputValue.trim().length > 0 ? "send" : "disabled";

    return (
        <div data-testid="input-area" className={["input-area w-full", className ?? ""].filter(Boolean).join(" ")}>
            <div className="input-area__container relative w-full">
                <div className="input-area__content accent-gradient-border relative rounded-2xl bg-app-background">
                    <div className="flex flex-col gap-4 p-4">
                        <div className="flex gap-3 items-start px-2">
                            <textarea
                                ref={textareaRef}
                                data-testid="chat-input-field"
                                aria-label={UI_STRINGS.INPUT_COMPONENT.INPUT_PLACEHOLDER}
                                placeholder={UI_STRINGS.INPUT_COMPONENT.INPUT_PLACEHOLDER}
                                rows={1}
                                className="flex-1 custom-scrollbar custom-scrollbar-no-gutter text-text-default text-sm leading-4 resize-none border-none outline-none overflow-y-auto whitespace-pre-wrap placeholder:text-text-states-disabled hover:text-text-states-active bg-transparent"
                                style={{
                                    height: `${MIN_HEIGHT}px`,
                                    minHeight: `${MIN_HEIGHT}px`,
                                    maxHeight: `${MAX_HEIGHT}px`,
                                }}
                                value={inputValue}
                                onChange={updateInputValue}
                                onKeyDown={handleKeyDown}
                            />
                        </div>

                        <div className="flex gap-3 items-center justify-between">
                            <ActionBar />

                            <button
                                type="button"
                                data-testid={buttonState === "stop" ? "chat-stop-button" : "chat-send-button"}
                                className={[
                                    "flex size-8 shrink-0 items-center justify-center rounded-full transition-colors",
                                    buttonState === "send" && "bg-app-accent-color-1 text-white cursor-pointer",
                                    buttonState === "stop" && "bg-app-accent-color-1 text-white cursor-pointer",
                                    buttonState === "disabled" && "bg-app-icon-background-disabled text-text-states-disabled cursor-not-allowed",
                                ]
                                    .filter(Boolean)
                                    .join(" ")}
                                onClick={handleSendOrStop}
                                disabled={buttonState === "disabled"}
                                title={buttonState === "stop" ? "Stop generation" : "Send message"}
                            >
                                <Icon
                                    className={["icon-wrapper", buttonState === "disabled" && "cursor-not-allowed"].filter(Boolean).join(" ")}
                                    size={buttonState === "stop" ? 14 : buttonState === "send" ? 18 : 16}
                                >
                                    {buttonState === "stop" ? <StopIcon /> : buttonState === "send" ? <ArrowUpIcon /> : <PaperPlaneIcon />}
                                </Icon>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ActionBar: React.FC = () => {
    const activePanelContent = useIoAssistStore((s) => s.activePanelContent);
    const setActivePanelContent = useIoAssistStore((s) => s.setActivePanelContent);
    const permissionMode = useIoAssistStore((s) => s.permissionMode);
    const { setPermissionMode } = useIoConnectApi();

    const [hovered, setHovered] = useState<"prompt" | "tool" | null>(null);

    // Match ng: size depends only on whether the panel is displayed (XS when open, S otherwise) —
    // it must NOT shrink on hover. The icon variant, however, swaps to the filled glyph on hover.
    const promptDisplayed = activePanelContent === PANEL_CONTENT.PROMPTS;
    const toolDisplayed = activePanelContent === PANEL_CONTENT.TOOLS;
    const promptFilled = promptDisplayed || hovered === "prompt";
    const toolFilled = toolDisplayed || hovered === "tool";

    return (
        <div className="flex flex-1 gap-0.5 items-center">
            <IconButton
                size={promptDisplayed ? 12 : 16}
                containerSize={promptDisplayed ? 24 : 32}
                testId="prompt-panel-button"
                className="hover:bg-app-icon-background-hover"
                onClick={() => setActivePanelContent(PANEL_CONTENT.PROMPTS)}
                onMouseEnter={() => setHovered("prompt")}
                onMouseLeave={() => setHovered(null)}
                title="Browse prompts"
                aria-label="Browse prompts"
            >
                {promptFilled ? <PromptPanelFilledIcon /> : <PromptPanelIcon />}
            </IconButton>
            <IconButton
                size={toolDisplayed ? 12 : 16}
                containerSize={toolDisplayed ? 24 : 32}
                testId="tool-panel-button"
                className="hover:bg-app-icon-background-hover"
                onClick={() => setActivePanelContent(PANEL_CONTENT.TOOLS)}
                onMouseEnter={() => setHovered("tool")}
                onMouseLeave={() => setHovered(null)}
                title="Manage tools"
                aria-label="Manage tools"
            >
                {toolFilled ? <ToolPanelFilledIcon /> : <ToolPanelIcon />}
            </IconButton>

            <div className="min-w-[63px]">
                <Select selectId="permission" options={PERMISSION_OPTIONS} value={permissionMode} onChange={(option) => void setPermissionMode(option.value)} preferredPlacement="above" />
            </div>
        </div>
    );
};
