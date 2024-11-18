#!/usr/bin/env node

const { stdin, stdout } = process;

// To store open documents (for example purposes)
let documents = {};

// Buffer to accumulate incoming data
let buffer = "";

// Handle incoming data from the client (LSP messages)
stdin.on('data', (chunk) => {
  buffer += chunk.toString();

  while (true) {
    const contentLengthMatch = buffer.match(/Content-Length: (\d+)/);

    if (!contentLengthMatch) {
      break;
    }

    const contentLength = parseInt(contentLengthMatch[1], 10);
    const headerEndIndex = buffer.indexOf("\r\n\r\n");

    if (headerEndIndex === -1) {
      break;
    }

    const messageStartIndex = headerEndIndex + 4;
    const messageEndIndex = messageStartIndex + contentLength;

    if (buffer.length < messageEndIndex) {
      // If the full message body hasn't been received yet, wait for more data
      break;
    }

    const messageBody = buffer.substring(messageStartIndex, messageEndIndex);
    buffer = buffer.substring(messageEndIndex);

    // Try to parse the message as JSON
    try {
      const message = JSON.parse(messageBody);
      handleMessage(message);
    } catch (error) {
      console.error("Failed to parse message:", error);
    }
  }
});

// Function to handle the parsed JSON-RPC message
function handleMessage(message) {
  // Handle 'initialize' request
  if (message.method === 'initialize') {
    sendResponse(message.id, {
      capabilities: {
        textDocumentSync: 1, // TextDocumentSyncKind: Full
        diagnosticsProvider: true,
      },
    });
  }

  // Handle 'textDocument/didOpen' notification
  if (message.method === 'textDocument/didOpen') {
    const { uri, text } = message.params.textDocument;
    documents[uri] = text;
    validateTextDocument(uri, text); // Simulate diagnostic generation
  }

  // Handle 'textDocument/didChange' notification
  if (message.method === 'textDocument/didChange') {
    const { uri, contentChanges } = message.params;
    documents[uri] = contentChanges[0].text;
    validateTextDocument(uri, documents[uri]);
  }
}

// Validate the document and send diagnostics
function validateTextDocument(uri, text) {
  const diagnostics = [];

  // Example: Simple diagnostic for lines that are too long (over 80 characters)
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    if (line.length > 80) {
      diagnostics.push({
        range: {
          start: { line: i, character: 80 },
          end: { line: i, character: line.length },
        },
        severity: 1, // Error
        message: 'Line exceeds 80 characters',
        source: 'minimal-lsp',
      });
    }
  });

  sendNotification('textDocument/publishDiagnostics', {
    uri,
    diagnostics,
  });
}

// Send a JSON-RPC response
function sendResponse(id, result) {
  const response = JSON.stringify({
    jsonrpc: '2.0',
    id,
    result,
  });
  sendMessage(response);
}

// Send a JSON-RPC notification
function sendNotification(method, params) {
  const notification = JSON.stringify({
    jsonrpc: '2.0',
    method,
    params,
  });
  sendMessage(notification);
}

// Utility to send messages over stdout
function sendMessage(message) {
  const contentLength = Buffer.byteLength(message, 'utf8');
  stdout.write(`Content-Length: ${contentLength}\r\n\r\n${message}`);
}
