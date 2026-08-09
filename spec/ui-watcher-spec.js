const path = require("path");
const nodeFs = require("fs");
const fs = require("@lumine-code/fs-plus");

const UIWatcher = require("../lib/ui-watcher");

const { conditionPromise, timeoutPromise: wait } = require("./async-spec-helpers");

// The active theme pair is derived from the mode and the light/dark pairs;
// set both so the active pair is the given list regardless of mode.
function setActiveThemes(names) {
  lumine.config.set("theme.light", names);
  lumine.config.set("theme.dark", names);
}

describe("UIWatcher", () => {
  let uiWatcher = null;

  beforeEach(() => lumine.packages.packageDirPaths.push(path.join(__dirname, "fixtures")));

  afterEach(() => uiWatcher && uiWatcher.destroy());

  describe("when a base stylesheet file changes", () => {
    beforeEach(() => {
      uiWatcher = new UIWatcher();
    });

    it("reloads all the base styles", async () => {
      jasmine.useRealClock();
      spyOn(lumine.themes, "reloadBaseStylesheets");

      const baseStylesheetPaths = lumine.themes.getBaseStylesheetFilePaths();
      expect(uiWatcher.baseTheme.entities.map((entity) => entity.getPath())).toEqual(
        baseStylesheetPaths,
      );
      expect(baseStylesheetPaths.every((filePath) => path.extname(filePath) === ".css")).toBe(true);

      uiWatcher.baseTheme.entities[0].emitter.emit("did-change");
      await conditionPromise(() => {
        return lumine.themes.reloadBaseStylesheets.callCount > 0;
      });
    });
  });

  it("watches all the style sheets in the theme's styles folder", async () => {
    const packagePath = path.join(__dirname, "fixtures", "package-with-styles-folder");

    await lumine.packages.activatePackage(packagePath);
    uiWatcher = new UIWatcher();

    const lastWatcher = uiWatcher.watchers[uiWatcher.watchers.length - 1];

    expect(lastWatcher.entities.length).toBe(4);
    expect(lastWatcher.entities[0].getPath()).toBe(path.join(packagePath, "styles"));
    expect(lastWatcher.entities[1].getPath()).toBe(path.join(packagePath, "styles", "3.css"));
    expect(lastWatcher.entities[2].getPath()).toBe(
      path.join(packagePath, "styles", "sub", "1.css"),
    );
    expect(lastWatcher.entities[3].getPath()).toBe(
      path.join(packagePath, "styles", "sub", "2.css"),
    );
  });

  it("ignores a temporary file left in the styles folder by a stylesheet save", async () => {
    const packagePath = path.join(__dirname, "fixtures", "package-with-styles-folder");
    const stylesPath = path.join(packagePath, "styles");
    const temporaryPath = path.join(stylesPath, "3.css.tmp.4242.deadbeef");

    await lumine.packages.activatePackage(packagePath);
    uiWatcher = new UIWatcher();

    const watcher = uiWatcher.watchedPackages.get("package-with-styles-folder");

    // Saving a stylesheet writes a temporary file next to it and renames it
    // away, so the scan can list an entry that no longer exists by the time it
    // is looked at. Nothing may be stat'ed for the entry to be discarded.
    const readdirSync = nodeFs.readdirSync;
    spyOn(nodeFs, "readdirSync").and.callFake((directoryPath, options) => {
      const entries = readdirSync(directoryPath, options);
      if (directoryPath === stylesPath && options?.withFileTypes) {
        entries.push({
          name: path.basename(temporaryPath),
          parentPath: stylesPath,
          isDirectory: () => false,
        });
      }
      return entries;
    });

    expect(() => watcher.syncStylesheetWatchers()).not.toThrow();
    expect(watcher.entities.map((entity) => entity.getPath())).not.toContain(temporaryPath);
  });

  it("starts watching a stylesheet added after activation", async () => {
    jasmine.useRealClock();
    const packagePath = path.join(__dirname, "fixtures", "package-with-styles-folder");
    const addedStylesheetPath = path.join(packagePath, "styles", "added.css");
    fs.removeSync(addedStylesheetPath);

    try {
      await lumine.packages.activatePackage(packagePath);
      uiWatcher = new UIWatcher();

      const pack = lumine.packages.getActivePackage("package-with-styles-folder");
      const watcher = uiWatcher.watchedPackages.get("package-with-styles-folder");
      spyOn(pack, "reloadStylesheets");

      fs.writeFileSync(addedStylesheetPath, ".added {}\n");
      watcher.entities[0].emitter.emit("did-change");

      await conditionPromise(() =>
        watcher.entities.some((entity) => entity.getPath() === addedStylesheetPath),
      );
      await conditionPromise(() => pack.reloadStylesheets.callCount > 0);

      pack.reloadStylesheets.calls.reset();
      const addedStylesheet = watcher.entities.find(
        (entity) => entity.getPath() === addedStylesheetPath,
      );
      addedStylesheet.emitter.emit("did-change");
      await conditionPromise(() => pack.reloadStylesheets.callCount > 0);
    } finally {
      fs.removeSync(addedStylesheetPath);
    }
  });

  describe("when a package stylesheet file changes", async () => {
    beforeEach(async () => {
      await lumine.packages.activatePackage(
        path.join(__dirname, "fixtures", "package-with-styles-manifest"),
      );
      uiWatcher = new UIWatcher();
    });

    it("reloads all package styles", async () => {
      jasmine.useRealClock();
      const pack = lumine.packages.getActivePackages()[0];
      spyOn(pack, "reloadStylesheets");

      uiWatcher.watchers[uiWatcher.watchers.length - 1].entities[1].emitter.emit("did-change");
      await conditionPromise(() => pack.reloadStylesheets.callCount > 0);

      expect(pack.reloadStylesheets).toHaveBeenCalled();
    });

    it("coalesces rapid filesystem events into one reload", async () => {
      jasmine.useRealClock();
      const pack = lumine.packages.getActivePackages()[0];
      spyOn(pack, "reloadStylesheets");

      const entity = uiWatcher.watchers[uiWatcher.watchers.length - 1].entities[1];
      entity.emitter.emit("did-change");
      entity.emitter.emit("did-change");
      entity.emitter.emit("did-rename");

      await conditionPromise(() => pack.reloadStylesheets.callCount > 0);
      await wait(50);
      expect(pack.reloadStylesheets.callCount).toBe(1);
    });
  });

  describe("when a package does not have a stylesheet", () => {
    beforeEach(async () => {
      await lumine.packages.activatePackage("package-with-index");
      uiWatcher = new UIWatcher();
    });

    it("does not create a PackageWatcher", () => {
      expect(uiWatcher.watchedPackages["package-with-index"]).toBeUndefined();
    });
  });

  describe("when a theme variables file changes", () => {
    beforeEach(async () => {
      jasmine.useRealClock();
      setActiveThemes(["theme-with-ui-variables", "theme-with-multiple-imported-files"]);

      await lumine.themes.activateThemes();
      uiWatcher = new UIWatcher();
    });

    afterEach(() => lumine.themes.deactivateThemes());

    // A theme's variables.css defines custom properties, which cascade at
    // runtime: re-attaching the theme that owns them restyles every consumer,
    // so nothing else has to be reloaded and nothing has to be recompiled.
    it("reloads only the theme that owns the file", async () => {
      const themes = lumine.themes.getActiveThemes();
      const changedTheme = themes.find((t) => t.name === "theme-with-multiple-imported-files");
      const otherTheme = themes.find((t) => t.name === "theme-with-ui-variables");
      spyOn(changedTheme, "reloadStylesheets");
      spyOn(otherTheme, "reloadStylesheets");
      spyOn(lumine.themes, "reloadBaseStylesheets");

      const varEntity = uiWatcher.watchedThemes
        .get("theme-with-multiple-imported-files")
        .entities.find((entity) => path.basename(entity.getPath()) === "variables.css");
      varEntity.emitter.emit("did-change");

      await conditionPromise(() => changedTheme.reloadStylesheets.callCount > 0);
      await wait(50);
      expect(changedTheme.reloadStylesheets.callCount).toBe(1);
      expect(otherTheme.reloadStylesheets).not.toHaveBeenCalled();
      expect(lumine.themes.reloadBaseStylesheets).not.toHaveBeenCalled();
    });
  });

  describe("when a non-theme package has a variables stylesheet", () => {
    beforeEach(async () => {
      jasmine.useRealClock();
      await lumine.packages.activatePackage(
        path.join(__dirname, "fixtures", "package-with-variables"),
      );
      uiWatcher = new UIWatcher();
    });

    it("reloads that package like any other stylesheet", async () => {
      const pack = lumine.packages.getActivePackage("package-with-variables");
      spyOn(pack, "reloadStylesheets");
      spyOn(lumine.themes, "reloadBaseStylesheets");

      const watcher = uiWatcher.watchedPackages.get("package-with-variables");
      const varEntity = watcher.entities.find(
        (entity) => path.basename(entity.getPath()) === "variables.css",
      );
      varEntity.emitter.emit("did-change");

      await conditionPromise(() => pack.reloadStylesheets.callCount > 0);
      expect(lumine.themes.reloadBaseStylesheets).not.toHaveBeenCalled();
    });
  });

  describe("watcher lifecycle", () => {
    it("starts watching a package if it is activated after initial startup", async () => {
      uiWatcher = new UIWatcher();
      expect(uiWatcher.watchedPackages.size).toBe(0);

      await lumine.packages.activatePackage(
        path.join(__dirname, "fixtures", "package-with-styles-folder"),
      );
      expect(uiWatcher.watchedPackages.get("package-with-styles-folder")).not.toBeUndefined();
    });

    it("unwatches a package after it is deactivated", async () => {
      await lumine.packages.activatePackage(
        path.join(__dirname, "fixtures", "package-with-styles-folder"),
      );
      uiWatcher = new UIWatcher();
      const watcher = uiWatcher.watchedPackages.get("package-with-styles-folder");
      expect(watcher).not.toBeUndefined();

      const watcherDestructionSpy = jasmine.createSpy("watcher-on-did-destroy");
      watcher.onDidDestroy(watcherDestructionSpy);

      await lumine.packages.deactivatePackage("package-with-styles-folder");
      expect(uiWatcher.watchedPackages.get("package-with-styles-folder")).toBeUndefined();
      expect(uiWatcher.watchedPackages.size).toBe(0);
      expect(watcherDestructionSpy).toHaveBeenCalled();
    });

    it("does not watch activated packages after the UI watcher has been destroyed", async () => {
      uiWatcher = new UIWatcher();
      uiWatcher.destroy();

      await lumine.packages.activatePackage(
        path.join(__dirname, "fixtures", "package-with-styles-folder"),
      );
      expect(uiWatcher.watchedPackages.size).toBe(0);
    });
  });

  describe("minimal theme packages", () => {
    let cssTheme = null;
    beforeEach(async () => {
      jasmine.useRealClock();
      setActiveThemes(["theme-with-index-css", "theme-with-ui-variables"]);
      await lumine.themes.activateThemes();
      uiWatcher = new UIWatcher();
      cssTheme = lumine.themes
        .getActiveThemes()
        .find((theme) => theme.name === "theme-with-index-css");
      await wait(50);
    });

    afterEach(async () => {
      lumine.themes.deactivateThemes();
      await wait(50);
    });

    it("watches a theme whose only stylesheet sits at its root", async () => {
      spyOn(cssTheme, "reloadStylesheets");
      spyOn(lumine.themes, "reloadBaseStylesheets");

      const cssWatcher = uiWatcher.watchedThemes.get("theme-with-index-css");

      expect(cssWatcher.entities.map((entity) => path.basename(entity.getPath()))).toEqual([
        "index.css",
      ]);

      cssWatcher.entities[0].emitter.emit("did-change");
      await conditionPromise(() => cssTheme.reloadStylesheets.callCount > 0);
      expect(lumine.themes.reloadBaseStylesheets).not.toHaveBeenCalled();
    });
  });

  describe("theme packages", () => {
    let pack = null;
    beforeEach(async () => {
      jasmine.useRealClock();
      setActiveThemes(["theme-with-syntax-variables", "theme-with-multiple-imported-files"]);

      await lumine.themes.activateThemes();
      uiWatcher = new UIWatcher();
      pack = lumine.themes.getActiveThemes()[0];
    });

    afterEach(() => lumine.themes.deactivateThemes());

    it("reloads the theme when anything within the theme changes", async () => {
      const themes = lumine.themes.getActiveThemes();
      const changedTheme = themes.find((t) => t.name === "theme-with-multiple-imported-files");
      const otherTheme = themes.find((t) => t.name === "theme-with-syntax-variables");
      spyOn(changedTheme, "reloadStylesheets");
      spyOn(otherTheme, "reloadStylesheets");
      spyOn(lumine.themes, "reloadBaseStylesheets");

      const watcher = uiWatcher.watchedThemes.get("theme-with-multiple-imported-files");

      // The styles directory, index.css, and the four stylesheets under it.
      expect(watcher.entities.length).toBe(6);

      watcher.entities[2].emitter.emit("did-change");
      await conditionPromise(() => changedTheme.reloadStylesheets.callCount > 0);
      expect(otherTheme.reloadStylesheets).not.toHaveBeenCalled();
      expect(lumine.themes.reloadBaseStylesheets).not.toHaveBeenCalled();
    });

    it("unwatches when a theme is deactivated", async () => {
      jasmine.useRealClock();

      setActiveThemes([]);
      await conditionPromise(() => !uiWatcher.watchedThemes["theme-with-multiple-imported-files"]);
    });

    it("watches a new theme when it is deactivated", async () => {
      jasmine.useRealClock();

      setActiveThemes(["theme-with-syntax-variables", "theme-with-package-file"]);
      await conditionPromise(() => uiWatcher.watchedThemes.get("theme-with-package-file"));

      pack = lumine.themes.getActiveThemes()[0];
      spyOn(pack, "reloadStylesheets");

      expect(pack.name).toBe("theme-with-package-file");

      const watcher = uiWatcher.watchedThemes.get("theme-with-package-file");
      watcher.entities[2].emitter.emit("did-change");
      await conditionPromise(() => pack.reloadStylesheets.callCount > 0);
    });
  });
});
