import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

interface Rule {
    triggerPattern: string;
    openPattern: string;
    viewColumn: 'beside' | 'active' | 'below';
}

// Track which files have already been processed
const processedFiles = new Set<string>();

export function activate(context: vscode.ExtensionContext) {
    console.log('Auto Open Files extension activated');

    // Register the event listener for when an editor becomes active
    const disposable = vscode.window.onDidChangeActiveTextEditor(async (editor) => {
        if (!editor) {
            return;
        }

        const config = vscode.workspace.getConfiguration('autoOpenFiles');
        const enabled = config.get<boolean>('enabled', true);
        
        if (!enabled) {
            return;
        }

        const filePath = editor.document.uri.fsPath;
        
        // Skip if we've already processed this file
        if (processedFiles.has(filePath)) {
            return;
        }
        
        // Mark this file as processed
        processedFiles.add(filePath);
        console.log(`Processing file: ${filePath}`);
        
        const rules = config.get<Rule[]>('rules', []);
        
        // Process the file with rules
        await handleFileOpen(editor.document, rules);
    });

    context.subscriptions.push(disposable);
    
    // Clear processed files when a file is closed
    context.subscriptions.push(
        vscode.workspace.onDidCloseTextDocument(document => {
            processedFiles.delete(document.uri.fsPath);
            console.log(`Removed from processed files: ${document.uri.fsPath}`);
        })
    );
}

async function handleFileOpen(document: vscode.TextDocument, rules: Rule[]) {
    const filePath = document.uri.fsPath;
    const fileName = path.basename(filePath);
    const dirPath = path.dirname(filePath);

    for (const rule of rules) {
        const regex = new RegExp(rule.triggerPattern);
        const match = regex.exec(fileName);
        
        if (!match) {
            continue;
        }

        // Replace capture groups in the open pattern
        let targetFileName = rule.openPattern;
        for (let i = 1; i < match.length; i++) {
            targetFileName = targetFileName.replace(`$${i}`, match[i]);
        }

        const targetFilePath = path.join(dirPath, targetFileName);
        
        // Check if target file exists
        if (!fs.existsSync(targetFilePath)) {
            console.log(`Target file does not exist: ${targetFilePath}`);
            continue;
        }

        // Don't open if it's the same file
        if (targetFilePath === filePath) {
            continue;
        }

        // Determine the view column
        let viewColumn: vscode.ViewColumn;
        switch (rule.viewColumn) {
            case 'beside':
                viewColumn = vscode.ViewColumn.Beside;
                break;
            case 'below':
                viewColumn = vscode.ViewColumn.Beside;
                break;
            case 'active':
            default:
                viewColumn = vscode.ViewColumn.Active;
                break;
        }

        // Open the related file with preserveFocus:true to keep focus on original file
        try {
            const document = await vscode.workspace.openTextDocument(targetFilePath);
            await vscode.window.showTextDocument(document, { 
                viewColumn: viewColumn,
                preserveFocus: true  // Key change: don't steal focus
            });
        } catch (error) {
            console.error(`Failed to open file: ${targetFilePath}`, error);
        }
    }
}

export function deactivate() {}
