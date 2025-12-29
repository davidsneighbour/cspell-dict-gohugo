# Hugo Template Functions and Methods Dictionary

This package provides a custom dictionary for [CSpell](https://cspell.org/) containing the names of all template functions and methods available in the [Hugo static site generator](https://gohugo.io/).

## Installation

Install the package with npm:

```bash
npm install --save-dev cspell-dict-hugo-template
```

## Usage

Add the dictionary to your CSpell configuration. The package exports a `cspell-ext.json` file that defines the dictionary and enables it globally.

### Via `package.json`

If you prefer to keep your CSpell configuration in `package.json`, add a `cspell` field that imports the extension:

```json
{
  "cspell": {
    "import": ["cspell-dict-hugo-template"]
  }
}
```

### Via `.cspell.json`

You can also import the dictionary in a dedicated CSpell configuration file:

```json
{
  "import": ["cspell-dict-hugo-template"]
}
```

The import mechanism instructs CSpell to load `cspell-ext.json` from the installed package. That file registers the dictionary under the name `hugo-template` and enables it for all languages.

## Updating

The package includes a script (`update-hugo-dictionary.js`) to refresh the dictionary periodically. It fetches the latest list of functions and methods from the Hugo documentation and writes the result back to `./dict/hugo-template.txt`. Run it with:

```bash
npm run update
```

Alternatively, invoke it directly:

```bash
node update-hugo-dictionary.js --output ./dict/hugo-template.txt
```

This script uses public Hugo documentation and does not require any credentials.

## License

MIT