import DOMPurify from 'dompurify';

const forbiddenHtmlTags = [
  'script',
  'style',
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
    ADD_TAGS: ['iframe'],
    ADD_ATTR: [
      'allow',
      'allowfullscreen',
      'fetchpriority',
      'frameborder',
      'loading',
      'referrerpolicy',
      'sandbox',
      'scrolling',
    ],
    FORBID_TAGS: forbiddenHtmlTags,
  });
}
