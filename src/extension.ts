import { exec } from "child_process";
import { quote } from "shell-quote";
import { type } from "os";
import {
  workspace,
  commands,
  window,
  ExtensionContext,
  QuickPickItem,
  Selection,
  Position,
  Range,
  TextEditorRevealType,
  TextDocumentShowOptions
} from "vscode";

const projectRoot = workspace.rootPath ? workspace.rootPath : ".";

const gitGrep = (query: string): Promise<QuickPickItem[]> => {
  let command = quote([
    "git",
    "grep",
    "-H",
    "-n",
    "-i",
    "-I",
    "--no-color",
    "-F",
    "-e",
    query === "" ? " " : query
  ]);

  if (type() === "Windows_NT") {
    // shell-quote doesn't work for cmd.exe
    command = command.replace(/\"/g, '"""').replace(/\'/g, '"');
  }

  return new Promise((resolve, _) => {
    exec(
      command,
      { cwd: projectRoot, maxBuffer: 2000 * 1024 },
      (err, stdout, stderr) => {
        // TODO: Refactor
        if (stderr) {
          window.showErrorMessage(stderr);
          return resolve([]);
        }
        const lines = stdout.split(/\n/).filter(l => l !== "");
        if (!lines.length) {
          return resolve([
            {
              label: "No results found",
              alwaysShow: true
            }
          ]);
        }
        return resolve(
          lines.map(l => {
            const [fullPath, line, ...desc] = l.split(":");
            const path = fullPath.split("/");
            return {
              label: `${path[path.length - 1]} : ${line}`,
              detail: desc.join(":").trim(),
              description: fullPath
            };
          })
        );
      }
    );
  });
};

const showDocument = async (item: QuickPickItem, preserveFocus = false) => {
  const path = item.description;
  const [_, line] = item.label.split(" : ");

  const doc = await workspace.openTextDocument(projectRoot + "/" + path);
  const options: TextDocumentShowOptions = { preserveFocus: preserveFocus };
  await window.showTextDocument(doc, options);

  const activeTextEditor = window.activeTextEditor;

  if (activeTextEditor) {
    const pos = new Position(~~line - 1, 0);
    const range = new Range(pos, pos);
    activeTextEditor.selection = new Selection(pos, pos);
    activeTextEditor.revealRange(range, TextEditorRevealType.InCenter);
  }
};

export function activate(context: ExtensionContext) {
  let disposable = commands.registerCommand("grep.git", async () => {
    const quickPick = window.createQuickPick();
    quickPick.matchOnDescription = false;
    quickPick.matchOnDetail = true;
    quickPick.placeholder = "Search";
    quickPick.items = await gitGrep("");

    quickPick.onDidAccept(async () => {
      if (quickPick.selectedItems.length > 0) {
        await showDocument(quickPick.selectedItems[0]);
      }
    });

    quickPick.onDidChangeActive(async val => {
      const config = workspace.getConfiguration("grep");
      const preview = config.git.preview;
      if (preview) {
        if (val.length > 0) {
          showDocument(val[0], true);
        }
      }
    });

    quickPick.show();
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {}
