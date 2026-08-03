import { AppIconVariantsType } from "../app-icon/types";

export type AppSelectOption<TValue = unknown> = {
    title: string;
    miniTitle?: string;
    description?: string;
    icon?: AppIconVariantsType;
    isSelected?: boolean;
    value?: TValue;
};
