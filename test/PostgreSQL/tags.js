import { expect } from 'chai';
import { PostgreSQL } from "../../index.js";
const { VALUES, IN, NOT_IN, EQ, SET, COLUMN, CL, TABLE, TB, SQL } = PostgreSQL;

describe('PostgreSQL', function() {

  describe('VALUES', function () {
    it('VALUES object', () => {
      var query = VALUES({a: 1, b: '2'})();
      expect(query.values.length).to.eql(2);
      expect(query.values).to.eql([1, '2']);
      expect(query.text).to.eql('("a", "b") VALUES (??, ??)');
    });

    it('VALUES array', () => {
      var query = VALUES([{x: 1, y: 2}, {x: 3}, {y: 4}])();
      expect(query.values.length).to.eql(4);
      expect(query.values).to.eql([1, 2, 3, 4]);
      expect(query.text).to.eql('("x", "y") VALUES (??, ??), (??, DEFAULT), (DEFAULT, ??)');
    });
  });

  describe('IN', function () {
    it('IN one', () => {
      var query = IN('id', [1, 2, 3, 4, 4, 4])();
      expect(query.values).to.eql([1, 2, 3, 4]);
      expect(query.text).to.eql('"id" IN (??, ??, ??, ??)');
    });

    it('IN multi', () => {
      var query = IN(['id', 'type'], [[1, 2, 3], ['TYPE1', 'TYPE2']])();
      expect(query.values).to.eql([ 1, 2, 3, 'TYPE1', 'TYPE2' ]);
      expect(query.text).to.eql('("id", "type") IN ((??, ??, ??), (??, ??))');
    });
  });

  describe('NOT_IN', function () {
    it('IN one', () => {
      var query = NOT_IN('id', [1, 2, 3, 4, 4, 4])();
      expect(query.values).to.eql([1, 2, 3, 4]);
      expect(query.text).to.eql('"id" NOT IN (??, ??, ??, ??)');
    });

    it('IN multi', () => {
      var query = NOT_IN(['id', 'type'], [[1, 2, 3], ['TYPE1', 'TYPE2']])();
      expect(query.values).to.eql([ 1, 2, 3, 'TYPE1', 'TYPE2' ]);
      expect(query.text).to.eql('("id", "type") NOT IN ((??, ??, ??), (??, ??))');
    });
  });

  describe('EQ, COLUMN', function () {
    it('EQ, COLUMN', () => {
      var query = EQ({
        is_public: true,
        is_hidden: false,
        type: 'TYPE1',
        't1.id': COLUMN('t2.t1_id')
      })();
      expect(query.values).to.eql([true, false, 'TYPE1']);
      expect(query.text).to.eql('"is_public" = ?? AND "is_hidden" = ?? AND "type" = ?? AND "t1"."id" = "t2"."t1_id"');
    });

    it('COLUMN', () => {
      var query = COLUMN('id', 'bb as cc', 't2.name', 't2.name as name2', { a: 'c' }, { 't3.a': 'd' })();
      expect(query.values).to.eql([]);
      expect(query.text).to.eql(
        '"id", "bb" AS "cc", "t2"."name", "t2"."name" AS "name2", "a" AS "c", "t3"."a" AS "d"');
    });
  });

  describe('SET', function () {
    it('SET', () => {
      var query = SET({
        is_public: true,
        is_hidden: false,
        type: 'TYPE1'
      })();
      expect(query.values).to.eql([true, false, 'TYPE1']);
      expect(query.text).to.eql('SET "is_public" = ??, "is_hidden" = ??, "type" = ??');
    });
  });

  describe('COLUMN == CL == TABLE == TB', function() {
    it('==', () => {
      expect(COLUMN).to.eql(CL);
      expect(CL).to.eql(TABLE);
      expect(TABLE).to.eql(TB);
    });
  });

  describe('SQL', function() {
    it('SQL', () => {
      expect(SQL `SELECT ${'hi'} AS ho`()).to.eql({
        text: 'SELECT ?? AS ho',
        values: ['hi']
      });
      expect(SQL `SELECT ${COLUMN('id', 'body')} FROM posts OFFSET ${20} LIMIT ${10}`()).to.eql({
        text: 'SELECT "id", "body" FROM posts OFFSET ?? LIMIT ??',
        values: [20, 10]
      });
    });
  });

});

