import type { ReadOnlyReference } from "model/ref";
import { ConstantReference } from "model/ref";

export class TriggerConfig {
  private autoCompleteTrigger: ReadOnlyReference<string> = new ConstantReference("(@");

   // Set the autocomplete trigger string.
  setAutoCompleteTrigger(trigger: ReadOnlyReference<string>): void {
    this.autoCompleteTrigger = trigger;
  }

   // Get the current autocomplete trigger string.
  getAutoCompleteTrigger(): string {
    return this.autoCompleteTrigger.value;
  }
}

// Global singleton instance for trigger configuration.
export const TRIGGER_CONFIG = new TriggerConfig();
