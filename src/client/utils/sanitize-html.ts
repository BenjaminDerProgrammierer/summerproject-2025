import DOMPurify from 'dompurify';

const forbiddenHtmlTags = [
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'form',
  'input',
  'button',
  'textarea',
  'select',
  'option',
  'base',
  'meta',
  'link',
];

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true, mathMl: true },
    FORBID_TAGS: forbiddenHtmlTags,
  });
}
