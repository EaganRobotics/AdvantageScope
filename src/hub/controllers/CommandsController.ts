import { COMMANDS_KEYS } from "../../shared/log/LogUtil";
import { CommandsRendererCommand } from "../../shared/renderers/CommandsRenderer";
import { createUUID } from "../../shared/util";
import TabController from "./TabController";

export default class CommandsController implements TabController {
  UUID = createUUID();

  // private ROOT: HTMLElement;
  // private TABLE_CONTAINER: HTMLElement;
  // private DRAG_HIGHLIGHT: HTMLElement;

  private command: CommandsRendererCommand = { keyAvailable: false, timestamp: 0.0 };

  saveState(): unknown {
    return null;
  }

  restoreState(state: unknown): void {}

  refresh(): void {}

  newAssets(): void {}

  getActiveFields(): string[] {
    return COMMANDS_KEYS;
  }

  showTimeline(): boolean {
    return true;
  }

  getCommand(): CommandsRendererCommand {
    const time = window.selection.getRenderTime() ?? window.log.getLastTimestamp();
    this.command.timestamp = time;

    const key = window.log
      .getFieldKeys()
      .find((key) => COMMANDS_KEYS.some((commandsKey) => key.startsWith(commandsKey)));
    this.command.keyAvailable = !!key;
    if (key) {
      this.command.json = window.log.getString(key, time, time)?.values[0];
    }

    return this.command;
  }
}
