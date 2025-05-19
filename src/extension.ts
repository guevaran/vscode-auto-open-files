import * as vscode from 'vscode';
import * as path from 'path';
import { promises as fsPromises } from 'fs';

interface Rule {
    triggerPattern: string;
    openPattern: string;
    viewColumn: 'beside' | 'active' | 'beside-left' | 'beside-right';
}

// Output channel for extension logging
let outputChannel: vscode.OutputChannel;
// Debug mode for verbose logging
const DEBUG = true;

export function activate(context: vscode.ExtensionContext) {
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
        const enabled = config.get<boolean>('enabled', true);
        
        if (!enabled) {
            log('Extension is disabled in settings');
            return;
        }

        const filePath = editor.document.uri.fsPath;
        log(`Active editor changed to: ${filePath}`);
        
        // Get list of actually visible files (not just loaded documents)
        const openFiles = new Set(
            vscode.window.visibleTextEditors.map(editor => editor.document.uri.fsPath)
        );
        logDebug(`Currently visible editors: ${Array.from(openFiles).join(', ')}`);
        
        // Get the related file path from rules
        const rules = config.get<Rule[]>('rules', []);
        logDebug(`Found ${rules.length} rules in configuration`);
        
        // Get info about editor groups before processing
        const editorGroupInfo = {
            activeGroupIndex: vscode.window.activeTextEditor?.viewColumn || vscode.ViewColumn.One,
            allGroups: vscode.window.visibleTextEditors.map(e => e.viewColumn),
            editorCount: vscode.window.visibleTextEditors.length
        };
        logDebug(`Editor group info: active=${editorGroupInfo.activeGroupIndex}, count=${editorGroupInfo.editorCount}, all=[${editorGroupInfo.allGroups.join(',')}]`);
        
        // Process the file with rules
        await handleFileOpen(editor.document, rules, openFiles);
    });

    context.subscriptions.push(disposable);
    
    // Add a command to show the output channel
    const showLogsCommand = vscode.commands.registerCommand('autoOpenFiles.showLogs', () => {
        outputChannel.show();
    });
    context.subscriptions.push(showLogsCommand);
}

// Helper function for logging to output channel
function log(message: string): void {
    if (outputChannel) {
        const timestamp = new Date().toISOString();
        outputChannel.appendLine(`[${timestamp}] ${message}`);
    }
}

// Helper function for debug logging (only when DEBUG is true)
function logDebug(message: string): void {
    if (DEBUG && outputChannel) {
        const timestamp = new Date().toISOString();
        outputChannel.appendLine(`[${timestamp}] [DEBUG] ${message}`);
    }
}

// Helper function for error logging to output channel
function logError(message: string, error?: any): void {
    if (outputChannel) {
        const timestamp = new Date().toISOString();
        outputChannel.appendLine(`[${timestamp}] ERROR: ${message}`);
        if (error) {
            if (error.stack) {
                outputChannel.appendLine(error.stack);
            } else {
                outputChannel.appendLine(error.toString());
            }
        }
    }
}

// Helper function to check if a file exists asynchronously
async function fileExists(filePath: string): Promise<boolean> {
    try {
        logDebug(`Checking if file exists: ${filePath}`);
        await fsPromises.access(filePath);
        logDebug(`File exists: ${filePath}`);
        return true;
    } catch (error) {
        logDebug(`File does not exist: ${filePath}`);
        return false;
    }
}

async function handleFileOpen(document: vscode.TextDocument, rules: Rule[], openFiles: Set<string>) {
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
        
        // Check if target file is already open
        if (openFiles.has(targetFilePath)) {
            log(`Target file is already open: ${targetFilePath}`);
            continue;
        }

        // Determine the view column
        const activeEditor = vscode.window.activeTextEditor;
        logDebug(`Active editor: ${activeEditor ? activeEditor.document.uri.fsPath : 'none'}`);
        
        // Ensure currentColumn has a default value (ViewColumn.One) when undefined
        const currentColumn = activeEditor?.viewColumn ?? vscode.ViewColumn.One;
        logDebug(`Current view column: ${currentColumn}`);
        
        let viewColumn: vscode.ViewColumn;
        
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
                
                if (currentColumn === vscode.ViewColumn.One) {
                    try {
                        // Find the text editor with the current file and close it
                        const editorsToClose = vscode.window.visibleTextEditors.filter(
                            editor => editor.document.uri.fsPath === filePath
                        );
                        
                        if (editorsToClose.length > 0) {
                            // Close the current file using the close command
                            await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
                            log(`Closed current file: ${filePath}`);
                        }
                    } catch (error) {
                        logError(`Failed to close current file: ${filePath}`, error);
                    }
                }
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
                preserveFocus: true,  // Keep focus on original file
                preview: false        // Open as a permanent editor, not in preview mode
            });
            log(`Successfully opened related file: ${targetFilePath}`);
        } catch (error) {
            logError(`Failed to open file: ${targetFilePath}`, error);
        }
    }
}

export function deactivate() {}