const { startServer } = require("./server/index");

startServer().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
