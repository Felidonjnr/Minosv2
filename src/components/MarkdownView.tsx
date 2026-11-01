import React, { useMemo } from 'react';

interface MarkdownViewProps {
  content: string;
  className?: string;
}

export const MarkdownView: React.FC<MarkdownViewProps> = ({ content, className = '' }) => {
  const html = useMemo(() => {
    if (!content) return '';
    const lines = content.split('\n');
    let out = '';
    let inUL = false;
    let inOL = false;
    let inTbl = false;
    let trows: string[][] = [];

    function cUL() {
      if (inUL) {
        out += '</ul>';
        inUL = false;
      }
    }
    function cOL() {
      if (inOL) {
        out += '</ol>';
        inOL = false;
      }
    }
    function cT() {
      if (!inTbl) return;
      let t = '<table>';
      trows.forEach((r, i) => {
        t += '<tr>';
        r.forEach(c => {
          t += i === 0 ? `<th>${c}</th>` : `<td>${c}</td>`;
        });
        t += '</tr>';
      });
      t += '</table>';
      out += t;
      inTbl = false;
      trows = [];
    }

    function il(s: string): string {
      return s
        .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/__(.+?)__/g, '<strong>$1</strong>')
        .replace(/_([^_]+)_/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code>$1</code>');
    }

    lines.forEach(line => {
      const isTbl = /^\|(.+)\|$/.test(line);
      const isSep = /^\|[\s\-|:]+\|$/.test(line);

      if (isTbl && !isSep) {
        cUL();
        cOL();
        if (!inTbl) inTbl = true;
        trows.push(
          line
            .split('|')
            .filter((_, i, a) => i > 0 && i < a.length - 1)
            .map(c => il(c.trim()))
        );
        return;
      }
      if (isSep) return;
      if (!isTbl && inTbl) cT();

      if (/^### /.test(line)) {
        cUL();
        cOL();
        out += `<h3>${il(line.slice(4))}</h3>`;
      } else if (/^## /.test(line)) {
        cUL();
        cOL();
        out += `<h2>${il(line.slice(3))}</h2>`;
      } else if (/^# /.test(line)) {
        cUL();
        cOL();
        out += `<h1>${il(line.slice(2))}</h1>`;
      } else if (/^> /.test(line)) {
        cUL();
        cOL();
        out += `<blockquote><p>${il(line.slice(2))}</p></blockquote>`;
      } else if (/^---/.test(line)) {
        cUL();
        cOL();
        out += '<hr>';
      } else if (/^[-*] /.test(line)) {
        cOL();
        if (!inUL) {
          out += '<ul>';
          inUL = true;
        }
        out += `<li>${il(line.slice(2))}</li>`;
      } else if (/^\d+\. /.test(line)) {
        cUL();
        if (!inOL) {
          out += '<ol>';
          inOL = true;
        }
        out += `<li>${il(line.replace(/^\d+\. /, ''))}</li>`;
      } else if (line.trim()) {
        cUL();
        cOL();
        out += `<p>${il(line)}</p>`;
      } else {
        cUL();
        cOL();
      }
    });

    cUL();
    cOL();
    cT();
    return out;
  }, [content]);

  return (
    <div 
      className={`prose-minos ${className}`} 
      dangerouslySetInnerHTML={{ __html: html }} 
    />
  );
};
