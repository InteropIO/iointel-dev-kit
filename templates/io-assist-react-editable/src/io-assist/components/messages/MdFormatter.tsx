import React from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { CodePanel } from "../shared/CodePanel";

type MdFormatterProps = {
    content: string;
};

// Display names for common fenced-code languages; anything else is shown capitalized.
const LANGUAGE_LABELS: Record<string, string> = {
    js: "JavaScript",
    javascript: "JavaScript",
    ts: "TypeScript",
    typescript: "TypeScript",
    json: "JSON",
    yaml: "YAML",
    yml: "YAML",
    xml: "XML",
    md: "Markdown",
    markdown: "Markdown",
};

function languageLabel(lang: string | undefined): string {
    const key = (lang ?? "").trim().toLowerCase();

    if (!key) return "Text";

    return LANGUAGE_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
}

const CodeBlock: React.FC<{ className?: string; children?: React.ReactNode }> = ({ className, children }) => {
    const code = String(children).replace(/\n$/, "");
    const rawLanguage = className?.replace(/^language-/, "") ?? "";

    return <CodePanel className="io-assist-code-block my-2" label={languageLabel(rawLanguage)} code={code} language={rawLanguage || "text"} />;
};

const components: Components = {
    code({ className, children, ...props }) {
        const isInline = !className && typeof children === "string" && !children.includes("\n");
        if (isInline) {
            return (
                <code
                    className="font-mono text-[12px] font-normal leading-[inherit] text-text-default bg-[var(--app-input-background-hover)] rounded-[4px] px-[5px] py-px whitespace-normal align-baseline"
                    {...props}
                >
                    {children}
                </code>
            );
        }
        return <CodeBlock className={className}>{children}</CodeBlock>;
    },
    pre({ children }) {
        return <>{children}</>;
    },
    a({ href, title, children }) {
        return (
            <a
                href={href}
                title={title ?? ""}
                className="text-[14px] font-weight-550 leading-5 text-[var(--app-blue)] underline [text-decoration-skip-ink:none] hover:opacity-[0.85]"
                target="_blank"
                rel="noopener noreferrer"
            >
                {children}
            </a>
        );
    },
    table({ children }) {
        return (
            <div className="p-0 max-w-full overflow-x-auto">
                <table className="p-0 w-full max-w-full my-4 border-separate border-spacing-0 border border-[var(--app-table-border)] rounded-lg shadow-[0_3px_10px_#00000020] [&_thead_th:first-child]:rounded-tl-lg [&_thead_th:last-child]:rounded-tr-lg [&_tbody_tr:last-child_td:first-child]:rounded-bl-lg [&_tbody_tr:last-child_td:last-child]:rounded-br-lg">
                    {children}
                </table>
            </div>
        );
    },
    thead({ children }) {
        return <thead className="p-0 text-left">{children}</thead>;
    },
    tbody({ children }) {
        return <tbody className="p-0">{children}</tbody>;
    },
    th({ children }) {
        return (
            <th className="font-default py-1 px-3 text-[11px] font-medium leading-5 text-text-secondary bg-[var(--app-input-background-hover)] border-b border-[var(--app-table-border)]">
                {children}
            </th>
        );
    },
    td({ children }) {
        return (
            <td className="font-default py-1 px-3 text-[12px] font-normal leading-5 text-text-states-active bg-app-background-secondary first:font-weight-350 first:text-text-default">
                {children}
            </td>
        );
    },
    tr({ children, ...props }) {
        return (
            <tr className="p-0 [&:not(:last-child)>td]:border-b [&:not(:last-child)>td]:border-[var(--app-table-border)]" {...props}>
                {children}
            </tr>
        );
    },
    ul({ children }) {
        return <ul className="text-[14px] font-weight-350 leading-5 text-text-default">{children}</ul>;
    },
    ol({ children }) {
        return <ol className="text-[14px] font-weight-350 leading-5 text-text-default">{children}</ol>;
    },
    li({ children }) {
        return <li>{children}</li>;
    },
    blockquote({ children }) {
        return (
            <blockquote className="io-assist-md-blockquote relative flex flex-col justify-center py-4 px-6 my-2 rounded-[4px] text-text-default bg-[#2e3033] before:content-[''] before:absolute before:left-0 before:inset-y-0 before:w-0.5 before:rounded-l-[4px] before:bg-[linear-gradient(180deg,var(--color-app-accent-color-1),var(--app-blue))]">
                {children}
            </blockquote>
        );
    },
    hr() {
        return <hr className="io-assist-md-hr mt-4 mb-2 pb-2 border-0 border-t border-panel-border" />;
    },
    p({ children }) {
        return <p className="text-[14px] font-weight-350 leading-5 text-text-default my-3 first:mt-0 last:mb-0">{children}</p>;
    },
    strong({ children }) {
        return <strong className="font-bold">{children}</strong>;
    },
    h1({ children }) {
        return <h1 className="font-default font-weight-550 text-text-states-active py-0 mt-2 text-[20px] leading-[28px]">{children}</h1>;
    },
    h2({ children }) {
        return <h2 className="font-default font-weight-550 text-text-states-active py-0 mt-2 text-[18px] leading-[26px]">{children}</h2>;
    },
    h3({ children }) {
        return <h3 className="font-default font-weight-550 text-text-states-active py-0 mt-2 text-[16px] leading-[24px]">{children}</h3>;
    },
    h4({ children }) {
        return <h4 className="font-default font-weight-550 text-text-states-active py-0 mt-2 text-[15px] leading-[22px]">{children}</h4>;
    },
    h5({ children }) {
        return <h5 className="font-default font-weight-550 text-text-states-active py-0 mt-2 text-[14px] leading-5">{children}</h5>;
    },
    h6({ children }) {
        return <h6 className="font-default font-weight-550 text-text-states-active py-0 mt-2 text-[13px] leading-[18px]">{children}</h6>;
    },
};

export const MdFormatter: React.FC<MdFormatterProps> = ({ content }) => {
    return (
        <div className="io-assist-md w-full max-w-full min-w-0 box-border flex flex-col px-0.5">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
                {content}
            </ReactMarkdown>
        </div>
    );
};
