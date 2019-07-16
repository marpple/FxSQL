import {
  is_string, is_function,
  deep_flat,
  flat,
  go, pipe, tap,
  map, filter, reduce, reject,
  pluck, uniq, each, index_by, group_by, unique_by, object, curry, min_by,
  C
} from 'fxjs2';

import pg from 'pg';
import mysql from 'mysql';
import { plural, singular } from 'pluralize';
import load_ljoin from './ljoin.js'
import { dump } from 'dumper.js';

export const FxSQL_DEBUG = {
  DUMP: false,
  LOG: false,
  ERROR_WITH_SQL: false
};

const SymbolColumn = Symbol('COLUMN');
const SymbolTag = Symbol('TAG');
const SymbolInjection = Symbol('INJECTION');
const SymbolDefault = Symbol('DEFAULT');

const wrap_arr = a => Array.isArray(a) ? a : [a];
const mix = (arr1, arr2) => arr1.reduce((res, item, i) => {
  res.push(item);
  i < arr2.length && res.push(arr2[i]);
  return res;
}, []);

const uniq_index_by = curry((f, coll) => index_by(f, unique_by(f, coll)));

const first = a => a && a[0];
const last = a => a && a[a.length - 1];

const is_plain_object = obj => !!obj && typeof obj == 'object' && obj.constructor == Object;
const is_column = f => !!(f && f[SymbolColumn]);
const is_tag = f => !!(f && f[SymbolTag]);
const is_injection = query => query == SymbolInjection;

const tag = f => typeof f == 'function' ?
  Object.assign(f, { [SymbolTag]: true }) : tag(_ => f);

