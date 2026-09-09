const { CompositeDisposable, Emitter, watchDirectory, watchFile } = require("lumine");
const path = require("path");

module.exports = class Watcher {
  constructor() {
    this.destroy = this.destroy.bind(this);
    this.emitter = new Emitter();
    this.disposables = new CompositeDisposable();
    this.entities = [];
    this.reloadTimer = null;
    this.destroyed = false;
  }

  onDidDestroy(callback) {
    return this.emitter.on("did-destroy", callback);
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    clearTimeout(this.reloadTimer);
    this.disposables.dispose();
    this.entities = null;
    this.emitter.emit("did-destroy");
    this.emitter.dispose();
  }

  watch() {
    // override me
  }

  loadStylesheet(_stylesheetPath) {
    // override me
  }

  loadAllStylesheets() {
    // override me
  }

  scheduleReload(callback) {
    clearTimeout(this.reloadTimer);
    this.reloadTimer = setTimeout(() => {
      this.reloadTimer = null;
      if (!this.destroyed) callback();
    }, 25);
  }

  watchDirectory(directoryPath, callback = () => this.loadAllStylesheets()) {
    if (this.isInAsarArchive(directoryPath)) return;
    const watcher = watchDirectory(directoryPath, { recursive: true });
    const changed = () => {
      if (!this.destroyed) callback();
    };
    this.disposables.add(
      watcher,
      watcher.onDidChange(changed),
      watcher.onDidInvalidate(changed),
      watcher.onDidError((error) => console.error("Unable to watch package directory", error)),
    );
    // PackageWatcher filters `entities` by `isFile()`/`getPath()` to avoid
    // re-watching known stylesheets.
    this.entities.push({
      getPath: () => directoryPath,
      isFile: () => false,
      isDirectory: () => true,
      watcher,
    });
  }

  watchFile(filePath) {
    if (this.isInAsarArchive(filePath)) return;
    const reloadFn = () => this.loadStylesheet(filePath);

    const watcher = watchFile(filePath);
    this.disposables.add(
      watcher,
      watcher.onDidChange(reloadFn),
      watcher.onDidInvalidate(reloadFn),
      watcher.onDidError((error) => console.error("Unable to watch stylesheet", error)),
    );
    this.entities.push({
      getPath: () => filePath,
      isFile: () => true,
      isDirectory: () => false,
      watcher,
    });
  }

  isInAsarArchive(pathToCheck) {
    const resourcePath = lumine.application.getResourcePath();
    return (
      pathToCheck.startsWith(`${resourcePath}${path.sep}`) && path.extname(resourcePath) === ".asar"
    );
  }
};
