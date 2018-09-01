import {
  is_string, is_function, flatten, flatten as cat, reduce, tap, go,
  map, filter, reject, pluck, uniq, each, index_by, group_by, last, object, curry
} from 'fxjs2';

export default async function load_ljoin({
  ready_sqls, add_column, tag, MQL_DEBUG,
  connection_info, QUERY, VALUES, IN, NOT_IN, EQ, SET, COLUMN, CL, TABLE, TB, SQL, SQLS
}) {

  MQL_DEBUG.LOG = true;

  const table_columns = {};

  const add_as_join = (me, as) =>
    COLUMN(...go(
      me.column.originals.concat(pluck('left_key', me.left_joins)),
      map(c => me.as + '.' + c + ' AS ' + `${as}>_<${c}`),
      uniq
    ));

  const initial = function(arr, n, guard) {
    return Array.prototype.slice.call(arr, 0, Math.max(0, arr.length - (n == null || guard ? 1 : n)));
  };

  Object.assign(table_columns, await go(
    QUERY `
      SELECT table_name, column_name 
      FROM information_schema.columns 
      WHERE 
        table_name in (
          SELECT tablename 
          FROM pg_tables
          WHERE 
            tableowner=${connection_info.user || process.env.PGUSER} ORDER BY tablename
        );`,
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


  function make_join_group(join_group, left_joins) {
    return each(join_right => {
      join_group.push(join_right);
      make_join_group(join_group, join_right.left_joins);
    }, left_joins)
  }

  function where_in_query(left, where_in, QUERY) {
    const colums = uniq(add_column(left).originals.concat(left.key));
    const query = left.query();
    if (query && query.text) query.text = 'AND ' + query.text.replace(/WHERE|AND/i, '');
    return QUERY`
    SELECT ${CL(...colums)}
    FROM ${TB(left.table)} AS ${TB(left.as)}
    ${where_in}
    ${tag(query)}
    `;
  }

  function left_join_query(left, where_in_query, QUERY) {
    const first_col = add_as_join(left, left.as).originals.concat(left.as + '.id' + ' AS ' + `${left.as}>_<id`);
    if (left.key) first_col.push(left.as + '.' + left.key + ' AS ' + `${left.as}>_<${left.key}`);
    const join_columns = [first_col];
    const join_sqls = [];
    return go(
      left,
      function recur(me, parent_as) {
        me.left_join_over = true;
        parent_as = parent_as || me.as;
        each(right => {
          const query = right.query();
          if (query && query.text) query.text = 'AND ' + query.text.replace(/WHERE|AND/i, '');
          join_columns.push(
            uniq(add_as_join(right, `${parent_as}>_<${right.as}`).originals
              .concat(right.as + '.' + right.key + ' AS ' + `${right.as}>_<${right.key}`)
              .concat(left.as + '.id' + ' AS ' + `${left.as}>_<id`))
          );
          join_sqls.push(SQL `
          LEFT JOIN
           ${TB(right.table)} AS ${TB(right.as)}
            ON
            ${EQ({
              [me.as + '.' + right.left_key]: COLUMN(right.as + '.id') 
            })}
            ${tag(query)}
          `);
          recur(right, `${parent_as}>_<${right.as}`);
        }, me.left_joins);
      },
      () => {
        const query = left.query();
        if (!query) return query;
        query.text = (where_in_query ? 'AND ' : 'WHERE ') + query.text.replace(/WHERE|AND/i, '');
        return query;
      },
      (query) => QUERY `
        SELECT ${COLUMN(...cat(join_columns))}
        FROM ${TB(left.table)} AS ${TB(left.as)}
        ${SQLS(join_sqls)}
        ${where_in_query || tag()}
        ${tag(query)}`,
      map(row => {
        const result_obj = {};
        for (const as in row) {
          if (as.indexOf('>_<') == -1) return ;
          let _obj = null;
          const split_as = as.split('>_<');
          const ass = initial(split_as);
          reduce(function(mem, key) {
            _obj = mem[key] = mem[key] || { _: {}};
            return mem[key]._;
          }, ass, result_obj);
          _obj[split_as[split_as.length-1]] = row[as];
        }
        for (const r_key in result_obj) return result_obj[r_key];
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
        }),
        ([left, ...rest]) => {
          const cur = [left];
          each(me => {
            while (!(last(cur).depth < me.depth)) cur.pop();
            const left = last(cur);
            if (me.rel_type == '-') {
              me.left_key = me.left_key || (me.is_poly ? 'id' : me.table.substr(0, me.table.length-1) + '_id');
              me.key = me.key || (me.is_poly ? 'attached_id' : 'id');
              left.left_joins.push(me);
            } else {
              me.left_key = me.left_key || 'id';
              me.key = me.key || (me.is_poly ? 'attached_id' : left.table.substr(0, left.table.length-1) + '_id');
            }
            left.rels.push(me);

            //

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
          return go(
            left.rels,
            each(function(me) {
              const next_result = cat(map(r => r._ ? r._[me.as] : null, results));
              const f_key_ids = uniq(filter((r) => !!r, pluck(me.left_key, results)));
              if (me.rel_type == '-' || !f_key_ids.length) return recur([me, next_result]);
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