function BASE({
  create_pool,
  end_pool,
  query_fn,
  get_connection = pool => pool.connect(),
  BEGIN = client => client.query('BEGIN'),
  COMMIT = async client => {
    await client.query('COMMIT');
    return await client.release();
  },
  ROLLBACK = async client => {
    await client.query('ROLLBACK');
    return await client.release();
  },
  reg_q = /\?\?/g,
  to_q = () => '??',
  escape_dq = idtf => `"${('' + idtf).replace(/\\/g, '\\\\').replace(/"/g, '""')}"`,
  replace_q = (query) => {
    if (is_injection(query)) return SymbolInjection;
    let i = 0;
    query.text = query.text.replace(reg_q, _ => `$${++i}`);
    return query;
  },
  use_ljoin
}) {
  const add_column = me =>
    me.column == '*' ?
      COLUMN(me.as + '.*') :
      is_column(me.column) ?
        COLUMN(...go(
          me.column.originals.concat(pluck('left_key', me.rels)),
          map(c => is_string(c) ? me.as + '.' + c : c),
          uniq)) :
        tag(SymbolInjection);

  const columnize = v =>
    v == '*' ?
      '*' :
      v.match(/\s*\sas\s\s*/i) ?
        v.split(/\s*\sas\s\s*/i).map(dq).join(' AS ') :
        dq(v);

  const dq = str => ('' + str).split('.').map(s => s == '*' ? s : escape_dq(s)).join('.');

  function ASSOCIATE_MODULE(strs, ...tails) {
    strs = strs.slice();
    strs.push(strs.pop() + '\n');
    var [strs2, tails2] = import_module(strs, tails);

    const splited = deep_flat(strs.map(str => str.split('\n')))
      .filter(str => str.match(/^\s*/)[0])
      .filter(str => str.trim());

    const min = min_by(str => str.match(/^\s*/)[0].length, splited);
    const a = '\n' + min.match(/^\s*/)[0];

    return [strs2.map(str => str.split(a).join('\n')), tails2];
  }

  function import_module(strs, tails) {
    if (!tails.some(tail => typeof tail == 'function' && !is_tag(tail))) return [strs, tails];

    var strs2 = [...strs];
    var j = 0;
    var tails2 = tails.map(function(tail, i) {
      if (typeof tail != 'function' || is_tag(tail)) return tail;
      var k = i + j++;
      var spaces = last(strs2[k].split('\n')).match(/^\s*/)[0];
      var [strs3, tails3] = tail();
      strs2.splice(k+1, 0, strs3.map(str => str.replace(/\n/g, '\n' + spaces)));
      return tails3;
    });

    return [
      deep_flat(strs2).filter(str => str.trim()).reduce((strs, str, i) => {
        if (i == 0) return strs.push(str), strs;
        const splited = last(strs).split('\n');
        if (!last(splited).trim()) {
          splited[splited.length-1] = str.substr(1);
          strs[strs.length-1] = splited.join('\n');
        } else {
          strs.push(str);
        }
        return strs;
      }, []),
      deep_flat(tails2)];
  }

  function ready_sqls(strs, tails) {
    const [strs2, tails2] = import_module(strs, tails);
    const options = strs2
      .map(s => s
        .replace(/\s*\n/, '')
        .split('\n')
        .map((s) => {
          var depth = s.match(/^\s*/)[0].length,
            as = s.trim(),
            rel_type;

          var prefix = as.substr(0, 2);
          if (['- ', '< ', 'x '].includes(prefix)) {
            rel_type = prefix.trim();
            as = as.substr(1).trim();
            return { depth, as, rel_type }
          } else if (prefix == 'p ') {
            rel_type = as[2];
            as = as.substr(3).trim();
            return { depth, as, rel_type, is_poly: true }
          } else {
            return { depth, as };
          }
        })
      );

      go(
        tails2,
        map(tail =>
          is_tag(tail) ?
            { query: tail } :
            Object.assign({}, tail, { query: tail.query || tag() })
        ),
        Object.entries,
        each(([i, t]) => go(
          options[i],
          last,
          _ => Object.assign(_, t)
        ))
      );

      return options;
  }

  function merge_query(queries) {
    if (queries.find(is_injection)) return SymbolInjection;
    var query = reduce((res, query) => {
      if (!query) return res;
      if (query.text) res.text += (' ' + query.text);
      if (query.values) res.values.push(...query.values);
      return res;
    }, {
      text: '',
      values: []
    }, queries);
    query.text = query.text.replace(/\n/g, ' ').replace(/\s\s*/g, ' ').trim();
    return query;
  }

  function VALUES(values) {
    return tag(function () {
      values = Array.isArray(values) ? values : [values];

      const columns = go(
        values,
        map(Object.keys),
        flat,
        uniq);

      const DEFAULTS = go(
        columns,
        map(k => [k, SymbolDefault]),
        object);

      values = values
        .map(v => Object.assign({}, DEFAULTS, v))
        .map(v => Object.values(v));

      return {
        text: `(${COLUMN(...columns)().text}) VALUES (${
          values
            .map(v => v.map(v => v == SymbolDefault ? 'DEFAULT' : to_q()).join(', '))
            .join('), (')})`,
        values: flat(values.map(v => v.filter(v => v != SymbolDefault)))
      }
    });
  }

  function COLUMN(...originals) {
    return Object.assign(tag(function() {
      let sqls = flat(originals
        .map(v =>
          is_string(v) ? [{ text: columnize(v) }, { text: ', ' }] :
            is_tag(v) ? [v(), { text: ', ' }] :
              [{ text: Object.entries(v).map(v => v.map(dq).join(' AS ')).join(', ')}, { text: ', ' }]));
      sqls.pop();
      return merge_query(sqls);
    }), { [SymbolColumn]: true, originals: originals });
  }

  const CL = COLUMN, TABLE = COLUMN, TB = TABLE;

  function PARAMS(obj, sep) {
    return tag(function() {
      let i = 0;
      const text = Object.keys(obj).map(k => `${columnize(k)} = ${to_q()}`).join(sep);
      const values = Object.values(obj);
      return {
        text: text.replace(reg_q, function() {
          const value = values[i++];
          return is_column(value) ? value().text : to_q()
        }),
        values: reject(is_column, values)
      };
    });
  }

  function EQ(obj, sep = 'AND') {
    return PARAMS(obj, ' ' + sep + ' ');
  }

  function SET(obj) {
    return tag(function() {
      const query = PARAMS(obj, ', ')();
      query.text = 'SET ' + query.text;
      return query;
    });
  }

  function BASE_IN(key, operator, values) {
    values = uniq(values);

    var keys_text = COLUMN(...wrap_arr(key))().text;
    return {
      text: `${Array.isArray(key) ? `(${keys_text})` : keys_text} ${operator} (${values.map(
        Array.isArray(key) ? v => `(${v.map(to_q).join(', ')})` : to_q
      ).join(', ')})`,
      values: deep_flat(values)
    };
  }

  function IN(key, values) {
    return tag(function() {
      if (!values || !values.length) return { text: `1=??`, values: [0]};
      return BASE_IN(key, 'IN', values);
    });
  }

  function NOT_IN(key, values) {
    return tag(function() {
      if (!values || !values.length) return { text: `1=??`, values: [0]};
      return BASE_IN(key, 'NOT IN', values);
    });
  }

  function _SQL(texts, values) {
    return go(
      mix(
        texts.map(text => ({ text })),
        values.map(value =>
          is_tag(value) ? value() : is_function(value) ? SymbolInjection : { text: to_q(), values: [value] })
      ),
      merge_query);
  }

  function SQL(texts, ...values) {
    return tag(function() {
      return _SQL(texts, values);
    });
  }

  function SQLS(sqls) {
    return tag(function() {
      return sqls.find(sql => !is_tag(sql)) ?
        SymbolInjection : merge_query(sqls.map(sql => sql()));
    });
  }

  function baseAssociate(QUERY) {
    return async function(strs, ...tails) {
      return go(
        ready_sqls(strs, tails),
        deep_flat,
        filter(t => t.as),
        each(option => {
          option.column = option.column || '*';
          option.query = option.query || tag();
          option.table = option.table || (option.rel_type == '-' ? plural(option.as) : option.as);
          option.rels = [];
          option.row_number = option.row_number || [];
        }),
        function setting([left, ...rest]) {
          const cur = [left];
          each(me => {
            while (!(last(cur).depth < me.depth)) cur.pop();
            const left = last(cur);
            left.rels.push(me);
            if (me.rel_type == '-') {
              me.left_key = me.left_key || (me.is_poly ? 'id' : singular(me.table) + '_id');
              me.where_key = me.key || (me.is_poly ? 'attached_id' : 'id');
              me.xjoin = tag();
            } else if (me.rel_type == '<') {
              me.left_key = me.left_key || 'id';
              me.where_key = me.key || (me.is_poly ? 'attached_id' : singular(left.table) + '_id');
              me.xjoin = tag();
            } else if (me.rel_type == 'x') {
              me.left_key = me.left_key || 'id';
              me.where_key = '_#_xtable_#_.' + (me.left_xkey || singular(left.table) + '_id');
              var xtable = me.xtable || (left.table + '_' + me.table);
              me.xjoin = SQL `INNER JOIN ${TB(xtable)} AS ${TB('_#_xtable_#_')} on ${EQ({
                ['_#_xtable_#_.' + (me.xkey || singular(me.table) + '_id')]: COLUMN(me.as + '.' + (me.key || 'id'))
              })}`;
            }
            me.poly_type = me.is_poly ?
              SQL `AND ${EQ(
                is_plain_object(me.poly_type) ? me.poly_type : { attached_type: me.poly_type || left.table }
              )}` : tag();
            cur.push(me);
          }, rest);
          return left;
        },
        async function(me) {
          const lefts = await QUERY `
            SELECT ${add_column(me)}
              FROM ${TB(me.table)} AS ${TB(me.as)} ${me.query}`;
          return go(
            [lefts, me],
            function recur([lefts, option]) {
              return lefts.length && option.rels.length && go(option.rels, C.map(async function(me) {
                const query = me.query();
                if (query && query.text) query.text = query.text.replace(/^\s*WHERE/i, 'AND');

                var fold_key = me.rel_type == 'x' ?
                  `_#_${me.where_key.split('.')[1]}_#_` : me.where_key;

                const colums = uniq(add_column(me).originals.concat(
                  me.rel_type != 'x' ? me.as + '.' + me.where_key : me.where_key + ' AS ' + fold_key));

                const in_vals = filter(a => a != null, pluck(me.left_key, lefts));
                const is_row_num = me.row_number.length == 2;
                const rights = (!in_vals.length ? [] : await (is_row_num ?
                  QUERY `
                  SELECT *
                  FROM (
                    SELECT
                      ${COLUMN(...colums)}, 
                      ROW_NUMBER() OVER (PARTITION BY ${CL(me.where_key)} ORDER BY ${me.row_number[1]}) as "--row_number--"
                    FROM ${TB(me.table)} AS ${TB(me.as)} 
                    ${me.xjoin} 
                    WHERE ${IN(me.as +'.'+me.where_key, in_vals)} ${me.poly_type} ${tag(query)}
                  ) AS "--row_number_table--"
                  WHERE "--row_number_table--"."--row_number--"<=${me.row_number[0]}`
                  :
                  QUERY `
                  SELECT ${COLUMN(...colums)}
                    FROM ${TB(me.table)} AS ${TB(me.as)} 
                    ${me.xjoin} 
                    WHERE ${IN(me.where_key, in_vals)} ${me.poly_type} ${tag(query)}`));

                const [folder, default_value] = me.rel_type == '-' ? [uniq_index_by, () => ({})] : [group_by, () => []];
                return go(
                  rights,
                  is_row_num ? map(r => delete r['--row_number--'] && r) : r => r,
                  folder(a => a[fold_key]),
                  folded => each(function(left) {
                    left._ = left._ || {};
                    left._[me.as] = folded[left[me.left_key]] || default_value();
                  }, lefts),
                  _ => recur([rights, me]),
                  _ => me.hook && each(left => go(me.hook(left._[me.as]), right => left._[me.as] = right), lefts));
              }));
            },
            _ => me.hook ? me.hook(lefts) : lefts
          );
        }
      );
    }
  }

  function CONNECT(connection_info) {
    const pool = create_pool(connection_info);
    const pool_query = query_fn(pool);

    async function base_query(excute_query, texts, values) {
      try {
        var query = replace_q(_SQL(texts, values));
        return await go(
          is_injection(query) ? Promise.reject('INJECTION ERROR') : query,
          tap(function(query) {
            if (FxSQL_DEBUG.DUMP) dump(query);
            typeof FxSQL_DEBUG.LOG == 'function' ?
              FxSQL_DEBUG.LOG(query) : (FxSQL_DEBUG.LOG && console.log(query));
          }),
          excute_query);
      } catch (e) {
        FxSQL_DEBUG.ERROR_WITH_SQL &&
          (e.stack = `\nFxSQL_DEBUG.ERROR_WITH_SQL:\n  text: ${query.text}\n  values: ${JSON.stringify(query.values)}\n${e.stack}`);
        throw e;
      }
    }

    function QUERY(texts, ...values) {
      return base_query(pool_query, texts, values);
    }

    function END() {
      return end_pool(pool);
    }

    const QUERY1 = pipe(QUERY, first),
      ASSOCIATE = baseAssociate(QUERY),
      ASSOCIATE1 = pipe(ASSOCIATE, first);

    var ljoin = null;

    async function LOAD_LJOIN(QUERY) {
      if (!ljoin) ljoin = await load_ljoin({
        ready_sqls, add_column, tag, FxSQL_DEBUG,
        connection_info, QUERY, VALUES, IN, NOT_IN, EQ, SET, COLUMN, CL, TABLE, TB, SQL, SQLS
      });
      return ljoin(QUERY);
    }

    return {
      VALUES, IN, NOT_IN, EQ, SET, COLUMN, CL, TABLE, TB, SQL, SQLS, FxSQL_DEBUG,
      QUERY,
      QUERY1,
      ASSOCIATE,
      ASSOCIATE1,
      ASSOCIATE_MODULE,
      END,
      LOAD_LJOIN: use_ljoin ? LOAD_LJOIN : null,
      async TRANSACTION() {
        try {
          const client = await get_connection(pool);
          const client_query = query_fn(client);
          await BEGIN(client);
          function QUERY(texts, ...values) {
            return base_query(client_query, texts, values);
          }
          const QUERY1 = pipe(QUERY, first),
          ASSOCIATE = baseAssociate(QUERY),
          ASSOCIATE1 = pipe(ASSOCIATE, first);
          return {
            VALUES, IN, NOT_IN, EQ, SET, COLUMN, CL, TABLE, TB, SQL,
            QUERY,
            QUERY1,
            ASSOCIATE,
            ASSOCIATE1,
            LJOIN: use_ljoin && ljoin ? await ljoin(QUERY) : null,
            COMMIT: _ => COMMIT(client),
            ROLLBACK: _ => ROLLBACK(client)
          }
        } catch (e) { throw e; }
      }
    }
  }

  return { CONNECT, VALUES, IN, NOT_IN, EQ, SET, COLUMN, CL, TABLE, TB, SQL, SQLS, FxSQL_DEBUG }
}

const method_promise = curry((name, obj) =>
  new Promise((resolve, reject) =>
      obj[name]((err, res) => err ? reject(err) : resolve(res))));

export const
  PostgreSQL = BASE({
    create_pool: connection_info => new pg.Pool(connection_info),

    end_pool: pool => pool.end(),

    query_fn: pool => pipe(pool.query.bind(pool), res => res.rows),

    use_ljoin: true
  }),
  MySQL = BASE({
    create_pool: connection_info => mysql.createPool(connection_info),

    end_pool: pool => new Promise((resolve, reject) => pool.end(err => err ? reject(err) : resolve)),

    query_fn: pool => ({text, values}) =>
      new Promise((resolve, reject) =>
        pool.query(text, values, (err, results) =>
          err ? reject(err) : resolve(results))),

    get_connection: method_promise('getConnection'),
    BEGIN: method_promise('beginTransaction'),
    COMMIT: method_promise('commit'),
    ROLLBACK: method_promise('rollback'),

    reg_q: /\?/g,
    to_q: () => '?',
    escape_dq: mysql.escapeId,
    replace_q: _ => _
  });