# Auto Open Files

A Visual Studio Code extension that automatically opens related files when you open a file that matches specific patterns.

## Features

- Automatically open related files when you open a matching file
- Configurable rules using regular expression patterns
- Control where the related files open (side-by-side, etc.)
- Easily enable or disable the functionality

## Usage

By default, when you open an HTML file (e.g., `myComponent.html`), the extension will automatically open the corresponding JavaScript file (`myComponent.js`) in a side-by-side view.

## Configuration

Customize the extension in VS Code settings:

```json
// Enable or disable the extension
"autoOpenFiles.enabled": true,

// Configure rules for auto-opening files
"autoOpenFiles.rules": [
  {
    // Regular expression pattern for the file that triggers auto-opening
    "triggerPattern": "(.+)\\.html$",
    
    // Pattern for the file to open, using capture groups from triggerPattern
    "openPattern": "$1.js",
    
    // Where to open the related file: "beside", "beside-left", "beside-right", "active", or "below"
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

- `triggerPattern`: Regular expression pattern with capture groups to match the opened file
- `openPattern`: Pattern for the file to open, using `$1`, `$2`, etc. to reference capture groups
- `viewColumn`: Where to open the related file:
  - `"beside"`: Opens to the side (typically to the right)
  - `"beside-left"`: Forces opening to the left of the current editor
  - `"beside-right"`: Forces opening to the right of the current editor
  - `"active"`: Opens in the current editor group

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

## License

MIT
