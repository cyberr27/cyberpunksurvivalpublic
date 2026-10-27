window.npcDialogSystem = {
  currentOpenNpc: null,

  refreshCurrentDialog: function () {
    if (this.currentOpenNpc === "neon") {
      refreshNeonQuestDialog();
    }
    if (this.currentOpenNpc === "potion") {
      window.potionNpcSystem.refreshDialog();
    }
    // В будущем можно добавить другие NPC
  },
};
