<script setup lang="ts">
import { ref, onMounted, watch, h, createApp } from 'vue';
import markdownit from 'markdown-it';
import markdownItTaskLists from 'markdown-it-task-lists';
import markdownItFootnote from 'markdown-it-footnote';
import markdownItDefList from 'markdown-it-deflist';
import markdownItSub from 'markdown-it-sub';
import markdownItSup from 'markdown-it-sup';
import markdownItMark from 'markdown-it-mark';
import texmath from 'markdown-it-texmath';
import katex from 'katex';
import hljs from 'highlight.js';
import 'highlight.js/styles/github.css';
import 'katex/dist/katex.min.css';
import Callout from './Callout.vue';

const props = defineProps({
  markdown: {
    type: String,
    required: true,
    default: ''
  }
});

const renderedMarkdown = ref('');

// Initialize markdown-it with configuration
const md = markdownit({
  html: true,
  linkify: true,
  typographer: true,
  highlight: function (str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(str, { language: lang }).value;
      } catch (e) {
        console.error('Error highlighting code:', e);
      }
    }
    return ''; // use external default escaping
  }
});

// Apply base plugins
try {
  md.use(markdownItTaskLists, { enabled: true, label: true });
  md.use(markdownItFootnote);
  md.use(markdownItDefList);
  md.use(markdownItSub);
  md.use(markdownItSup);
  md.use(markdownItMark);
  md.use(texmath, {
    engine: katex,
    delimiters: ['dollars', 'bracks'],
    katexOptions: { macros: { '\\RR': '\\mathbb{R}' } }
  });

} catch (error) {
  console.error('Error applying markdown-it plugins:', error);
}

// Add custom renderer for ordered lists to handle a, b, c style nested lists
md.renderer.rules.ordered_list_open = function(tokens, idx, _options, _env, _self) {
  const token = tokens[idx];
  const level = token.level;
  
  // First level is regular numbers, second level is letters, etc.
  let listStyleType = '';
  switch (Math.floor(level / 2) % 3) {
    case 0: 
      listStyleType = 'decimal'; // 1, 2, 3...
      break;
    case 1: 
      listStyleType = 'lower-alpha'; // a, b, c...
      break;
    case 2: 
      listStyleType = 'lower-roman'; // i, ii, iii...
      break;
  }
  
  return `<ol style="list-style-type: ${listStyleType}">`;
};

