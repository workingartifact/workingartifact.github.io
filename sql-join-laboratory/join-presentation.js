// Presentation data only. Relational calculations remain in join-engine.js.
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JoinPresentation = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function sourceRows(type, rows, engine, side) {
    const employeeSide = side === 'employee';
    const records = employeeSide ? engine.employees : engine.spaces;
    const others = employeeSide ? engine.spaces : engine.employees;
    const key = employeeSide ? 'employeeIndex' : 'spaceIndex';
    return records.map((record, index) => {
      const count = rows.filter(row => row[key] === index).length;
      const hasMatch = others.some(other => employeeSide ? engine.matches(record, other) : engine.matches(other, record));
      return {
        record, index, count, hasMatch,
        status: type === 'CROSS' ? 'product' : count === 0 ? 'excluded' : hasMatch ? 'matched' : 'preserved'
      };
    });
  }

  function introducedFields(row, example = { leftKey: 'employee_id', rightKey: 'space_id', outputKey: 'space_employee_id' }) {
    if (row.employeeIndex === null) return [example.leftKey, 'first_name'];
    if (row.spaceIndex === null) return [example.rightKey, example.outputKey];
    return [];
  }

  function representativeRows(type, rows, example = { leftKey: 'employee_id', outputKey: 'space_employee_id' }) {
    const matched = rows.filter(row => row.kind === 'matched');
    const extended = rows.filter(row => row.kind === 'extended');
    let samples;
    if (type === 'LEFT') samples = [matched[0], ...extended];
    else if (type === 'RIGHT') samples = [matched[0], matched[matched.length - 1], ...extended];
    else if (type === 'CROSS') samples = [rows[0], rows.find(row => row[example.leftKey] !== row[example.outputKey]), rows[rows.length - 1]];
    else samples = rows;
    return [...new Set(samples.filter(Boolean))].slice(0, 3);
  }

  function visibleConnections(type, rows, selectedRow = rows[0]) {
    // CROSS shows one employee's fan of pairs, not the entire 16-line web.
    return rows.filter(row => row.employeeIndex !== null && row.spaceIndex !== null &&
      (type !== 'CROSS' || row.employeeIndex === selectedRow?.employeeIndex))
      .map(({ employeeIndex, spaceIndex }) => ({ employeeIndex, spaceIndex }));
  }

  // Fictional display-only extensions. The JOIN engine never reads these tables.
  function illustrativeTables(example) {
    const parking = example.id === 'parking';
    const leftDetails = parking ? [
      { last_name: 'Carter', department: 'Marketing', hire_date: '2021-08-16' },
      { last_name: 'Brooks', department: 'Finance', hire_date: '2020-02-10' },
      { last_name: 'Chen', department: 'Operations', hire_date: '2022-06-13' },
      { last_name: 'Rivera', department: 'IT', hire_date: '2023-01-09' }
    ] : [
      { last_name: 'Morgan', city: 'Lexington', joined_date: '2024-03-12' },
      { last_name: 'Patel', city: 'Louisville', joined_date: '2024-07-08' },
      { last_name: 'Reed', city: 'Frankfort', joined_date: '2023-11-20' },
      { last_name: 'Davis', city: 'Bowling Green', joined_date: '2025-01-15' }
    ];
    const rightDetails = parking ? [
      { location: 'North A1', space_type: 'Standard' },
      { location: 'North A2', space_type: 'Standard' },
      { location: 'South B1', space_type: 'Covered' },
      { location: 'South B2', space_type: 'EV charging' }
    ] : [
      { order_date: '2026-09-04', status: 'Delivered', total_amount: 129.95 },
      { order_date: '2026-09-18', status: 'Delivered', total_amount: 49.50 },
      { order_date: '2026-10-02', status: 'Shipped', total_amount: 89.00 },
      { order_date: '2026-10-20', status: 'Processing', total_amount: 249.00 }
    ];
    const extraLeft = parking ? [
      { employee_id: 5, first_name: 'Nora', last_name: 'Ellis', department: 'HR', hire_date: '2024-04-22' },
      { employee_id: 6, first_name: 'Ethan', last_name: 'Shah', department: 'IT', hire_date: '2025-07-14' },
      { employee_id: 7, first_name: 'Sofia', last_name: 'Bennett', department: 'Marketing', hire_date: '2026-02-02' }
    ] : [
      { customer_id: 5, first_name: 'Ava', last_name: 'Foster', city: 'Richmond', joined_date: '2025-05-06' },
      { customer_id: 6, first_name: 'Noah', last_name: 'Kim', city: 'Georgetown', joined_date: '2025-10-21' },
      { customer_id: 7, first_name: 'Mia', last_name: 'Ortiz', city: 'Danville', joined_date: '2026-04-09' }
    ];
    const extraRight = parking ? [
      { space_id: 105, employee_id: 5, location: 'East C1', space_type: 'Standard' },
      { space_id: 106, employee_id: 6, location: 'East C2', space_type: 'Covered' },
      { space_id: 107, employee_id: 7, location: 'West D1', space_type: 'Standard' }
    ] : [
      { order_id: 105, customer_id: 2, order_date: '2026-10-21', status: 'Shipped', total_amount: 64.75 },
      { order_id: 106, customer_id: 5, order_date: '2026-10-23', status: 'Processing', total_amount: 119.00 },
      { order_id: 107, customer_id: 7, order_date: '2026-10-26', status: 'Processing', total_amount: 32.50 }
    ];
    const expand = (originals, details, extra) => Object.freeze([
      // Original attributes take precedence; no sample value may be overwritten.
      ...originals.map((record, index) => Object.freeze({ ...record, ...details[index], ...record })),
      ...extra.map(record => Object.freeze(record))
    ]);
    return Object.freeze({
      left: expand(example.left, leftDetails, extraLeft),
      right: expand(example.right, rightDetails, extraRight)
    });
  }

  return Object.freeze({ sourceRows, introducedFields, representativeRows, visibleConnections, illustrativeTables });
});
