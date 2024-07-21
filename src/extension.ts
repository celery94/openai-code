// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import axios from "axios";
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as util from "util";
import showdown = require("showdown");

interface Message {
  role: "user" | "system" | "assistant";
  content: string;
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  let editor = vscode.window.activeTextEditor;
  const languageId = editor!.document.languageId;

  let askToAI = vscode.commands.registerCommand("openai-code.askToAI", () => {
    // Create and show a new webview
    const panel = vscode.window.createWebviewPanel(
      "chatCoding", // Identifies the type of the webview. Used internally
      "AI Assistant Hub", // Title of the panel displayed to the user
      vscode.ViewColumn.Beside, // Editor column to show the new webview panel in.
      {
        enableScripts: true,
      } // Webview options. More on these later.
    );

    const bulma = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, "media", "bulma.min.css"));
    const selectionText = editor!.document.getText(editor!.selection);

    const filePath: vscode.Uri = vscode.Uri.file(path.join(context.extensionPath, "media", "index.html"));
    const fileContent = fs.readFileSync(filePath.fsPath, "utf8");

    const messages: Message[] = [
      {
        role: "system",
        content: `This GPT assists users by generating Angular, Material Design, and TailwindCSS web interface prototypes based on user requirements. 
        It outputs complete code for Angular components, embedding HTML and CSS within the TypeScript component file, without explaining basic steps. 
        All generated components will be named ${selectionText} and will use standalone=true. 
        The output will include only the source code without any additional explanations.`,
      },
    ];

    panel.webview.html = util.format(fileContent, bulma, htmlEscape(selectionText));
    panel.webview.onDidReceiveMessage(
      (message) => {
        if (message.msg) {
          messages.push({
            role: "user",
            content: message.msg,
          });

          sendRequest(messages).then((response) => {
            if (!response) {
              return;
            }

            messages.push({
              role: "assistant",
              content: response,
            });

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

async function sendRequest(messages: Message[]) {
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
  console.log(messages);

  const isOpenAI = endpoint === "https://api.openai.com/v1/chat/completions";
  let { postData, requestConfig } = isOpenAI ? prepareOpenAiChatRequest(messages, apiKey) : prepareAzureRequest(messages, apiKey);

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
  const text = isOpenAI ? (response.data.choices[0].message.content as string) : (response.data.choices[0].text as string);

  return text.trim();
}

function prepareOpenAiChatRequest(messages: Message[], apiKey: string) {
  let postData = {
    model: "gpt-3.5-turbo",
    messages: messages,
  };

  let requestConfig = {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
  };
  return { postData, requestConfig };
}

function prepareAzureRequest(messages: Message[], apiKey: string) {
  const prompt = messages.map((m) => `<|im_start|>${m.role}\n${m.content}\n<|im_end|>`).join("\n");

  let postData = {
    prompt: `${prompt}\n<|im_start|>assistant`,
    temperature: 1,
    max_tokens: 4000,
    stop: ["<|im_end|>"],
  };

  let requestConfig = {
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
  };
  return { postData, requestConfig };
}

// This method is called when your extension is deactivated
export function deactivate() {}
