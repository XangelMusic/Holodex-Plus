import { Options, loadSVGElement } from "@utils";
import { runtime } from "webextension-polyfill";
import logoRaw from "@assets/img/logo.svg?raw";
import outlineRaw from "@assets/img/outline.svg?raw";

// Holodex button injected into YouTube pages
(async () => {
  if (!(await Options.get("holodexButtonInYoutube"))) return;
  console.log("[Holodex+] yt-watch script loaded");

  const logo = loadSVGElement(logoRaw);
  const outline = loadSVGElement(outlineRaw);

  [logo, outline].forEach((element) => {
    element.style.transform = "translateX(1.2px)";
  });

  let pageUrl = "";
  let pageType = "";
  let rafId: number | undefined;
  let tooltipTimer: ReturnType<typeof setTimeout> | undefined;
  let isInjecting = false;

  const selectors = {
    shorts: "ytd-reel-video-renderer reel-action-bar-view-model",
    watch: "#actions #top-level-buttons-computed",
    buttonID: "#holodex-button",
    tooltip: "yt-tooltip",
    tooltipID: "#holodex-tooltip",
    actionBar: () => (pageType === "shorts" ? selectors.shorts : selectors.watch),
    holodexButton: () => `${selectors.actionBar()} ${selectors.buttonID}`,
  };

  const render = {
    tooltip: async (target: Element | null) => {
      if (!target) return;
      if (document.querySelectorAll(selectors.tooltipID).length === 1) return;

      console.debug("[Holodex+] (re)rendering Holodex tooltip within", target);
      const cloneTooltip = target.firstChild?.cloneNode(true) as HTMLElement | undefined;
      if (!cloneTooltip) return;

      cloneTooltip.id = "holodex-tooltip";
      target.appendChild(cloneTooltip);

      console.debug("[Holodex+] Holodex tooltip rendered:", target.querySelector(selectors.tooltipID));
    },

    button: async (target: Element | null) => {
      if (!target) return;
      target.querySelectorAll(selectors.buttonID).forEach((node) => node.remove());

      console.debug("[Holodex+] (re)rendering Holodex button within", target);
      const container = await createButton(target);
      if (!container) return;

      if (pageType === "shorts") {
        target.insertBefore(container, target.firstChild);
      } else {
        target.querySelector("yt-button-view-model")?.after(container);
      }

      console.debug("[Holodex+] Holodex button rendered:", target.querySelector(selectors.buttonID));
    },
  };

  function syncPageContext() {
    pageUrl = window.location.href;
    if (window.location.pathname.startsWith("/shorts/")) {
      pageType = "shorts";
    } else if (window.location.pathname.startsWith("/watch")) {
      pageType = "watch";
    } else {
      pageType = "";
    }
  }

  async function checkAndInject() {
    if (isInjecting) return;
    syncPageContext();
    if (pageType !== "shorts" && pageType !== "watch") return;

    const ytdApp = document.querySelector("ytd-app");
    if (!ytdApp) return;

    isInjecting = true;
    try {
      await render.tooltip(ytdApp.querySelector(selectors.tooltip));

      if (ytdApp.querySelector(selectors.holodexButton())) return;

      const candidates = Array.from(ytdApp.querySelectorAll(selectors.actionBar()));
      const target = candidates.find((el) => el.querySelector("button-view-model"));
      if (!target) return;

      await render.button(target);
    } finally {
      isInjecting = false;
    }
  }

  // Always attach listeners unconditionally at the top level
  document.addEventListener("yt-navigate-finish", checkAndInject);
  await checkAndInject();

  const observer = new MutationObserver(() => {
    if (rafId !== undefined) return;
    rafId = requestAnimationFrame(async () => {
      rafId = undefined;
      await checkAndInject();
    });
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });

  function ytButton_Click() {
    syncPageContext();
    const response = runtime.sendMessage({
      pageUrl,
      greeting: "ytButton_Click",
    });
    console.debug("[Holodex+] yt button clicked:", response);
  }

  function ytButton_MouseEnter(evt: Event) {
    clearTimeout(tooltipTimer);

    const container = evt.currentTarget as HTMLElement | null;
    const ytLogo = container?.querySelector("svg");
    if (!ytLogo) return;
    ytLogo.outerHTML = logo.outerHTML;

    const ytPopover = document.getElementById("holodex-tooltip");
    if (!ytPopover) return;

    const ytButton = container?.querySelector("button");
    if (!ytButton) return;

    const rect = ytButton.getBoundingClientRect();
    const leftSide = rect.x + (rect.width - 60) / 2 + window.scrollX;
    const topSide = rect.y + rect.height + 16 + window.scrollY;

    ytPopover.classList.add("ytTooltipContainerDefaultTooltipContent", ":popover-open");
    ytPopover.style.inset = `${topSide}px auto auto ${leftSide}px`;
    ytPopover.style.boxSizing = "content-box";
    ytPopover.style.display = "block";
    ytPopover.textContent = "Holodex";

    tooltipTimer = setTimeout(() => {
      ytPopover.classList.remove(":popover-open");
    }, 100);
  }

  function ytButton_MouseLeave(evt: Event) {
    clearTimeout(tooltipTimer);

    const container = evt.currentTarget as HTMLElement | null;
    const ytLogo = container?.querySelector("svg");
    if (!ytLogo) return;
    ytLogo.outerHTML = outline.outerHTML;

    const ytPopover = document.getElementById("holodex-tooltip");
    if (!ytPopover) return;

    ytPopover.classList.add("ytPopoverComponentHostClosing", ":popover-open");
    tooltipTimer = setTimeout(() => {
      ytPopover.style.removeProperty("inset");
      ytPopover.style.removeProperty("box-sizing");
      ytPopover.style.removeProperty("display");
      ytPopover.textContent = "";
      ytPopover.classList.remove(
        "ytTooltipContainerDefaultTooltipContent",
        "ytPopoverComponentHostClosing",
        ":popover-open"
      );
    }, 50);
  }

  async function createButton(target: Element) {
    const reference = Array.from(target.querySelectorAll<HTMLElement>("button-view-model")).at(-1);
    if (!reference) return;

    const parent = reference.parentElement;
    const hasParentMargin = parent ? parseFloat(window.getComputedStyle(parent).marginLeft) > 0 : false;

    const nodeToClone = hasParentMargin && parent ? parent : reference;
    const container = nodeToClone.cloneNode(true) as HTMLElement;

    container.id = "holodex-button";
    container.removeAttribute("hidden");
    container.addEventListener("click", ytButton_Click);
    container.addEventListener("focus", ytButton_MouseEnter);
    container.addEventListener("blur", ytButton_MouseLeave);
    container.addEventListener("mouseenter", ytButton_MouseEnter);
    container.addEventListener("mouseleave", ytButton_MouseLeave);

    const ytButton = container.querySelector("button");
    if (!ytButton) return;
    ytButton.classList.add("yt-watch-holodex-btn");
    ytButton.setAttribute("aria-label", "Open in Holodex");

    const label = ytButton.nextSibling;
    if (label) label.textContent = "Holodex";

    const holodexIcon = ytButton.querySelector("svg");
    if (!holodexIcon) return;
    holodexIcon.outerHTML = outline.outerHTML;

    return container;
  }
})();
