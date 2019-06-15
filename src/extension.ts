import { exec } from "child_process";
import { quote } from "shell-quote";
import {
  workspace,
  commands,
  window,
  ExtensionContext,
  QuickPickItem,
  Selection,
  Position,
  Range,
  TextEditorRevealType
} from "vscode";

const projectRoot = workspace.rootPath ? workspace.rootPath : ".";

const fetchItems = (query: string): Promise<QuickPickItem[]> => {
  const command = quote([
    "git",
    "grep",
    "-H",
    "-n",
    "-i",
    "-I",
    "-e",
    query === "" ? " " : query
  ]);

  return new Promise((resolve, reject) => {
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
              description: desc.join(":"),
              detail: fullPath
            };
          })
        );
      }
    );
  });
};

export function activate(context: ExtensionContext) {
  let disposable = commands.registerCommand("grep.git", async () => {
    const quickPick = window.createQuickPick();
    quickPick.matchOnDescription = true;
    quickPick.matchOnDetail = true;
    quickPick.items = await fetchItems("");

    quickPick.onDidAccept(async () => {
      if (quickPick.selectedItems.length > 0) {
        const path = quickPick.selectedItems[0].detail;
        const [_, line] = quickPick.selectedItems[0].label.split(" : ");

        const doc = await workspace.openTextDocument(projectRoot + "/" + path);
        await window.showTextDocument(doc);

        const activeTextEditor = window.activeTextEditor;

        if (activeTextEditor) {
          const pos = new Position(~~line - 1, 0);
          const range = new Range(pos, pos);
          activeTextEditor.selection = new Selection(pos, pos);
          activeTextEditor.revealRange(range, TextEditorRevealType.InCenter);
        }
      }
    });

    quickPick.onDidChangeValue(async val => {
      quickPick.items = await fetchItems(val);
    });

    quickPick.placeholder = "Search";

    quickPick.show();
  });

  context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}
