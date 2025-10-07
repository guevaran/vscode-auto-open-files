# Auto Open Files

A Visual Studio Code extension that automatically opens related files when you open a file that matches specific patterns.

## Features

-   Automatically open related files when you open a matching file
-   Configurable rules using regular expression patterns
-   Control where the related files open (side-by-side, etc.)
-   Easily enable or disable the functionality

## Usage

By default, when you open an HTML file (e.g., `myComponent.html`), the extension will automatically open the corresponding JavaScript file (`myComponent.js`) in a side-by-side view.

## Configuration

Customize the extension in VS Code settings:

```json
// Enable or disable the extension
"autoOpenFiles.enabled": true,

// Maximum number of tabs/columns to use (0 = unlimited)
"autoOpenFiles.maxTab": 2,

// Configure rules for auto-opening files
"autoOpenFiles.rules": [
  {
    // Regular expression pattern for the file that triggers auto-opening
    "triggerPattern": "(.+)\\.html$",

    // Pattern for the file to open, using capture groups from triggerPattern
    "openPattern": "$1.js",

    // Where to open the related file
    "viewColumn": "beside"
  },
  {
    // Another example: Open CSS file when opening a component
    "triggerPattern": "(.+)Component\\.js$",
    "openPattern": "$1.css",
    "viewColumn": "beside"
  }
]
```

### Rule Properties

-   `triggerPattern`: Regular expression pattern with capture groups to match the opened file
-   `openPattern`: Pattern for the file to open, using `$1`, `$2`, etc. to reference capture groups
-   `viewColumn`: Where to open the related file:
    -   `"beside"`: Opens to the side (typically to the right)
    -   `"beside-left"`: Forces opening to the left of the current editor
    -   `"beside-right"`: Forces opening to the right of the current editor
    -   `"active"`: Opens in the current editor group
-   `hasOppositeRule`: Indicate if there is an opposite rule. This is needed for bidirectional rules.
-   `onlyIfMultipleTabs`: When true, the file will only be opened if there are already multiple tabs open.

## Examples

1. Open TypeScript file when opening HTML file:

    ```json
    {
    	"triggerPattern": "(.+)\\.html$",
    	"openPattern": "$1.ts",
    	"viewColumn": "beside"
    }
    ```

2. Open CSS file when opening React component:

    ```json
    {
    	"triggerPattern": "(.+)\\.jsx$",
    	"openPattern": "$1.css",
    	"viewColumn": "beside"
    }
    ```

3. Open implementation file when opening header:

    ```json
    {
    	"triggerPattern": "(.+)\\.h$",
    	"openPattern": "$1.cpp",
    	"viewColumn": "beside"
    }
    ```

4. Bidirectional rule for HTML and JS files:

    ```json
    {
      "triggerPattern": "(.+)\\.html$",
      "openPattern": "$1.js",
      "viewColumn": "beside-right",
      "hasOppositeRule": true
    },
    {
      "triggerPattern": "(.+)\\.js$",
      "openPattern": "$1.html",
      "viewColumn": "beside-left",
      "hasOppositeRule": true
    }
    ```

5. Open JavaScript file when HTML file is opened only if multiple tabs/columns are already open:

    ```json
    {
    	"triggerPattern": "(.+)\\.html$",
    	"openPattern": "$1.js",
    	"viewColumn": "beside",
    	"onlyIfMultipleTabs": true
    }
    ```

6. Complete configuration example with bidirectional rules and multiple tabs condition:

    ```json
    {
    	"autoOpenFiles.enabled": true,
    	"autoOpenFiles.maxTab": 2,
    	"autoOpenFiles.rules": [
    		{
    			"triggerPattern": "(.+)\\.html$",
    			"openPattern": "$1.js",
    			"viewColumn": "beside-right",
    			"hasOppositeRule": true,
    			"onlyIfMultipleTabs": true
    		},
    		{
    			"triggerPattern": "(.+)\\.js$",
    			"openPattern": "$1.html",
    			"viewColumn": "beside-left",
    			"hasOppositeRule": true,
    			"onlyIfMultipleTabs": true
    		},
    		{
    			"triggerPattern": "(.+)Test\\.cls$",
    			"openPattern": "$1.cls",
    			"viewColumn": "beside-left",
    			"onlyIfMultipleTabs": true
    		}
    	]
    }
    ```

## Development / Run Locally

1. Clone  
    ```bash
    git clone https://github.com/guevaran/vscode-auto-open-files.git
    cd vscode-auto-open-files
    ```

2. Install dependencies  
    ```bash
    npm install
    ```

3. Build (optional, VS Code does this on F5 if watch not running)  
    ```bash
    npm run compile
    ```

4. Start debug session  
    - Open the folder in VS Code  
    - Press F5 (launches an Extension Development Host)  
    - Open a file matching a triggerPattern to verify behavior  

5. Change code and auto-reload  
    - Keep the debug window open  
    - Edit files in `src/`  
    - Use Command Palette: Developer: Reload Window if needed  

6. Enable verbose logs  
    - Run command: Auto Open Files: Show Logs  
    - Adjust settings and observe output channel "Auto Open Files"

7. Test packaging (optional)  
    ```bash
    npm install -g @vscode/vsce
    vsce package
    ```
    Outputs a `.vsix` you can install via VSIX: Install from VSIX...

8. Install locally without packaging  
    - Use vsce to publish privately or just copy folder into your VS Code extensions dir (not recommended; use F5 for dev)

### Useful Commands

| Action | Command |
| ------ | ------- |
| Show logs | Auto Open Files: Show Logs |
| Open settings JSON | Preferences: Open Settings (JSON) |
| Reload window | Developer: Reload Window |

## License

MIT
