import React from 'react';
import { ExternalLink } from 'lucide-react';

/**
 * Utility to detect URLs starting with http:// or https:// in response strings
 * and render them as interactive links that open in a new tab.
 */
export function renderTextWithLinks(
  text: string, 
  options?: { 
    className?: string; 
    iconClassName?: string;
    showIcon?: boolean;
  }
): React.ReactNode {
  if (!text || typeof text !== 'string') return text;

  // Match URLs starting with http:// or https://
  const urlRegex = /(https?:\/\/[^\s"'<>\\]+)/g;
  const parts = text.split(urlRegex);

  if (parts.length === 1) {
    return text;
  }

  const showIcon = options?.showIcon !== false;

  return parts.map((part, idx) => {
    if (/^https?:\/\//i.test(part)) {
      // Check if URL ends with trailing punctuation like , . ; )
      let url = part;
      let trailingPunct = '';
      const matchTrailing = url.match(/([.,;)]+)$/);
      if (matchTrailing) {
        const punct = matchTrailing[1];
        if (punct === ')' && (url.match(/\(/g) || []).length >= (url.match(/\)/g) || []).length) {
          // Parenthesis is balanced within the URL, keep it
        } else {
          url = url.slice(0, -punct.length);
          trailingPunct = punct;
        }
      }

      return (
        <React.Fragment key={idx}>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className={
              options?.className ||
              "inline-flex items-center gap-0.5 text-emerald-400 hover:text-emerald-300 underline underline-offset-2 decoration-emerald-500/60 hover:decoration-emerald-300 transition-colors cursor-pointer group/link font-medium break-all select-text"
            }
            title={`Open in new tab: ${url}`}
          >
            <span>{url}</span>
            {showIcon && (
              <ExternalLink 
                size={11} 
                className={options?.iconClassName || "inline-block shrink-0 opacity-70 group-hover/link:opacity-100 transition-opacity ml-0.5"} 
              />
            )}
          </a>
          {trailingPunct}
        </React.Fragment>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}
