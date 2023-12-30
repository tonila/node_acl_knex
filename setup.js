'use strict';

var createTables = require('./lib/databaseTasks').createTables;

async function run() {
  await createTables(process.argv.slice(2))
  process.exit();
}
run()