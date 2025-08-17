// ==UserScript==
// @name         ReadEase
// @namespace    https://github.com/example/ReadEase
// @version      1.1
// @description  在网页边缘显示可拖动的“复制正文”按钮，一键复制网页标题和正文，支持 HTML、Markdown 或纯文本。
// @author       ReadEase contributors
// @match        *://*/*
// @grant        GM_setClipboard
// @require      https://cdn.jsdelivr.net/npm/@mozilla/readability@0.5.0/Readability.js
// @run-at       document-idle
// ==/UserScript==

(function() {
  // htmlToMarkdown function
  function htmlToMarkdown(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    let lastTag = null;
    return traverse(doc.body);

    function traverse(node) {
      let md = '';
      node.childNodes.forEach(child => {
        if (child.nodeType === Node.TEXT_NODE) {
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
              md += '\n' + content + '\n\n';
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
                md += '\n\n' + heading + '\n\n';
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

  if (document.getElementById('copy-article-btn')) return;

  function getBackgroundColor(element) {
    const backgroundColor = window.getComputedStyle(element).backgroundColor;
    if (backgroundColor === 'rgba(0, 0, 0, 0)' || backgroundColor === 'transparent') {
      return element.parentElement ? getBackgroundColor(element.parentElement) : 'rgb(255, 255, 255)';
    }
    return backgroundColor;
  }

  function getLuminance(r, g, b) {
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }

  function getContrastColor(backgroundColor) {
    const rgb = backgroundColor.match(/\d+/g);
    if (!rgb || rgb.length < 3) return { color: '#000000', background: '#ffffff' };
    const luminance = getLuminance(parseInt(rgb[0]), parseInt(rgb[1]), parseInt(rgb[2]));
    return luminance > 0.5 ?
      { color: '#000000', background: '#ffffff' } :
      { color: '#ffffff', background: '#000000' };
  }

  const btn = document.createElement('button');
  btn.id = 'copy-article-btn';
  btn.title = '一键复制网页标题和正文';

  function updateStyles() {
    const bodyBgColor = getBackgroundColor(document.body);
    const colors = getContrastColor(bodyBgColor);
    btn.style.color = colors.color;
    btn.style.backgroundColor = colors.background;
    btn.style.border = `1px solid ${colors.color}`;
    if (menu) {
      menu.style.color = colors.color;
      menu.style.backgroundColor = colors.background;
      menu.style.border = `1px solid ${colors.color}`;
      const hoverBg = colors.background === '#ffffff' ? '#f0f0f0' : '#333333';
      menu.querySelectorAll('button').forEach(mb => {
        mb.style.color = colors.color;
        mb.style.backgroundColor = 'transparent';
        mb.onmouseenter = () => mb.style.backgroundColor = hoverBg;
        mb.onmouseleave = () => mb.style.backgroundColor = 'transparent';
      });
    }
  }

  btn.innerHTML = '<div style="font-size:15px;line-height:1.1;font-weight:bold;white-space:pre;user-select:none;text-align:center;">复制\n正文</div>';

  let isDragging = false, offsetX = 0, offsetY = 0;

  btn.addEventListener('mousedown', function(e) {
    isDragging = true;
    const rect = btn.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    btn.style.transition = 'none';
    btn.style.left = rect.left + 'px';
    btn.style.top = rect.top + 'px';
    btn.style.transform = '';
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', function(e) {
    if (isDragging) {
      btn.style.left = (e.clientX - offsetX) + 'px';
      btn.style.top = (e.clientY - offsetY) + 'px';
      btn.style.right = 'auto';
    }
  });

  document.addEventListener('mouseup', function() {
    if (isDragging) {
      isDragging = false;
      btn.style.transition = '';
      document.body.style.userSelect = '';
    }
  });

  function positionButton() {
    const heading = document.querySelector('h1');
    btn.style.position = 'fixed';
    if (heading) {
      const rect = heading.getBoundingClientRect();
      btn.style.left = (rect.left + rect.width / 2) + 'px';
      btn.style.top = (rect.bottom + 8) + 'px';
    } else {
      btn.style.left = '50%';
      btn.style.top = '8px';
    }
    btn.style.right = 'auto';
    btn.style.transform = 'translateX(-50%)';
  }
  positionButton();
  window.addEventListener('resize', positionButton);

  const menu = document.createElement('div');
  menu.id = 'copy-format-menu';
  menu.innerHTML = `
    <button data-format="html">HTML</button>
    <button data-format="markdown">Markdown</button>
    <button data-format="text">Text</button>
  `;
  document.body.appendChild(menu);

  const observer = new MutationObserver(updateStyles);
  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ['style', 'class'],
    subtree: true
  });

  document.body.appendChild(btn);
  updateStyles();

  function cleanHtml(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    const elementsToRemove = div.querySelectorAll(
      'script, style, link, meta, iframe, button, input, form, nav, footer, [role="complementary"], [class*="sidebar"], [class*="related"], [class*="comment"]'
    );
    elementsToRemove.forEach(el => el.remove());
    const emptyElements = div.querySelectorAll('*:empty');
    emptyElements.forEach(el => el.remove());
    const allElements = div.getElementsByTagName('*');
    for (let el of allElements) {
      el.removeAttribute('class');
      el.removeAttribute('style');
      el.removeAttribute('id');
    }
    const paragraphs = div.getElementsByTagName('p');
    for (let p of paragraphs) {
      p.style.margin = '1em 0';
    }
    return div.innerHTML;
  }

  function formatPlainText(title, text) {
    text = text.replace(/\n{3,}/g, '\n\n');
    return `${title}\n\n${text}`;
  }

  btn.addEventListener('click', function(e) {
    if (isDragging) return;
    e.stopPropagation();
    if (menu.style.display === 'block') {
      menu.style.display = 'none';
    } else {
      const rect = btn.getBoundingClientRect();
      menu.style.left = (rect.left + rect.width / 2) + 'px';
      menu.style.top = (rect.bottom + 4) + 'px';
      menu.style.transform = 'translateX(-50%)';
      menu.style.display = 'block';
    }
  });

  document.addEventListener('click', function(e) {
    if (!menu.contains(e.target) && e.target !== btn) {
      menu.style.display = 'none';
    }
  });

  menu.addEventListener('click', function(e) {
    const format = e.target.getAttribute('data-format');
    if (!format) return;
    e.stopPropagation();
    menu.style.display = 'none';
    copyArticle(format);
  });

  async function copyArticle(format) {
    const title = document.title;
    let htmlContent = '', textContent = '';

    try {
      const article = new Readability(document.cloneNode(true)).parse();
      if (article) {
        htmlContent = cleanHtml(article.content);
        textContent = formatPlainText(title, article.textContent);
      }
    } catch (e) {
      htmlContent = cleanHtml(document.body.innerHTML);
      textContent = formatPlainText(title, document.body.innerText || '');
    }

    const fullHtml = `<h1>${title}</h1>${htmlContent}`;
    let markdown = `# ${title}\n\n` + htmlToMarkdown(htmlContent);

    const item = {};
    if (format === 'html') {
      item['text/html'] = new Blob([fullHtml], {type: 'text/html'});
      item['text/plain'] = new Blob([textContent], {type: 'text/plain'});
    } else if (format === 'markdown') {
      item['text/plain'] = new Blob([markdown], {type: 'text/plain'});
      item['text/markdown'] = new Blob([markdown], {type: 'text/markdown'});
    } else {
      item['text/plain'] = new Blob([textContent], {type: 'text/plain'});
    }

    try {
      if (window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {
        await navigator.clipboard.write([new ClipboardItem(item)]);
      } else {
        const textData = format === "markdown" ? markdown : (format === "html" ? fullHtml : textContent);
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(textData);
        } else if (typeof GM_setClipboard === 'function') {
          GM_setClipboard(textData);
        }
      }
      const originalBg = btn.style.backgroundColor;
      const originalColor = btn.style.color;
      btn.style.backgroundColor = "#e6ffe6";
      btn.style.color = "#000000";
      btn.title = "复制成功！";
      setTimeout(()=> {
        btn.style.backgroundColor = originalBg;
        btn.style.color = originalColor;
        btn.title = "一键复制网页标题和正文";
      }, 1200);
    } catch (e) {
      try {
        const textData = format === "markdown" ? markdown : (format === "html" ? fullHtml : textContent);
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(textData);
        } else if (typeof GM_setClipboard === 'function') {
          GM_setClipboard(textData);
        }
        const originalBg = btn.style.backgroundColor;
        const originalColor = btn.style.color;
        btn.style.backgroundColor = "#e6ffe6";
        btn.style.color = "#000000";
        btn.title = "复制成功！";
        setTimeout(() => {
          btn.style.backgroundColor = originalBg;
          btn.style.color = originalColor;
          btn.title = "一键复制网页标题和正文";
        }, 1200);
      } catch (err) {
        alert('复制失败，请手动复制！');
      }
    }
  }
})();
