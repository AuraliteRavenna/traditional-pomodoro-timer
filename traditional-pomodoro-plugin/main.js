const { ItemView, Notice, Plugin, PluginSettingTab, Setting, WorkspaceLeaf } = require("obsidian");

const VIEW_TYPE = "traditional-pomodoro-timer-view";
const WORK_SECONDS = 25 * 60;
const BREAK_SECONDS = 5 * 60;

class PomodoroView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.timerId = null;
  }

  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return "Pomodoro timer"; }
  getIcon() { return "timer"; }

  async onOpen() {
    this.render();
    this.timerId = window.setInterval(() => this.render(), 250);
  }

  async onClose() {
    if (this.timerId) window.clearInterval(this.timerId);
  }

  render() {
    const container = this.contentEl;
    container.empty();
    container.addClass("pomodoro-view");
    const state = this.plugin.getTimerState();
    const remaining = this.plugin.getRemainingSeconds();
    const phaseName = state.phase === "work" ? "Focus time" : "Break time";
    const phaseDetail = state.phase === "work" ? "25 minute Pomodoro" : "5 minute recovery";

    container.createEl("h2", { text: "Pomodoro" });
    container.createDiv({ cls: "pomodoro-phase", text: phaseName });
    container.createDiv({ cls: "pomodoro-time", text: formatTime(remaining) });
    container.createDiv({ cls: "pomodoro-detail", text: phaseDetail });

    const controls = container.createDiv({ cls: "pomodoro-controls" });
    const running = state.running;
    const mainButton = controls.createEl("button", {
      cls: "mod-cta",
      text: running ? "Pause" : (state.started ? "Resume" : "Start")
    });
    mainButton.onclick = () => this.plugin.toggleTimer();

    const resetButton = controls.createEl("button", { text: "Reset phase" });
    resetButton.onclick = () => this.plugin.resetPhase();

    const skipButton = controls.createEl("button", { text: "Skip" });
    skipButton.onclick = () => this.plugin.completePhase(true);

    const count = container.createDiv({ cls: "pomodoro-count" });
    count.createSpan({ text: "Completed this session" });
    count.createEl("strong", { text: String(this.plugin.settings.completedPomodoros) });

    const resetSession = container.createEl("button", { cls: "pomodoro-reset-session", text: "Reset session count" });
    resetSession.onclick = () => this.plugin.resetSession();
  }
}

class PomodoroSettingsTab extends PluginSettingTab {
  constructor(app, plugin) { super(app, plugin); this.plugin = plugin; }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Traditional Pomodoro Timer" });
    containerEl.createEl("p", { text: "This timer always uses the traditional 25-minute work and 5-minute break intervals." });
    new Setting(containerEl)
      .setName("Desktop notification at phase end")
      .setDesc("Show a notification when a work or break period completes.")
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.notifications)
        .onChange(async value => { this.plugin.settings.notifications = value; await this.plugin.saveSettings(); }));
  }
}

module.exports = class TraditionalPomodoroTimerPlugin extends Plugin {
  async onload() {
    await this.loadSettings();
    this.registerView(VIEW_TYPE, leaf => new PomodoroView(leaf, this));
    this.addRibbonIcon("timer", "Open Pomodoro timer", () => this.activateView());
    this.addCommand({ id: "open-pomodoro-timer", name: "Open timer", callback: () => this.activateView() });
    this.addCommand({ id: "toggle-pomodoro-timer", name: "Start or pause timer", callback: () => this.toggleTimer() });
    this.addCommand({ id: "reset-pomodoro-phase", name: "Reset current phase", callback: () => this.resetPhase() });
    this.addSettingTab(new PomodoroSettingsTab(this.app, this));
    this.registerInterval(window.setInterval(() => this.tick(), 1000));
  }

  onunload() { this.app.workspace.detachLeavesOfType(VIEW_TYPE); }

  async loadSettings() {
    const saved = await this.loadData();
    this.settings = Object.assign({
      completedPomodoros: 0,
      notifications: false,
      timer: { phase: "work", remainingSeconds: WORK_SECONDS, running: false, started: false, endTime: null }
    }, saved || {});
    this.settings.timer = Object.assign(
      { phase: "work", remainingSeconds: WORK_SECONDS, running: false, started: false, endTime: null },
      this.settings.timer || {}
    );
    // A timer should never silently run after Obsidian restarts.
    this.settings.timer.running = false;
    this.settings.timer.endTime = null;
    await this.saveSettings();
  }

  async saveSettings() { await this.saveData(this.settings); }
  getTimerState() { return this.settings.timer; }
  getRemainingSeconds() {
    const timer = this.settings.timer;
    if (!timer.running || !timer.endTime) return Math.max(0, timer.remainingSeconds);
    return Math.max(0, Math.ceil((timer.endTime - Date.now()) / 1000));
  }

  async toggleTimer() {
    const timer = this.settings.timer;
    if (timer.running) {
      timer.remainingSeconds = this.getRemainingSeconds();
      timer.running = false;
      timer.endTime = null;
      new Notice("Pomodoro timer paused.");
    } else {
      timer.running = true;
      timer.started = true;
      timer.endTime = Date.now() + timer.remainingSeconds * 1000;
      new Notice(timer.phase === "work" ? "Focus session started." : "Break started.");
    }
    await this.saveSettings();
    this.refreshViews();
  }

  async resetPhase() {
    const timer = this.settings.timer;
    timer.remainingSeconds = timer.phase === "work" ? WORK_SECONDS : BREAK_SECONDS;
    timer.running = false;
    timer.started = false;
    timer.endTime = null;
    await this.saveSettings();
    this.refreshViews();
  }

  async resetSession() {
    this.settings.completedPomodoros = 0;
    await this.saveSettings();
    this.refreshViews();
    new Notice("Pomodoro session count reset.");
  }

  async tick() {
    if (!this.settings.timer.running) return;
    if (this.getRemainingSeconds() === 0) await this.completePhase(false);
    else this.refreshViews();
  }

  async completePhase(skipped) {
    const timer = this.settings.timer;
    const wasWork = timer.phase === "work";
    if (wasWork && !skipped) this.settings.completedPomodoros += 1;
    timer.phase = wasWork ? "break" : "work";
    timer.remainingSeconds = wasWork ? BREAK_SECONDS : WORK_SECONDS;
    timer.running = false;
    timer.started = false;
    timer.endTime = null;
    await this.saveSettings();
    this.refreshViews();
    const message = skipped
      ? (wasWork ? "Focus session skipped. Break is ready." : "Break skipped. Focus is ready.")
      : (wasWork ? "Pomodoro complete! Take a 5-minute break." : "Break complete. Ready for another Pomodoro?");
    new Notice(message, 6000);
    if (!skipped && this.settings.notifications && "Notification" in window) {
      if (Notification.permission === "granted") new Notification("Pomodoro", { body: message });
      else if (Notification.permission === "default") Notification.requestPermission();
    }
  }

  refreshViews() {
    this.app.workspace.getLeavesOfType(VIEW_TYPE).forEach(leaf => leaf.view.render());
  }

  async activateView() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) leaf = workspace.getRightLeaf(false) || workspace.getLeaf(true);
    await leaf.setViewState({ type: VIEW_TYPE, active: true });
    workspace.revealLeaf(leaf);
  }
};

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}
