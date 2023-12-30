/**
  Knex Backend.
  Implementation of the storage backend using Knex.js
*/
'use strict';

var contract = require('./contract');
var _ = require('lodash');
var buckets = require('./buckets');

function KnexDBBackend({ db, prefix, client, options }) {
  this.db = db;
  this.buckets = buckets(options);
  this.prefix = typeof prefix !== 'undefined' ? prefix : '';
  this.client = client; // knex client, postgres, mysql, etc.
}

KnexDBBackend.prototype = {
  async close() {
    if (this.db) await this.db.destroy();
  },

  /**
     Begins a transaction.
  */
  async begin() {
    // returns a transaction object
    return [];
  },

  /**
     Ends a transaction (and executes it)
  */
  async end(transaction) {
    // transactions need to be run serial to prevent race conditions
    /*for (let fn of transaction) {
      await fn();
    }*/
    const promises = transaction.map((fn) => fn());
    await Promise.all(promises);
  },

  /**
    Cleans the whole storage.
  */
  async clean() {
    const promises = [];
    for (var key in this.buckets) {
      promises.push(this.db(`${this.prefix}${this.buckets[key]}`).delete());
    }
    await Promise.all(promises);
  },

  /**
     Gets the contents at the bucket's key.
  */
  async get(bucket, key) {
    contract(arguments).params('string', 'string').end();

    var table = '';
    if (bucket.indexOf('allows') != -1) {
      table = this.prefix + this.buckets.permissions;
      const result = await this.db(table)
        .select('key', 'value')
        .where({'key': bucket})
      if (result.length) {
        return (result[0].value[key] ? result[0].value[key] : []);
      } else {
        return [];
      }
    } else {
      table = this.prefix + bucket;
      const result = await this.db(table)
        .select('key', 'value')
        .where({'key': key})
      return (result.length ? result[0].value : []);
    }
  },

  /**
    Returns the union of the values in the given keys.
  */
  async union(bucket, keys) {
    contract(arguments).params('string', 'array').end();

    var table = '';
    if (bucket.indexOf('allows') != -1) {
      table = this.prefix + this.buckets.permissions;
      const results = await this.db(table)
        .select('key', 'value')
        .where({'key': bucket})
      if (results.length && results[0].value) {
        let keyArrays = [];
        _.each(keys, function(key) {
          keyArrays.push.apply(keyArrays, results[0].value[key]);
        });
        return _.union(keyArrays);
      } else {
        return [];
      }
    } else {
      table = this.prefix + bucket;
      const results = await this.db(table)
        .select('key', 'value')
        .whereIn('key', keys)

      if (results.length) {
        let keyArrays = [];
        _.each(results, function(result) {
          keyArrays.push.apply(keyArrays, result.value);
        });
        return _.union(keyArrays);
      } else {
        return [];
      }
    }
  },

  /**
    Adds values to a given key inside a table.
  */
  async add(transaction, bucket, key, values) {
    contract(arguments)
      .params('array', 'string', 'string','string|array')
      .end()
    ;

    var self = this;
    values = Array.isArray(values) ? values : [values]; // we always want to have an array for values

    transaction.push(async () => {
      if (bucket.indexOf('allows') != -1) {
        let table = self.prefix + self.buckets.permissions;

        var json = {};
        json[key] = values;
        // handle concurrent inserts race condition with .onConflict().ignore()
        const insertData = await this.db(table)
          .insert({key: bucket, value: json})
          .onConflict()
          .ignore();

        // return if row was inserted
        if (insertData.rowCount > 0) return

        // handle concurrent updates race condition with row level locking .forUpdate()
        await this.db.transaction(async trx => {
          let result = await trx(table)
            .select('key', 'value')
            .forUpdate()
            .where({'key': bucket})

          // if we have found the key in the table then lets refresh the data
          if (_.has(result[0].value, key)) {
            result[0].value[key] = _.union(values, result[0].value[key]);
          } else {
            result[0].value[key] = values;
          }

          await trx(table)
            .where('key', bucket)
            .update({key: bucket, value: result[0].value});
        }, { isolationLevel: 'read committed' })
      } else {
        let table = self.prefix + bucket;

        // handle concurrent inserts race condition with .onConflict().ignore()
        const insertData = await this.db(table)
          .insert({key: key, value: values})
          .onConflict()
          .ignore();

        // return if row was inserted
        if (insertData.rowCount > 0) return

        // handle concurrent updates race condition with row level locking .forUpdate()
        await this.db.transaction(async trx => {
          let result = await trx(table)
            .select('key', 'value')
            .forUpdate()
            .where({'key': key})

          // if we have found the key in the table then lets refresh the data
          await trx(table)
            .where('key', key)
            .update({value: _.union(values, result[0].value)});

        }, { isolationLevel: 'read committed' })
      }
    });
  },

  /**
     Delete the given key(s) at the bucket
  */
  async del(transaction, bucket, keys) {
    contract(arguments).params('array', 'string', 'string|array').end();

    var self = this;
    var table = '';
    keys = Array.isArray(keys) ? keys : [keys]; // we always want to have an array for keys

    transaction.push(async () => {
      if (bucket.indexOf('allows') != -1) {
        table = self.prefix + self.buckets.permissions;
        await this.db.transaction(async trx => {
          // handle concurrent updates race condition with row level locking .forUpdate()
          const result = await trx(table)
            .select('key', 'value')
            .forUpdate()
            .where({'key': bucket})

          if (result.length === 0) return;

          _.each(keys, function(value) {
            result[0].value = _.omit(result[0].value, value);
          });

          if (_.isEmpty(result[0].value)) {
          // if no more roles stored for a resource the remove the resource
            await trx(table)
              .where('key', bucket)
              .del();
          } else {
            await trx(table)
              .where('key', bucket)
              .update({ value: result[0].value });
          }
        }, { isolationLevel: 'read committed' })
      } else {
        table = self.prefix + bucket;
        await self.db(table)
          .whereIn('key', keys)
          .del()
      }
    });
  },

  /**
    Removes values from a given key inside a bucket.
  */
  async remove(transaction, bucket, key, values) {
    contract(arguments).params('array', 'string', 'string','string|array').end();

    var self = this;
    var table = '';
    values = Array.isArray(values) ? values : [values]; // we always want to have an array for values

    transaction.push(async () => {

      if (bucket.indexOf('allows') != -1) {
        table = self.prefix + self.buckets.permissions;
        await this.db.transaction(async trx => {
          // handle concurrent updates race condition with row level locking .forUpdate()
          const result = await trx(table)
            .select('key', 'value')
            .forUpdate()
            .where({'key': bucket})

          if(result.length === 0) return;

          // update the permissions for the role by removing what was requested
          _.each(values, function(value) {
            result[0].value[key] = _.without(result[0].value[key], value);
          });

          //  if no more permissions in the role then remove the role
          if (!result[0].value[key].length) {
            result[0].value = _.omit(result[0].value, key);
          }

          await trx(table)
            .where('key', bucket)
            .update({value: result[0].value});
        }, { isolationLevel: 'read committed' })
      } else {
        table = self.prefix + bucket;
        await this.db.transaction(async trx => {
          const result = await trx(table)
            .select('key', 'value')
            .forUpdate()
            .where({'key': key})

          if(result.length === 0) return;

          var resultValues = result[0].value;
          // if we have found the key in the table then lets remove the values from it
          _.each(values, function(value) {
            resultValues = _.without(resultValues, value);
          });
          await trx(table)
            .where('key', key)
            .update({value: resultValues});
        }, { isolationLevel: 'read committed' })
      }
    });
  }
};

exports = module.exports = KnexDBBackend;
