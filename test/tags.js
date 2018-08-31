const { expect } = require('chai');
const {
  VALUES, IN, NOT_IN, EQ, SET, COLUMN, CL, TABLE, TB, SQL
} = require('../index.js');

describe('[ VALUES ]', function () {
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