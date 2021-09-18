(async function () {
  const path = require("path");
  const fs = require("fs").promises;
  const glob = require("glob");

  const { name, description, version } = require("../package.json");

  const urlGlobs = ["https://*.holodex.net/*", "*://*.youtube.com/*"];

  const content_extra = glob
    .sync("**/*.ts", { cwd: "src/content" })
    .filter((file) => file !== "index.ts")
    .map((file) =>
      "content/" + path.basename(file, path.extname(file)) + ".js"
    );

  const web_accessible_resources =
    content_extra.length > 0 ? content_extra : undefined;

  const icons = Object.fromEntries(
    ["16", "32", "48", "64", "128"].map((size) => [size, `img/${size}.png`])
  );

  await fs.writeFile(
    "build/manifest.json",
    JSON.stringify(
      {
        manifest_version: 2,
        name,
        description,
        version,
        icons,
        background: {
          scripts: ["background/index.js"],
        },
        content_scripts: [
          {
            matches: urlGlobs,
            js: ["content/index.js"],
            // Allow acess to inner iframe (like the iframe embed on Holodex)
            all_frames: true,
            run_at: "document_end"
          },
        ],
        permissions: [
          "storage",
          "activeTab",
          "tabs",
          "webRequest",
          "webRequestBlocking",
          ...urlGlobs
        ],
        web_accessible_resources,
        browser_action: {
          default_icon: { ...icons },
          default_popup: "popup.html",
          default_title: name,
        },
        options_ui: {
          browser_style: true,
          page: "options.html",
          open_in_tab: true,
        },
      },
      null,
      true
    )
  );
})();
