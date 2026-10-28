(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JoinLab = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const employees = Object.freeze([
    Object.freeze({ employee_id: 1, first_name: 'Mary' }),
    Object.freeze({ employee_id: 2, first_name: 'James' }),
    Object.freeze({ employee_id: 3, first_name: 'Linda' }),
    Object.freeze({ employee_id: 4, first_name: 'Alex' })
  ]);
  const spaces = Object.freeze([
    Object.freeze({ space_id: 101, employee_id: 1 }),
    Object.freeze({ space_id: 102, employee_id: null }),
    Object.freeze({ space_id: 103, employee_id: 3 }),
    Object.freeze({ space_id: 104, employee_id: null })
  ]);
  const customers = Object.freeze(employees.map(e => Object.freeze({ customer_id: e.employee_id, first_name: e.first_name })));
  const orders = Object.freeze([
    Object.freeze({ order_id: 101, customer_id: 1 }),
    Object.freeze({ order_id: 102, customer_id: 1 }),
    Object.freeze({ order_id: 103, customer_id: 3 }),
    Object.freeze({ order_id: 104, customer_id: 3 })
  ]);
  const examples = Object.freeze({
    parking: Object.freeze({
      id: 'parking', label: '1: Employees & Parking Spaces',
      left: employees, right: spaces, leftTable: 'EMPLOYEE', rightTable: 'PARKING_SPACE',
      leftKey: 'employee_id', rightKey: 'space_id', foreignKey: 'employee_id', outputKey: 'space_employee_id',
      leftAlias: 'e', rightAlias: 'p', leftNoun: 'employee', leftPlural: 'employees',
      rightNoun: 'space', rightPlural: 'spaces', nullable: true, unique: true
    }),
    customers: Object.freeze({
      id: 'customers', label: '2: Customers & Orders',
      left: customers, right: orders, leftTable: 'CUSTOMER', rightTable: 'ORDERS',
      leftKey: 'customer_id', rightKey: 'order_id', foreignKey: 'customer_id', outputKey: 'order_customer_id',
      leftAlias: 'c', rightAlias: 'o', leftNoun: 'customer', leftPlural: 'customers',
      rightNoun: 'order', rightPlural: 'orders', nullable: false, unique: false
    })
  });
  const types = Object.freeze(['INNER', 'LEFT', 'RIGHT', 'CROSS']);
  // SQL equality does not match NULL to NULL. Keys in this lab are numeric.
  const matches = (e, p, example = examples.parking) => e[example.leftKey] != null && p[example.foreignKey] != null && e[example.leftKey] === p[example.foreignKey];
  const compareNullable = (a, b) => a == null ? (b == null ? 0 : 1) : (b == null ? -1 : a - b);
  function join(type, left = employees, right = spaces, example = examples.parking) {
    if (!types.includes(type)) throw new RangeError('Unknown JOIN type: ' + type);
    const result = [];
    function emit(ci, oi) {
      const e = ci === null ? null : left[ci];
      const p = oi === null ? null : right[oi];
      result.push({
        [example.leftKey]: e ? e[example.leftKey] : null,
        first_name: e ? e.first_name : null,
        [example.rightKey]: p ? p[example.rightKey] : null,
        [example.outputKey]: p ? p[example.foreignKey] : null,
        employeeIndex: ci, spaceIndex: oi,
        kind: ci === null || oi === null ? 'extended' : (type === 'CROSS' ? 'product' : 'matched')
      });
    }
    left.forEach((e, ci) => {
      let found = false;
      right.forEach((p, oi) => {
        if (type === 'CROSS' || matches(e, p, example)) { emit(ci, oi); found = true; }
      });
      if (!found && type === 'LEFT') emit(ci, null);
    });
    if (type === 'RIGHT') right.forEach((p, oi) => {
      if (!left.some(e => matches(e, p, example))) emit(null, oi);
    });
    // Same order for every operation: left primary key, then right primary key, NULLs last.
    return result.sort((a, b) => compareNullable(a[example.leftKey], b[example.leftKey]) || compareNullable(a[example.rightKey], b[example.rightKey]));
  }
  function sql(type, example = examples.parking, condition = 'ON') {
    if (!types.includes(type)) throw new RangeError('Unknown JOIN type: ' + type);
    if (!['ON', 'USING'].includes(condition)) throw new RangeError('Unknown condition: ' + condition);
    if (type !== 'CROSS' && condition === 'USING' && example.leftKey !== example.foreignKey) throw new RangeError('USING requires a shared column name');
    const e = example.leftAlias, p = example.rightAlias;
    const leftKey = e + '.' + example.leftKey, rightKey = p + '.' + example.rightKey;
    return 'SELECT\n    ' + leftKey + ',\n    ' + e + '.first_name,\n    ' + rightKey +
      ',\n    ' + p + '.' + example.foreignKey + ' AS ' + example.outputKey +
      '\nFROM ' + example.leftTable.toLowerCase() + ' AS ' + e +
      '\n' + type + ' JOIN ' + example.rightTable.toLowerCase() + ' AS ' + p +
      (type === 'CROSS' ? '' : condition === 'USING' ? '\n    USING (' + example.leftKey + ')' : '\n    ON ' + leftKey + ' = ' + p + '.' + example.foreignKey) +
      '\nORDER BY\n    ' + leftKey + ' IS NULL, ' + leftKey + ',\n    ' + rightKey + ' IS NULL, ' + rightKey + ';';
  }

  function forExample(id) {
    const example = Object.hasOwn(examples, id) ? examples[id] : null;
    if (!example) throw new RangeError('Unknown example: ' + id);
    // Stable provenance slots let both examples use the same renderer.
    return Object.freeze({
      example, employees: example.left, spaces: example.right, types,
      matches: (left, right) => matches(left, right, example),
      join: (type, left = example.left, right = example.right) => join(type, left, right, example),
      sql: (type, condition) => sql(type, example, condition)
    });
  }
  return Object.freeze({ employees, spaces, customers, orders, examples, forExample, types, matches, join, sql });
});
