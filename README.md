# MQL - Node.js 데이터베이스 쿼리 빌더

## 특징
 - INSERT, UPDATE, WHERE 절 등에 필요한 복잡한 쿼리를 자바스크립트 객체를 통해 쉽게 생성할 수 있습니다.
 - 일반적인 SQL 문법을 유지할 수 있어, SQL을 세밀하게 튜닝하고 발전시키기 쉽습니다.
 - PostgreSQL의 다양한 Operator 들을 쉽게 사용할 수 있습니다.
   - (예. https://www.postgresql.org/docs/current/static/functions-json.html)
 - SQL Injection 공격이 불가능합니다.
 - Associations을 위해 모델을 미리 구성해둘 필요가 없습니다.
 - Transaction을 사용하기 쉽습니다.
 - 인자와 결과 값을 자바스크립트의 기본 값으로만(object, array, string, number, true, false, null) 구성하여, 조합성이 높고 JSON 변환 비용이 없습니다.
 - PostgreSQL, MySQL 지원

## 목차
  - [설치](#설치)
  - [연결](#연결)
    - [PostgreSQL](#postgresql)
    - [MySQL](#mysql)
  - [간단한 쿼리](#간단한-쿼리)
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
* 테이블명과 컬럼명이 이미 MQL 포맷과 동일하거나 ViEW 등을 이용해 잘 맞춰놨을 때에는
* ASSOCIATE에게 넘긴 문자열들을 기반으로 자동으로 테이블명과 컬럼명들을 적절히 생성합니다.
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
* 위 상황에서 컬럼들을 최소화해서 가져오고 싶거나 쿼리를 추가하고 싶다면 아래와 같이할 수 있습니다.
* column에 기본키나 외래키 등을 포함시키지 않아도 적절히 ASSOCIATE 내부에서 추가하여 적절히 가져옵니다.
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
* 만일 테이블이 아래와 같다면 옵션을 통해 매칭을 시켜주면 됩니다.
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
      p < likes ${{ // p < 를 이용해 하나의 likes 테이블을 통해 comments와 posts의 likes를 구현
        poly_type: { parent_name: 'comments' },
        key: 'parent_id'
      }}
    p < likes ${{ // p < 를 이용해 하나의 likes 테이블을 통해 comments와 posts의 likes를 구현
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

위와 같이 데이터베이스의 테이블명과 사용하고자하는 이름이 다르거나, `ASSOCIATE`가 자동생성하는 컬럼명 등과 실제 데이터베이스의 상태가 다를 경우 옵션을 이용하여 맞춰줄 수 있습니다. 그러나 대부분의 경우는 데이터베이스의 VIEW를 사용하는 것이 코드 관리에 좋습니다.

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

