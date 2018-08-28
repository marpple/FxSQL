# MQL

마플에서 사용하는 PostgreSQL 쿼리 빌더

## 특징
 - INSERT, UPDATE, WHERE 절 등에 필요한 복잡한 쿼리를 자바스크립트 객체를 통해 쉽게 생성할 수 있습니다.
 - 일반적인 SQL 문법을 유지할 수 있습니다.
 - SQL을 세밀하게 튜닝할 수 있습니다.
 - SQL Injection이 불가능합니다.
 - Associations을 위해 모델을 미리 구성해둘 필요가 없습니다.
 - Transaction을 사용하기 쉽습니다.

## 설치

```
npm i mql2
```

## 연결

```javascript
const { CONNECT } = require('mql2');
const MQL = await CONNECT({
  host: 'localhost',
  user: 'username',
  password: '1234',
  database: 'dbname',
  charset: 'utf8'
});
```

## 간단한 쿼리

```javascript
const { QUERY } = MQL;
const id = 10;
const posts = await QUERY `SELECT * FROM posts WHERE id = ${id}`;
// [{ id: 10, ... }]
```

## 지원하는 tags

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
const users2 = await QUERY `SELECT * FROM users WHERE ${NOT_IN('id', [2, 4])}` LIMIT 3 ORDER BY ID;
// [{ id: 1, ...}, { id: 3, ...}, { id: 5, ...}]
```

### VALUES

```javascript
const post = { user_id: 10, body: 'hoho' };
await QUERY `
  INSERT INTO posts ${post}
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

## Associations


### 기본

```javascript
/*
* users
*  - id
*
* posts
*  - id
*  - user_id
*  - is_hidden
*
* comments
*  - post_id
*  - is_hidden
* */

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

### 옵션

```javascript
const posts = await ASSOCIATE `
  posts ${SQL `WHERE is_hidden IS NOT true LIMIT ${limit} OFFSET ${offset}`}
    - user ${{
        left_key: 'user_id',
        key: 'id'
        table: 'users'
    }}
    < comments
      - user
`;
```

## Transaction

```javascript
const { QUERY_T, COMMIT, ROLLBACK } = await TRANSACTION();
await QUERY_T `
  INSERT INTO posts ${post}
`;
await QUERY_T `
  UPDATE posts ${SET({ body: 'yo!', updated_at: new Date() })} WHERE id = ${post.id}
`;
await ROLLBACK();
```
