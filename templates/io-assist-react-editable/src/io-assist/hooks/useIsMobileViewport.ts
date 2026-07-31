import { useEffect, useState } from "react";

const MD_BREAKPOINT_QUERY = "(min-width: 768px)";

export function useIsMobileViewport(): boolean {
    const [isMobile, setIsMobile] = useState(() => {
        if (typeof window === "undefined") return false;
        return !window.matchMedia(MD_BREAKPOINT_QUERY).matches;
    });

    useEffect(() => {
        const mq = window.matchMedia(MD_BREAKPOINT_QUERY);
        const handler = (e: MediaQueryListEvent) => setIsMobile(!e.matches);
        mq.addEventListener("change", handler);
        return () => mq.removeEventListener("change", handler);
    }, []);

    return isMobile;
}
