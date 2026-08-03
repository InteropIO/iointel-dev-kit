import { Highlight } from "prism-react-renderer";
import React from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { prismTwilight } from "./prismTwilightTheme";
import { CopyButton } from "../shared/CopyButton";

type MdFormatterProps = {
    content: string;
};

const CodeBlock: React.FC<{ className?: string; children?: React.ReactNode }> = ({ className, children }) => {
    const code = String(children).replace(/\n$/, "");
    const rawLanguage = className?.replace(/^language-/, "") ?? "";

    return (
        <div className="io-assist-code-block relative w-full my-2 box-border flex flex-col rounded-2xl bg-app-background-secondary p-4">
            <CopyButton textToCopy={code} className="absolute top-[15px] right-[20px] z-1" />
            <div className="io-assist-code-theme block w-full pt-4">
                <Highlight code={code} language={rawLanguage} theme={prismTwilight}>
                    {({ className: prismClassName, style, tokens, getLineProps, getTokenProps }) => (
                        <pre className={`m-0 p-0 bg-transparent overflow-x-auto ${prismClassName}`} style={style}>
                            <code className="block whitespace-pre-wrap break-words max-w-full box-border font-mono text-[13px] leading-[18px]">
                                {tokens.map((line, i) => (
                                    <div key={i} {...getLineProps({ line })}>
                                        {line.map((token, key) => (
                                            <span key={key} {...getTokenProps({ token })} />
                                        ))}
                                    </div>
                                ))}
                            </code>
                        </pre>
                    )}
                </Highlight>
            </div>
        </div>
    );
};

const components: Components = {
    code({ className, children, ...props }) {
        const isInline = !className && typeof children === "string" && !children.includes("\n");
        if (isInline) {
            return (
                <code className="bg-app-background-secondary px-1.5 py-0.5 rounded text-sm font-mono text-text-states-active" {...props}>
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
                className="text-[14px] font-semibold leading-5 text-[var(--app-blue)] underline [text-decoration-skip-ink:none] hover:opacity-[0.85]"
                target="_blank"
                rel="noopener noreferrer"
            >
                {children}
            </a>
        );
    },
    table({ children }) {
        return <table className="block w-full max-w-full my-2 border-collapse overflow-x-auto">{children}</table>;
    },
    thead({ children }) {
        return <thead className="text-left">{children}</thead>;
    },
    th({ children }) {
        return <th className="py-3 pr-3 pl-0 last:pr-0 font-medium text-[14px] leading-5 text-text-states-active border-b-2 border-panel-border">{children}</th>;
    },
    td({ children }) {
        return <td className="py-3 pr-3 pl-0 last:pr-0 text-[14px] leading-5 text-text-default">{children}</td>;
    },
    tr({ children, ...props }) {
        return (
            <tr className="border-t border-panel-border" {...props}>
                {children}
            </tr>
        );
    },
    ul({ children }) {
        return <ul className="list-disc pl-5 mt-4 mb-2 text-[14px] font-normal leading-5 text-text-default">{children}</ul>;
    },
    ol({ children }) {
        return <ol className="list-decimal pl-5 mt-4 mb-2 text-[14px] font-normal leading-5 text-text-default">{children}</ol>;
    },
    li({ children }) {
        return <li className="py-1">{children}</li>;
    },
    blockquote({ children }) {
        return <blockquote className="p-4 my-4 rounded-2xl text-text-default flex flex-col gap-1 relative border border-app-accent-color-1">{children}</blockquote>;
    },
    hr() {
        return <hr className="my-4 border-0 border-t border-panel-border" />;
    },
    p({ children }) {
        return <p className="text-[14px] font-normal leading-5 text-text-default my-2 first:mt-0 last:mb-0">{children}</p>;
    },
    strong({ children }) {
        return <strong className="font-semibold">{children}</strong>;
    },
    h1({ children }) {
        return <h1 className="font-default font-medium text-text-states-active py-0 mt-5 text-[20px] leading-[28px]">{children}</h1>;
    },
    h2({ children }) {
        return <h2 className="font-default font-medium text-text-states-active py-0 mt-5 text-[18px] leading-[26px]">{children}</h2>;
    },
    h3({ children }) {
        return <h3 className="font-default font-medium text-text-states-active py-0 mt-5 text-[16px] leading-[24px]">{children}</h3>;
    },
    h4({ children }) {
        return <h4 className="font-default font-medium text-text-states-active py-0 mt-5 text-[15px] leading-[22px]">{children}</h4>;
    },
    h5({ children }) {
        return <h5 className="font-default font-medium text-text-states-active py-0 mt-5 text-[14px] leading-5">{children}</h5>;
    },
    h6({ children }) {
        return <h6 className="font-default font-medium text-text-states-active py-0 mt-5 text-[13px] leading-[18px]">{children}</h6>;
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
