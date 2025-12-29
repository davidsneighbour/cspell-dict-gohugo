// update-hugo-dictionary.js (ESM)
//
// This script fetches the list of available Hugo template functions and
// methods from the public documentation (https://gohugo.io) and writes
// them into a plain text file suitable for use with CSpell.  It is
// designed to be run occasionally (for example via a scheduled task or
// GitHub Action) to keep your Hugo template dictionary up to date.
//
// Usage:
//   node update-hugo-dictionary.js --output <path>
//
// The script supports the following optional configuration via CLI flags:
//   --output    Path to the dictionary file to create.  Defaults to
//               './hugo-template.cspell.txt'.
//   --baseUrl   Base URL of the Hugo documentation.  Defaults to
//               'https://gohugo.io'.  You can override this for testing.

import fs from 'fs';
import https from 'https';

/**
 * Dynamically import cheerio if it is available.  Cheerio is used to parse
 * HTML. If the module is not installed, the script falls back to using
 * regular expressions for extraction.
 *
 * @returns {Promise<any|null>} The imported cheerio module or null if unavailable.
 */
async function loadCheerio() {
  try {
    const module = await import('cheerio');
    // Support both ES module default and CommonJS exports.
    return module.default ?? module;
  } catch (err) {
    // The cheerio module is optional. If it is not found, return null.
    return null;
  }
}

/**
 * Perform an HTTPS GET request and return the response body as a string.
 *
 * @param {string} url - The URL to request.
 * @returns {Promise<string>} The response body.
 */
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        const { statusCode } = res;
        if (statusCode !== 200) {
          res.resume();
          return reject(
            new Error(`Request to ${url} failed with status code ${statusCode}`)
          );
        }
        let rawData = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          rawData += chunk;
        });
        res.on('end', () => {
          resolve(rawData);
        });
      })
      .on('error', (err) => {
        reject(err);
      });
  });
}

/**
 * Extract function or method names from a Hugo category page.
 *
 * @param {string} html - The HTML content to parse.
 * @param {any|null} cheerio - The cheerio module to use for parsing.
 * @returns {string[]} An array of extracted names.
 */
function extractNamesFromCategory(html, cheerio) {
  const names = [];
  if (cheerio) {
    // Parse using Cheerio for robust HTML handling.
    const $ = cheerio.load(html);
    $('a').each((_, el) => {
      const text = $(el).text().trim();
      // Names may be namespaced, e.g. 'collections.After'.
      const parts = text.split('.');
      if (parts.length > 1) {
        const name = parts[parts.length - 1];
        if (/^[A-Za-z_][A-Za-z0-9]*$/.test(name)) {
          names.push(name);
        }
      } else if (/^[a-z]+$/.test(text)) {
        // Capture built‑in template keywords.
        names.push(text);
      }
    });
  } else {
    // Fallback: use regex to extract dotted names.
    const regex = /\b([A-Za-z]+)\.([A-Za-z][A-Za-z0-9]*)\b/g;
    let match;
    // Extract dotted names.
    while ((match = regex.exec(html)) !== null) {
      names.push(match[2]);
    }
  }
  return names;
}

/**
 * Fetch all function names from the Hugo documentation.
 *
 * @param {string} baseUrl - The base URL of the Hugo documentation.
 * @param {any|null} cheerio - The cheerio module if available.
 * @returns {Promise<Set<string>>} A set of function names.
 */
async function fetchFunctionNames(baseUrl, cheerio) {
  const indexUrl = `${baseUrl}/functions/`;
  const indexHtml = await fetchUrl(indexUrl);
  // Determine category links.
  let links = [];
  if (cheerio) {
    const $ = cheerio.load(indexHtml);
    $('a').each((_, el) => {
      const href = $(el).attr('href');
      if (href && href.startsWith('/functions/') && href !== '/functions/') {
        links.push(`${baseUrl}${href}`);
      }
    });
  } else {
    // Fallback: simple regex to find category links.
    const regex = /href="(\\/functions\\/[^\"]+)"/g;
    let match;
    while ((match = regex.exec(indexHtml)) !== null) {
      const href = match[1];
      if (href !== '/functions/') {
        links.push(`${baseUrl}${href}`);
      }
    }
  }
  const functionNames = new Set();
  for (const link of links) {
    try {
      const html = await fetchUrl(link);
      const names = extractNamesFromCategory(html, cheerio);
      names.forEach((n) => functionNames.add(n));
    } catch (err) {
      // Log but continue on errors.
      console.error(`Failed to fetch ${link}: ${err.message}`);
    }
  }
  return functionNames;
}

/**
 * Fetch all method names from the Hugo documentation.
 *
 * @param {string} baseUrl - The base URL of the Hugo documentation.
 * @param {any|null} cheerio - The cheerio module if available.
 * @returns {Promise<Set<string>>} A set of method names.
 */
async function fetchMethodNames(baseUrl, cheerio) {
  const indexUrl = `${baseUrl}/methods/`;
  const indexHtml = await fetchUrl(indexUrl);
  let links = [];
  if (cheerio) {
    const $ = cheerio.load(indexHtml);
    $('a').each((_, el) => {
      const href = $(el).attr('href');
      if (href && href.startsWith('/methods/') && href !== '/methods/') {
        links.push(`${baseUrl}${href}`);
      }
    });
  } else {
    const regex = /href="(\\/methods\\/[^\"]+)"/g;
    let match;
    while ((match = regex.exec(indexHtml)) !== null) {
      const href = match[1];
      if (href !== '/methods/') {
        links.push(`${baseUrl}${href}`);
      }
    }
  }
  const methodNames = new Set();
  for (const link of links) {
    try {
      const html = await fetchUrl(link);
      const names = extractNamesFromCategory(html, cheerio);
      names.forEach((n) => methodNames.add(n));
    } catch (err) {
      console.error(`Failed to fetch ${link}: ${err.message}`);
    }
  }
  return methodNames;
}

/**
 * Parse CLI arguments into an options object.
 *
 * @param {string[]} argv - Array of command line arguments.
 * @returns {{output: string, baseUrl: string}} Parsed options.
 */
function parseArgs(argv) {
  const defaults = {
    output: './hugo-template.cspell.txt',
    baseUrl: 'https://gohugo.io',
  };
  const opts = { ...defaults };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--output' && argv[i + 1]) {
      opts.output = argv[i + 1];
      i++;
    } else if (arg === '--baseUrl' && argv[i + 1]) {
      opts.baseUrl = argv[i + 1].replace(/\/$/, '');
      i++;
    }
  }
  return opts;
}

/**
 * Main entry point for the script.
 */
async function main() {
  const cheerio = await loadCheerio();
  const { output, baseUrl } = parseArgs(process.argv.slice(2));
  const functions = await fetchFunctionNames(baseUrl, cheerio);
  const methods = await fetchMethodNames(baseUrl, cheerio);
  functions.add('page');
  functions.add('site');
  const allNames = new Set([...functions, ...methods]);
  const sortedNames = Array.from(allNames).sort((a, b) =>
    a.localeCompare(b)
  );
  const header = '# Hugo template functions and methods\n';
  try {
    fs.writeFileSync(output, header + sortedNames.join('\n') + '\n', 'utf8');
    console.log(`Wrote ${sortedNames.length} words to ${output}`);
  } catch (err) {
    console.error(`Unable to write dictionary to ${output}: ${err.message}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});