import {
  is_string, is_function, flatten, flatten as cat, reduce, tap, go,
  map, filter, reject, pluck, uniq, each, index_by, group_by, last, object, curry
} from 'fxjs2';

import { plural, singular } from 'pluralize';

export default async function load_ljoin({
  ready_sqls, add_column, tag, MQL_DEBUG,
  connection_info, QUERY, VALUES, IN, NOT_IN, EQ, SET, COLUMN, CL, TABLE, TB, SQL, SQLS
}) {
  const cmap = curry((f, arr) => Promise.all(arr.map(f)));

  const table_columns = {};

  const add_as_join = (me, as) =>
    COLUMN(...go(
      me.column.originals.concat(pluck('left_key', me.left_joins)),
      map(c => me.as + '.' + c + ' AS ' + `${as}>_<${c}`),
      uniq
    ));

  Object.assign(table_columns, await go(
    QUERY `
      SELECT table_name, column_name 
      FROM information_schema.columns 
      WHERE
        table_name in (
          SELECT tablename 
          FROM pg_tables
          WHERE 
            tableowner=${connection_info.user || process.env.PGUSER} 
        ) ORDER BY table_name;`,
    group_by((v) => v.table_name),
    map(v => pluck('column_name', v))),
    await go(QUERY `
      SELECT * 
      FROM INFORMATION_SCHEMA.view_column_usage
      WHERE view_catalog=${connection_info.database || process.env.PGDATABASE}
      ;`,
    group_by((v) => v.view_name),
    map(v => pluck('column_name', v)))
  );

  function where_in_query(left, where_in, QUERY) {
    const colums = uniq(add_column(left).originals.concat(left.key));
    const query = left.query();
    if (query && query.text) query.text = query.text.replace(/^\s*WHERE/i, 'AND');
    return left.row_number.length == 2 ?
      QUERY `
      SELECT *
      FROM (
        SELECT
          ${COLUMN(...colums)}, 
          ROW_NUMBER() OVER (PARTITION BY ${CL(left.key)} ORDER BY ${left.row_number[1]}) as "--row_number--"
        FROM ${TB(left.table)} AS ${TB(left.as)}       
        ${where_in || tag()}
      ) AS "--row_number_table--"
      WHERE "--row_number_table--"."--row_number--"<=${left.row_number[0]}`
      :
      QUERY`
      SELECT ${CL(...colums)}
      FROM ${TB(left.table)} AS ${TB(left.as)}
      ${where_in || tag()}
      ${tag(query)}
    `
  }

  function left_join_query(left, where_in, QUERY) {
    let i = 0;
    left.lj_as = 'lj'+ i++ + "//"+left.depth;
    const first_col = add_as_join(left, left.lj_as).originals.concat(left.as + '.id' + ' AS ' + `${left.lj_as}>_<id`);
    if (left.key) first_col.push(left.as + '.' + left.key + ' AS ' + `${left.lj_as}>_<${left.key}`);
    const join_columns = [first_col];
    const join_sqls = [];
    return go(
      left,
      function recur(me) {
        me.left_join_over = true;
        each(right => {
          const query = right.query();
          right.lj_as = 'lj'+ i++ + "//"+right.depth;
          if (query && query.text) query.text = query.text.replace(/^\s*WHERE/i, 'AND');
          join_columns.push(
            uniq(add_as_join(right, right.lj_as).originals
              .concat(right.as + '.' + right.key + ' AS ' + `${right.lj_as}>_<${right.key}`)
              .concat(right.as + '.id' + ' AS ' + `${right.lj_as}>_<id`))
          );

          join_sqls.push(SQL `
          LEFT JOIN
           ${TB(right.table)} AS ${TB(right.as)}
            ON
            ${EQ({
              [me.as + '.' + right.left_key]: COLUMN(right.as + '.' + right.key) 
            })}
            ${tag(query)}
          `);
          recur(right);
        }, me.left_joins);
      },
      () => {
        const query = left.query();
        if (!query) return query;
        query.text = query.text.replace(/^\s*WHERE/i, where_in ? 'AND' : 'WHERE');
        return query;
      },
      (query) => left.row_number.length == 2  ?
        QUERY `
        SELECT "--row_number_table--".*
        FROM (
          SELECT 
            ${COLUMN(...cat(join_columns))},
            ROW_NUMBER() OVER (PARTITION BY ${CL(left.as + '.' + left.key)} ORDER BY ${left.row_number[1]}) as "--row_number--"
          FROM ${TB(left.table)} AS ${TB(left.as)}
          ${SQLS(join_sqls)}
          ${where_in || tag()}
          ${tag(query)}
        ) AS "--row_number_table--"
        WHERE "--row_number_table--"."--row_number--"<=${left.row_number[0]}`
        :
        QUERY `
          SELECT ${COLUMN(...cat(join_columns))}
          FROM ${TB(left.table)} AS ${TB(left.as)}
          ${SQLS(join_sqls)}
          ${where_in || tag()}
          ${tag(query)}`,
      left.row_number.length == 2 ? map(r => delete r['--row_number--'] && r) : r => r,
      map(row => {
        const before_result_obj = {};
        const result_obj = {};
        for (const as in row) {
          if (as.indexOf('>_<') == -1) return ;
          const split_as = as.split('>_<');
          var tas = split_as[0];
          before_result_obj[tas] = before_result_obj[tas] || { _:{} };
          before_result_obj[tas][split_as[1]] = row[as];
        }
        !function recur(me, memo) {
          memo[me.as] = before_result_obj[me.lj_as];
          each(right => recur(right, memo[me.as]._), me.left_joins);
        }(left, result_obj);
        return result_obj[left.as];
      })
    )
  }

  return function(QUERY) {
    return async function ljoin(strs, ...tails) {
      return go(
        ready_sqls(strs, tails),
        cat,
        filter(t => t.as),
        each(option => {
          option.query = option.query || tag();
          option.table = option.table || (option.rel_type == '-' ? option.as + 's' : option.as);
          option.column = option.column || CL(...table_columns[option.table]);
          option.left_joins = [];
          option.rels = [];
          option.row_number = option.row_number || [];
        }),
        ([left, ...rest]) => {
          const cur = [left];
          each(me => {
            while (!(last(cur).depth < me.depth)) cur.pop();
            const left = last(cur);
            if (me.rel_type == '-') {
              me.left_key = me.left_key || (me.is_poly ? 'id' : singular(me.table) + '_id');
              me.key = me.key || (me.is_poly ? 'attached_id' : 'id');
              left.left_joins.push(me);
            } else {
              me.left_key = me.left_key || 'id';
              me.key = me.key || (me.is_poly ? 'attached_id' : singular(left.table) + '_id');
            }
            left.rels.push(me);

            me.poly_type = me.is_poly ?
              SQL `AND ${EQ(
                is_string(me.poly_type) ? { attached_type: me.poly_type || left.table } : me.poly_type
              )}` : tag();

            cur.push(me);
          }, rest);
          return left;
        },
        async left => [
          left,
          left.left_joins.length ?
            await left_join_query(left, null, QUERY) :
            await QUERY `
              SELECT ${add_column(left)}
              FROM ${TB(left.table)} AS ${TB(left.as)} ${left.query}`
        ],
        function recur([left, results]) {
          if (reject(r=>r, results).length) return ;
          return go(
            left.rels,
            cmap(async function(me) {
              const f_key_ids = uniq(filter((r) => !!r, pluck(me.left_key, results)));
              if (me.rel_type == '-' || !f_key_ids.length) return recur([me, cat(map(r => r._ ? r._[me.as] : null, results))]);
              return go(
                (!me.left_join_over && me.left_joins.length ?
                  left_join_query : where_in_query)(me, SQL `WHERE ${IN(me.as + '.' + me.key, f_key_ids)}`, QUERY),
                group_by((v) => v[me.key]),
                function(groups) {
                  each(function(result) {
                    result._ = result._ || {};
                    result._[me.as] = (groups[result[me.left_key]] || []);
                  }, results);
                  return recur([me, cat(map(r => r._ ? r._[me.as] : null, results))]);
                }
              );
            }),
            () => results
          );
        }
      );
    };
  }
}