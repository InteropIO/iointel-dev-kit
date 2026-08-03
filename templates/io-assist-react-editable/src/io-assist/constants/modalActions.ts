export const ELICITATION_ACTION = {
    ACCEPT: "accept",
    DECLINE: "decline",
    CANCEL: "cancel",
} as const;

export type ElicitationAction = (typeof ELICITATION_ACTION)[keyof typeof ELICITATION_ACTION];

export const SAMPLING_ACTION = {
    ACCEPT: "accept",
    DECLINE: "decline",
} as const;

export type SamplingAction = (typeof SAMPLING_ACTION)[keyof typeof SAMPLING_ACTION];
