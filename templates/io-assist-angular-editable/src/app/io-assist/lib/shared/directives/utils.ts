import { Renderer2 } from "@angular/core";

export type StyleMap = Record<string, string>;

/**
 * Apply multiple styles to an element using the provided renderer
 */
export const applyStyles = (renderer: Renderer2, element: HTMLElement, styles: StyleMap): void => {
    Object.entries(styles).forEach(([property, value]) => {
        renderer.setStyle(element, property, value);
    });
};

/**
 * Create an HTML element with a class and styles using the provided renderer
 */
export const createElement = (renderer: Renderer2, tag: string, className: string, styles: StyleMap): HTMLElement => {
    const element = renderer.createElement(tag);

    renderer.addClass(element, className);
    applyStyles(renderer, element, styles);

    return element;
};
