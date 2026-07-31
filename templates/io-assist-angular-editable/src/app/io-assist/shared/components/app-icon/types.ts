import { APP_ICON_BACKGROUND_SHAPES, APP_ICON_SIZES, APP_ICON_VARIANTS } from "./enum";

export type AppIcon = {
    title: string;
    name: string;
    svgPath: string;
};

export type AppIconVariantsType = APP_ICON_VARIANTS[keyof APP_ICON_VARIANTS];

export type AppIconSizeType = APP_ICON_SIZES[keyof APP_ICON_SIZES];

export type AppIconBackgroundShapeType = APP_ICON_BACKGROUND_SHAPES[keyof APP_ICON_BACKGROUND_SHAPES];
