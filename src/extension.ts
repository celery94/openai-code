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

  let askToAI = vscode.commands.registerCommand("openai-code.askToAI", () => {
    // Create and show a new webview
    const panel = vscode.window.createWebviewPanel(
      'chatCoding', // Identifies the type of the webview. Used internally
      'Chat Coding', // Title of the panel displayed to the user
      vscode.ViewColumn.Beside, // Editor column to show the new webview panel in.
      {} // Webview options. More on these later.
    );
    panel.webview.html = getWebviewContent();
  });

  context.subscriptions.push(addComments, refactorCode, askToAI);
}

function getWebviewContent() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cat Coding</title>
</head>
<body>
    <img src="https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif" width="300" />
</body>
</html>`;
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
    prompt: `<|im_start|>system\nYou are an AI assistant that helps people find information.\n<|im_end|>\n<|im_start|>user\n${promptPrefix}\n${selectedText}<|im_end|>\n<|im_start|>assistant`,
    "temperature": 0.5,
    "top_p": 0.95,
    "frequency_penalty": 0,
    "presence_penalty": 0,
    "max_tokens": 800,
    stop: [
      "<|im_end|>"
    ]
  };

  let requestConfig = {
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
  };

  let statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.text = "Processing...";
  statusBarItem.show();

  const response = await axios.post(endpoint, postData, requestConfig);

  statusBarItem.hide();

  console.log(response.data);
  //return the response
  const text = response.data.choices[0].text as string;

  return text.trim();
}

// This method is called when your extension is deactivated
export function deactivate() { }
