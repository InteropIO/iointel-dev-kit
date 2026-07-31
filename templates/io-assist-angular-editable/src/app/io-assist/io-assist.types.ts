/**
 * Icon type for prompts and other UI elements.
 *
 * Supported types:
 * - 'svg': Inline SVG string (recommended for simplicity)
 * - 'url': Absolute URL to an image file (CDN, public assets, runtime paths)
 * - 'data-url': Data URL with base64 encoded image (SVG or raster images)
 *
 * Examples:
 * - svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">...</svg>'
 * - url: 'https://cdn.example.com/icons/icon.svg' or '/icons/icon.svg'
 * - data-url: 'data:image/svg+xml;base64,...' or 'data:image/png;base64,...'
 */
export type IconType = "svg" | "url" | "data-url";

export type IconResource = {
    type: IconType;
    data: string;
};

export type IoAssistPrompt = {
    name: string;
    prompt: string;
    /**
     * Optional icon for the prompt. Use default icon if not provided.
     *
     * Supported types:
     * - 'svg': Inline SVG string (recommended for simplicity)
     *   Example: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">...</svg>'
     *   Note: SVG strings are automatically cleaned (fill="none" removed, width/height removed,
     *         hardcoded colors replaced with currentColor). Just paste raw SVGs!
     *
     * - 'url': Absolute URL to an image file
     *   Examples:
     *   - CDN: 'https://cdn.example.com/icons/market-trends.svg'
     *   - Public assets: '/icons/market-trends.svg' (from public/icons/ folder)
     *   - Runtime base path: `${window.location.origin}/icons/market-trends.svg`
     *
     * - 'data-url': Data URL with base64 encoded image
     *   Examples:
     *   - SVG: 'data:image/svg+xml;base64,...'
     *   - PNG: 'data:image/png;base64,...'
     *   - JPEG: 'data:image/jpeg;base64,...'
     *
     * For file system icons:
     * 1. Place icon files in your app's public folder:
     *    - Angular 17+: 'public/icons/'
     *    - React/Vite: 'public/icons/'
     * 2. Reference with absolute path starting with '/' (relative to domain root)
     *    Example: '/icons/market-trends.svg'
     * 3. Build tools automatically serve public folder contents as static assets
     *
     * Note: Relative file paths (e.g., '../icons/file.svg') are NOT supported.
     * Icons must be accessible via HTTP(S) after build.
     */
    iconResource?: IconResource;
};

export type IoAssistPromptCategory = {
    category?: string;
    prompts: IoAssistPrompt[];
};
