"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
const path = require("path");
const fs_1 = require("fs");
// Output channel for extension logging
let outputChannel;
// Debug mode for verbose logging
const DEBUG = false;
function activate(context) {
    // Initialize output channel
    outputChannel = vscode.window.createOutputChannel('Auto Open Files');
    context.subscriptions.push(outputChannel);
    log('Auto Open Files extension activated');
    // Register the event listener for when an editor becomes active
    const disposable = vscode.window.onDidChangeActiveTextEditor(async (editor) => {
        if (!editor) {
            log('No active editor detected');
            return;
        }
        const config = vscode.workspace.getConfiguration('autoOpenFiles');
        const enabled = config.get('enabled', true);
        if (!enabled) {
            log('Extension is disabled in settings');
            return;
        }
        // Get the maxTab setting
        const maxTab = config.get('maxTab', 0);
        logDebug(`Max tab setting: ${maxTab}`);
        const filePath = editor.document.uri.fsPath;
        log(`Active editor changed to: ${filePath}`);
        // Get list of actually visible files (not just loaded documents)
        const openedVisibleFiles = new Set(vscode.window.visibleTextEditors.map((editor) => editor.document.uri.fsPath));
        log(`Currently visible editors: \n${Array.from(openedVisibleFiles).join(', \n')}`);
        // Get the related file path from rules
        const rules = config.get('rules', []);
        logDebug(`Found ${rules.length} rules in configuration`);
        // Process the file with rules
        await handleFileOpen(editor.document, rules, openedVisibleFiles, maxTab);
    });
    context.subscriptions.push(disposable);
    // Add a command to show the output channel
    const showLogsCommand = vscode.commands.registerCommand('autoOpenFiles.showLogs', () => {
        outputChannel.show();
    });
    context.subscriptions.push(showLogsCommand);
}
exports.activate = activate;
// Helper function for logging to output channel
function log(message) {
    if (outputChannel) {
        const timestamp = new Date().toISOString();
        outputChannel.appendLine(`[${timestamp}] ${message}`);
    }
}
// Helper function for debug logging (only when DEBUG is true)
function logDebug(message) {
    if (DEBUG && outputChannel) {
        const timestamp = new Date().toISOString();
        outputChannel.appendLine(`[${timestamp}] [DEBUG] ${message}`);
    }
}
// Helper function for error logging to output channel
function logError(message, error) {
    if (outputChannel) {
        const timestamp = new Date().toISOString();
        outputChannel.appendLine(`[${timestamp}] ERROR: ${message}`);
        if (error) {
            if (error.stack) {
                outputChannel.appendLine(error.stack);
            }
            else {
                outputChannel.appendLine(error.toString());
            }
        }
    }
}
// Helper function to check if a file exists asynchronously
async function fileExists(filePath) {
    try {
        logDebug(`Checking if file exists: ${filePath}`);
        await fs_1.promises.access(filePath);
        logDebug(`File exists: ${filePath}`);
        return true;
    }
    catch (error) {
        logDebug(`File does not exist: ${filePath}`);
        return false;
    }
}
async function closeCurrentFile(filePath) {
    try {
        // Find the text editor with the current file and close it
        const editorsToClose = vscode.window.visibleTextEditors.filter((editor) => editor.document.uri.fsPath === filePath);
        if (editorsToClose.length > 0) {
            // Close the current file using the close command
            await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
            log(`Successfully close file: ${filePath} from current editor`);
        }
    }
    catch (error) {
        logError(`Failed to close current file: ${filePath}`, error);
    }
}
async function openFile(filePath, viewColumn) {
    // Open the related file with preserveFocus:true to keep focus on original file
    try {
        const relatedDocument = await vscode.workspace.openTextDocument(filePath);
        await vscode.window.showTextDocument(relatedDocument, {
            viewColumn: viewColumn,
            preserveFocus: true,
            preview: false, // Open as a permanent editor, not in preview mode
        });
        log(`Successfully open file: ${filePath} in column ${viewColumn}`);
    }
    catch (error) {
        logError(`Failed to open file: ${filePath}`, error);
    }
}
async function handleFileOpen(document, rules, openedVisibleFiles, maxTab) {
    const filePath = document.uri.fsPath;
    const fileName = path.basename(filePath);
    const dirPath = path.dirname(filePath);
    logDebug(`Handling file open for: ${filePath}`);
    logDebug(`File name: ${fileName}`);
    logDebug(`Directory: ${dirPath}`);
    let matchedAnyRule = false;
    for (const rule of rules) {
        logDebug(`Checking rule: "${rule.triggerPattern}" -> "${rule.openPattern}"`);
        const regex = new RegExp(rule.triggerPattern);
        const match = regex.exec(fileName);
        if (!match) {
            logDebug(`No match for pattern: ${rule.triggerPattern}`);
            continue;
        }
        logDebug(`Matched pattern: ${rule.triggerPattern}`);
        matchedAnyRule = true;
        // Replace capture groups in the open pattern
        let targetFileName = rule.openPattern;
        for (let i = 1; i < match.length; i++) {
            const replacement = match[i] || '';
            logDebug(`Replacing $${i} with "${replacement}"`);
            targetFileName = targetFileName.replace(`$${i}`, replacement);
        }
        logDebug(`Target file name: ${targetFileName}`);
        const targetFilePath = path.join(dirPath, targetFileName);
        logDebug(`Target file path: ${targetFilePath}`);
        // Check if target file exists (asynchronously)
        if (!(await fileExists(targetFilePath))) {
            log(`Target file does not exist: ${targetFilePath}`);
            continue;
        }
        // Don't open if it's the same file
        if (targetFilePath === filePath) {
            log(`Target file is the same as source file, skipping: ${targetFilePath}`);
            continue;
        }
        // For 'active' viewColumn, check if file is already opened (not just visible)
        if (rule.viewColumn === 'active') {
            // Check all opened documents, not just visible ones
            const isAlreadyOpened = vscode.workspace.textDocuments.some((doc) => doc.uri.fsPath === targetFilePath);
            if (isAlreadyOpened) {
                log(`Target file is already opened (for active view column), skipping: ${targetFilePath}`);
                continue;
            }
        }
        else {
            // For other viewColumns, only check if it's already visible
            if (openedVisibleFiles.has(targetFilePath)) {
                log(`Target file is already open and visible, skipping: ${targetFilePath}`);
                continue;
            }
        }
        // Check if we should only open when multiple view columns exist
        if (rule.onlyIfMultipleTabs) {
            // Get unique view columns by creating a Set from the visible editors' view columns
            // Filter out undefined and null values before adding to the Set
            const uniqueViewColumns = new Set(vscode.window.visibleTextEditors
                .map((editor) => editor.viewColumn)
                .filter((column) => column !== undefined && column !== null));
            logDebug(`Unique view columns: ${Array.from(uniqueViewColumns).join(', ')}`);
            if (uniqueViewColumns.size <= 1) {
                log(`Rule requires multiple view columns, but only ${uniqueViewColumns.size} column(s) open. Skipping.`);
                continue;
            }
        }
        // Determine the view column
        const activeEditor = vscode.window.activeTextEditor;
        logDebug(`Active editor: ${activeEditor ? activeEditor.document.uri.fsPath : 'none'}`);
        // Ensure currentColumn has a default value (ViewColumn.One) when undefined
        const currentColumn = activeEditor?.viewColumn ?? vscode.ViewColumn.One;
        logDebug(`Current view column: ${currentColumn}`);
        let targetColumn;
        let targetColumnForCurrentFile = currentColumn;
        let doCloseCurrentFile = false;
        // Determine target view column based on rule and maxTab setting
        switch (rule.viewColumn) {
            case 'beside':
            case 'beside-right':
                targetColumn = currentColumn + 1;
                logDebug(`Using beside-right view column: ${targetColumn}`);
                // Check if the next column exceeds maxTab
                if (currentColumn === maxTab) {
                    if (rule.hasOppositeRule) {
                        // Close the current file so it can be reopened by the opposite rule
                        doCloseCurrentFile = true;
                    }
                    else {
                        // Close the current file to reopen it in another column
                        doCloseCurrentFile = true;
                        targetColumnForCurrentFile = currentColumn - 1;
                    }
                }
                break;
            case 'beside-left':
                targetColumn =
                    currentColumn > vscode.ViewColumn.One
                        ? currentColumn - 1
                        : vscode.ViewColumn.One;
                logDebug(`Using beside-left view column: ${targetColumn}`);
                // Check if the previous column is the first one
                if (currentColumn === vscode.ViewColumn.One) {
                    if (rule.hasOppositeRule) {
                        // Close the current file so it can be reopened by the opposite rule
                        doCloseCurrentFile = true;
                    }
                    else {
                        // Close the current file to reopen it in another column
                        doCloseCurrentFile = true;
                        targetColumnForCurrentFile = currentColumn + 1;
                    }
                }
                break;
            case 'active':
            default:
                targetColumn = vscode.ViewColumn.Active;
                logDebug(`Using active view column: ${targetColumn}`);
                break;
        }
        // Check if the number of open editors exceeds maxTab
        if (maxTab != 0 && targetColumn > maxTab) {
            logDebug(`Max tab limit exceeded, adjusting view column to: ${maxTab}`);
            targetColumn = vscode.ViewColumn.One + (maxTab - 1);
        }
        if (doCloseCurrentFile) {
            // Close the current file before opening the new one
            await closeCurrentFile(filePath);
        }
        if (doCloseCurrentFile && !rule.hasOppositeRule) {
            log('Reopening current file in the new column');
            await openFile(filePath, targetColumnForCurrentFile);
        }
        else {
            log(`Opening target file: ${targetFilePath} in column ${targetColumn}`);
            await openFile(targetFilePath, targetColumn);
        }
    }
}
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map