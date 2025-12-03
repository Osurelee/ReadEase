let turndownService;

function initTurndown() {
  if (turndownService) return turndownService;

  turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    hr: '---',
  });

  // 将 <br> 转成换行符，尽量保留原有的段落结构
  turndownService.addRule('softBreak', {
    filter: 'br',
    replacement: () => '\n'
  });

  // 直接保留 figure 中的内容而不引入额外的标记
  turndownService.keep(['figure']);

  return turndownService;
}

function htmlToMarkdown(html) {
  const service = initTurndown();
  return service.turndown(html || '');
}

if (typeof module !== 'undefined') {
  module.exports = htmlToMarkdown;
}