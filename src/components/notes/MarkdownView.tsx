import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';

/** Block dangerous link schemes even before sanitization. */
function safeUrl(url: string): string {
  const t = url.trim().toLowerCase();
  if (t.startsWith('javascript:') || t.startsWith('vbscript:') || t.startsWith('data:') || t.startsWith('file:')) return '#blocked';
  return url;
}

export default function MarkdownView({ content }: { content: string }) {
  return (
    <div className="md-preview">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        urlTransform={safeUrl}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="text-accent underline underline-offset-2 break-all">
              {children}
            </a>
          ),
          code: ({ className, children }: any) => (
            <code className={`rounded bg-surface2 border border-border px-1.5 py-0.5 text-[13px] font-mono ${className ?? ''}`}>{children}</code>
          ),
          pre: ({ children }) => (
            <pre className="rounded-xl bg-surface2 border border-border p-4 overflow-x-auto text-[13px] font-mono leading-[1.7]">{children}</pre>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto"><table className="w-full text-sm border-collapse">{children}</table></div>
          ),
          th: ({ children }) => <th className="border border-border bg-surface2 px-3 py-1.5 text-left font-medium">{children}</th>,
          td: ({ children }) => <td className="border border-border px-3 py-1.5 align-top">{children}</td>,
          blockquote: ({ children }) => <blockquote className="border-l-2 border-accent/60 pl-4 my-3 text-muted italic">{children}</blockquote>,
          h1: ({ children }) => <h1 className="text-xl font-semibold mt-2 mb-1">{children}</h1>,
          h2: ({ children }) => <h2 className="text-lg font-semibold mt-4 mb-1">{children}</h2>,
          h3: ({ children }) => <h3 className="text-[16px] font-semibold mt-3 mb-1">{children}</h3>,
          ul: ({ children }) => <ul className="list-disc pl-6 my-2.5 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-6 my-2.5 space-y-1">{children}</ol>,
          li: ({ children, ...props }: any) => (
            <li className={props.className?.includes('task-list-item') ? 'list-none -ml-5' : ''} {...props}>{children}</li>
          ),
          input: ({ ...props }: any) =>
            props.type === 'checkbox' ? <input type="checkbox" checked={Boolean(props.checked)} readOnly className="mr-1.5 accent-[#7fb685]" /> : <input {...props} />,
          hr: () => <hr className="border-border my-3" />,
        }}
      >
        {content || '*Nothing to preview*'}
      </ReactMarkdown>
    </div>
  );
}
