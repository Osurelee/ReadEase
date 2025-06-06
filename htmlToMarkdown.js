function htmlToMarkdown(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return traverse(doc.body).trim();

  function traverse(node) {
    let md = '';
    node.childNodes.forEach(child => {
      if (child.nodeType === Node.TEXT_NODE) {
        md += child.nodeValue.replace(/\s+/g, ' ');
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const tag = child.tagName.toLowerCase();
        const content = traverse(child);
        switch (tag) {
          case 'h1': md += '# ' + content + '\n\n'; break;
          case 'h2': md += '## ' + content + '\n\n'; break;
          case 'h3': md += '### ' + content + '\n\n'; break;
          case 'h4': md += '#### ' + content + '\n\n'; break;
          case 'h5': md += '##### ' + content + '\n\n'; break;
          case 'h6': md += '###### ' + content + '\n\n'; break;
          case 'p': md += content + '\n\n'; break;
          case 'br': md += '\n'; break;
          case 'strong':
          case 'b': md += '**' + content + '**'; break;
          case 'em':
          case 'i': md += '*' + content + '*'; break;
          case 'code': md += '`' + content + '`'; break;
          case 'pre': md += '\n```\n' + child.textContent + '\n```\n\n'; break;
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
            md += Array.from(child.children).map(li => '* ' + traverse(li).trim()).join('\n') + '\n\n';
            break;
          case 'ol': {
            let i = 1;
            md += Array.from(child.children).map(li => (i++) + '. ' + traverse(li).trim()).join('\n') + '\n\n';
            break;
          }
          case 'li':
            md += content + '\n';
            break;
          default:
            md += content;
        }
      }
    });
    return md;
  }
}

if (typeof module !== 'undefined') {
  module.exports = htmlToMarkdown;
}
