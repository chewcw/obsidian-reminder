import { TriggerLine, type MarkdownDocument } from "model/format/markdown";
import { DateTime } from "model/time";
import {
  ReminderFormatConfig,
  ReminderFormatParameterKey,
} from "./reminder-base";
import type { ReminderEdit, ReminderFormat, ReminderInsertion } from "./reminder-base";
import { Reminder } from "model/reminder";
import { DefaultReminderModel } from "./reminder-default";

export class PlainReminderModel extends DefaultReminderModel {
  static override parse(
    line: string,
    linkDatesToDailyNotes?: boolean,
  ): PlainReminderModel | null {
    if (linkDatesToDailyNotes == null) {
      linkDatesToDailyNotes = false;
    }
    const result = PlainReminderModel.regexp.exec(line);
    if (result == null) {
      return null;
    }
    let title1 = result.groups!["title1"]!;
    // This is the case when the reminder is a tree item, we don't need that "- "
    if (title1 == "- ") {
      title1 = "";
    }
    let time = result.groups!["time"];
    if (time == null) {
      return null;
    }
    const title2 = result.groups!["title2"]!;
    if (linkDatesToDailyNotes) {
      time = time.replace("[[", "");
      time = time.replace("]]", "");
    }
    return new PlainReminderModel(
      linkDatesToDailyNotes,
      title1,
      time,
      title2,
    );
  }

  public static override readonly regexp =
    /^(?<title1>.*?)\(@(?<time>.+?)\)(?<title2>.*)$/;
}

export class PlainReminderFormat implements ReminderFormat {
  public static readonly instance = new PlainReminderFormat();
  protected config: ReminderFormatConfig = new ReminderFormatConfig();

  setConfig(config: ReminderFormatConfig): void {
    this.config = config;
  }

  parse(doc: MarkdownDocument): Array<Reminder> | null {
    const parsedLines = doc.getTriggerLines()
      .map((triggerLine) => {
          const body = triggerLine.line;
          const parsed = this.parseReminder(body);
          if (parsed == null) {
              return null;
          }
          const title = parsed.getTitle();
          if (title == null) {
              return null;
          }
          const time = parsed.getTime();
          if (time == null) {
              return null;
          }
          return new Reminder(
              doc.file,
              title,
              time,
              triggerLine.lineIndex,
              false);
      })
      .filter((reminder): reminder is Reminder => reminder != null);
    return parsedLines;
  }

  parseReminder(line: string): PlainReminderModel | null {
    const linkDatesToDailyNotes = this.config.getParameter(
      ReminderFormatParameterKey.linkDatesToDailyNotes,
    );
    return PlainReminderModel.parse(
      line,
      linkDatesToDailyNotes,
    );
  }

  private parseValidReminder(line: string): PlainReminderModel | null {
    const parsed = this.parseReminder(line);
    if (parsed === null) {
      return null;
    }
    if (!this.isValidReminder(parsed)) {
      return null;
    }
    return parsed;
  }

  isValidReminder(reminder: PlainReminderModel): boolean {
    return reminder.getTime() !== null;
  }

  async modify(doc: MarkdownDocument, reminder: Reminder, edit: ReminderEdit): Promise<boolean> {
    const triggerLine = doc.getTriggerLine(reminder.rowNumber);
    if (triggerLine === null) {
      return false;
    }
    const parsed = this.parseValidReminder(triggerLine.line);
    if (parsed === null) {
      return false;
    }

    if (!this.modifyReminder(doc, triggerLine, parsed, edit)) {
      return false;
    }

    return true;
  }

  modifyReminder(
    doc: MarkdownDocument,
    triggerLine: TriggerLine,
    parsed: PlainReminderModel,
    edit: ReminderEdit,
  ): boolean {
    if (edit.rawTime !== undefined) {
      if (!parsed.setRawTime(edit.rawTime)) {
        console.warn(
          "The reminder doesn't support raw time: parsed=%o",
          parsed,
        );
        return false;
      }
    } else if (edit.time !== undefined) {
      triggerLine.setNewDateTime(edit.time);
    }
    if (edit.checked !== undefined) {
      triggerLine.setChecked(edit.checked);
    }
    return true;
  }

  appendReminder(line: string, time: DateTime, insertAt?: number): ReminderInsertion | null {
    return {
      insertedLine: `(@${time.toString()}) Task 1`,
      caretPosition: insertAt !== undefined ? insertAt : 0,
    }
  }
}
