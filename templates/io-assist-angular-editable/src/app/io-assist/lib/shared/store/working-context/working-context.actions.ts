import { IoIntelWorkingContext } from "@interopio/working-context";
import { createAction, props } from "@ngrx/store";

import { WORKING_CONTEXT_ACTIONS } from "./working-context.actions.enum";

export const getWorkingContext = createAction(WORKING_CONTEXT_ACTIONS.GET_WORKING_CONTEXT);
export const getWorkingContextSuccess = createAction(WORKING_CONTEXT_ACTIONS.GET_WORKING_CONTEXT_SUCCESS, props<{ workingContext: Record<string, IoIntelWorkingContext.Property> }>());
export const getWorkingContextFailure = createAction(WORKING_CONTEXT_ACTIONS.GET_WORKING_CONTEXT_FAILURE, props<{ error: Error }>());

export const updateWorkingContext = createAction(WORKING_CONTEXT_ACTIONS.UPDATE_WORKING_CONTEXT, props<{ workingContext: Record<string, IoIntelWorkingContext.Property> }>());

export const fetchIsWorkingContextEnabled = createAction(WORKING_CONTEXT_ACTIONS.FETCH_IS_WORKING_CONTEXT_ENABLED);
export const fetchIsWorkingContextEnabledSuccess = createAction(WORKING_CONTEXT_ACTIONS.FETCH_IS_WORKING_CONTEXT_ENABLED_SUCCESS, props<{ isEnabled: boolean }>());
export const fetchIsWorkingContextEnabledFailure = createAction(WORKING_CONTEXT_ACTIONS.FETCH_IS_WORKING_CONTEXT_ENABLED_FAILURE, props<{ error: Error }>());
