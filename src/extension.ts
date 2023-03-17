// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import axios from "axios";
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as util from "util";
import showdown = require("showdown");

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  let editor = vscode.window.activeTextEditor;
  const languageId = editor!.document.languageId;

  let askToAI = vscode.commands.registerCommand("openai-code.askToAI", () => {
    // Create and show a new webview
    const panel = vscode.window.createWebviewPanel(
      "chatCoding", // Identifies the type of the webview. Used internally
      "OpenAI Code Chat Assistant", // Title of the panel displayed to the user
      vscode.ViewColumn.Beside, // Editor column to show the new webview panel in.
      {
        enableScripts: true,
      } // Webview options. More on these later.
    );

    const bulma = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, "media", "bulma.min.css"));
    const selectionText = editor!.document.getText(editor!.selection);

    const filePath: vscode.Uri = vscode.Uri.file(path.join(context.extensionPath, "src", "index.html"));
    const fileContent = fs.readFileSync(filePath.fsPath, "utf8");

    panel.webview.html = util.format(fileContent, bulma, htmlEscape(selectionText));
    panel.webview.onDidReceiveMessage(
      (message) => {
        if (message.msg) {
          sendRequest(selectionText, languageId, message.msg).then((response) => {
            if (!response) {
              return;
            }
            const converter = new showdown.Converter();
            const html = converter.makeHtml(response);

            panel!.webview.postMessage({ prompt: message.msg, response: html });
          });
        }
      },
      undefined,
      context.subscriptions
    );
  });

  context.subscriptions.push(askToAI);
}

function htmlEscape(str: string) {
  return str.replace(/[&<>'"]/g, (tag) => {
    const map: any = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    };
    return map[tag] || tag;
  });
}

async function sendRequest(selectionText: string, languageId: string, userQuery: string) {
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

  const systemStart = `<|im_start|>system\nYou are an AI assistant that helps people in programming.
    Here is a ${languageId} snippet :
    ${selectionText}
    <|im_end|>\n`;

  let postData = {
    prompt: `${systemStart}<|im_start|>user\n${userQuery}\n<|im_end|>\n<|im_start|>assistant`,
    temperature: 0.5,
    top_p: 0.95,
    frequency_penalty: 0,
    presence_penalty: 0,
    max_tokens: 800,
    stop: ["<|im_end|>"],
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

  let response: any;
  try {
    response = await axios.post(endpoint, postData, requestConfig);
  } catch (error) {
    console.error(error);
    vscode.window.showErrorMessage("Error: " + error);
    return;
  } finally {
    statusBarItem.hide();
  }

  console.log(response.data);
  //return the response
  const text = response.data.choices[0].text as string;

  return text.trim();
}

// This method is called when your extension is deactivated
export function deactivate() { }
