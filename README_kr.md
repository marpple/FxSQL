# MQL - Node.js Functional SQL Query Builder & ORM

[EN](https://github.com/marpple/MQL) | [KR](https://github.com/marpple/MQL/blob/master/README_kr.md)

## 특징
 - 함수와 자바스크립트의 기본 값을 이용한 쿼리 생성
 - Promise 지원
 - SQL 문법 사용
 - 각 데이터베이스에서 지원하는 다양한 최신 Operator 사용 가능
   - (예. https://www.postgresql.org/docs/current/static/functions-json.html)
 - SQL Injection 공격 불가능
 - 클래스와 모델이 필요 없는 Associations
 - 간결한 Transaction API
 - JSON 변환 비용 없음
 - PostgreSQL, MySQL 지원

## 목차
  - [설치](#설치)
  - [연결](#연결)
    - [PostgreSQL](#postgresql)
    - [MySQL](#mysql)
  - [간단한 쿼리](#간단한-쿼리)
  - [서브 쿼리, 조인](#서브-쿼리-조인)
  - [함수 불러오기](#함수-불러오기)
  - [지원하는 헬퍼 함수](#지원하는-헬퍼-함수)
    - [EQ](#eq)
    - [IN](#in)
    - [NOT_IN](#not_in)
    - [VALUES](#values)
    - [SET](#set)
    - [COLUMN, CL](#column-cl)
    - [TABLE, TB](#table-tb)
  - [Associations](#associations)
    - [기본](#기본)
    - [Polymorphic](#polymorphic)
    - [Transaction](#transaction)
    - [Many to many](#many-to-many)
    - [Hook](#hook)
  - [옵션](#옵션)
  - [DEBUG](#debug)

## 설치

```
npm i mql2
```

## 연결

### PostgreSQL

```javascript
const { PostgreSQL } = require('mql2');
const { CONNECT } = PostgreSQL;
const POOL = await CONNECT({
  host: 'localhost',
  user: 'username',
  password: '1234',
  database: 'dbname'
});
```

### PostgreSQL Connection 옵션

MQL은 내부적으로 node-postgres를 사용합니다. `CONNECT` 함수에 사용되는 옵션은 node-postgres와 동일합니다. [디비 연결](https://node-postgres.com/features/connecting)이나 [커넥션 풀](https://node-postgres.com/api/pool)과 관련된 자세한 옵션은 [node-postgres](https://node-postgres.com/) 사이트에서 확인할 수 있습니다.

### MySQL

```javascript
const { MySQL } = require('mql2');
const { CONNECT } = MySQL;
const POOL = await CONNECT({
  host: 'localhost',
  user: 'username',
  password: '1234',
  database: 'dbname'
});
```

### MySQL Connection 옵션

MQL은 내부적으로 mysql를 사용합니다. `CONNECT` 함수에 사용되는 옵션은 mysql과 동일합니다. [디비 연결](https://github.com/mysqljs/mysql#connection-options)이나 [커넥션 풀](https://github.com/mysqljs/mysql#pool-options)과 관련된 자세한 옵션은 [mysql](https://github.com/mysqljs/mysql) 사이트에서 확인할 수 있습니다.

## 간단한 쿼리

```javascript
const { QUERY } = POOL;
const id = 10;
const posts = await QUERY `SELECT * FROM posts WHERE id = ${id}`;
// [{ id: 10, ... }]
```

## 서브 쿼리, 조인

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


`CONNECT`를 통해 얻은 `QUERY`는 connection pool을 이용합니다.

## 함수 불러오기

```javascript
const POOL = await CONNECT();
const = {
  VALUES, IN, NOT_IN, EQ, SET, COLUMN, CL, TABLE, TB, SQL, MQL_DEBUG,
  QUERY,
  ASSOCIATE,
  LJOIN,
  TRANSACTION
} = POOL;
```

## 지원하는 헬퍼 함수

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
const users = await QUERY `SELECT * FROM users WHERE ${NOT_IN('id', [2, 4])} LIMIT 3 ORDER BY ID`;
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
    COLUMN('id', 'bb as cc', 't2.name', 't2.name as name2', { a: 'c' }, { 't3.a': 'd' })
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
    FROM TABLE('t1'), TABLE('tt as t2')
`;
// SELECT
//   ...
//   FROM "t1", "tt" AS "t2"
```

## Associations

### 기본

`ASSOCIATE`는 connection pool을 이용합니다.

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

posts[0].body; // 내용
posts[0]._.user.name // 글쓴이 이름
posts[0]._.comments[0].body // 코멘트 내용
posts[0]._.comments[0]._.user.name // 댓글 작성자 이름
```

`- user`의 `-`는 Belongs to 이고 `< comments`의 `<`는 Has many 입니다.

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
// SELECT * FROM photos WHERE attached_id IN (${map($ => $.id, posts)}) AND attached_type = 'photos';
// SELECT * FROM photos WHERE attached_id IN (${map($ => $.id, users)}) AND attached_type = 'users';
// SELECT * FROM photos WHERE attached_id IN (${map($ => $.id, comments)}) AND attached_type = 'comments';
```

`p -`는 Polymorphic + Has one 이고 `p <`는 Polymorphic + Has many 입니다.

### Many to many

```javascript
/*
* books
*  - id
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

books[0]._.authors[0].name; // 이름

const authors = await ASSOCIATE `
  authors
    x books ${{ xtable: 'books_authors' }}
`;

authors[0]._.books[0].name; // 책 이름
```

### 옵션

```javascript
/*
* 아래와 같이 테이블이 구성되어있다면 ASSOCIATE에서 쿼리에 필요한 테이블명과 컬럼명등을 자동으로 적절히 생성합니다.
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
* 아래와 같이 컬럼을 지정하거나 조건을 추가할 수 있습니다.
* 컬럼을 지정할 때 기본키나 외래키 등을 포함시키지 않아도 ASSOCIATE 내부에서 추가하여 적절히 가져옵니다.
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
* 만일 테이블명과 컬럼명이 ASSOCIATE 규칙에 맞지 않다면 옵션을 통해 매칭을 시켜주세요.
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
    table: 'articles' // 데이터베이스 테이블 명이 다를 때
  }}
    - user ${{ // - 를 했으므로 하나를 객체로 가져옴
      left_key: 'writer_id', // articles가 가진 members.member_id를 가리키는 컬럼
      key: 'member_id', // members 테이블이 가진 키
      table: 'members' // user의 테이블 명
    }}
    < comments ${{ // < 를 했으므로 배열로 여러개를 가져옴
      key: 'article_id' // articles의 id를 가리키는 comments가 가진 컬럼
    }}
      - user ${{
        left_key: 'writer_id', // articles가 가진 members.member_id를 가리키는 컬럼
        key: 'member_id', // members 테이블이 가진 키
        table: 'members' // user의 테이블 명
      }}
      p < likes ${{ // 하나의 likes 테이블을 통해 comments와 posts의 likes를 구현
        poly_type: { parent_name: 'comments' },
        key: 'parent_id'
      }}
    p < likes ${{ // 하나의 likes 테이블을 통해 comments와 posts의 likes를 구현
      poly_type: { parent_name: 'articles' },
      key: 'parent_id'
    }}
    x tags ${{ // x 를 통해 중간 테이블을 join 하여 다대다 관계 구현
      left_key: 'id', // articles.id (articles.id = tags_articles.article_id)
      left_xkey: 'article_id', // left_key와 매칭되는 tags_articles의 키 article_id
      xtable: 'tags_articles', // 중간 테이블 이름
      xkey: 'tag_name', // key와 매칭되는 tags_articles의 키 tag_name
      key: 'name' // tags가 가진 키 (tags_articles.tag_name = tags.name)
    }}
`;
```

위와 같이 옵션을 통해 매칭시켜줄 수 있지만, 데이터베이스 VIEW를 이용해 매칭하면 훨씬 간결한 코드를 유지할 수 있습니다.

### Hook

`hook`을 이용하여 가상 컬럼을 추가하거나 정렬이나 필터링을 할 수 있습니다. 자신의 안쪽 데이터들이 모두 불려진 후 실행되어 활용하기 좋습니다.

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

## Transaction

```javascript
const { PostgreSQL } = require('mql2');
const { CONNECT } = PostgreSQL;
const POOL = await CONNECT({
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

`TRANSACTION`을 통해 얻은 `QUERY`는 하나의 connection을 이용합니다. `ROLLBACK`이나 `COMMIT`을 하고나면 앞서 함께 얻었던 `QUERY` 함수의 커넥션은 해제되고 더이상 사용할 수 없습니다.

## DEBUG

`MQL_DEBUG.LOG`를 `true`로 설정한 후 `QUERY`를 실행하면 콘솔에 DB로 보낸 쿼리들을 출력합니다.

```javascript
MQL_DEBUG.LOG = true;
QUERY `SELECT ${"hi~"} as ho`;

// { text: 'SELECT $1 as ho', values: ['hi'] }
```

