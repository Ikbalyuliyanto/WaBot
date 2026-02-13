// temp-id-server.js
const http = require("http");
const { randomUUID } = require("crypto");

const TEMP_ID = randomUUID(); // hanya selama server hidup

http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end(TEMP_ID);
}).listen(3011, () => {
  console.log("TEMP ID:", TEMP_ID);
});
