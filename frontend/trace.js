const fs = require('fs');
const path = require('path');
const sourceMap = require('source-map-js');

// Read the map file
const mapPath = path.join(__dirname, 'dist', 'assets', 'index-C7nUEDPx.js.map');
const rawSourceMap = JSON.parse(fs.readFileSync(mapPath, 'utf8'));

const consumer = new sourceMap.SourceMapConsumer(rawSourceMap);

// The error occurred at line 581, column 54815 in the production JS file
// Note: line in SourceMapConsumer is 1-indexed, column is 0-indexed
const originalPos = consumer.originalPositionFor({
  line: 581,
  column: 54815
});

console.log('Original Position:', originalPos);
