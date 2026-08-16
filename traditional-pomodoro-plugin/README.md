# Traditional Pomodoro Timer for Obsidian

A traditional Pomodoro timer with fixed intervals:

- 25 minutes of focused work
- 5 minutes of break time
- A persistent count of Pomodoros completed in the current session

## Install in Obsidian

1. Open your vault folder and go to `.obsidian/plugins/`.
2. Create a folder named `traditional-pomodoro-timer`.
3. Copy `manifest.json`, `main.js`, and `styles.css` from this folder into it.
4. In Obsidian, open **Settings → Community plugins**, turn off Restricted mode if necessary, then enable **Traditional Pomodoro Timer**.

Click the timer icon in the left ribbon or run **Pomodoro: Open timer** from the Command Palette.

## Behavior

- Starting a work interval begins a 25:00 countdown.
- Completing it automatically adds one completed Pomodoro and prepares the 5:00 break.
- Completing a break prepares the next 25:00 work interval.
- **Skip** changes the phase without adding a completed Pomodoro.
- The counter is saved by Obsidian and can be reset with **Reset session count**.
- On closing or restarting Obsidian, an active timer is paused so time is never counted invisibly.
