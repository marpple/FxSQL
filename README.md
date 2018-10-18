# MQL - Node.js Functional SQL Query Builder & ORM

[EN](https://github.com/marpple/MQL) | [KR](https://github.com/marpple/MQL/blob/master/README_kr.md)

## Features
 - Tagged template literal
 - No models.
 - Only need functions and javascript data types.
 - Promises
 - No cost for converting to JSON.
 - More freedom in using SQL syntax.
 - Preventing SQL-injection attacks.
 - Easy to use the latest operators provided in databases.
 - Simple transaction API.
 - No models for Associations.
 - Designed to work well with PostgreSQL, MySQL.


## Overview
  - [Installation](#installation)
  - [Connect](#connect)
    - [PostgreSQL](#postgresql)
    - [MySQL](#mysql)
  - [Simple query](#simple-query)
  - [Subquery, Join](#subquery-Join)
  - [Ready to be used](#ready-to-be-used)
  - [Helper Function](#helper-Function)
    - [EQ](#eq)
    - [IN](#in)
    - [NOT_IN](#not_in)
    - [VALUES](#values)
    - [SET](#set)
    - [COLUMN, CL](#column-cl)
    - [TABLE, TB](#table-tb)
  - [Associations](#associations)
    - [Common use](#common-use)
    - [Polymorphic](#polymorphic)
    - [Transaction](#transaction)
    - [Many to many](#many-to-many)
    - [ROW_NUMBER + PARTITION](#row_number--partition-postgresql)
    - [Hook](#hook)
    - [ASSOCIATE_MODULE](#associate_module)
  - [Option](#option)
  - [DEBUG](#debug)

## Installation

```
npm i mql2
```

## Connect

### PostgreSQL

```javascript
const { PostgreSQL } = require('mql2');
const { CONNECT } = PostgreSQL;
const POOL = CONNECT({
  host: 'localhost',
  user: 'username',
  password: '1234',
  database: 'dbname'
});
```

### PostgreSQL Connection option

MQL is built on node-postgres. The parameter of CONNECT function is the same as node-postgres’. You can read the detail of [connection pool](https://node-postgres.com/api/pool) or [connecting to DB](https://node-postgres.com/features/connecting) on [node-postgres’ site](https://node-postgres.com/).

### MySQL

```javascript
const { MySQL } = require('mql2');
const { CONNECT } = MySQL;
const POOL = CONNECT({
  host: 'localhost',
  user: 'username',
  password: '1234',
  database: 'dbname'
});
```

### MySQL Connection option

MQL is built on node-postgres. The parameter of CONNECT function is the same as the MySQL’. You can read the detail of [connection pool](https://github.com/mysqljs/mysql#pool-options) or [connecting to DB](https://github.com/mysqljs/mysql#connection-options) on [MySQL's site](https://github.com/mysqljs/mysql).

## Simple query

```javascript
const { QUERY } = POOL;
const id = 10;
const posts = await QUERY `SELECT * FROM posts WHERE id = ${id}`;
// [{ id: 10, ... }]
```

## Subquery, Join

```javascript
const type = 'TYPE1';
const limit = 10;

QUERY `
  SELECT * FROM table1 WHERE table2_id IN (
    SELECT id FROM table2 WHERE type = ${type} ORDER BY id DESC LIMIT ${limit}
  )
`;

const status = 'STATUS1';

QUERY `
  SELECT *
    FROM table1 AS t1, table2 AS t2
    WHERE t1.id = t2.table1_id AND t1.status = ${status}
    ORDER BY id DESC
    LIMIT 10
`;
```


QUERY achieved from CONNECT uses a connection pool.

## Ready to be used

```javascript
const POOL = CONNECT();
const {
  VALUES, IN, NOT_IN, EQ, SET, COLUMN, CL, TABLE, TB, SQL, MQL_DEBUG,
  QUERY,
  ASSOCIATE,
  LJOIN,
  TRANSACTION
} = POOL;
```

## Helper-Function

### EQ

```javascript
const users = await QUERY `SELECT * FROM users WHERE ${EQ({
  email: 'dev@marpple.com',
  password: '1234'
})}`;
// [{ id: 15, email: 'dev@marpple.com', ... }]
```

### IN

```javascript
const users = await QUERY `SELECT * FROM users WHERE ${IN('id', [15, 19, 20, 40])}`;
// [{ id: 15, ...}, { id: 19, ...} ...]
```

### NOT_IN

```javascript
const users = await QUERY `SELECT * FROM users WHERE ${NOT_IN('id', [2, 4])} ORDER BY ID LIMIT 3`;
// [{ id: 1, ...}, { id: 3, ...}, { id: 5, ...}]
```

### VALUES

```javascript
const post = { user_id: 10, body: 'hoho' };
await QUERY `
  INSERT INTO posts ${VALUES(post)}
`;
// INSERT INTO posts ("user_id", "body") VALUES (10, 'hohoho')

await QUERY `
  INSERT INTO coords ${VALUES([
    {x: 20},
    {y: 30},
    {x: 10, y: 20}
  ])}`;
// INSERT INTO coords ("x", "y") VALUES (20, DEFAULT), (DEFAULT, 30), (10, 20)
```

### SET

```javascript
await QUERY `
  UPDATE posts ${SET({ body: 'yo!', updated_at: new Date() })} WHERE id = ${post.id}
`;
// UPDATE posts SET "body" = 'yo!', "updated_at" = '2018-08-28T23:18:13.263Z' WHERE id = 10
```

### COLUMN, CL

```javascript
COLUMN == CL; // true

await QUERY `
  SELECT
    ${COLUMN('id', 'bb as cc', 't2.name', 't2.name as name2', { a: 'c' }, { 't3.a': 'd' })}
      ...
`;
// SELECT
//   "id", "bb" AS "cc", "t2"."name", "t2"."name" AS "name2", "a" AS "c", "t3"."a" AS "d"
//     ...
```

### TABLE, TB

```javascript
TABLE == TB; // true

await QUERY `
  SELECT
    ...
    FROM ${TABLE('t1')}, ${TABLE('tt as t2')}
`;
// SELECT
//   ...
//   FROM "t1", "tt" AS "t2"
```

## Associations

### Common use

ASSOCIATE uses Connection pool.

```javascript
/*
* users
*  - id
*  - name
*
* posts
*  - id
*  - user_id
*  - body

* comments
*  - id
*  - user_id
*  - post_id
*  - body
* */

const { ASSOCIATE } = POOL;

const posts = await ASSOCIATE `
  posts
    - user
    < comments
      - user
`;

posts[0].body;
posts[0]._.user.name
posts[0]._.comments[0].body
posts[0]._.comments[0]._.user.name
```

`-` of `- user` refers to "Belongs to", `<` of `< user` refers to "Has many".

### Polymorphic

```javascript
/*
* photos
*  - attached_type
*  - attached_id
* */

await ASSOCIATE `
  posts
    - user
      p - photo
    p < photos
    < comments
      p < photos
`;
// SELECT * FROM photos WHERE attached_id IN (${map($ => $.id, posts)}) AND attached_type = 'posts';
// SELECT * FROM photos WHERE attached_id IN (${map($ => $.id, users)}) AND attached_type = 'users';
// SELECT * FROM photos WHERE attached_id IN (${map($ => $.id, comments)}) AND attached_type = 'comments';
```

`p -` refers to Polymorphic + Has one, `p <` refers to Polymorphic + Has many.

### Many to many

```javascript
/*
* books
*  - id
*  - title
*
* authors
*  - id
*  - name
*
* books_authors
*  - author_id
*  - book_id
* */

const books = await ASSOCIATE `
  books
    x authors
`;

books[0]._.authors[0].name;

const authors = await ASSOCIATE `
  authors
    x books ${{ xtable: 'books_authors' }}
`;

authors[0]._.books[0].title;
```

### Option

```javascript
/*
* If the tables are formed like the example below, the ASSOCIATE automatically creates the necessary table and column names for queries. the necessary names for the tables and columns for queries
* users
*  - id
* posts
*  - id
*  - user_id
* comments
*  - id
*  - post_id
*  - user_id
* likes
*  - attached_type
*  - attached_id
*  - user_id
* posts_tags
*  - post_id
*  - tag_id
* tags
*  - id
* */

ASSOCIATE `
  posts
    - user
    < comments
     - user
     p < likes
      - user
    p < likes
      - user
    x tags
`;

/*
* You can select columns or add conditions.
* Even though you don’t select a foreign key or a primary key in the option like the below, they are included in ASSOCIATE.
* */

ASSOCIATE `
  posts ${SQL `WHERE is_hidden = false ORDER BY id DESC LIMIT ${10}`}
    - user
    < comments ${{
      column: COLUMN('body', 'updated_at')
    }}
     - user
     p < likes
      - user
    p < likes
      - user
    x tags
`;


/*
* If the names of the tables and columns does not follow the ASSOCIATE rules, you need to manually insert the correct names of the tables and columns.
* members
*  - member_id
* articles
*  - id
*  - writer_id
* comments
*  - id
*  - article_id
*  - writer_id
* likes
*  - parent_name
*  - parent_id
*  - member_id
* tags_articles
*  - article_id
*  - tag_name
* tags
*  - name
* */

const posts = await ASSOCIATE `
  posts ${{
    table: 'articles'
  }}
    - user ${{
      left_key: 'writer_id',
      key: 'member_id',
      table: 'members'
    }}
    < comments ${{
      key: 'article_id'
    }}
      - user ${{
        left_key: 'writer_id',
        key: 'member_id',
        table: 'members'
      }}
      p < likes ${{
        poly_type: { parent_name: 'comments' },
        key: 'parent_id'
      }}
    p < likes ${{
      poly_type: { parent_name: 'articles' },
      key: 'parent_id'
    }}
    x tags ${{
      left_key: 'id',
      left_xkey: 'article_id',
      xtable: 'tags_articles',
      xkey: 'tag_name',
      key: 'name'
    }}
`;
```

If you use VIEW in databases, it's much easier. Then, you don't need to insert all correct column and table names.

### ROW_NUMBER + PARTITION (PostgreSQL)

You can set the `row_number` option to fetch only up to four comments each post. Internally use `ROW_NUMBER` and` PARTITION`.

```javascript
ASSOCIATE `
  posts ${SQL `WHERE is_hidden = false ORDER BY id DESC LIMIT ${10}`}
    < comments ${{
      row_number: [4, SQL `id DESC`]
    }}
`
```

### Hook

You can add virtual columns, sorting, filtering and etc by using Hook.
When all the datas are gathered below “posts”, Hook is executed.

```javascript
const users = await ASSOCIATE `
  users ${{hook: users => users.map(u =>
    Object.assign({}, u, { _popular: !!u._.posts.find(p => p._is_best) })
  )}}
    < posts ${{hook: posts => posts.map(
      p => Object.assign({}, p, { _is_best: p._.comments.length > 1 }))}}
      - user
      < comments
       - user
`;

users[0]._popular; // true
users[0]._.posts[0]._is_best; // true
users[0]._.posts[1]._is_best; // false
```

### ASSOCIATE_MODULE

`ASSOCIATE` allows you to modularize options for reuse. `ASSOCIATE_MODULE` in the function to be passed to` ASSOCIATE`.

```javascript
Post.rights = () => ASSOCIATE_MODULE `
  - user
    < comments ${{
      row_number: [4, SQL `id DESC`]
    }}
     - user
     p < likes
      - user
    p < likes
      - user
    x tags
`;

ASSOCIATE `
  posts ${SQL `WHERE is_hidden = false ORDER BY id DESC LIMIT ${10}`}
    ${Post.rights}
`;
```

Use currying to pass arguments.

```javascript
Post.rights = (limit = 4) => () => ASSOCIATE_MODULE `
  - user
    < comments ${{
      row_number: [limit, SQL `id DESC`]
    }}
     - user
     p < likes
      - user
    p < likes
      - user
    x tags
`;

ASSOCIATE `
  posts ${SQL `WHERE is_hidden = false ORDER BY id DESC LIMIT ${10}`}
    ${Post.rights(6)}
`;
```

## Transaction

```javascript
const { PostgreSQL } = require('mql2');
const { CONNECT } = PostgreSQL;
const POOL = CONNECT({
  host: 'localhost',
  user: 'username',
  password: '1234',
  database: 'dbname',
  charset: 'utf8'
});
const { TRANSACTION } = POOL;
const { QUERY, COMMIT, ROLLBACK } = await TRANSACTION();

await QUERY `
  INSERT INTO posts ${VALUES(post)}
`;
await QUERY `
  UPDATE posts ${SET({ body: 'yo!', updated_at: new Date() })} WHERE id = ${post.id}
`;
await ROLLBACK();
```


## DEBUG


```javascript
MQL_DEBUG.LOG = true;
QUERY `SELECT ${"hi~"} as ho`;

// { text: 'SELECT $1 as ho', values: ['hi'] }
```

