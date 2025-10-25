import type { DateTime } from "model/time";
import { TRIGGER_CONFIG } from "./trigger-config";

/**
 * Represents TODO items in Markdown.
 *
 * This class shouldn't break original line.
 */
export class Todo {
  // e.g: '  - [x] hello'
  // prefix: '  - [ '
  // check: 'x'
  // suffix: '] '
  // body: hello
  private static readonly regexp =
    /^(?<prefix>((> ?)*)?\s*[-*][ ]+\[)(?<check>.)(?<suffix>\]\s+)(?<body>.*)$/;
  private static readonly checkedStatuses = ["x", "-"];

  static parse(lineIndex: number, line: string): Todo | null {
    const match = Todo.regexp.exec(line);
    if (match) {
      return new Todo(
        lineIndex,
        match.groups!["prefix"]!,
        match.groups!["check"]!,
        match.groups!["suffix"]!,
        match.groups!["body"]!,
      );
    }
    return null;
  }

  constructor(
    public lineIndex: number,
    private prefix: string,
    public check: string,
    private suffix: string,
    public body: string,
  ) {}

  public toMarkdown(): string {
    return `${this.prefix}${this.check}${this.suffix}${this.body}`;
  }

  public isChecked() {
    return Todo.checkedStatuses.some((status) => status === this.check);
  }

  public setChecked(checked: boolean) {
    this.check = checked ? "x" : " ";
  }

  public getHeaderLength() {
    return this.prefix.length + this.check.length + this.suffix.length;
  }

  public clone() {
    return Todo.parse(this.lineIndex, this.toMarkdown());
  }
}

export type TodoEdit = {
  checked?: boolean;
  body?: string;
};

export class TriggerLine {
  constructor(
    public lineIndex: number,
    public line: string,
    // public todo: Todo | null = null,
    private prefix: string = "",
    private suffix: string = "",
) {}

  // prefix: '- '
  // timer: '(@..)'
  // suffix: ' '
  private static readonly regexp =
    /^(?<prefix>.*?)(\(@(?<timer>.+?)\))(?<suffix>.*)$/;

  static parse(lineIndex: number, line: string): TriggerLine | null {
    const match = TriggerLine.regexp.exec(line);
    if (match) {
      return new TriggerLine(
        lineIndex,
        line,
        match.groups!["prefix"]!,
        match.groups!["suffix"]!,
      );
    }
    return null;
  }

  setChecked(checked: boolean) {
    if (checked) {
      this.line = this.toMarkdown();
    }
  }

  setNewDateTime(dateTime: DateTime) {
    this.line = this.toMarkdown(dateTime);
  }

  toMarkdown(time: DateTime | null = null): string {
    const autoCompleteTrigger = TRIGGER_CONFIG.getAutoCompleteTrigger();
    if (!!time) {
      return `${this.prefix}${autoCompleteTrigger}${time.toString()})${this.suffix}`;
    }
    return `${this.prefix.trimEnd()}${this.suffix}`;
  }
}

export class MarkdownDocument {
  private lines: Array<string> = [];
  private todos: Array<Todo> = [];
  private triggerLines: Array<TriggerLine> = [];

  constructor(
    public file: string,
    content: string,
  ) {
    this.parse(content);
  }

  private parse(content: string) {
    this.lines = content.split("\n");
    this.todos = [];
    this.triggerLines = [];
    const autoCompleteTrigger = TRIGGER_CONFIG.getAutoCompleteTrigger();
    this.lines.forEach((line, lineIndex) => {
      const todo = Todo.parse(lineIndex, line);
      if (todo) {
        this.todos.push(todo);
      }
      // Check if line contains the autoCompleteTrigger and it's not a todo
      if (!todo && autoCompleteTrigger && line.includes(autoCompleteTrigger)) {
        const triggerLine = TriggerLine.parse(lineIndex, line);
        if (triggerLine) {
          this.triggerLines.push(triggerLine);
        }
      }
    });
  }

  public getTodos(): Array<Todo> {
    return this.todos;
  }

  public getTriggerLines(): Array<TriggerLine> {
    return this.triggerLines;
  }

  public insertTodo(lineIndex: number, todo: Todo) {
    todo.lineIndex = lineIndex;
    this.lines.splice(lineIndex, 0, todo.toMarkdown());
    let todoIndex = -1;
    for (const i in this.todos) {
      const todo = this.todos[i]!;
      if (todo.lineIndex >= lineIndex) {
        if (todoIndex < 0) {
          todoIndex = parseInt(i);
        }
        todo.lineIndex++;
      }
    }
    if (todoIndex <= 0) {
      this.todos.splice(0, 0, todo);
    } else {
      this.todos.splice(todoIndex, 0, todo);
    }
  }

  public getTodo(lineIndex: number): Todo | null {
    const found = this.todos.find((todo) => todo.lineIndex === lineIndex);
    if (found == null) {
      return null;
    }
    return found;
  }

  public getTriggerLine(lineIndex: number): TriggerLine | null {
    const found = this.triggerLines.find((line) => line.lineIndex === lineIndex);
    if (found == null) {
      return null;
    }
    return found;
  }

  private applyChanges() {
    // apply changes of TODO items to lines
    this.todos.forEach((todo) => {
      this.lines[todo.lineIndex] = todo.toMarkdown();
    });
    // apply changes of Trigger lines to lines
    this.triggerLines.forEach((triggerLine) => {
      this.lines[triggerLine.lineIndex] = triggerLine.line;
    });
  }

  public toMarkdown(): string {
    this.applyChanges();
    return this.lines.join("\n");
  }
}
