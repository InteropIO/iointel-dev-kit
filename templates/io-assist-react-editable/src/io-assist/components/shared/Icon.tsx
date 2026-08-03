import React from "react";

type IconProps = {
    size?: number;
    className?: string;
    children: React.ReactNode;
};

export const Icon: React.FC<IconProps> = ({ size = 16, className, children }) => (
    <span className={["pointer-events-none inline-flex items-center justify-center", className ?? ""].join(" ")} style={{ width: `${size}px`, height: `${size}px` }}>
        {children}
    </span>
);
