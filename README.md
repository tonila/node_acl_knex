Node Acl KnexBackend
=============

A Knex.js backend for node_acl

Knex is a query builder for PostgreSQL, MySQL and SQLite3 in Node, The Knex backend is to be used as an adapter for [flash-oss/node_acl](https://github.com/flash-oss/node_acl).

## Features & Documentation
**Please note that this library is tested with Postgres. MySql and SQLite may not work properly.**

Please see [flash-oss/node_acl](https://github.com/flash-oss/node_acl).

## Breaking changes comparing to previous version
Original `node_acl_knex`
```
var acl = new Acl(new AclKnexBackend(db, 'postgres', 'acl_'));
```

New `node_acl_knex`
```
var acl = new Acl(new AclKnexBackend({ db, client: 'postgres', prefix: 'acl_' }));
```
## Installation

Using npm:

```javascript
npm install acl2
npm install knex

npm install pg (for use with Postgres)
npm install mysql (for use with MySql, coming soon)
npm install sqlite3 (for use with SQLite, coming soon)

npm install acl-knex
```

Setup tables:
```
node setup.js <<db_name>> <<username>> <<password>> <<prefix>> <<db_host>> <<db_port>> <<db>> <<db_url>> <<options>>

<<db_host>>, <<db_port>> default to 127.0.0.1 and 5432 respectively
<<db>> should actually be a knex object (only prefix would be needed if you pass in the knex object)
<<db_url>> should be a connection string (only prefix would be needed if you pass in the connection string)
<<options>> defaults (allows you to change the tables names)
{
  meta: 'meta',
  parents: 'parents',
  permissions: 'permissions',
  resources: 'resources',
  roles: 'roles',
  users: 'users'
}

eg: node setup.js 'travis_ci_test', 'postgres', '12345', 'acl_'
eg: node setup.js 'travis_ci_test', 'postgres', '12345', 'acl_', 192.168.56.10, 5432

eg: node setup.js null, null, null, 'acl_', null, null, 'postgres://postgres:12345@192.168.56.10:5432/travis_ci_test'

typically passing db is for use within code (we use it for rebuilding acl in unit tests)
var createTables = require('node_modules/acl-knex/lib/databaseTasks').createTables;
createTables([
  null,
  null,
  null,
  'node_acl_',
  null,
  null,
  null,
  db,
  options
], function(err, db) {
  ...
});

```

Or to include it in a script:
```
var acl_knex = require('acl-knex');
new acl_knex.setup(function() {
  ...
});
```

# Quick Start

```javascript
  Acl = require('acl2');
  AclKnexBackend = require('acl-knex');
  knex = require('knex');

  var db = knex({
    client: 'postgres',
    connection: {
      host: '127.0.0.1',
      port: 5432,
      user: 'postgres',
      database: 'travis_ci_test'
    }
  });

  var acl = new Acl(new AclKnexBackend({ db, client: 'postgres', prefix: 'acl_' }));
```

# Testing

```javascript
npm test
```

Follow me on Twitter [thetrudel](http://twitter.com/thetrudel)
