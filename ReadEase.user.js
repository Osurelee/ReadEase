// ==UserScript==
// @name         ReadEase
// @namespace    https://github.com/Osurelee/ReadEase
// @version      1.8
// @description  在页面标题上方插入“一键复制：[text] [html] [markdown]”。
// @author       Osurelee
// @match        *://*/*
// @grant        GM_setClipboard
// @require      https://raw.githubusercontent.com/mozilla/readability/refs/heads/main/Readability.js
// @run-at       document-idle
// ==/UserScript==

(function () {
  // ========= 可见性 & 主题色 =========
  function isVisible(el) {
    if (!el) return false;
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
  }

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
    if (!rgb || rgb.length < 3) return { color: '#000000', background: '#ffffff', hover: '#f0f0f0' };
    const lum = getLuminance(parseInt(rgb[0]), parseInt(rgb[1]), parseInt(rgb[2]));
    return lum > 0.5
      ? { color: '#000000', background: '#ffffff', hover: '#f0f0f0' }
      : { color: '#ffffff', background: '#000000', hover: '#333333' };
  }

  // ========= HTML 清理 & 文本格式 =========
  function cleanHtml(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    const rm = div.querySelectorAll(
      'script, style, link, meta, iframe, button, input, form, nav, footer, [role="complementary"], [class*="sidebar"], [class*="related"], [class*="comment"]'
    );
    rm.forEach(el => el.remove());
    // 不移除 <picture>/<source>；仅移除空节点
    div.querySelectorAll('*:empty:not(img):not(br)').forEach(el => {
        if (!el.hasChildNodes() && !el.textContent.trim()) {
            el.remove();
        }
    });
    const all = div.getElementsByTagName('*');
    for (let el of all) {
      el.removeAttribute('class');
      el.removeAttribute('style');
      el.removeAttribute('id');
    }
    for (let p of div.getElementsByTagName('p')) {
      p.style.margin = '1em 0';
    }
    return div.innerHTML;
  }

  function formatPlainText(title, text) {
    text = (text || '').replace(/\n{3,}/g, '\n\n');
    return `${title}\n\n${text}`;
  }

  // ========= URL、图片工具 =========
  function toAbsoluteUrl(u) {
    try { return new URL(u, document.baseURI).href; } catch { return u || ''; }
  }

  function pickBestFromSrcset(srcset) {
    if (!srcset) return null;
    const items = srcset.split(',').map(s => s.trim()).map(s => {
      const m = s.match(/^(.*?)\s+(\d+)(w|x)$/i);
      if (m) return { url: m[1], score: parseInt(m[2], 10) };
      return { url: s.split(/\s+/)[0], score: 0 };
    });
    items.sort((a, b) => b.score - a.score);
    return items[0]?.url || null;
  }

  function needsAngleBrackets(url) {
    return /[()\s<>]/.test(url || '');
  }
  function mdUrl(url) {
    if (!url) return '';
    const abs = toAbsoluteUrl(url);
    return needsAngleBrackets(abs) ? `<${abs}>` : abs;
  }

  function getPictureBestSrc(pictureEl) {
    if (!pictureEl) return null;
    const sources = Array.from(pictureEl.querySelectorAll('source'));
    let best = null, bestScore = -1;
    for (const s of sources) {
      const ss = s.getAttribute('srcset') || s.getAttribute('data-srcset');
      const pick = pickBestFromSrcset(ss);
      if (pick) {
        const m = ss?.match(/(\d+)(w|x)\s*$/i);
        const score = (m ? parseInt(m[1], 10) : 0) + pick.length / 1000;
        if (score > bestScore) { bestScore = score; best = pick; }
      }
    }
    if (best) return best;

    const img = pictureEl.querySelector('img');
    if (img) return getImgSrc(img);
    return null;
  }

  function getImgSrc(el) {
    if (!el) return '';
    if (el.tagName && el.tagName.toLowerCase() === 'picture') {
      const s = getPictureBestSrc(el);
      return s ? toAbsoluteUrl(s) : '';
    }
    const imgEl = el;
    const attrs = ['src', 'data-src', 'data-original', 'data-actualsrc', 'data-lazy-src', 'data-lazy', 'data-url', 'data-image', 'data-image-src', 'data-kg-src'];
    let src = null;
    for (const key of attrs) {
      const v = imgEl.getAttribute && imgEl.getAttribute(key);
      if (v && v.trim()) { src = v.trim(); break; }
    }
    if (!src) {
      const srcset = imgEl.getAttribute && (imgEl.getAttribute('srcset') || imgEl.getAttribute('data-srcset'));
      const best = pickBestFromSrcset(srcset);
      if (best) src = best;
    }
    if (!src) {
      const pic = imgEl.closest && imgEl.closest('picture');
      if (pic) {
        const best = getPictureBestSrc(pic);
        if (best) src = best;
      }
    }
    return toAbsoluteUrl(src || '');
  }

  function anchorHasOnlyVisual(aEl) {
    const hasVisual = !!(aEl.querySelector('img') || aEl.querySelector('picture'));
    const text = (aEl.textContent || '').replace(/\s+|&nbsp;/g, '');
    return hasVisual && text.length === 0;
  }

  function imageNodeToMarkdown(node) {
    let alt = '';
    let url = '';
    if (node.tagName.toLowerCase() === 'picture') {
      const img = node.querySelector('img');
      alt = (img && img.getAttribute('alt')) || '';
      url = getPictureBestSrc(node) || (img ? getImgSrc(img) : '');
    } else {
      alt = node.getAttribute('alt') || '';
      url = getImgSrc(node);
    }
    // 确保 alt 文本中的方括号被转义，避免破坏 Markdown 语法
    alt = alt.replace(/([\[\]])/g, '\\$1');
    return url ? `![${alt}](${mdUrl(url)})` : (alt ? `![${alt}]()` : '');
  }

  // ========= HTML -> Markdown (已优化) =========
  function htmlToMarkdown(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');

    function traverse(node) {
      let md = '';
      node.childNodes.forEach(child => {
        if (child.nodeType === Node.TEXT_NODE) {
          // 多个空白符合并为单个空格，但保留换行符的意图
          if (/\S/.test(child.nodeValue)) {
            md += child.nodeValue.replace(/\s+/g, ' ');
          }
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          const tag = child.tagName.toLowerCase();
          const getContent = () => traverse(child); // 子节点递归，不 trim() 以保留内部格式

          switch (tag) {
            case 'h1': md += '# ' + getContent().trim() + '\n\n'; break;
            case 'h2': md += '## ' + getContent().trim() + '\n\n'; break;
            case 'h3': md += '### ' + getContent().trim() + '\n\n'; break;
            case 'h4': md += '#### ' + getContent().trim() + '\n\n'; break;
            case 'h5': md += '##### ' + getContent().trim() + '\n\n'; break;
            case 'h6': md += '###### ' + getContent().trim() + '\n\n'; break;

            case 'p':
              md += getContent().trim() + '\n\n';
              break;

            case 'br':
              md += '  \n'; // Markdown 硬换行
              break;

            case 'strong':
            case 'b':
              md += '**' + getContent().trim() + '**';
              break;

            case 'em':
            case 'i':
              md += '*' + getContent().trim() + '*';
              break;

            case 'code':
              md += '`' + getContent().trim() + '`';
              break;

            case 'pre':
              // 对于 <pre> 标签，通常内部包含 <code>，我们直接取其文本内容
              md += '\n```\n' + child.textContent.trim() + '\n```\n\n';
              break;

            case 'img':
            case 'picture':
              md += imageNodeToMarkdown(child) + '\n\n'; // 图片作为独立段落
              break;

            case 'a': {
              if (anchorHasOnlyVisual(child)) {
                const visualNode = child.querySelector('picture') || child.querySelector('img');
                if (visualNode) {
                  md += imageNodeToMarkdown(visualNode) + '\n\n';
                }
              } else {
                const href = child.getAttribute('href') || '';
                const text = getContent().trim() || href;
                md += `[${text}](${mdUrl(href)})`;
              }
              break;
            }

            case 'ul':
              // 修正：处理 ul 内部的 li
              const ulItems = Array.from(child.children)
                .filter(li => li.tagName.toLowerCase() === 'li')
                .map(li => '* ' + traverse(li).trim());
              md += ulItems.join('\n') + '\n\n';
              break;

            case 'ol':
              let start = parseInt(child.getAttribute('start') || '1', 10);
              const olItems = Array.from(child.children)
                .filter(li => li.tagName.toLowerCase() === 'li')
                .map(li => `${start++}. ${traverse(li).trim()}`);
              md += olItems.join('\n') + '\n\n';
              break;

            case 'li':
              let content = '';
              child.childNodes.forEach(subChild => {
                  if (subChild.nodeType === Node.ELEMENT_NODE && (subChild.tagName.toLowerCase() === 'ul' || subChild.tagName.toLowerCase() === 'ol')) {
                      const nestedList = traverse(subChild).trim().split('\n').map(line => '    ' + line).join('\n');
                      content += '\n' + nestedList;
                  } else {
                      // 修正：此处应该调用 traverse 处理子节点，而不是直接拼接
                      content += traverse(subChild);
                  }
              });
              md += content.trim();
              break;

            case 'blockquote':
              const quoteContent = getContent().trim().replace(/\n{2,}/g, '\n').replace(/^/gm, '> ');
              md += `\n${quoteContent}\n\n`;
              break;

            case 'figure':
              md += getContent() + '\n';
              break;

            case 'figcaption':
              md += `*${getContent().trim()}*\n\n`;
              break;

            default:
              md += getContent();
              break;
          }
        }
      });
      return md;
    }
    let result = traverse(doc.body).trim();
    result = result.replace(/\n{3,}/g, '\n\n');
    return result;
  }


  // ========= 标题定位 =========
  function findTitleElement() {
    const h1s = Array.from(document.querySelectorAll('h1')).filter(isVisible);
    if (h1s.length) return h1s[0];
    const candidates = [
      '[itemprop="headline"]',
      '.post-title,.article-title,.entry-title,.title',
      'h2.page-title'
    ];
    for (const sel of candidates) {
      const el = document.querySelector(sel);
      if (isVisible(el)) return el;
    }
    return null;
  }

  // ========= Readability 提取 =========
  async function getReadableArticle() {
    const R =
      (typeof Readability !== 'undefined' && Readability) ||
      window.Readability ||
      (typeof unsafeWindow !== 'undefined' ? unsafeWindow.Readability : undefined);

    if (!R) {
      console.debug('[ReadEase] 未检测到 Readability 全局对象。');
      return null;
    }
    try {
      // 【关键修改】克隆文档，并在副本中移除工具栏，避免被复制
      const docClone = document.cloneNode(true);
      const toolbarClone = docClone.getElementById('copy-inline-toolbar');
      if (toolbarClone) {
        toolbarClone.remove();
      }
      
      const article = new R(docClone).parse();
      if (article && article.content) return article; // { title, content, textContent, ... }
    } catch (e) {
      console.debug('[ReadEase] Readability 解析失败：', e);
    }
    return null;
  }

  // ========= 复制逻辑 =========
  async function copyArticle(format, toolbarEl) {
    const article = await getReadableArticle();
    const title = article?.title || document.title || 'Untitled';
    let htmlContent = '', textContent = '';

    if (article) {
      htmlContent = cleanHtml(article.content);
      textContent = formatPlainText(title, article.textContent || '');
    } else {
      htmlContent = cleanHtml(document.body.innerHTML);
      textContent = formatPlainText(title, document.body.innerText || '');
    }

    const fullHtml = `<h1>${title}</h1>${htmlContent}`;
    const markdownBody = htmlToMarkdown(htmlContent);
    const markdown = `# ${title}\n\n${markdownBody}`;

    const item = {};
    if (format === 'html') {
      item['text/html'] = new Blob([fullHtml], { type: 'text/html' });
      item['text/plain'] = new Blob([textContent], { type: 'text/plain' });
    } else if (format === 'markdown') {
      item['text/plain'] = new Blob([markdown], { type: 'text/plain' });
      item['text/markdown'] = new Blob([markdown], { type: 'text/markdown' });
    } else {
      item['text/plain'] = new Blob([textContent], { type: 'text/plain' });
    }

    const feedbackOk = () => {
      if (!toolbarEl) return;
      const originalBg = toolbarEl.style.backgroundColor;
      const originalColor = toolbarEl.style.color;
      toolbarEl.style.backgroundColor = '#e6ffe6';
      toolbarEl.style.color = '#000000';
      setTimeout(() => {
        toolbarEl.style.backgroundColor = originalBg;
        toolbarEl.style.color = originalColor;
      }, 900);
    };

    const writeTextFallback = async () => {
      const textData = format === 'markdown' ? markdown : (format === 'html' ? fullHtml : textContent);
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(textData);
      } else if (typeof GM_setClipboard === 'function') {
        GM_setClipboard(textData);
      } else {
        throw new Error('No clipboard API available');
      }
    };

    try {
      if (window.ClipboardItem && navigator.clipboard?.write) {
        await navigator.clipboard.write([new ClipboardItem(item)]);
      } else {
        await writeTextFallback();
      }
      feedbackOk();
    } catch (e) {
      try {
        await writeTextFallback();
        feedbackOk();
      } catch (err) {
        alert('复制失败，请手动复制！');
      }
    }
  }

  // ========= 构建并插入工具条 =========
  if (document.getElementById('copy-inline-toolbar')) return;

  const toolbar = document.createElement('div'); // 使用 div 块级元素，使其单独占一行
  toolbar.id = 'copy-inline-toolbar';

  const theme = getContrastColor(getBackgroundColor(document.body));
  toolbar.style.display = 'block'; // 明确为块级
  toolbar.style.margin = '0 0 12px 0'; // 调整外边距，下方留出空间
  toolbar.style.padding = '4px 8px';
  toolbar.style.borderRadius = '6px';
  toolbar.style.fontSize = '14px';
  toolbar.style.lineHeight = '1.6';
  toolbar.style.border = `1px solid ${theme.color}`;
  toolbar.style.backgroundColor = theme.background;
  toolbar.style.color = theme.color;
  toolbar.style.userSelect = 'none';
  toolbar.style.zIndex = '99999';

  toolbar.innerHTML = `
    <span style="opacity:.85">一键复制：</span>
    <a href="#" data-format="text" style="text-decoration:none;margin:0 6px;">[text]</a>
    <a href="#" data-format="html" style="text-decoration:none;margin:0 6px;">[html]</a>
    <a href="#" data-format="markdown" style="text-decoration:none;margin:0 6px;">[markdown]</a>
  `;

  Array.from(toolbar.querySelectorAll('a')).forEach(a => {
    a.style.color = theme.color;
    a.style.padding = '0 2px';
    a.addEventListener('mouseenter', () => { a.style.backgroundColor = theme.hover; });
    a.addEventListener('mouseleave', () => { a.style.backgroundColor = 'transparent'; });
  });

  toolbar.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-format]');
    if (!a) return;
    e.preventDefault();
    copyArticle(a.getAttribute('data-format'), toolbar);
  });

  const titleEl = findTitleElement();
  if (titleEl && titleEl.parentElement) {
    // 【关键修改】将工具栏插入到标题元素之前
    titleEl.insertAdjacentElement('beforebegin', toolbar);
  } else {
    const container = document.createElement('div');
    container.style.margin = '12px 0';
    container.appendChild(toolbar);
    document.body.insertBefore(container, document.body.firstChild);
  }

  // 主题变化时自适应
  const observer = new MutationObserver(() => {
    const t = getContrastColor(getBackgroundColor(document.body));
    toolbar.style.backgroundColor = t.background;
    toolbar.style.color = t.color;
    toolbar.style.border = `1px solid ${t.color}`;
    Array.from(toolbar.querySelectorAll('a')).forEach(a => { a.style.color = t.color; });
  });
  observer.observe(document.body, { attributes: true, attributeFilter: ['style', 'class'], subtree: true });
})();
