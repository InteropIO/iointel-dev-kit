import { createAction, props } from "@ngrx/store";

import { APP_LIFECYCLE_ACTIONS } from "./app-lifecycle.actions.enum";

export const initialAppCoreServicesInit = createAction(APP_LIFECYCLE_ACTIONS.INITIAL_APP_CORE_SERVICES_INIT);
export const initialAppCoreServicesInitSuccess = createAction(APP_LIFECYCLE_ACTIONS.INITIAL_APP_CORE_SERVICES_INIT_SUCCESS);
export const initialAppCoreServicesInitFailure = createAction(APP_LIFECYCLE_ACTIONS.INITIAL_APP_CORE_SERVICES_INIT_FAILURE, props<{ error: Error }>());
