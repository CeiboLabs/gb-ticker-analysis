"use client";

import ReactMarkdown from "react-markdown";

interface Props {
  title: string;
  content: string;
}

export function ReportSection({ title, content }: Props) {
  const text = typeof content === "string" ? content : JSON.stringify(content, null, 2);

  return (
    <div className="mb-6">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-[#03065E]/50 mb-3">
        {title}
      </h2>
      <div className="prose prose-sm max-w-none text-[#2A2A2A] leading-relaxed prose-headings:text-[#03065E] prose-strong:text-[#03065E]">
        <ReactMarkdown>{text}</ReactMarkdown>
      </div>
    </div>
  );
}
