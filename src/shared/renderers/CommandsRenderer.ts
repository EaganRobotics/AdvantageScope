import TabRenderer from "./TabRenderer";

export default class CommandsRenderer implements TabRenderer {
  private ICON_TEMPLATES: HTMLElement;
  private COMMANDS_CONNECT_MESSAGE: HTMLElement;
  private COMMANDS_CONTAINER: HTMLElement;
  private COMMANDS_LIST: HTMLElement;
  private json?: string;
  private openStates: Map<string, boolean> = new Map();
  // New map to track active states with debounced updates
  private activeStates: Map<string, { active: boolean; timer?: number }> = new Map();

  constructor(root: HTMLElement) {
    this.ICON_TEMPLATES = document.getElementById("fieldItemIconTemplates") as HTMLElement;
    this.COMMANDS_CONNECT_MESSAGE = root.getElementsByClassName("commands-connect-message")[0] as HTMLElement;
    this.COMMANDS_CONTAINER = root.getElementsByClassName("commands-container")[0] as HTMLElement;
    this.COMMANDS_LIST = root.getElementsByClassName("commands-list")[0] as HTMLElement;
    this.COMMANDS_LIST.classList.add("command-list");
  }

  saveState(): unknown {
    return {
      openStates: Array.from(this.openStates.entries()),
      activeStates: Array.from(this.activeStates.entries()).map(([key, value]) => [key, value.active]) // Just save the active status, not the timer
    };
  }

  restoreState(state: unknown): void {
    if (typeof state === "object" && state !== null) {
      const typedState = state as {
        openStates?: [string, boolean][];
        activeStates?: [string, boolean][];
      };

      if (Array.isArray(typedState.openStates)) {
        this.openStates = new Map(typedState.openStates);
      }

      if (Array.isArray(typedState.activeStates)) {
        this.activeStates = new Map(typedState.activeStates.map(([key, active]) => [key, { active }]));
      }
    }
  }

  getAspectRatio(): number | null {
    return null;
  }

  render(command: CommandsRendererCommand): void {
    if (!command.keyAvailable || this.json === command.json) {
      return;
    }

    this.json = command.json;

    if (!this.json) {
      this.COMMANDS_CONNECT_MESSAGE.hidden = false;
      this._clearChildren();
      return;
    }

    var commands: Commands;
    try {
      commands = JSON.parse(this.json) satisfies Commands;
    } catch (error) {
      return;
    }

    this.COMMANDS_CONNECT_MESSAGE.hidden = true;
    this.COMMANDS_CONTAINER.hidden = false;
    this._clearChildren();

    // Changed order: subsystems first, then scheduled commands

    // Create sections for each subsystem
    if (commands.subsystems && commands.subsystems.length > 0) {
      commands.subsystems.forEach((subsystem, index) => {
        const subsystemPath = `subsystem-${index}`;
        const subsystemSection = this._createSection(subsystem.name, subsystemPath);
        this.COMMANDS_LIST.appendChild(subsystemSection);

        const subsystemList = subsystemSection.querySelector("ol") as HTMLElement;

        // Render the subsystem commands
        if (subsystem.command) {
          this._renderCommandRecursive(subsystem.command, subsystemList, [subsystemPath]);
        }
      });
    }

    // Create section for scheduled commands
    if (commands.scheduled && commands.scheduled.length > 0) {
      const scheduledSection = this._createSection("Scheduled Commands", "scheduled");
      this.COMMANDS_LIST.appendChild(scheduledSection);

      const scheduledList = scheduledSection.querySelector("ol") as HTMLElement;

      commands.scheduled.forEach((command, index) => {
        this._renderCommandRecursive(command, scheduledList, ["scheduled", index.toString()]);
      });
    }
  }

  private _createSection(title: string, id: string): HTMLElement {
    const section = document.createElement("li");
    section.classList.add("command", "section");

    const sectionLabel = document.createElement("span");
    sectionLabel.innerText = title;
    sectionLabel.classList.add("section-title");

    const closedIcon = this.ICON_TEMPLATES.children[0].cloneNode(true) as HTMLElement;
    const openIcon = this.ICON_TEMPLATES.children[1].cloneNode(true) as HTMLElement;
    const isOpen = this.openStates.get(id) ?? true; // Default to open

    closedIcon.style.display = isOpen ? "none" : "initial";
    openIcon.style.display = isOpen ? "initial" : "none";

    section.append(closedIcon, openIcon, sectionLabel);

    const childList = document.createElement("ol");
    section.appendChild(childList);
    childList.hidden = !isOpen;

    closedIcon.addEventListener("click", () => {
      childList.hidden = false;
      closedIcon.style.display = "none";
      openIcon.style.display = "initial";
      this.openStates.set(id, true);
    });

    openIcon.addEventListener("click", () => {
      childList.hidden = true;
      closedIcon.style.display = "initial";
      openIcon.style.display = "none";
      this.openStates.set(id, false);
    });

    return section;
  }

