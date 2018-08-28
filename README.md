## MQL

마플에서 사용하는 PostgreSQL 쿼리 빌더

### 설치

```
npm i mql2
```

### 연결

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

### 간단한 쿼리

```javascript
  const { QUERY } = MQL;
  const id = 10;
  const posts = await QUERY `SELECT * FROM posts WHERE id = ${id}`;
  // [{ id: 10, ... }]
```

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

### Associations

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
```

### Transaction

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
