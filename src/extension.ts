// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import axios from "axios";
import * as vscode from "vscode";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  let editor = vscode.window.activeTextEditor;

  const document = editor!.document;
  const languageId = document.languageId;
  console.log("Language ID: " + languageId);

  let addComments = vscode.commands.registerCommand("openai-code.addComments", () => {
    sendRequest("Add Documentation comments to the code (" + languageId + "):").then((response) => {
      if (!response) {
        return;
      }

      editor!.edit((editBuilder) => {
        editBuilder.replace(editor!.selection, response!);
      });
    });
  });

  let refactorCode = vscode.commands.registerCommand("openai-code.refactorCode", () => {
    sendRequest("Refactor this code and use comment explain what's changed:").then((response) => {
      if (!response) {
        return;
      }

      editor!.edit((editBuilder) => {
        editBuilder.replace(editor!.selection, response!);
      });
    });
  });

  let addComment = vscode.commands.registerCommand("openai-code.implementTodo", () => {
    sendRequest("Implement TODO for bellow code:").then((response) => {
      if (!response) {
        return;
      }
      editor!.edit((editBuilder) => {
        editBuilder.replace(editor!.selection, response!);
      });
    });
  });

  let askToAI = vscode.commands.registerCommand("openai-code.askToAI", () => {
    // Pop up a dialog to ask to AI
    vscode.window.showInputBox({ prompt: "What do you want to do?" }).then((value) => {
      if (!value) {
        return;
      }
      sendRequest(value).then((response) => {
        if (!response) {
          return;
        }
        editor!.edit((editBuilder) => {
          editBuilder.insert(editor!.selection.active, response!);
        });
      });
    });
  });

  context.subscriptions.push(addComments, refactorCode, addComment, askToAI);
}

async function sendRequest(promptPrefix: string) {
  const config = vscode.workspace.getConfiguration("openAICode");
  const apiKey = config.get("apiKey") as string | undefined;
  const endpoint = config.get("endpoint") as string | undefined;

  if (!apiKey) {
    vscode.window.showErrorMessage("Please set the api key in the settings.");
    return;
  }

  if (!endpoint) {
    vscode.window.showErrorMessage("Please set the endpoint in the settings.");
    return;
  }

  let editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showInformationMessage("No editor is active.");
    return;
  }
  let selection = editor.selection;
  if (selection.isEmpty) {
    vscode.window.showInformationMessage("Please select some text.");
    return;
  }
  let selectedText = editor.document.getText(selection);

  let postData = {
    prompt: `${promptPrefix}\n${selectedText}`,
    temperature: 0.7,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
    best_of: 1,
    max_tokens: 1000,
    stop: null,
  };

  let requestConfig = {
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
  };

  let statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.text = "请求中...";
  statusBarItem.show();

  const response = await axios.post(endpoint, postData, requestConfig);

  statusBarItem.hide();

  console.log(response.data);
  //return the response
  const text = response.data.choices[0].text as string;

  return text.trim();
}

// This method is called when your extension is deactivated
export function deactivate() {}
