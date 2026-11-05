import type { IconResource, IconType } from '../types/icon';

type Logger = Pick<Console, 'warn' | 'error'>;

/**
 * Determines the icon type from the data string.
 * Auto-detects data URLs and distinguishes between SVG strings and regular URLs.
 */
export function detectIconType(data: string): IconType {
    if (!data) {
        throw new Error('Icon data cannot be empty');
    }

    if (data.startsWith('data:')) {
        return 'data-url';
    }

    if (data.trim().startsWith('<svg')) {
        return 'svg';
    }

    return 'url';
}

/**
 * Normalizes icon resource to ensure consistent type detection.
 * If type is not explicitly set or is incorrect, auto-detects from data.
 */
export function normalizeIconResource(icon: IconResource, logger: Logger = console): IconResource {
    // Empty data: leave as-is so validateIconResource can reject it.
    if (!icon.data) {
        return icon;
    }

    // Unknown/invalid type: leave as-is so validateIconResource can reject it.
    const validTypes: IconType[] = ['svg', 'url', 'data-url'];
    if (!validTypes.includes(icon.type)) {
        return icon;
    }

    const detectedType: IconType = detectIconType(icon.data);

    // Only auto-correct when detection is unambiguous (data: or <svg prefix).
    // If detected as 'url' (the catch-all fallback), trust the declared type so that
    // invalid SVG/data-url data is rejected by validateIconResource rather than
    // silently reclassified as a URL icon.
    if (detectedType === 'url') {
        return icon;
    }

    if (icon.type !== detectedType) {
        logger.warn(
            `Icon type mismatch: declared as '${icon.type}' but detected as '${detectedType}'. Using detected type.`
        );

        return {
            type: detectedType,
            data: icon.data,
        };
    }

    return icon;
}

/**
 * Checks if icon is an inline SVG string.
 */
export function isInlineSvg(icon: IconResource): boolean {
    return icon.type === 'svg';
}

/**
 * Checks if icon is a data URL (base64 encoded).
 */
export function isDataUrl(icon: IconResource): boolean {
    return icon.type === 'data-url' || icon.data.startsWith('data:');
}

/**
 * Checks if icon is a regular URL (CDN, public assets, etc.).
 */
export function isRegularUrl(icon: IconResource): boolean {
    return icon.type === 'url' && !icon.data.startsWith('data:');
}

/**
 * Checks if icon should be rendered as an image element.
 * Returns true for URLs and data URLs, false for inline SVG.
 */
export function shouldRenderAsImage(icon: IconResource): boolean {
    return isDataUrl(icon) || isRegularUrl(icon);
}

/**
 * Validates icon resource structure and data.
 */
export function validateIconResource(icon: IconResource): { valid: boolean; error?: string } {
    if (!icon || typeof icon !== 'object') {
        return { valid: false, error: 'Icon resource must be an object' };
    }

    if (!icon.type) {
        return { valid: false, error: 'Icon type is required' };
    }

    if (!['svg', 'url', 'data-url'].includes(icon.type)) {
        return { valid: false, error: `Invalid icon type: ${icon.type}` };
    }

    if (!icon.data || typeof icon.data !== 'string') {
        return { valid: false, error: 'Icon data must be a non-empty string' };
    }

    if (icon.type === 'svg' && !icon.data.trim().startsWith('<svg')) {
        return { valid: false, error: 'SVG icon data must start with <svg tag' };
    }

    if (icon.type === 'data-url' && !icon.data.startsWith('data:')) {
        return { valid: false, error: 'Data URL must start with "data:"' };
    }

    return { valid: true };
}

/**
 * Removes security-sensitive attributes from an SVG element.
 */
function removeDangerousAttributes(element: Element): void {
    // Remove event handlers. Match case-insensitively: DOMParser in image/svg+xml
    // mode preserves attribute casing, but the HTML parser lower-cases names on
    // injection, so `ONERROR`/`onError` would otherwise survive as live `onerror`.
    Array.from(element.attributes).forEach((attr) => {
        if (attr.name.toLowerCase().startsWith('on')) {
            element.removeAttribute(attr.name);
        }
    });

    // Remove style (can contain javascript: urls)
    element.removeAttribute('style');

    // Remove potentially dangerous href attributes — allow only local fragments (#id for <use>), relative paths and http(s) URLs
    const href = element.getAttribute('href') || element.getAttribute('xlink:href');
    if (href !== null) {
        const isSafe = /^(#|https?:\/\/|\/(?!\/)|\.\.?\/)/.test(href);
        if (!isSafe) {
            element.removeAttribute('href');
            element.removeAttribute('xlink:href');
        }
    }

    // Remove elements that can execute code or escape the SVG sandbox:
    // <script> runs JS, <style> injects global CSS into the host document,
    // <foreignObject> lets arbitrary HTML (e.g. exfiltrating <img>) be parsed.
    if (['script', 'style', 'foreignobject'].includes(element.tagName.toLowerCase())) {
        element.remove();
    }
}

/**
 * Strips problematic attributes from SVG strings to ensure proper rendering and security.
 * Uses DOM parsing for reliable and maintainable attribute manipulation.
 * Removes:
 * - fill="none" from <svg> tag (prevents SVG from rendering)
 * - width and height attributes (allows CSS sizing to work)
 * - Replaces hardcoded fill colors with "currentColor" for theming
 * - Ensures viewBox is present (adds default "0 0 24 24" if missing)
 * - Removes dangerous attributes: event handlers (on*), style
 * - Removes dangerous elements: script, style, foreignObject
 *
 * @param svgString - The raw SVG string
 * @returns Cleaned SVG string ready for use
 */
export function stripSvgAttributes(svgString: string, logger: Logger = console): string {
    if (!svgString || !svgString.trim().startsWith('<svg')) {
        return svgString;
    }

    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgString, 'image/svg+xml');
        const svg = doc.querySelector('svg');

        if (!svg) {
            logger.warn('Failed to parse SVG, rejecting for security');
            return '';
        }

        // Store original dimensions for viewBox fallback
        const width = svg.getAttribute('width') || '24';
        const height = svg.getAttribute('height') || '24';

        // Remove problematic attributes from root <svg>
        svg.removeAttribute('width');
        svg.removeAttribute('height');

        // Only remove fill="none" from root svg, not children
        if (svg.getAttribute('fill') === 'none') {
            svg.removeAttribute('fill');
        }

        // Ensure viewBox exists
        if (!svg.hasAttribute('viewBox')) {
            svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        }

        // Process all child elements
        const allElements = svg.querySelectorAll('*');
        allElements.forEach((element) => {
            // Replace hardcoded fill colors with currentColor (preserve "none")
            const fillAttr = element.getAttribute('fill');
            if (fillAttr && fillAttr !== 'none' && fillAttr !== 'currentColor') {
                element.setAttribute('fill', 'currentColor');
            }

            // Security: Remove dangerous attributes
            removeDangerousAttributes(element);
        });

        // Security: Remove dangerous attributes from root svg
        removeDangerousAttributes(svg);

        return new XMLSerializer().serializeToString(svg);
    } catch (error) {
        logger.error('SVG parsing error:', error instanceof Error ? error : new Error(String(error)));
        return '';
    }
}
