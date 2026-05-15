"use client";

import ReactMarkdown from "react-markdown";

interface Props {
  title: string;
  content: string;
}

export function ReportSection({ title, content }: Props) {
  const text = typeof content === "string" ? content : JSON.stringify(content, null, 2);

  return (
    <div
      style={{
        paddingTop: "var(--space-5)",
        paddingBottom: "var(--space-5)",
        borderTop: "1px solid var(--rule)",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "200px 1fr",
          gap: "var(--space-5)",
          alignItems: "baseline",
        }}
        className="report-section-grid"
      >
        <h2
          className="serif"
          style={{
            fontWeight: 400,
            fontSize: 24,
            lineHeight: 1.15,
            margin: 0,
            letterSpacing: "-0.015em",
            color: "var(--ink)",
          }}
        >
          {title}
        </h2>
        <div
          className="body-base prose prose-sm"
          style={{
            maxWidth: "44em",
            color: "var(--ink-2)",
            lineHeight: 1.65,
          }}
        >
          <ReactMarkdown>{text}</ReactMarkdown>
        </div>
      </div>

      <style>{`
        @media (max-width: 760px) {
          .report-section-grid { grid-template-columns: 1fr !important; gap: var(--space-2) !important; }
        }
      `}</style>
    </div>
  );
}
