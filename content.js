console.log('copy-article content.js injected');

(function() {
  if (document.getElementById('copy-article-btn')) return;

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

  const btn = document.createElement('button');
  btn.id = 'copy-article-btn';
  btn.title = '一键复制网页标题和正文';

  // 根据页面背景设置按钮和菜单样式
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

  // 纯文字按钮内容
  btn.innerHTML = '<div style="font-size:15px;line-height:1.1;font-weight:bold;white-space:pre;user-select:none;text-align:center;">复制\n正文</div>';

  // 拖动功能变量
  let isDragging = false, offsetX = 0, offsetY = 0;

  btn.addEventListener('mousedown', function(e) {
    isDragging = true;
    offsetX = e.clientX - btn.getBoundingClientRect().left;
    offsetY = e.clientY - btn.getBoundingClientRect().top;
    btn.style.transition = 'none';
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

  // 初始位置
  btn.style.left = 'auto';
  btn.style.top = '40%';
  btn.style.right = '24px';

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

  document.body.appendChild(btn);
  updateStyles(); // 初始化样式

  // 清理HTML内容并提取图片地址的函数
  function cleanHtml(html) {
    const div = document.createElement('div');
    div.innerHTML = html;

    // 移除不必要的标签和属性
    const elementsToRemove = div.querySelectorAll(
      'script, style, link, meta, iframe, button, input, form, nav, footer, [role="complementary"], [class*="sidebar"], [class*="related"], [class*="comment"]'
    );
    elementsToRemove.forEach(el => el.remove());

    // 规范化图片，优先使用 data-src 等懒加载字段并转换为绝对地址
    const imageSrcSet = new Set();
    const images = div.querySelectorAll('img');
    images.forEach(img => {
      const candidate = img.getAttribute('data-src')
        || img.getAttribute('data-original')
        || img.getAttribute('data-lazy-src')
        || img.getAttribute('data-actualsrc')
        || img.getAttribute('srcset')?.split(',')[0].trim().split(' ')[0]
        || img.getAttribute('src');

      if (!candidate) {
        img.remove();
        return;
      }

      try {
        const absoluteUrl = new URL(candidate, location.href).href;
        img.setAttribute('src', absoluteUrl);
        imageSrcSet.add(absoluteUrl);
      } catch (err) {
        // 如果URL无法解析，则移除该图片
        img.remove();
      }

      img.removeAttribute('srcset');
      img.removeAttribute('loading');
      img.removeAttribute('decoding');
    });

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

    return { html: div.innerHTML, images: Array.from(imageSrcSet) };
  }

  // 格式化纯文本的函数
  function formatPlainText(title, text, images = []) {
    // 移除多余的空行
    text = text.replace(/\n{3,}/g, '\n\n');

    let result = `${title}\n\n${text}`;

    if (images.length) {
      result += `\n\n图片：\n${images.map(src => `- ${src}`).join('\n')}`;
    }

    // 确保标题和正文之间有适当的间距
    return result;
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

  async function copyArticle(format) {
    const title = document.title;
    let htmlContent = '', textContent = '', imageSources = [];

    try {
      const article = new Readability(document.cloneNode(true)).parse();
      if (article) {
        const cleaned = cleanHtml(article.content);
        htmlContent = cleaned.html;
        imageSources = cleaned.images;
        textContent = formatPlainText(title, article.textContent || '', imageSources);
      }
    } catch (e) {
      const cleaned = cleanHtml(document.body.innerHTML);
      htmlContent = cleaned.html;
      imageSources = cleaned.images;
      textContent = formatPlainText(title, document.body.innerText || '', imageSources);
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
