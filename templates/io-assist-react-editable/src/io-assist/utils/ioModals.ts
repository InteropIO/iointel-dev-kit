import { ioAssistStore } from "../stores";

export type ModalsDialogButton = {
    variant: "primary" | "outline";
    text: string;
    id: string;
};

export type ModalsDialogRequest = {
    templateName: "noInputsConfirmationDialog";
    variables: {
        title: string;
        heading: string;
        text: string;
        actionButtons: ModalsDialogButton[];
    };
};

export type ModalsDialogResponse = {
    responseButtonClicked?: { id: string };
};

export async function isModalsAvailable(): Promise<boolean> {
    const ioConnectApi = ioAssistStore.getState().ioConnectApi;
    const modalsAPI = ioConnectApi?.modals;
    const dialogsAPI = modalsAPI?.dialogs;
    if (!modalsAPI || !dialogsAPI) return false;

    try {
        const status = await modalsAPI.getStatus();
        if (!status) return false;
        return status.platformConfigured === true;
    } catch {
        return false;
    }
}

export function requestModalDialog(options: ModalsDialogRequest): Promise<ModalsDialogResponse> {
    const ioConnectApi = ioAssistStore.getState().ioConnectApi;
    if (!ioConnectApi?.modals?.dialogs) {
        return Promise.reject(new Error("IO Connect Modals API is not available."));
    }
    return ioConnectApi.modals.dialogs.request(options);
}
