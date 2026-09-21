export const HTML_THEMES = [
  { id: "paper", label: "Paper", hint: "Light" },
  { id: "ink", label: "Ink", hint: "Dark" },
] as const;

export type HtmlTheme = (typeof HTML_THEMES)[number]["id"];

export function isHtmlTheme(value: string | null | undefined): value is HtmlTheme {
  return HTML_THEMES.some((theme) => theme.id === value);
}

export const THEME_KEY = "paydown:html-theme";

export function htmlThemeCss(): string {
  return `:root, html[data-theme="paper"] {
      color-scheme: light;
      --bg: #f3efe6;
      --fg: #1c1914;
      --card: #faf7f0;
      --muted: #ebe6db;
      --muted-fg: #6e6a62;
      --primary: #1f2a24;
      --primary-fg: #f4f1ea;
      --border: #ddd5c6;
      --interest: #9a5a45;
      --principal: #2c332e;
      --ok: #3d5c45;
      --extra: #2f6f5e;
      --shadow: 0 0 0 1px rgba(28,25,20,.06), 0 1px 2px -1px rgba(28,25,20,.06), 0 2px 4px 0 rgba(28,25,20,.04);
      --display: Georgia, "Iowan Old Style", Palatino, "Palatino Linotype", serif;
      --sans: system-ui, -apple-system, "Segoe UI", sans-serif;
    }
    html[data-theme="ink"] {
      color-scheme: dark;
      --bg: #12110f;
      --fg: #f3efe6;
      --card: #1b1a17;
      --muted: #24221e;
      --muted-fg: #9a958c;
      --primary: #f3efe6;
      --primary-fg: #12110f;
      --border: #2e2c28;
      --interest: #d0927d;
      --principal: #cdd6d0;
      --ok: #8fbf9a;
      --extra: #7ec9b0;
      --shadow: 0 0 0 1px rgba(243,239,230,.08), 0 1px 2px -1px rgba(0,0,0,.4);
    }`;
}
