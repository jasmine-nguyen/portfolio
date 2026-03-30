import { QuartzConfig } from "./quartz/cfg"
import * as Plugin from "./quartz/plugins"

const config: QuartzConfig = {
  configuration: {
    pageTitle: "Jas Nguyen",
    pageTitleSuffix: "",
    enableSPA: true,
    enablePopovers: true,
    analytics: {
      provider: "plausible",
    },
    locale: "en-US",
    baseUrl: "jasmine-nguyen.github.io/quartz",
    ignorePatterns: ["private", "templates", ".obsidian"],
    defaultDateType: "modified",
    theme: {
      fontOrigin: "googleFonts",
      cdnCaching: true,
      typography: {
        header: "JetBrains Mono",
        body: "JetBrains Mono",
        code: "JetBrains Mono",
      },
      colors: {
        lightMode: {
          light: "#011628",
          lightgray: "#143652",
          gray: "#627E97",
          darkgray: "#B4D0E9",
          dark: "#CBE0F0",
          secondary: "#0A64AC",
          tertiary: "#275378",
          highlight: "rgba(10, 100, 172, 0.15)",
          textHighlight: "rgba(39, 83, 120, 0.3)",
        },
        darkMode: {
          light: "#011628",
          lightgray: "#143652",
          gray: "#627E97",
          darkgray: "#B4D0E9",
          dark: "#CBE0F0",
          secondary: "#0A64AC",
          tertiary: "#275378",
          highlight: "rgba(10, 100, 172, 0.15)",
          textHighlight: "rgba(39, 83, 120, 0.3)",
        },
      },
    },
  },
  plugins: {
    transformers: [
      Plugin.FrontMatter(),
      Plugin.CreatedModifiedDate({
        priority: ["frontmatter", "git", "filesystem"],
      }),
      Plugin.SyntaxHighlighting({
        theme: {
          light: "github-dark",
          dark: "github-dark",
        },
        keepBackground: false,
      }),
      Plugin.ObsidianFlavoredMarkdown({ enableInHtmlEmbed: false }),
      Plugin.GitHubFlavoredMarkdown(),
      Plugin.TableOfContents(),
      Plugin.CrawlLinks({ markdownLinkResolution: "shortest" }),
      Plugin.Description(),
      Plugin.Latex({ renderEngine: "katex" }),
    ],
    filters: [Plugin.RemoveDrafts()],
    emitters: [
      Plugin.AliasRedirects(),
      Plugin.ComponentResources(),
      Plugin.ContentPage(),
      Plugin.FolderPage(),
      Plugin.TagPage(),
      Plugin.ContentIndex({
        enableSiteMap: true,
        enableRSS: true,
      }),
      Plugin.Assets(),
      Plugin.Static(),
      Plugin.Favicon(),
      Plugin.NotFoundPage(),
      Plugin.CustomOgImages(),
    ],
  },
}

export default config
