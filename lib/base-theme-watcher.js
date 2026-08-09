const Watcher = require("./watcher");

module.exports = class BaseThemeWatcher extends Watcher {
  constructor() {
    super();
    this.watch();
  }

  watch() {
    // The base stylesheet is concatenated from a manifest of plain CSS files;
    // watch each of them.
    for (const filePath of lumine.themes.getBaseStylesheetFilePaths()) {
      this.watchFile(filePath);
    }
  }

  loadStylesheet() {
    this.scheduleReload(() => this.loadAllStylesheets());
  }

  loadAllStylesheets() {
    lumine.themes.reloadBaseStylesheets();
  }
};
