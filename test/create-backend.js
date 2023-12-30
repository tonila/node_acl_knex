const AclKnexBackend = require('../lib/knex-backend');
const knex = require('knex');

module.exports = async function createBackend(backendType) {
  backendType = backendType || process.env.ACL_BACKEND;

  if (backendType === "knex") {
    var db = knex({
      client: 'postgres',
      connection: {
        host: 'localhost',
        port: 5432,
        user: 'postgres',
        password: '12345',
        database: 'acl_test'
      }
    });

    return new AclKnexBackend({ db, client: 'postgres', prefix: 'acl_' });
  }

  throw new Error("Please assign ACL_BACKEND env const to knex");
  //throw new Error("Please assign ACL_BACKEND env const to one of: memory, redis, mongo, mongo_single");
};