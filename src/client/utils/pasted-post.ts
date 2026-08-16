export interface PastedPost {
  title: string;
  content: string;
}

interface HeadingMatch {
  title: string;
  start: number;
  end: number;
}

function removeHeading(text: string, start: number, end: number): string {
  let removalEnd = end;

  // A heading at the start of a post is normally followed by a blank line. Do
  // not leave that formatting-only whitespace at the start of the post body.
  if (start === 0) {
    const followingLineBreaks = text.slice(removalEnd).match(/^(?:\r?\n){1,2}/);
    removalEnd += followingLineBreaks?.[0].length ?? 0;
  }

  return text.slice(0, start) + text.slice(removalEnd);
}

function findMarkdownH1(text: string): HeadingMatch | null {
  const lines = [...text.matchAll(/.*(?:\r?\n|$)/g)].filter(match => match[0]);
  let fencedBy: '`' | '~' | null = null;

  for (let index = 0; index < lines.length; index++) {
    const lineMatch = lines[index];
    if (!lineMatch) continue;
    const line = lineMatch[0].replace(/\r?\n$/, '');
    const fence = line.match(/^ {0,3}(`{3,}|~{3,})/);

    if (fence?.[1]) {
      const marker = fence[1][0] as '`' | '~';
      if (fencedBy === marker) fencedBy = null;
      else if (!fencedBy) fencedBy = marker;
      continue;
    }
    if (fencedBy) continue;

    const atxHeading = line.match(/^ {0,3}#(?!#)[\t ]+(.+?)[\t ]*$/);
    if (atxHeading?.[1]) {
      const title = atxHeading[1].replace(/[\t ]+#+[\t ]*$/, '').trim();
      if (title) {
        return {
          title,
          start: lineMatch.index,
          end: lineMatch.index + line.length,
        };
      }
    }

    const underlineMatch = lines[index + 1];
    const underline = underlineMatch?.[0].replace(/\r?\n$/, '');
    if (line.trim() && underlineMatch && underline && /^ {0,3}=+[\t ]*$/.test(underline)) {
      return {
        title: line.trim(),
        start: lineMatch.index,
        end: underlineMatch.index + underline.length,
      };
    }
  }

  return null;
}

function findHtmlH1(html: string): string | null {
  if (!html || !/<h1(?:\s|>)/i.test(html)) return null;

  const document = new DOMParser().parseFromString(html, 'text/html');
  const heading = document.querySelector('h1');
  const title = heading?.textContent?.replace(/\s+/g, ' ').trim();
  return title || null;
}

function removeHtmlHeadingFromPlainText(text: string, title: string): string {
  const lines = [...text.matchAll(/.*(?:\r?\n|$)/g)].filter(match => match[0]);
  const matchingLine = lines.find(match => {
    const line = match[0].replace(/\r?\n$/, '').trim().replace(/\s+/g, ' ');
    return line === title;
  });

  if (matchingLine) {
    const lineWithoutBreak = matchingLine[0].replace(/\r?\n$/, '');
    return removeHeading(
      text,
      matchingLine.index,
      matchingLine.index + lineWithoutBreak.length,
    );
  }

  // Some clipboard producers do not put the heading on its own line.
  const titleIndex = text.indexOf(title);
  return titleIndex === -1
    ? text
    : removeHeading(text, titleIndex, titleIndex + title.length);
}

export function extractPastedPost(text: string, html = ''): PastedPost | null {
  const markdownHeading = findMarkdownH1(text);
  if (markdownHeading) {
    return {
      title: markdownHeading.title,
      content: removeHeading(text, markdownHeading.start, markdownHeading.end),
    };
  }

  const htmlTitle = findHtmlH1(html || text);
  if (!htmlTitle) return null;

  // When HTML itself was pasted as source text, remove the complete h1 element
  // rather than leaving an empty pair of tags in the Markdown body.
  if (!html) {
    const headingElement = /<h1(?:\s[^>]*)?>[\s\S]*?<\/h1\s*>/i.exec(text);
    if (headingElement?.index !== undefined) {
      return {
        title: htmlTitle,
        content: removeHeading(
          text,
          headingElement.index,
          headingElement.index + headingElement[0].length,
        ),
      };
    }
  }

  return {
    title: htmlTitle,
    content: removeHtmlHeadingFromPlainText(text, htmlTitle),
  };
}
