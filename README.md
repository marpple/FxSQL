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

