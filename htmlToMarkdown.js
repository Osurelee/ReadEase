function htmlToMarkdown(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  let lastTag = null;

  return traverse(doc.body);  // 不使用 trim，保留结构性换行

  function traverse(node) {
    let md = '';
    node.childNodes.forEach(child => {
      if (child.nodeType === Node.TEXT_NODE) {
        // 如果去掉空白后长度为 0，就跳过
        if (!/\S/.test(child.nodeValue)) return;
        md += child.nodeValue.replace(/\s+/g, ' ');
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const tag = child.tagName.toLowerCase();
        const content = traverse(child).trim();
        const className = (child.getAttribute('class') || '').toLowerCase();
        const isQuoteLike = /quote/.test(className);
        const isFullQuote = /^“[^”]{2,}”$/.test(content);
        const parentTag = child.parentElement?.tagName?.toLowerCase() || '';

        switch (tag) {
          case 'h1': md += '# ' + content + '\n\n'; break;
          case 'h2': md += '## ' + content + '\n\n'; break;
          case 'h3': md += '### ' + content + '\n\n'; break;
          case 'h4': md += '#### ' + content + '\n\n'; break;
          case 'h5': md += '##### ' + content + '\n\n'; break;
          case 'h6': md += '###### ' + content + '\n\n'; break;

          case 'figure':
            md += '\n' + content + '\n\n';  // figure 本身不渲染，只做结构隔断
            lastTag = 'figure';
            break;

          case 'figcaption':
            md += '\n> ' + content.replace(/\n/g, '\n> ') + '\n\n';
            lastTag = 'figcaption';
            break;

          case 'p': {
            if (lastTag === 'figcaption' && isFullQuote) {
              let headingLevel = (parentTag === 'figure') ? 1 : 2;
              const heading = '#'.repeat(headingLevel) + ' ' + content.trim();
              md += '\n\n' + heading + '\n\n';  // 💡 强制从空行起始
            } else if (isQuoteLike || isFullQuote) {
              md += '\n> ' + content.replace(/\n/g, '\n> ') + '\n\n';
            } else {
              md += content + '\n\n';
            }
            lastTag = 'p';
            break;
          }
          case 'br': md += '\n'; break;
          case 'strong':
          case 'b': md += '**' + content + '**'; break;
          case 'em':
          case 'i': md += '*' + content + '*'; break;
          case 'code': md += '`' + content + '`'; break;
          case 'pre': md += '\n```\n' + child.textContent.trim() + '\n```\n\n'; break;

          case 'a': {
            const href = child.getAttribute('href') || '';
            md += '[' + content + '](' + href + ')';
            break;
          }

          case 'img': {
            const alt = child.getAttribute('alt') || '';
            const src = child.getAttribute('src') || '';
            md += '![' + alt + '](' + src + ')';
            break;
          }

          case 'ul':
            md += Array.from(child.children)
              .map(li => '* ' + traverse(li).trim())
              .join('\n') + '\n\n';
            break;

          case 'ol': {
            let i = 1;
            md += Array.from(child.children)
              .map(li => (i++) + '. ' + traverse(li).trim())
              .join('\n') + '\n\n';
            break;
          }

          case 'li':
            md += content + '\n';
            break;

          case 'blockquote':
            md += '\n> ' + content.replace(/\n/g, '\n> ') + '\n\n';
            break;

          default:
            if (isQuoteLike) {
              md += '\n> ' + content.replace(/\n/g, '\n> ') + '\n\n';
            } else {
              md += content;
            }
        }
      }
    });
    return md;
  }
}

if (typeof module !== 'undefined') {
  module.exports = htmlToMarkdown;
}