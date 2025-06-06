console.log('copy-article content.js injected');

(function() {
  if (document.getElementById('read-ease-wrap')) return;

  // 获取背景色的函数
  function getBackgroundColor(element) {
    const backgroundColor = window.getComputedStyle(element).backgroundColor;
    if (backgroundColor === 'rgba(0, 0, 0, 0)' || backgroundColor === 'transparent') {
      return element.parentElement ? getBackgroundColor(element.parentElement) : 'rgb(255, 255, 255)';
    }
    return backgroundColor;
  }

  // 计算颜色亮度
  function getLuminance(r, g, b) {
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }

  // 获取反色
  function getContrastColor(backgroundColor) {
    const rgb = backgroundColor.match(/\d+/g);
    if (!rgb || rgb.length < 3) return { color: '#000000', background: '#ffffff' };
    
    const luminance = getLuminance(parseInt(rgb[0]), parseInt(rgb[1]), parseInt(rgb[2]));
    return luminance > 0.5 ? 
      { color: '#000000', background: '#ffffff' } : 
      { color: '#ffffff', background: '#000000' };
  }

  const wrap = document.createElement('div');
  wrap.id = 'read-ease-wrap';

  const btn = document.createElement('button');
  btn.id = 'copy-article-btn';
  btn.title = '一键复制网页标题和正文';

  const readerBtn = document.createElement('button');
  readerBtn.id = 'reader-mode-btn';
  readerBtn.title = '阅读模式';

  // 根据页面背景设置按钮和菜单样式
  function updateStyles() {
    const bodyBgColor = getBackgroundColor(document.body);
    const colors = getContrastColor(bodyBgColor);

    [btn, readerBtn].forEach(b => {
      b.style.color = colors.color;
      b.style.backgroundColor = colors.background;
      b.style.border = `1px solid ${colors.color}`;
    });

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

  // 纯文字按钮内容
  btn.innerHTML = '<div style="font-size:15px;line-height:1.1;font-weight:bold;white-space:pre;user-select:none;text-align:center;">复制\n正文</div>';
  readerBtn.innerHTML = '<div style="font-size:15px;line-height:1.1;font-weight:bold;white-space:pre;user-select:none;text-align:center;">阅读\n模式</div>';

  // 拖动功能变量
  let isDragging = false, offsetX = 0, offsetY = 0;

  wrap.addEventListener('mousedown', function(e) {
    if (e.target !== btn && e.target !== readerBtn) return;
    isDragging = true;
    offsetX = e.clientX - wrap.getBoundingClientRect().left;
    offsetY = e.clientY - wrap.getBoundingClientRect().top;
    wrap.style.transition = 'none';
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', function(e) {
    if (isDragging) {
      wrap.style.left = (e.clientX - offsetX) + 'px';
      wrap.style.top = (e.clientY - offsetY) + 'px';
      wrap.style.right = 'auto';
    }
  });

  document.addEventListener('mouseup', function() {
    if (isDragging) {
      isDragging = false;
      wrap.style.transition = '';
      document.body.style.userSelect = '';
    }
  });

  // 初始位置
  wrap.style.left = 'auto';
  wrap.style.top = '40%';
  wrap.style.right = '24px';

  // 创建格式选择菜单
  const menu = document.createElement('div');
  menu.id = 'copy-format-menu';
  menu.innerHTML = `
    <button data-format="html">HTML</button>
    <button data-format="markdown">Markdown</button>
    <button data-format="text">Text</button>
  `;
  document.body.appendChild(menu);

  // 监听背景色变化
  const observer = new MutationObserver(updateStyles);
  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ['style', 'class'],
    subtree: true
  });

  wrap.appendChild(btn);
  wrap.appendChild(readerBtn);
  document.body.appendChild(wrap);
  updateStyles(); // 初始化样式

  // 清理HTML内容的函数
  function cleanHtml(html) {
    const div = document.createElement('div');
    div.innerHTML = html;

    // 移除不必要的标签和属性
    const elementsToRemove = div.querySelectorAll(
      'script, style, link, meta, iframe, button, input, form, nav, footer, [role="complementary"], [class*="sidebar"], [class*="related"], [class*="comment"]'
    );
    elementsToRemove.forEach(el => el.remove());

    // 移除空标签
    const emptyElements = div.querySelectorAll('div:empty, span:empty, p:empty');
    emptyElements.forEach(el => el.remove());

    // 移除所有class和style属性
    const allElements = div.getElementsByTagName('*');
    for (let el of allElements) {
      el.removeAttribute('class');
      el.removeAttribute('style');
      el.removeAttribute('id');
    }

    // 统一段落样式
    const paragraphs = div.getElementsByTagName('p');
    for (let p of paragraphs) {
      p.style.margin = '1em 0';
    }

    return div.innerHTML;
  }

  // 格式化纯文本的函数
  function formatPlainText(title, text) {
    // 移除多余的空行
    text = text.replace(/\n{3,}/g, '\n\n');
    
    // 确保标题和正文之间有适当的间距
    return `${title}\n\n${text}`;
  }

  // 点击显示或隐藏菜单
  btn.addEventListener('click', function(e) {
    if (isDragging) return;
    e.stopPropagation();
    if (menu.style.display === 'block') {
      menu.style.display = 'none';
    } else {
      const rect = btn.getBoundingClientRect();
      menu.style.left = rect.left + 'px';
      menu.style.top = (rect.bottom + 4) + 'px';
      menu.style.display = 'block';
    }
  });

  // 点击菜单外隐藏
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

  // 阅读模式按钮与遮罩
  const overlay = document.createElement('div');
  overlay.id = 'reader-mode-overlay';
  const closeBtn = document.createElement('button');
  closeBtn.id = 'reader-close-btn';
  closeBtn.textContent = '关闭';
  const overlayContent = document.createElement('div');
  overlayContent.id = 'reader-mode-content';
  overlay.appendChild(closeBtn);
  overlay.appendChild(overlayContent);
  overlay.style.display = 'none';
  document.body.appendChild(overlay);

  closeBtn.addEventListener('click', () => overlay.style.display = 'none');

  readerBtn.addEventListener('click', function(e) {
    if (isDragging) return;
    e.stopPropagation();
    if (overlay.style.display === 'block') {
      overlay.style.display = 'none';
      return;
    }
    try {
      const article = new Readability(document.cloneNode(true)).parse();
      if (article) {
        overlayContent.innerHTML = `<h1>${article.title}</h1>` + cleanHtml(article.content);
      } else {
        overlayContent.innerHTML = `<h1>${document.title}</h1>` + cleanHtml(document.body.innerHTML);
      }
    } catch (e) {
      overlayContent.innerHTML = `<h1>${document.title}</h1>` + cleanHtml(document.body.innerHTML);
    }
    overlay.style.display = 'block';
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
      if (window.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem(item)]);
      } else {
        const textData = format === "markdown" ? markdown : (format === "html" ? fullHtml : textContent);
        await navigator.clipboard.writeText(textData);
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
        await navigator.clipboard.writeText(textData);
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