  _renderCommandRecursive(command: Command, parentElement: HTMLElement, path: string[] = []): CommandStateFromChildren {
    // Setup this command element
    const hasChildren = "commands" in command;
    const commandElement = document.createElement("li");
    commandElement.classList.add("command");

    // Create unique ID for this command
    const commandId = path.join("/") + "/" + command.name;

    // Determine initial active state
    const isBaseCommand = !hasChildren;
    let currentActive = isBaseCommand ? (command as BaseCommand).active : false;

    parentElement.appendChild(commandElement);

    // Open/closed/neutral icons
    const closedIcon = this.ICON_TEMPLATES.children[0].cloneNode(true) as HTMLElement;
    const openIcon = this.ICON_TEMPLATES.children[1].cloneNode(true) as HTMLElement;
    const neutralIcon = this.ICON_TEMPLATES.children[2].cloneNode(true) as HTMLElement;

    closedIcon.style.display = hasChildren ? "initial" : "none";
    openIcon.style.display = "none";
    neutralIcon.style.display = hasChildren ? "none" : "initial";

    commandElement.append(closedIcon, openIcon, neutralIcon);

    // Add label
    const label = document.createElement("span");
    label.innerText = command.name;
    commandElement.appendChild(label);

    let childrenActive = false;

    if (hasChildren) {
      // Mark as parent
      commandElement.classList.add("parent");

      // Check if this command was previously expanded
      const isOpen = this.openStates.get(commandId) ?? false;

      // Create child list container
      const childParentElement = document.createElement("ol");
      commandElement.appendChild(childParentElement);
      childParentElement.hidden = !isOpen;

      // Update icons based on stored state
      closedIcon.style.display = isOpen ? "none" : "initial";
      openIcon.style.display = isOpen ? "initial" : "none";

      // Always process children immediately, regardless of expanded state
      const nestedCommand = command as NestedCommand;
      nestedCommand.commands.forEach((childCmd, index) => {
        const childPath = [...path, command.name, index.toString()];
        const childState = this._renderCommandRecursive(childCmd, childParentElement, childPath);

        // Update parent active state based on child state
        if (childState.active) {
          childrenActive = true;
        }
      });

      const setChildrenExpanded = (expanded: boolean) => {
        childParentElement.hidden = !expanded;
        closedIcon.style.display = expanded ? "none" : "initial";
        openIcon.style.display = expanded ? "initial" : "none";

        // Store the state
        this.openStates.set(commandId, expanded);
      };

      // Set initial state
      setChildrenExpanded(isOpen);

      closedIcon.addEventListener("click", () => setChildrenExpanded(true));
      openIcon.addEventListener("click", () => setChildrenExpanded(false));
    }

    // Update current active state based on children
    if (childrenActive) {
      currentActive = true;
    }

    // Improved active state handling with debounce
    this.updateActiveState(commandId, currentActive, commandElement);

    return { active: currentActive };
  }

  // New method for handling active state with improved debounce logic
  private updateActiveState(commandId: string, isActive: boolean, element: HTMLElement): void {
    let state = this.activeStates.get(commandId) || { active: false };

    if (isActive) {
      // If becoming active, do it immediately and clear any pending inactive timers
      if (state.timer) {
        window.clearTimeout(state.timer);
        state.timer = undefined;
      }

      state.active = true;
      element.classList.add("active");
      this.activeStates.set(commandId, state);
    } else if (state.active) {
      // If it's currently active but should become inactive
      // Set/reset the debounce timer
      if (state.timer) {
        window.clearTimeout(state.timer);
      }

      // Only start fade out after 0.1s of inactivity
      state.timer = window.setTimeout(() => {
        const currentState = this.activeStates.get(commandId);
        if (currentState) {
          currentState.active = false;
          currentState.timer = undefined;
          this.activeStates.set(commandId, currentState);

          // Apply the inactive state after the debounce
          element.classList.remove("active");
        }
      }, 100); // 0.1s debounce as requested

      this.activeStates.set(commandId, state);
    }

    // Make sure the element class matches the current active state
    if (state.active) {
      element.classList.add("active");
    } else {
      element.classList.remove("active");
    }
  }

  _clearChildren() {
    while (this.COMMANDS_LIST.firstChild) {
      this.COMMANDS_LIST.removeChild(this.COMMANDS_LIST.firstChild);
    }
  }
}

export type CommandsRendererCommand = {
  keyAvailable: boolean;
  timestamp: number;
  json?: string;
};

interface CommandStateFromChildren {
  active: boolean;
}

interface BaseCommand {
  name: string;
  active: boolean;
}

interface NestedCommand {
  name: string;
  commands: Command[];
}

type Command = BaseCommand | NestedCommand;

interface Subsystem {
  name: string;
  command: Command;
}

interface Commands {
  subsystems: Subsystem[];
  scheduled: Command[];
}
