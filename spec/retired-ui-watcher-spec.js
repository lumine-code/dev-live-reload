const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

describe("dev-live-reload retired package watcher", () => {
  let ui, earlierListener, directory;
  const packageName = "dev-live-reload-owned-style-fixture";

  beforeEach(async () => {
    jasmine.useRealClock();
    await lumine.packages.activatePackage("dev-live-reload");
    directory = await fs.mkdtemp(path.join(os.tmpdir(), "dev-live-reload-retired-"));
    await fs.mkdir(path.join(directory, "styles"));
    await fs.writeFile(
      path.join(directory, "styles", "main.css"),
      ".owned-fixture { color: red; }",
    );
    await fs.writeFile(
      path.join(directory, "package.json"),
      JSON.stringify({
        name: packageName,
        version: "1.0.0",
        engines: { lumine: "^1.0.0" },
      }),
    );
    earlierListener = lumine.packages.onDidActivatePackage((pack) => {
      if (pack.name === packageName) ui.destroy();
    });
    spyOn(lumine.themes, "getBaseStylesheetFilePaths").and.returnValue([]);
    spyOn(lumine.themes, "getActiveThemes").and.returnValue([]);
    spyOn(lumine.packages, "getActivePackages").and.returnValue([]);
    const UIWatcher = require("../lib/ui-watcher");
    ui = new UIWatcher();
    jasmine.unspy(lumine.themes, "getBaseStylesheetFilePaths");
    jasmine.unspy(lumine.themes, "getActiveThemes");
    jasmine.unspy(lumine.packages, "getActivePackages");
  });

  afterEach(async () => {
    earlierListener.dispose();
    ui.destroy();
    // Retire any leaked watcher on the original source before cleaning its real files.
    for (const watcher of [...ui.watchers]) watcher.destroy();
    if (lumine.packages.getLoadedPackage(packageName)) {
      await lumine.packages.deactivatePackage(packageName);
      await lumine.packages.unloadPackage(packageName);
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
    const target = path.resolve(directory);
    if (
      path.dirname(target) !== path.resolve(os.tmpdir()) ||
      !path.basename(target).startsWith("dev-live-reload-retired-")
    ) {
      throw new Error("Unsafe live reload fixture cleanup");
    }
    await fs.rm(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  });

  it("does not create native file watchers from a copied activation callback after retirement", async () => {
    const pack = await lumine.packages.activatePackage(directory);
    expect(pack.getStylesheetPaths().length).toBe(1);
    expect(ui.destroyed).toBe(true);
    expect(ui.watchers.length).toBe(0);
    expect(ui.watchedPackages.size).toBe(0);
  });

  it("keeps a current native package watcher and releases its handles on retirement", async () => {
    earlierListener.dispose();
    await lumine.packages.activatePackage(directory);
    const watcher = ui.watchedPackages.get(packageName);
    expect(watcher.entities.length).toBe(2);
    await Promise.all(watcher.entities.map((entity) => entity.watcher.ready));
    expect(watcher.destroyed).toBe(false);
    ui.destroy();
    expect(watcher.destroyed).toBe(true);
    expect(ui.watchers.length).toBe(0);
    expect(ui.watchedPackages.size).toBe(0);
  });
});
