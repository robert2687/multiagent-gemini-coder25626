import React, { useMemo } from 'react';
import { Marked, Renderer } from 'marked';
import DOMPurify from 'dompurify';

interface MarkdownProps {
  content: string;
}

// Configure marked to add Tailwind classes to generated HTML
const renderer = new Renderer();

renderer.code = (code: string, language: string | undefined) => {
  return `<div class="my-4 rounded-lg overflow-hidden border border-gray-800 bg-gray-900">
            <div class="flex items-center px-4 py-2 bg-gray-800/50 border-b border-gray-800 text-xs text-gray-400 font-mono uppercase tracking-wider">
              ${language || 'code'}
            </div>
            <pre class="p-4 overflow-x-auto text-sm text-gray-300 font-mono leading-relaxed"><code>${code}</code></pre>
          </div>`;
};

renderer.paragraph = (text: string) => {
  return `<p class="mb-4 text-gray-300 leading-relaxed">${text}</p>`;
};

renderer.heading = (text: string, level: number) => {
  const sizes = {
    1: 'text-2xl font-bold mt-8 mb-4 text-white',
    2: 'text-xl font-semibold mt-6 mb-3 text-white',
    3: 'text-lg font-medium mt-4 mb-2 text-white',
    4: 'text-base font-medium mt-4 mb-2 text-white',
    5: 'text-sm font-medium mt-4 mb-2 text-white',
    6: 'text-xs font-medium mt-4 mb-2 text-white',
  };
  const className = sizes[level as keyof typeof sizes] || sizes[1];
  return `<h${level} class="${className}">${text}</h${level}>`;
};

renderer.list = (body: string, ordered: boolean) => {
  const type = ordered ? 'ol' : 'ul';
  const className = ordered ? 'list-decimal list-inside mb-4 space-y-1 text-gray-300' : 'list-disc list-inside mb-4 space-y-1 text-gray-300';
  return `<${type} class="${className}">${body}</${type}>`;
};

renderer.listitem = (text: string) => {
  return `<li class="ml-4">${text}</li>`;
};

renderer.codespan = (text: string) => {
  return `<code class="bg-gray-800 text-blue-300 px-1.5 py-0.5 rounded text-sm font-mono">${text}</code>`;
};

renderer.link = (href: string, title: string | null | undefined, text: string) => {
  return `<a href="${href}" title="${title || ''}" class="text-blue-400 hover:text-blue-300 underline underline-offset-2" target="_blank" rel="noopener noreferrer">${text}</a>`;
};

renderer.blockquote = (quote: string) => {
  return `<blockquote class="border-l-4 border-blue-500 pl-4 py-1 my-4 bg-gray-800/30 text-gray-400 italic rounded-r">${quote}</blockquote>`;
};

// Fix: Instantiate a new Marked instance instead of mutating the global one
const markedInstance = new Marked({ renderer });

export const Markdown: React.FC<MarkdownProps> = ({ content }) => {
  const html = useMemo(() => {
    const rawHtml = markedInstance.parse(content) as string;
    // Fix: Allow 'target' attribute so links can open in new tabs
    return DOMPurify.sanitize(rawHtml, { ADD_ATTR: ['target'] });
  }, [content]);

  return (
    <div 
      className="markdown-container break-words"
      dangerouslySetInnerHTML={{ __html: html }} 
    />
  );
};