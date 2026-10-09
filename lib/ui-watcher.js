const { CompositeDisposable } = require("lumine");

const BaseThemeWatcher = require("./base-theme-watcher");
const PackageWatcher = require("./package-watcher");

module.exports = class UIWatcher {
  constructor() {
    this.subscriptions = new CompositeDisposable();
    this.reloadAll = this.reloadAll.bind(this);
    this.watchers = [];
    this.destroyed = false;
    this.baseTheme = this.createWatcher(new BaseThemeWatcher());
    this.watchPackages();
  }

  watchPackages() {
    this.watchedThemes = new Map();
    this.watchedPackages = new Map();
    for (const theme of lumine.themes.getActiveThemes()) {
      this.watchTheme(theme);
    }
    for (const pack of lumine.packages.getActivePackages()) {
      this.watchPackage(pack);
    }
    this.watchForPackageChanges();
  }

  watchForPackageChanges() {
    this.subscriptions.add(
      lumine.themes.onDidChangeActiveThemes(() => {
        if (this.destroyed) return;
        // We need to destroy all theme watchers as all theme packages are destroyed
        // when a theme changes.
        for (const theme of this.watchedThemes.values()) {
          theme.destroy();
        }

        this.watchedThemes.clear();

        // Rewatch everything!
        for (const theme of lumine.themes.getActiveThemes()) {
          this.watchTheme(theme);
        }
      }),
    );

    this.subscriptions.add(lumine.packages.onDidActivatePackage((pack) => this.watchPackage(pack)));

    this.subscriptions.add(
      lumine.packages.onDidDeactivatePackage((pack) => {
        if (this.destroyed) return;
        // This only handles packages - onDidChangeActiveThemes handles themes
        const watcher = this.watchedPackages.get(pack.name);
        if (watcher) watcher.destroy();
        this.watchedPackages.delete(pack.name);
      }),
    );
  }

  watchTheme(theme) {
    if (this.destroyed) return;
    if (PackageWatcher.supportsPackage(theme, "theme")) {
      const watcher = this.createWatcher(new PackageWatcher(theme));
      if (!this.destroyed) this.watchedThemes.set(theme.name, watcher);
    }
  }

  watchPackage(pack) {
    if (this.destroyed) return;
    if (PackageWatcher.supportsPackage(pack, "lumine")) {
      const watcher = this.createWatcher(new PackageWatcher(pack));
      if (!this.destroyed) this.watchedPackages.set(pack.name, watcher);
    }
  }

  createWatcher(watcher) {
    if (this.destroyed) {
      watcher.destroy();
      return watcher;
    }
    watcher.onDidDestroy(() => {
      const index = this.watchers.indexOf(watcher);
      if (index >= 0) this.watchers.splice(index, 1);
    });
    this.watchers.push(watcher);
    return watcher;
  }

  reloadAll() {
    if (this.destroyed) return;
    this.baseTheme.loadAllStylesheets();
    for (const watcher of this.watchedPackages.values()) {
      watcher.loadAllStylesheets();
    }

    for (const watcher of this.watchedThemes.values()) {
      watcher.loadAllStylesheets();
    }
    lumine.themes.loadUserStylesheet();
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    const packages = [...this.watchedPackages.values()];
    const themes = [...this.watchedThemes.values()];
    this.watchedPackages.clear();
    this.watchedThemes.clear();
    this.subscriptions.dispose();
    this.baseTheme.destroy();
    for (const pack of packages) {
      pack.destroy();
    }
    for (const theme of themes) {
      theme.destroy();
    }
  }
};
