// 这里配置全局 OEM 需求
export const programTag = 'j2agent';
// eg: /v*${globalUrlPrefix}rest/${programTag}/**
export const globalUrlPrefix = '/';
// 网页title
export const webTitleZh = 'J2Agent 平台';
export const webTitleEn = 'J2Agent Platform'
// AI聊天页自我介绍（{name} 为当前智能体名称）
export const aiIntroducePrefixZh = '你好，我是'
export const aiIntroducePrefixEn = 'Hello, I am'
// 顶栏名称
export const topBarTittle = 'J2Agent AI';

// 主色（唯一需手改的值）
export const primaryColor = '#5182e4';

// 由 primaryColor 自动推导，避免 RGB 与 hex 不一致
export const primaryColorRgb = (() => {
	const n = parseInt(primaryColor.slice(1), 16);
	return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
})();

// Logo
export const faviconUrl = 'favicon.svg';
export const topBarShowText = false;
export const topBarLogoUrl = 'logo-b.svg';
export const topBarLogoUrlOnDark = 'logo-w.svg';
export const chatLogoUrl = 'logo-b.svg'; // 留空则使用 emoji
export const chatLogoEmoji = '🤖';