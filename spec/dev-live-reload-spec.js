describe("Dev Live Reload", () => {
  describe("package activation", () => {
    let [pack, mainModule] = [];

    beforeEach(() => {
      pack = lumine.packages.loadPackage("dev-live-reload");
      pack.requireMainModule();
      mainModule = pack.mainModule;
      spyOn(mainModule, "startWatching");
    });

    describe("when the window is not in dev mode", () => {
      beforeEach(() => spyOn(lumine.window, "isDevMode").andReturn(false));

      it("does not watch files", async () => {
        spyOn(lumine.packages, "hasActivatedInitialPackages").andReturn(true);

        await lumine.packages.activatePackage("dev-live-reload");
        expect(mainModule.startWatching).not.toHaveBeenCalled();
      });
    });

    describe("when the window is in spec mode", () => {
      beforeEach(() => spyOn(lumine.window, "isSpecMode").andReturn(true));

      it("does not watch files", async () => {
        spyOn(lumine.packages, "hasActivatedInitialPackages").andReturn(true);

        await lumine.packages.activatePackage("dev-live-reload");
        expect(mainModule.startWatching).not.toHaveBeenCalled();
      });
    });

    describe("when the window is in dev mode", () => {
      beforeEach(() => {
        spyOn(lumine.window, "isDevMode").andReturn(true);
        spyOn(lumine.window, "isSpecMode").andReturn(false);
      });

      it("watches files", async () => {
        spyOn(lumine.packages, "hasActivatedInitialPackages").andReturn(true);

        await lumine.packages.activatePackage("dev-live-reload");
        expect(mainModule.startWatching).toHaveBeenCalled();
      });
    });

    describe("when the window is in both dev mode and spec mode", () => {
      beforeEach(() => {
        spyOn(lumine.window, "isDevMode").andReturn(true);
        spyOn(lumine.window, "isSpecMode").andReturn(true);
      });

      it("does not watch files", async () => {
        spyOn(lumine.packages, "hasActivatedInitialPackages").andReturn(true);

        await lumine.packages.activatePackage("dev-live-reload");
        expect(mainModule.startWatching).not.toHaveBeenCalled();
      });
    });

    describe("when the package is activated before initial packages have been activated", () => {
      beforeEach(() => {
        spyOn(lumine.window, "isDevMode").andReturn(true);
        spyOn(lumine.window, "isSpecMode").andReturn(false);
      });

      it("waits until all initial packages have been activated before watching files", async () => {
        await lumine.packages.activatePackage("dev-live-reload");
        expect(mainModule.startWatching).not.toHaveBeenCalled();

        lumine.packages.emitter.emit("did-activate-initial-packages");
        expect(mainModule.startWatching).toHaveBeenCalled();
      });
    });
  });

  describe("package deactivation", () => {
    beforeEach(() => {
      spyOn(lumine.window, "isDevMode").andReturn(true);
      spyOn(lumine.window, "isSpecMode").andReturn(false);
    });

    it("stops watching all files", async () => {
      spyOn(lumine.packages, "hasActivatedInitialPackages").andReturn(true);
      const { mainModule } = await lumine.packages.activatePackage("dev-live-reload");
      expect(mainModule.uiWatcher).not.toBeNull();

      spyOn(mainModule.uiWatcher, "destroy").and.callThrough();

      await lumine.packages.deactivatePackage("dev-live-reload");
      expect(mainModule.uiWatcher.destroy).toHaveBeenCalled();
    });

    it("unsubscribes from the onDidActivateInitialPackages subscription if it is disabled before all initial packages are activated", async () => {
      const { mainModule } = await lumine.packages.activatePackage("dev-live-reload");
      expect(mainModule.activatedDisposable.disposed).toBe(false);

      await lumine.packages.deactivatePackage("dev-live-reload");
      expect(mainModule.activatedDisposable.disposed).toBe(true);

      spyOn(mainModule, "startWatching");
      lumine.packages.emitter.emit("did-activate-initial-packages");
      expect(mainModule.startWatching).not.toHaveBeenCalled();
    });

    it("removes its commands", async () => {
      spyOn(lumine.packages, "hasActivatedInitialPackages").andReturn(true);
      await lumine.packages.activatePackage("dev-live-reload");
      expect(
        lumine.commands
          .findCommands({ target: lumine.views.getView(lumine.workspace) })
          .filter((command) => command.name.startsWith("dev-live-reload")).length,
      ).toBeGreaterThan(0);

      await lumine.packages.deactivatePackage("dev-live-reload");
      expect(
        lumine.commands
          .findCommands({ target: lumine.views.getView(lumine.workspace) })
          .filter((command) => command.name.startsWith("dev-live-reload")).length,
      ).toBe(0);
    });
  });
});
