const fs = require('fs');
const path = require('path');
const sourceMap = require('source-map-js');

const mapPath = path.join(__dirname, 'dist', 'assets', 'index-C7nUEDPx.js.map');
const rawSourceMap = JSON.parse(fs.readFileSync(mapPath, 'utf8'));

const consumer = new sourceMap.SourceMapConsumer(rawSourceMap);

const originalPos = consumer.originalPositionFor({
  line: 581,
  column: 54815
});

console.log('Original Position:', originalPos);