// Enhanced callout processing logic
const processCallouts = (markdown: string): string => {
  if (!markdown) return '';
  
  // Improved regex to match callout syntax more precisely:
  // > [!TYPE] Title
  // > Content
  // The regex catches callout notation that begins a blockquote
  const calloutRegex = /^>\s*\[!([\w-]+)[+-]?((?:\s*\|[^|\n]*)*)\](?:\s+(.*?))?$/gm;
  
  // Find all callout blocks
  let match;
  let lastIndex = 0;
  let processed = '';
  
  while ((match = calloutRegex.exec(markdown)) !== null) {
    // Add text before the match
    processed += markdown.substring(lastIndex, match.index);
    
    // Extract callout components
    const calloutType = match[1].trim().toLowerCase();
    const foldState = match[2] || ''; // + for expanded, - for collapsed
    const customParams = match[3] ? match[3].trim() : '';
    const titleLine = match[4] ? match[4].trim() : '';
    
    // Find the end of this blockquote to extract all content
    let blockquoteLines = [];
    let contentStartIndex = match.index + match[0].length;
    let contentEndIndex = contentStartIndex;
    
    // Improved blockquote detection - matches consecutive blockquote lines
    // and stops when it finds a non-blockquote line
    let nextLine;
    let nextLineRegex = /^(>.*?)$|^(?!>)(.+)$/gm;
    nextLineRegex.lastIndex = contentStartIndex;
    
    let foundEnd = false;
    
    while (!foundEnd && (nextLine = nextLineRegex.exec(markdown)) !== null) {
      if (nextLine[1]) { // This is a blockquote line
        // Remove the '>' and leading space
        let content = nextLine[1].substring(1).trim();
        blockquoteLines.push(content);
        contentEndIndex = nextLineRegex.lastIndex;
      } else {
        // Found a non-blockquote line, stop here
        foundEnd = true;
      }
    }
    
    // Process parameters (if any)
    let bgColor = '';
    let customIcon = '';
    if (customParams) {
      const params = customParams.split('|').filter(Boolean);
      params.forEach(param => {
        const trimmedParam = param.trim();
        if (trimmedParam.startsWith('#')) {
          // Color parameter
          bgColor = trimmedParam;
        } else {
          // Icon parameter
          customIcon = trimmedParam;
        }
      });
    }
    
    // Determine if foldable
    const isFoldable = foldState === '+' || foldState === '-';
    const isCollapsed = foldState === '-';
    
    // Extract the title and content
    let title = titleLine || '';
    const content = blockquoteLines.join('\n');
    
    // Create a placeholder for where to insert the callout
    // Use a unique ID to ensure we can find and replace this later
    const calloutId = `callout-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    processed += `<div id="${calloutId}" 
                       data-callout-type="${calloutType}" 
                       data-callout-title="${encodeURIComponent(title)}" 
                       data-callout-content="${encodeURIComponent(content)}"
                       data-callout-foldable="${isFoldable}" 
                       data-callout-collapsed="${isCollapsed}"
                       data-callout-bgcolor="${bgColor}"
                       data-callout-icon="${customIcon}"></div>`;
    
    lastIndex = contentEndIndex;
  }
  
  // Add any remaining text
  processed += markdown.substring(lastIndex);
  
  return processed;
};

const renderMarkdown = () => {
  if (!props.markdown) {
    renderedMarkdown.value = '';
    return;
  }
  
  // Pre-process markdown for callouts
  const processedMarkdown = processCallouts(props.markdown);
  
  // Render processed markdown
  let html = md.render(processedMarkdown);
  
  renderedMarkdown.value = html;
};

// Process the callout placeholders after the markdown is rendered to the DOM
const processCalloutPlaceholders = () => {
  // Wait for next tick to ensure the DOM is updated
  setTimeout(() => {
    const container = document.querySelector('.markdown-renderer');
    if (!container) return;
    
    // Find all callout placeholders
    const placeholders = container.querySelectorAll('[data-callout-type]');
    placeholders.forEach(placeholder => {
      const type = placeholder.getAttribute('data-callout-type');
      const title = decodeURIComponent(placeholder.getAttribute('data-callout-title') || '');
      const content = decodeURIComponent(placeholder.getAttribute('data-callout-content') || '');
      const collapsed = placeholder.getAttribute('data-callout-collapsed') === 'true';
      const iconName = placeholder.getAttribute('data-callout-icon') || '';
      
      // Create the callout component
      const calloutContainer = document.createElement('div');
      calloutContainer.className = 'vue-callout-container';
      
      // Replace the placeholder with the callout
      if (placeholder.parentNode) {
        placeholder.parentNode.replaceChild(calloutContainer, placeholder);
      }
      
      // Mount the Vue component
      const app = createApp({
        render() {
          return h(Callout, {
            type,
            title,
            content, 
            folded: collapsed ? true : undefined,
            icon: iconName
          });
        }
      });
      
      app.mount(calloutContainer);
    });
  }, 0);
};

watch(() => props.markdown, renderMarkdown, { immediate: true });

onMounted(() => {
  renderMarkdown();
  // Process callouts after the component is mounted
  processCalloutPlaceholders();
});

// Watch for changes in the rendered markdown to process callouts
watch(() => renderedMarkdown.value, processCalloutPlaceholders);
</script>

<template>
  <div class="markdown-renderer">
    <div v-html="renderedMarkdown"></div>
  </div>
</template>

<style>
.markdown-renderer {
  font-family: var(--body-font-family);
  line-height: 1.7;
}

.markdown-renderer h1,
.markdown-renderer h2,
.markdown-renderer h3,
.markdown-renderer h4,
.markdown-renderer h5,
.markdown-renderer h6 {
  font-family: var(--heading-font-family);
  margin-top: 1.5em;
  margin-bottom: 0.75em;
  line-height: 1.3;
}

.markdown-renderer h1 { font-size: 2.2rem; }
.markdown-renderer h2 { font-size: 1.8rem; border-bottom: 1px solid #eee; padding-bottom: 0.3em; }
.markdown-renderer h3 { font-size: 1.5rem; }
.markdown-renderer h4 { font-size: 1.3rem; }
.markdown-renderer h5 { font-size: 1.2rem; }
.markdown-renderer h6 { font-size: 1.1rem; }

.markdown-renderer p {
  margin-bottom: 1em;
}

.markdown-renderer ul,
.markdown-renderer ol {
  margin-bottom: 1em;
  padding-left: 2em;
}

.markdown-renderer li {
  margin-bottom: 0.3em;
}

.markdown-renderer blockquote {
  border-left: 4px solid var(--color-accent);
  padding-left: 1em;
  margin-left: 0;
  margin-right: 0;
  color: #555;
  font-style: italic;
}

.markdown-renderer blockquote > blockquote {
  border-left-color: #999;
}

.markdown-renderer code {
  font-family: monospace;
  background-color: #f3f3f3;
  padding: 0.2em 0.4em;
  border-radius: 3px;
  font-size: 0.9em;
}

.markdown-renderer pre {
  background-color: #f5f5f5;
  border-radius: 5px;
  padding: 1em;
  overflow: auto;
  margin-bottom: 1em;
}

.markdown-renderer pre code {
  background-color: transparent;
  padding: 0;
  border-radius: 0;
  font-size: 0.9em;
}

.markdown-renderer img {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 1em 0;
  border-radius: 5px;
}

.markdown-renderer hr {
  height: 0.15em;
  border: 0;
  background-color: #ddd;
  margin: 2em 0;
}

.markdown-renderer table {
  border-collapse: collapse;
  width: 100%;
  margin-bottom: 1em;
  overflow-x: auto;
  display: block;
}

.markdown-renderer table th,
.markdown-renderer table td {
  border: 1px solid #ddd;
  padding: 8px 12px;
}

.markdown-renderer table th {
  background-color: #f5f5f5;
  font-weight: bold;
  text-align: left;
}

.markdown-renderer table tr:nth-child(even) {
  background-color: #f9f9f9;
}

/* Task Lists */
.markdown-renderer .task-list-item {
  list-style-type: none;
  padding-left: 0;
  margin-left: -1.5em;
}

.markdown-renderer .task-list-item input {
  margin-right: 0.5em;
}

/* Strikethrough */
.markdown-renderer del {
  text-decoration: line-through;
}

/* Ordered Lists - Custom styling for nested lists */
.markdown-renderer ol {
  list-style-type: decimal;
  padding-left: 2em;
  margin-bottom: 1em;
}

.markdown-renderer ol ol {
  list-style-type: lower-alpha; /* a, b, c... */
}

.markdown-renderer ol ol ol {
  list-style-type: lower-roman; /* i, ii, iii... */
}

.markdown-renderer ol ol ol ol {
  list-style-type: decimal; /* back to numbers */
}

/* Footnotes */
.markdown-renderer .footnotes {
  border-top: 1px solid #ddd;
  margin-top: 2em;
  padding-top: 1em;
}

.markdown-renderer .footnotes p {
  display: inline;
}

.markdown-renderer .footnote-ref {
  font-size: 0.8em;
  position: relative;
  top: -0.5em;
}

.markdown-renderer .footnote-backref {
  font-size: 0.8em;
  text-decoration: none;
}

/* Definition Lists */
.markdown-renderer dl {
  margin-bottom: 1em;
}

.markdown-renderer dt {
  font-weight: bold;
}

.markdown-renderer dd {
  margin-left: 2em;
  margin-bottom: 0.5em;
}

/* Math Expressions */
.markdown-renderer .katex {
  text-align: center;
  margin: 0.5em 0;
  font-size: 1.1em;
}

.markdown-renderer .katex-display {
  margin: 1em auto;
  text-align: center;
  overflow-x: auto;
  overflow-y: hidden;
}

/* Vue Callout container */
.vue-callout-container {
  margin: 1rem 0;
}
</style>