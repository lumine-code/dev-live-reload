module.exports = {
  activate(_state) {
    if (!lumine.window.isDevMode() || lumine.window.isSpecMode()) return;

    if (lumine.packages.hasActivatedInitialPackages()) {
      this.startWatching();
    } else {
      this.activatedDisposable = lumine.packages.onDidActivateInitialPackages(() =>
        this.startWatching(),
      );
    }
  },

  deactivate() {
    if (this.activatedDisposable) this.activatedDisposable.dispose();
    if (this.commandDisposable) this.commandDisposable.dispose();
    if (this.uiWatcher) this.uiWatcher.destroy();
  },

  startWatching() {
    const UIWatcher = require("./ui-watcher");
    this.uiWatcher = new UIWatcher();
    this.commandDisposable = lumine.commands.add(
      "lumine-workspace",
      "dev-live-reload:reload-all",
      () => this.uiWatcher.reloadAll(),
    );
    if (this.activatedDisposable) this.activatedDisposable.dispose();
  },
};
