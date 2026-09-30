import type { ComponentPropsWithoutRef, ElementType } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { isSafeHref, markdownHeadingTag } from "../model/answer-markdown";

type AnswerBodyProps = {
  answer: string;
};

function headingComponent(depth: number) {
  return function MdHeading(props: ComponentPropsWithoutRef<"h1">) {
    const Tag = markdownHeadingTag(depth) as ElementType;
    const { node: _node, ...rest } = props as ComponentPropsWithoutRef<"h1"> & { node?: unknown };
    return <Tag {...rest} />;
  };
}

function MarkdownAnchor(props: ComponentPropsWithoutRef<"a">) {
  const { href, children, node: _node, ...rest } = props as ComponentPropsWithoutRef<"a"> & { node?: unknown };
  if (!href || !isSafeHref(href)) {
    return <span>{children}</span>;
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>
      {children}
    </a>
  );
}

function MarkdownImage(props: ComponentPropsWithoutRef<"img">) {
  const { alt, node: _node, src: _src } = props as ComponentPropsWithoutRef<"img"> & { node?: unknown };
  if (alt && alt.length > 0) {
    return <span className="image-alt">{alt}</span>;
  }
  return null;
}

export function AnswerBody({ answer }: AnswerBodyProps) {
  if (answer.trim().length === 0) {
    return null;
  }

  return (
    <div className="answer-md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          h1: headingComponent(1),
          h2: headingComponent(2),
          h3: headingComponent(3),
          h4: headingComponent(4),
          h5: headingComponent(5),
          h6: headingComponent(6),
          a: MarkdownAnchor,
          img: MarkdownImage,
        }}
      >
        {answer}
      </ReactMarkdown>
    </div>
  );
}
