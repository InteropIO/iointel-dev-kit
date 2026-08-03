import { AgentEffects } from "./agent/agent.effects";
import { AgentReducerStateType, agentReducer } from "./agent/agent.reducer";
import { AppLifecycleEffects } from "./app-lifecycle/app-lifecycle.effects";
import { appLifecycleReducer, AppLifecycleStateType } from "./app-lifecycle/app-lifecycle.reducer";
import { MessageEffects } from "./message/message.effects";
import { messageReducer, MessageReducerStateType } from "./message/message.reducer";
import { PromptEffects } from "./prompt/prompt.effects";
import { PromptReducerStateType } from "./prompt/prompt.reducer";
import { promptReducer } from "./prompt/prompt.reducer";
import { responseStreamReducer, ResponseStreamReducerStateType } from "./response-stream/response-stream.reducer";
import { ThreadEffects } from "./thread/thread.effects";
import { threadReducer, ThreadReducerStateType } from "./thread/thread.reducer";
import { ToolEffects } from "./tool/tool.effects";
import { toolReducer, ToolReducerStateType } from "./tool/tool.reducer";
import { WorkingContextEffects } from "./working-context/working-context.effects";
import { workingContextReducer, WorkingContextReducerStateType } from "./working-context/working-context.reducer";

export type AppState = {
    threadsStore: ThreadReducerStateType;
    appLifecycleStore: AppLifecycleStateType;
    promptStore: PromptReducerStateType;
    toolStore: ToolReducerStateType;
    messageStore: MessageReducerStateType;
    responseStreamStore: ResponseStreamReducerStateType;
    agentStore: AgentReducerStateType;
    workingContextStore: WorkingContextReducerStateType;
};

export const appReducers = {
    threadsStore: threadReducer,
    appLifecycleStore: appLifecycleReducer,
    promptStore: promptReducer,
    toolStore: toolReducer,
    messageStore: messageReducer,
    responseStreamStore: responseStreamReducer,
    agentStore: agentReducer,
    workingContextStore: workingContextReducer,
};

export const appEffects: unknown[] = [ThreadEffects, AppLifecycleEffects, PromptEffects, ToolEffects, MessageEffects, AgentEffects, WorkingContextEffects];
