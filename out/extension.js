"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
const path = require("path");
const fs_1 = require("fs");
// Track which files have already been processed
const processedFiles = new Set();
// Output channel for extension logging
let outputChannel;
// Debug mode for verbose logging
const DEBUG = true;
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
        // Check for files in processedFiles that are no longer open in the workspace
        const openFiles = new Set(vscode.workspace.textDocuments.map(doc => doc.uri.fsPath));
        const filesToRemove = [];
        processedFiles.forEach(filePath => {
            if (!openFiles.has(filePath)) {
                filesToRemove.push(filePath);
            }
        });
        if (filesToRemove.length > 0) {
            filesToRemove.forEach(filePath => {
                processedFiles.delete(filePath);
                log(`Removed file no longer in workspace: ${filePath}`);
            });
            log(`Cleaned up ${filesToRemove.length} files from processedFiles that were no longer open`);
        }
        const config = vscode.workspace.getConfiguration('autoOpenFiles');
        const enabled = config.get('enabled', true);
        if (!enabled) {
            log('Extension is disabled in settings');
            return;
        }
        const filePath = editor.document.uri.fsPath;
        log(`Active editor changed to: ${filePath}`);
        // Skip if we've already processed this file
        if (processedFiles.has(filePath)) {
            log(`File already processed, skipping: ${filePath}`);
            return;
        }
        // Mark this file as processed
        processedFiles.add(filePath);
        log(`Processing file: ${filePath}`);
        const rules = config.get('rules', []);
        logDebug(`Found ${rules.length} rules in configuration`);
        rules.forEach((rule, index) => {
            logDebug(`Rule #${index + 1}: "${rule.triggerPattern}" -> "${rule.openPattern}" (${rule.viewColumn})`);
        });
        // Get info about editor groups before processing
        const editorGroupInfo = {
            activeGroupIndex: vscode.window.activeTextEditor?.viewColumn || vscode.ViewColumn.One,
            allGroups: vscode.window.visibleTextEditors.map(e => e.viewColumn),
            editorCount: vscode.window.visibleTextEditors.length
        };
        logDebug(`Editor group info: active=${editorGroupInfo.activeGroupIndex}, count=${editorGroupInfo.editorCount}, all=[${editorGroupInfo.allGroups.join(',')}]`);
        // Process the file with rules
        await handleFileOpen(editor.document, rules);
    });
    context.subscriptions.push(disposable);
    // Add a command to manually reset processed files cache
    const resetCommand = vscode.commands.registerCommand('autoOpenFiles.resetCache', () => {
        processedFiles.clear();
        log('Cache cleared - all files will be processed again on next open');
    });
    context.subscriptions.push(resetCommand);
    // Add a command to show the output channel
    const showLogsCommand = vscode.commands.registerCommand('autoOpenFiles.showLogs', () => {
        outputChannel.show();
    });
    context.subscriptions.push(showLogsCommand);
    // Clear processed files when a file is closed
    context.subscriptions.push(vscode.workspace.onDidCloseTextDocument(document => {
        const filePath = document.uri.fsPath;
        if (processedFiles.has(filePath)) {
            processedFiles.delete(filePath);
            log(`Removed from processed files: ${filePath}`);
        }
    }));
    // Log the current state periodically (for debugging)
    if (DEBUG) {
        // Add debouncing to prevent excessive logging
        let debounceTimer;
        context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(() => {
            // Clear any existing timer
            if (debounceTimer) {
                clearTimeout(debounceTimer);
            }
            // Set a new timer with delay
            debounceTimer = setTimeout(() => {
                logDebug(`Currently processed files (${processedFiles.size}):`);
                Array.from(processedFiles).forEach(file => {
                    logDebug(`  - ${file}`);
                });
            }, 2000); // 2 second delay
        }));
    }
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
async function handleFileOpen(document, rules) {
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
        if (!await fileExists(targetFilePath)) {
            log(`Target file does not exist: ${targetFilePath}`);
            continue;
        }
        // Don't open if it's the same file
        if (targetFilePath === filePath) {
            log(`Target file is the same as source file, skipping: ${targetFilePath}`);
            continue;
        }
        // Determine the view column
        const activeEditor = vscode.window.activeTextEditor;
        logDebug(`Active editor: ${activeEditor ? activeEditor.document.uri.fsPath : 'none'}`);
        // Ensure currentColumn has a default value (ViewColumn.One) when undefined
        const currentColumn = activeEditor?.viewColumn ?? vscode.ViewColumn.One;
        logDebug(`Current view column: ${currentColumn}`);
        let viewColumn;
        switch (rule.viewColumn) {
            case 'beside-right':
                viewColumn = currentColumn + 1;
                logDebug(`Using beside-right view column: ${viewColumn}`);
                break;
            case 'beside-left':
                viewColumn = currentColumn > vscode.ViewColumn.One
                    ? currentColumn - 1
                    : vscode.ViewColumn.One;
                logDebug(`Using beside-left view column: ${viewColumn}`);
                break;
            case 'beside':
                viewColumn = vscode.ViewColumn.Beside;
                logDebug(`Using beside view column: ${viewColumn}`);
                break;
            case 'active':
            default:
                viewColumn = vscode.ViewColumn.Active;
                logDebug(`Using active view column: ${viewColumn}`);
                break;
        }
        // Open the related file with preserveFocus:true to keep focus on original file
        try {
            const relatedDocument = await vscode.workspace.openTextDocument(targetFilePath);
            await vscode.window.showTextDocument(relatedDocument, {
                viewColumn: viewColumn,
                preserveFocus: true,
                preview: false // Open as a permanent editor, not in preview mode
            });
            log(`Successfully opened related file: ${targetFilePath}`);
        }
        catch (error) {
            logError(`Failed to open file: ${targetFilePath}`, error);
        }
    }
}
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map