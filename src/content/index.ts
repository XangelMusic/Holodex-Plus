// import loadScript from "../utils/load-script";

function loadScript(scriptNameInContent: string) {
  var s = document.createElement("script");
  s.src = chrome.runtime.getURL(`content/${scriptNameInContent}`);

  // Remove script after insert
  s.onload = function () {
    s.remove();
  };
  (document.head || document.documentElement).appendChild(s);
}

loadScript("yt-embed-inject.js");
