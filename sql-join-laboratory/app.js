(function () {
  'use strict';
  let engine = window.JoinLab.forExample('parking');
  let example = engine.example;
  const presentation = window.JoinPresentation;
  const $ = selector => document.querySelector(selector);
  const $$ = selector => Array.from(document.querySelectorAll(selector));
  const escapeHTML = value => String(value).replace(/[&<>"']/g, e => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[e]));
  const state = { type: 'INNER', rows: [], selected: 0, source: null, condition: 'ON' };
  let descriptions = {
    INNER: 'Keep only employees with an assigned parking space: Mary and Linda. NULL assignments do not match an employee.',
    LEFT: 'Keep every EMPLOYEE. James and Alex have no assigned space, so the parking-space fields are introduced as NULL.',
    RIGHT: 'Keep every PARKING_SPACE, including unassigned spaces 102 and 104. Their employee fields are introduced as NULL; the space assignment was already NULL in the source.',
    CROSS: 'Pair every employee with every parking space, including unassigned spaces. No ON condition is tested. Stored NULL assignments remain; no NULLs are introduced.'
  };
  const lessons = {
    parking: {
      descriptions,
      integrityTitle: 'Why does RIGHT JOIN produce NULLs here?',
      integrity: 'A parking space may exist without being assigned to an employee. Its employee_id foreign key is nullable. RIGHT JOIN retains every parking space, including unassigned spaces 102 and 104. With no matching employee, the employee columns are introduced as NULL; space_employee_id retains its stored NULL. This is valid data, not a broken relationship.',
      constraintTitle: 'Why are unassigned spaces valid?',
      constraint: '<p><code>PARKING_SPACE.employee_id</code> is a <strong class="concept">nullable foreign key</strong>.</p><ul><li>Assigned spaces reference a valid employee.</li><li><code>NULL</code> means unassigned; multiple unassigned spaces are valid.</li><li><code>UNIQUE</code> limits each employee to one assigned space.</li></ul><p>Spaces <strong>102 and 104</strong> are valid unassigned records.</p>',
      nullNote: '<ul><li><strong>Stored NULL:</strong> Spaces 102 and 104 have no assigned employee.</li><li><code>LEFT JOIN</code>: Missing space fields become <code>NULL</code>.</li><li><code>RIGHT JOIN</code>: Missing employee fields become <code>NULL</code>; the space assignment stays stored <code>NULL</code>.</li><li><code>CROSS JOIN</code>: Stored NULLs repeat; no missing-side NULLs are introduced.</li></ul>'
    },
    customers: {
      descriptions: {
    INNER: 'Keep only pairs with equal customer IDs. Each matching order produces a separate row.',
    LEFT: 'Keep every CUSTOMER record and its matching orders. Without a match, the order fields become NULL.',
    RIGHT: 'Keep every ORDERS record and its matching customer. Because every order references an existing customer, RIGHT JOIN and INNER JOIN return the same rows in this dataset. Different JOIN operations do not always produce different results.',
    CROSS: 'Pair every customer with every order. No ON condition tests the IDs, and no NULLs are introduced.'
  },
      integrityTitle: "Why doesn't RIGHT JOIN produce NULLs here?",
      integrity: 'In this model, every order must have a unique, non-NULL order_id and a non-NULL customer_id referencing an existing customer. Primary-key, NOT NULL, and foreign-key constraints enforce these rules. RIGHT JOIN retains every order, and all four orders have a customer match, so it introduces no NULLs. INNER JOIN returns the same four rows here. These JOINs are not logically equivalent: this dataset and its enforced relationship rules prevent unmatched orders. Other schemas may permit optional relationships.',
      constraintTitle: 'How is customer–order integrity maintained?',
      constraint: '<p><code>ORDERS.customer_id</code> is a <strong class="concept">NOT NULL foreign key</strong>.</p><ul><li>Every order references an existing customer.</li><li>One customer may have multiple orders.</li><li>Customers may have no orders: James and Alex have none.</li></ul><p>Both tables have <strong>unique, non-NULL primary keys</strong>.</p>',
      nullNote: '<ul><li><strong>Source records:</strong> Neither table stores <code>NULL</code> here.</li><li><code>LEFT JOIN</code>: James and Alex have no orders; their order fields become <code>NULL</code>.</li><li><code>RIGHT JOIN</code>: No introduced NULLs: every order has a customer.</li><li><code>CROSS JOIN</code>: No NULLs are introduced.</li></ul>'
    }
  };
  lessons.customers.descriptions.RIGHT = 'Keep every ORDERS record and its matching customer. All four orders have matches in this example.';
  function selectExample(id) {
    engine = window.JoinLab.forExample(id);
    example = engine.example;
    descriptions = lessons[id].descriptions;
    state.source = null; state.selected = 0;
    $('#example-select').value = id;
    renderExampleLabels();
    selectJoin(state.type);
  }

  function renderExampleLabels() {
    $$('.table-label').forEach((label, i) => {
      label.innerHTML = '<strong><button type="button" class="table-view-button" data-table-side="' + (i ? 'right' : 'left') + '" aria-haspopup="dialog" aria-controls="source-viewer" aria-label="View illustrative ' + (i ? example.rightTable : example.leftTable) + ' source table">' + (i ? example.rightTable : example.leftTable) + ' <span aria-hidden="true">▦</span></button></strong><div class="table-meta"><code>' + highlightSQL('AS ' + (i ? example.rightAlias : example.leftAlias)) + '</code><span aria-hidden="true"> · </span><span class="side-label">' + (i ? 'RIGHT' : 'LEFT') + ' TABLE</span></div>';
    });
    $('#employees thead th').childNodes[0].nodeValue = example.leftKey + ' ';
    $('#spaces thead th').childNodes[0].nodeValue = example.rightKey + ' ';
    $('#spaces thead th:nth-child(2)').childNodes[0].nodeValue = example.foreignKey + ' ';
    $('#spaces th:nth-child(2) abbr').title = (example.nullable ? 'Nullable, UNIQUE' : 'NOT NULL') + ' foreign key referencing ' + example.leftTable + '.' + example.leftKey;
    $('#employees caption').textContent = example.leftTable + ' source records; final column annotates participation';
    $('#spaces caption').textContent = example.rightTable + ' source records; final column annotates participation';
    $('#result-employee-group .side-label').textContent = example.leftTable + ' · LEFT';
    $('#result-space-group .side-label').textContent = example.rightTable + ' · RIGHT';
    $('#result-employee-id').textContent = example.leftKey;
    $('#result-space-id').textContent = example.rightKey;
    $('#result-space-employee-id').textContent = example.outputKey;
    $('#result-space-employee-id').title = 'SQL alias for ' + example.rightAlias + '.' + example.foreignKey + ' from ' + example.rightTable;
    $('[data-join="LEFT"] small').textContent = 'Every ' + example.leftNoun;
    $('[data-join="RIGHT"] small').textContent = 'Every ' + example.rightNoun;
    $('.relationship-heading > p').textContent = 'Select ' + example.leftKey + ' or ' + example.rightKey + ' to inspect.';
    $('#data-note-title').textContent = lessons[example.id].constraintTitle;
    const noteHTML = html => html.replace(/<code>(.*?)<\/code>/g, (_, sql) => '<code>' + highlightSQL(sql).replace(/<span class="keyword">NULL<\/span>/g, '<span class="note-null">NULL</span>') + '</code>');
    $('.data-note .note-copy').innerHTML = noteHTML(lessons[example.id].constraint);
    $('.null-note .note-copy').innerHTML = noteHTML(lessons[example.id].nullNote + '<p class="null-definition"><code>NULL</code> means missing or unknown, not zero, empty text, or the string &ldquo;NULL&rdquo;. Equality never matches <code>NULL</code>.</p>');
    $('.order-note p').textContent = 'Every result is sorted by ' + example.leftKey + ', then ' + example.rightKey + ', with NULLs last. The SQL uses the same explicit ORDER BY. A JOIN alone does not guarantee row order.';
  }

  function highlightSQL(text) {
    return text.split(/('(?:''|[^'])*'|\b(?:ORDER BY|IS NULL|NOT NULL|UNIQUE|SELECT|FROM|AS|INNER|LEFT|RIGHT|CROSS|JOIN|ON|USING|NULL)\b|\b(?:[epco]|EMPLOYEE|PARKING_SPACE|CUSTOMER|ORDERS)\.\w+\b|\b[a-z_]\w*\b|\b\d+\b)/g).map(token => {
      const kind = /^(SELECT|FROM|AS|INNER|LEFT|RIGHT|CROSS|JOIN|ON|USING|ORDER BY|IS NULL|NOT NULL|UNIQUE|NULL)$/.test(token) ? 'keyword' : /^[epco]$/.test(token) ? 'sql-alias' : /^[A-Za-z_]\w*(?:\.\w+)?$/.test(token) ? 'identifier' : /^(?:\d+|')/.test(token) ? 'sql-value' : '';
      return kind ? '<span class="' + kind + '">' + escapeHTML(token) + '</span>' : escapeHTML(token);
    }).join('');
  }

  function renderSQL() {
    const available = state.type !== 'CROSS' && example.leftKey === example.foreignKey;
    $('#condition-controls').hidden = !available;
    $$('[data-condition]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.condition === state.condition)));
    $('#condition-note').innerHTML = state.type === 'CROSS'
      ? '<code>' + highlightSQL('CROSS JOIN') + '</code> pairs every combination; no equality condition is used.'
      : '<code>' + highlightSQL('ON') + '</code> compares specified columns. <code>' + highlightSQL('USING') + '</code> is a shorter alternative when both tables share the same column name. With <code>' + highlightSQL('SELECT *') + '</code>, <code>' + highlightSQL('USING') + '</code> presents the shared column once; this lab keeps explicit, qualified selections and output aliases.';
    const sql = engine.sql(state.type, available ? state.condition : 'ON');
    $('#sql-code').innerHTML = highlightSQL(sql);
    $('#copy-status').textContent = '';
    $('#manual-copy').hidden = true;
    $('#sql-fallback').value = sql;
  }

  function renderSources() {
    [['#employees', 'employee', 'employeeIndex'], ['#spaces', 'space', 'spaceIndex']].forEach(([id, side, key]) => {
      const left = side === 'employee';
      const sources = presentation.sourceRows(state.type, state.rows, engine, side);
      const retained = sources.filter(row => row.count > 0).length;
      const unmatched = sources.filter(row => row.status === 'preserved').length;
      const policy = $('#' + side + '-policy');
      const policyText = state.type === 'CROSS' ? 'All ' + retained + ' records paired' : retained === sources.length ? 'All ' + retained + ' records retained' : retained + ' of ' + sources.length + ' records participate';
      policy.innerHTML = '<strong>' + policyText + '</strong><span>' + (unmatched ? unmatched + ' kept without a match' : state.type === 'CROSS' ? 'No ID test' : (sources.length - retained) + ' excluded') + '</span>';
      policy.classList.toggle('has-preserved', unmatched > 0);
      policy.classList.toggle('is-cross', state.type === 'CROSS');
      $(id + ' tbody').innerHTML = sources.map(({ record, index, count, status: kind }) => {
        const nullable = !left && record[example.foreignKey] === null;
        const label = (nullable ? 'Unassigned space; stored employee_id is NULL. ' : '') + (kind === 'excluded' ? 'No ID match; excluded' : kind === 'preserved' ? 'No ID match; source record kept, missing opposite side becomes NULL' : kind === 'product' ? 'Paired with every record on the other side; no ID test' : 'Matching key relationship') + '; ' + count + ' result ' + (count === 1 ? 'row' : 'rows');
        const selected = state.rows[state.selected];
        const inspected = state.source?.side === side && state.source.index === index;
        const focused = selected?.[key] === index || (!selected && inspected) ? ' focused' : '';
        const crossClass = state.type === 'CROSS' ? (!left ? ' paired' : selected?.employeeIndex === index ? ' cross-origin' : '') : '';
        const values = left ? [record[example.leftKey], record.first_name] : [record[example.rightKey], record[example.foreignKey]];
        const badge = kind === 'excluded' ? '− Excluded' : kind === 'preserved' ? '+ Kept' : kind === 'product' ? '× Paired' : '• ' + count + (count === 1 ? ' match' : ' matches');
        const name = left ? example.leftTable + ' ' + values[0] + ' · ' + record.first_name : example.rightTable + ' ' + values[0] + ' · ' + example.foreignKey + ' ' + (nullable ? 'NULL (unassigned)' : values[1]);
        return '<tr class="' + kind + focused + crossClass + '" data-source-index="' + index + '"><td><button type="button" class="source-select" aria-label="Inspect ' + escapeHTML(name) + '" aria-pressed="' + inspected + '">' + values[0] + '</button></td><td>' + displayValue(values[1]) + '</td><td><span class="row-status" title="' + label + '"><span aria-hidden="true">' + badge + '</span><span class="sr-only">' + label + '</span></span></td></tr>';
      }).join('');
    });
    $('.source-panel').classList.toggle('is-cross', state.type === 'CROSS');
  }

  function displayValue(value, introduced = false) {
    const origin = introduced ? 'Introduced by this JOIN: no matching source record' : 'Stored NULL in ' + example.rightTable + '.' + example.foreignKey + ': unassigned space';
    return value === null ? '<span class="null" data-null-origin="' + (introduced ? 'join' : 'source') + '" title="' + origin + '" aria-label="SQL NULL. ' + origin + '">NULL</span>' : escapeHTML(value);
  }

  function renderResult() {
    const emphasis = state.type === 'LEFT' ? 'employee' : state.type === 'RIGHT' ? 'space' : 'both';
    $('.result-table').dataset.emphasis = emphasis;
    for (const source of ['employee', 'space']) {
      const retained = emphasis === source;
      $('#result-' + source + '-policy').textContent = retained ? 'All rows retained' : state.type === 'CROSS' ? 'Every pairing' : 'Matching records';
    }
    $('#result-count').textContent = state.rows.length + ' rows';
    $('#operation-label').textContent = state.type + ' JOIN';
    $('#result-explanation').textContent = descriptions[state.type];
    $('#integrity-explanation').hidden = state.type !== 'RIGHT';
    $('#integrity-title').textContent = lessons[example.id].integrityTitle;
    $('#integrity-copy').textContent = lessons[example.id].integrity;
    $('.relationship-lab').dataset.operation = state.type;
    const matched = state.rows.filter(row => row.kind === 'matched').length;
    const kept = state.rows.filter(row => row.kind === 'extended').length;
    $('#result-breakdown').textContent = state.type === 'CROSS' ? engine.employees.length + ' × ' + engine.spaces.length + ' = ' + state.rows.length + ' pairs · no matching condition' : matched + ' matching pairs' + (kept ? ' + ' + kept + ' unmatched ' + (state.type === 'LEFT' ? example.leftPlural : example.rightPlural) + ' retained' : ' · unmatched records excluded');
    $('#result-caption').textContent = state.type + ' JOIN result, ' + state.rows.length + ' rows. ' + example.leftTable + ' on the left supplies ' + example.leftKey + ' and first_name. ' + example.rightTable + ' on the right supplies ' + example.rightKey + ' and ' + example.outputKey + ', the alias for ' + example.rightAlias + '.' + example.foreignKey + '. TRACE is an interface control. Use a trace button to inspect a result row.';
    $('#result-body').innerHTML = state.rows.map((row, index) => {
      const missing = presentation.introducedFields(row, example);
      const side = row.employeeIndex === null ? 'employee' : row.spaceIndex === null ? 'space' : '';
      const cells = [example.leftKey, 'first_name', example.rightKey, example.outputKey].map((key, column) => {
        const source = column < 2 ? 'employee' : 'space';
        const header = ['result-employee-id', 'result-first-name', 'result-space-id', 'result-space-employee-id'][column];
        const classes = [column === 2 ? 'source-divider' : '', missing.includes(key) ? 'null-cell' : ''].filter(Boolean).join(' ');
        const attrs = ' data-source="' + source + '" headers="result-' + source + '-group ' + header + '" class="' + classes + '"' + (missing.includes(key) ? ' title="Introduced by the JOIN: no matching ' + (column < 2 ? example.leftNoun : example.rightNoun) + ' record"' : '');
        return '<td' + attrs + '>' + displayValue(row[key], missing.includes(key)) + '</td>';
      }).join('');
      const status = row.kind === 'extended' ? 'Preserved without match' : row.kind === 'product' ? 'Cartesian pair' : 'Matching pair';
      return '<tr data-row="' + index + '" data-missing-side="' + side + '" class="' + row.kind + (index === state.selected ? ' selected' : '') + '"><td headers="result-trace"><button type="button" class="trace-button" title="' + status + '" aria-label="Trace result row ' + (index + 1) + '" aria-pressed="' + (index === state.selected) + '">' + String(index + 1).padStart(2, '0') + (row.kind === 'extended' ? ' +' : '') + '</button></td>' + cells + '</tr>';
    }).join('');
    const extended = state.rows.filter(row => row.kind === 'extended').length;
    const stored = state.rows.filter(row => row.spaceIndex !== null && row[example.outputKey] === null).length;
    $('#null-count').textContent = (extended ? extended + ' NULL-extended ' + (extended === 1 ? 'row' : 'rows') : 'No introduced NULLs') + (stored ? ' · ' + stored + ' stored NULLs' : '');
  }

  function traceCards(e, p, excluded = false) {
    const cross = state.type === 'CROSS', matched = e && p && engine.matches(e, p);
    const field = (name, value, key = '', joinKey = false) => '<p class="trace-field' + (joinKey ? ' join-key' : '') + '"><code>' + highlightSQL(name) + (key ? ' <abbr title="' + (key === 'PK' ? 'Primary key' : 'Foreign key') + '">' + key + '</abbr>' : '') + ' = ' + (value === null ? displayValue(null) : highlightSQL(typeof value === 'string' ? "'" + value.replace(/'/g, "''") + "'" : String(value))) + '</code>' + (value === null ? '<small>Stored NULL · unassigned</small>' : '') + '</p>';
    const missing = (side, fields) => '<strong>No matching row</strong><p>' + (excluded ? 'No matching ' + side + ' record' : 'Missing source · JOIN introduces NULLs') + '</p>' + (excluded ? '' : fields.map(name => '<p><code>' + highlightSQL(name + ' = NULL') + '</code></p>').join(''));
    const card = (table, alias, record, content) => '<div class="trace-record' + (!record ? (excluded ? ' unmatched' : ' missing') : '') + '"><small>' + table + ' · <code class="sql-alias">' + alias + '</code></small>' + content + '</div>';
    const left = e ? field(example.leftKey, e[example.leftKey], 'PK', true) + field('first_name', e.first_name) : missing(example.leftTable, [example.leftKey, 'first_name']);
    const right = p ? field(example.rightKey, p[example.rightKey], 'PK') + field(example.foreignKey, p[example.foreignKey], 'FK', true) + '<p class="attribute-alias">' + (excluded ? 'SQL alias (no output row):' : 'Output alias:') + '<br><code>' + highlightSQL(example.outputKey + ' = ' + (p[example.foreignKey] === null ? 'NULL' : p[example.foreignKey])) + '</code></p>' : missing(example.rightTable, [example.rightKey, example.outputKey]);
    const mode = cross ? 'cross' : matched ? 'match' : 'no-match';
    const label = cross ? 'Every combination' : matched ? 'Equal JOIN keys' : 'No equality match';
    const comparison = cross ? (matched ? 'IDs happen to be equal' : p?.[example.foreignKey] === null ? 'Stored NULL cannot equal an ID' : 'IDs differ') + ' · no test required' : excluded ? 'Excluded · no output row' : matched ? 'FK references PK' : 'Preserved side kept · missing side is NULL';
    const relation = '<div class="trace-relationship ' + mode + '"><strong>' + label + '</strong><code>' + highlightSQL(example.leftAlias + '.' + example.leftKey) + ' <b>' + (cross ? '×' : matched ? '=' : '∅') + '</b> ' + highlightSQL(example.rightAlias + '.' + example.foreignKey) + '</code><small>' + comparison + '</small></div>';
    return '<div class="trace-equation ' + mode + '">' + card(example.leftTable, example.leftAlias, e, left) + card(example.rightTable, example.rightAlias, p, right) + relation + '</div>';
  }

  function highlightExpressions(html) {
    return html.replace(/\b(?:[epco]\.\w+|(?:EMPLOYEE|PARKING_SPACE|CUSTOMER|ORDERS)\.\w+|employee_id|customer_id|space_id|order_id|space_employee_id|order_customer_id|first_name)(?: = (?:\d+|NULL))?/g,
      expression => '<code>' + highlightSQL(expression) + '</code>');
  }

  function renderTrace() {
    const row = state.rows[state.selected];
    $('.trace-panel').classList.toggle('is-excluded', !row);
    $('#trace-kind').textContent = state.source ? 'SOURCE INSPECTION' : 'ROW TRACE';
    if (!row) { renderExcludedSource(); return; }
    const e = row.employeeIndex === null ? null : engine.employees[row.employeeIndex];
    const p = row.spaceIndex === null ? null : engine.spaces[row.spaceIndex];
    $('.trace-panel').classList.toggle('has-null', !e || !p);
    $('.trace-panel').classList.toggle('is-cross', state.type === 'CROSS');
    let explanation, kicker;
    if (!e) {
      kicker = 'UNASSIGNED SPACE · PRESERVED';
      explanation = '<strong>' + example.rightKey + ' = ' + p[example.rightKey] + ' is unassigned.</strong> ' + example.rightTable + '.' + example.foreignKey + ' is stored NULL, which cannot match an ' + example.leftTable + '.' + example.leftKey + ' through equality. RIGHT JOIN keeps this valid space and introduces NULL for ' + example.leftKey + ' and first_name. ' + example.outputKey + ' retains its stored NULL.';
    } else if (!p) {
      kicker = example.leftTable + ' WITHOUT ' + example.rightNoun.toUpperCase() + ' · PRESERVED';
      explanation = '<strong>first_name = ' + escapeHTML(e.first_name) + ', ' + example.leftKey + ' = ' + e[example.leftKey] + ' has no matching ' + example.rightTable + ' record.</strong> No ' + example.rightAlias + '.' + example.foreignKey + ' equals ' + e[example.leftKey] + '. LEFT JOIN preserves this ' + example.leftTable + ' record and introduces NULL for ' + example.rightKey + ' and ' + example.outputKey + '.' + (example.nullable ? ' It does not pair this employee with an unassigned space.' : '');
    } else if (state.type === 'CROSS') {
      kicker = 'CARTESIAN PAIR · NO MATCH REQUIRED';
      explanation = '<strong>' + example.leftKey + ' = ' + e[example.leftKey] + ' (first_name = ' + escapeHTML(e.first_name) + ') is paired with ' + example.rightKey + ' = ' + p[example.rightKey] + '.</strong> CROSS JOIN pairs every ' + example.leftNoun + ' with every ' + example.rightNoun + ' without an ON condition. ' + (p[example.foreignKey] === null ? example.outputKey + ' remains the stored NULL assignment: this space is unassigned, and the pairing does not create an assignment.' : engine.matches(e, p) ? 'The IDs happen to be equal, but no equality test is required.' : example.leftAlias + '.' + example.leftKey + ' = ' + e[example.leftKey] + ' differs from ' + example.rightAlias + '.' + example.foreignKey + ' = ' + p[example.foreignKey] + '; this pair does not create a source relationship.') + ' No NULLs are introduced.';
    } else {
      kicker = 'MATCHING PAIR · PRESERVED';
      const others = engine.spaces.filter(record => engine.matches(e, record) && record[example.rightKey] !== p[example.rightKey]);
      explanation = '<strong>' + example.leftKey + ' = ' + e[example.leftKey] + ' (first_name = ' + escapeHTML(e.first_name) + ') matches ' + example.rightKey + ' = ' + p[example.rightKey] + '.</strong> ' + example.leftAlias + '.' + example.leftKey + ' and ' + example.rightAlias + '.' + example.foreignKey + ' both equal ' + e[example.leftKey] + ', so the equality condition is true. ' + example.rightTable + '.' + example.foreignKey + ' is shown as ' + example.outputKey + '. ' + (example.unique ? 'The non-NULL assignment is unique, so this employee has one assigned space.' : others.map(record => 'Another match at ' + example.rightKey + ' = ' + record[example.rightKey] + ' produces a separate result row.').join(' '));
    }
    $('#trace-content').innerHTML = '<p class="trace-kicker">' + kicker + '</p>' + traceCards(e, p) + '<p class="trace-explanation">' + highlightExpressions(explanation) + '</p>';
    $('#trace-position').textContent = (state.selected + 1) + ' / ' + state.rows.length;
    const candidates = traceCandidates(), position = candidates.indexOf(state.selected);
    $('#previous-row').disabled = position <= 0;
    $('#next-row').disabled = position === candidates.length - 1;
    const context = state.source ? ' involving this selected source record' : '';
    $('#previous-row').setAttribute('aria-label', 'Trace previous result row' + context);
    $('#next-row').setAttribute('aria-label', 'Trace next result row' + context);
    $('#takeaway').textContent = !e
      ? 'INNER and LEFT exclude unassigned ' + example.rightKey + ' = ' + p[example.rightKey] + '. CROSS pairs it with all four ' + example.leftPlural + ' while keeping its stored NULL assignment.'
      : !p
      ? 'INNER and RIGHT exclude ' + example.leftKey + ' = ' + e[example.leftKey] + '. CROSS pairs this ' + example.leftNoun + ' with all four ' + example.rightPlural + ', without generating NULLs or creating a source relationship.'
      : engine.matches(e, p)
      ? 'This matching pair appears in INNER, LEFT, RIGHT, and CROSS. Only CROSS includes combinations without an equality match.'
      : 'INNER, LEFT, and RIGHT do not include this combination. CROSS pairs the source records without requiring an equality match.';
    $('#trace-kind').textContent = state.source ? 'Source inspection · result ' + (state.selected + 1) : 'Result row ' + (state.selected + 1);
  }

  function traceCandidates() {
    const key = state.source?.side === 'employee' ? 'employeeIndex' : 'spaceIndex';
    return state.rows.flatMap((row, index) => !state.source || row[key] === state.source.index ? [index] : []);
  }

  function renderExcludedSource() {
    const left = state.source.side === 'employee';
    const record = (left ? engine.employees : engine.spaces)[state.source.index];
    const name = left ? example.leftKey + ' = ' + record[example.leftKey] + ' (first_name = ' + record.first_name + ')' : example.rightKey + ' = ' + record[example.rightKey] + ' (' + example.rightAlias + '.' + example.foreignKey + ' = ' + (record[example.foreignKey] === null ? 'NULL' : record[example.foreignKey]) + ')';
    const reason = left ? 'No ' + example.rightTable + '.' + example.foreignKey + ' equals ' + record[example.leftKey] + '.' : 'This space is unassigned: its stored ' + example.foreignKey + ' is NULL, which cannot match through equality.';
    const explanation = name + ' is excluded under ' + state.type + ' JOIN. ' + reason + ' This operation does not preserve this unmatched source. There is no output row and no NULL extension for this record.';
    $('.trace-panel').classList.remove('has-null', 'is-cross');
    $('#trace-content').innerHTML = '<p class="trace-kicker">EXCLUDED SOURCE · NOT AN OUTPUT ROW</p>' + traceCards(left ? record : null, left ? null : record, true) + '<p class="trace-explanation">' + highlightExpressions(escapeHTML(explanation)) + '</p>';
    $('#trace-position').textContent = 'No output row';
    $('#previous-row').disabled = $('#next-row').disabled = true;
    $('#takeaway').textContent = left ? 'LEFT preserves this ' + example.leftNoun + ' with NULL ' + example.rightNoun + ' fields. CROSS pairs this record with all four ' + example.rightPlural + '.' : 'RIGHT preserves this unassigned space and introduces NULL employee fields; its assignment stays stored NULL. CROSS pairs it with all four employees.';
  }

  function selectSource(side, index) {
    const page = {left:window.scrollX, top:window.scrollY}, x = $('.source-scroll').scrollLeft;
    state.source = {side,index};
    state.selected = traceCandidates()[0] ?? null;
    renderSources(); renderResult(); renderTrace();
    revealSelectedResult();
    $('.source-scroll').scrollLeft = x;
    $(side === 'employee' ? '#employees' : '#spaces').querySelector('[data-source-index="' + index + '"] .source-select').focus({preventScroll:true});
    window.scrollTo({...page,behavior:'instant'});
  }

  function selectRow(index, retainSource = false) {
    if (!retainSource) state.source = null;
    state.selected = index;
    $$('#result-body tr').forEach((tr, i) => {
      tr.classList.toggle('selected', i === index);
      tr.querySelector('button').setAttribute('aria-pressed', String(i === index));
    });
    renderSources(); renderTrace();
    revealSelectedResult();
  }

  function revealSelectedResult() {
    // Reveal only inside the result viewport, without jumping the whole page.
    const viewport = $('.result-scroll');
    const selectedRow = $('#result-body tr.selected');
    if (!selectedRow) return;
    const box = viewport.getBoundingClientRect();
    const rowBox = selectedRow.getBoundingClientRect();
    const headerHeight = $('.result-table thead').getBoundingClientRect().height;
    if (rowBox.top < box.top + headerHeight) viewport.scrollTop += rowBox.top - box.top - headerHeight;
    else if (rowBox.bottom > box.bottom) viewport.scrollTop += rowBox.bottom - box.bottom;
  }

  function selectJoin(type) {
    const pagePosition = { left: window.scrollX, top: window.scrollY };
    const trace = $('.trace-panel');
    const traceBox = trace.getBoundingClientRect();
    const readingTrace = traceBox.top <= window.innerHeight / 2 && traceBox.bottom > window.innerHeight / 2;
    const demonstration = readingTrace ? trace : $('.relationship-lab');
    const demonstrationTop = demonstration.getBoundingClientRect().top;
    const anchorDemonstration = demonstrationTop < window.innerHeight && $('.result-panel').getBoundingClientRect().top <= 21;
    const sourceScrollLeft = $('.source-scroll').scrollLeft;
    state.type = type;
    state.selected = 0;
    state.rows = engine.join(type);
    if (state.source) state.selected = traceCandidates()[0] ?? null;
    $$('.join-choices [data-join]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.join === type)));
    renderSQL();
    renderSources(); renderResult(); renderTrace();
    $('.result-scroll').scrollTop = 0;
    $('.result-scroll').scrollLeft = 0;
    if (state.source) revealSelectedResult();
    $('.source-scroll').scrollLeft = sourceScrollLeft;
    // Adaptive results can change the height above the source demonstration.
    // Keep the source demonstration (or the trace currently being read) in place;
    // near the page top, retain the ordinary document scroll position instead.
    const heightChange = anchorDemonstration ? demonstration.getBoundingClientRect().top + window.scrollY - demonstrationTop - pagePosition.top : 0;
    window.scrollTo({ left: pagePosition.left, top: pagePosition.top + heightChange, behavior: 'instant' });
  }

  const sourceViewer = $('#source-viewer');
  let viewerOrigin = null, backdropPointer = false;
  function openSourceViewer(button) {
    const left = button.dataset.tableSide === 'left';
    const expanded = presentation.illustrativeTables(example);
    const records = left ? expanded.left : expanded.right;
    const table = left ? example.leftTable : example.rightTable;
    const primaryKey = left ? example.leftKey : example.rightKey;
    // Only the pop-out uses this expanded fictional view; JOIN sample data stays unchanged.
    const fields = [...new Set(records.flatMap(record => Object.keys(record)))];
    viewerOrigin = button;
    $('#source-viewer-title').textContent = table + ' — Source Table';
    $('#source-viewer-meta').innerHTML = '<code>' + highlightSQL('AS ' + (left ? example.leftAlias : example.rightAlias)) + '</code> · ' + records.length + ' illustrative records · ' + fields.length + ' attributes';
    $('#source-viewer-caption').textContent = table + ': illustrative database view including all JOIN sample records';
    $('#source-viewer thead').innerHTML = '<tr>' + fields.map(field => {
      const pk = field === primaryKey, fk = !left && field === example.foreignKey;
      const key = pk ? 'PK' : fk ? 'FK' : '';
      const description = pk ? 'Primary key: unique and non-NULL' : fk ? (example.nullable ? 'Nullable, UNIQUE' : 'NOT NULL') + ' foreign key referencing ' + example.leftTable + '.' + example.leftKey : '';
      return '<th scope="col"><code>' + highlightSQL(field) + '</code>' + (key ? ' <abbr title="' + escapeHTML(description) + '">' + key + '</abbr>' : '') + '</th>';
    }).join('') + '</tr>';
    $('#source-viewer tbody').innerHTML = records.map(record => '<tr>' + fields.map(field => '<td>' + displayValue(record[field]) + '</td>').join('') + '</tr>').join('');
    $('#source-viewer-null').hidden = left || !example.nullable;
    $('.viewer-scroll').scrollLeft = $('.viewer-scroll').scrollTop = 0;
    document.body.classList.add('source-view-open');
    sourceViewer.showModal();
    $('#source-viewer-close').focus({preventScroll:true});
  }
  function outsideViewer(event) {
    const box = sourceViewer.getBoundingClientRect();
    return event.target === sourceViewer && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom);
  }
  $('.source-canvas').addEventListener('click', event => {
    const button = event.target.closest('[data-table-side]');
    if (button) openSourceViewer(button);
  });
  $('#source-viewer-close').addEventListener('click', () => sourceViewer.close());
  sourceViewer.addEventListener('cancel', event => { event.preventDefault(); sourceViewer.close(); });
  sourceViewer.addEventListener('pointerdown', event => { backdropPointer = outsideViewer(event); });
  sourceViewer.addEventListener('click', event => {
    if (backdropPointer && outsideViewer(event)) sourceViewer.close();
    backdropPointer = false;
  });
  sourceViewer.addEventListener('close', () => {
    document.body.classList.remove('source-view-open');
    viewerOrigin?.focus({preventScroll:true});
    viewerOrigin = null;
  });

  $$('.join-choices [data-join]').forEach(button => button.addEventListener('click', () => selectJoin(button.dataset.join)));
  $('#result-body').addEventListener('click', event => {
    const tr = event.target.closest('[data-row]');
    if (tr) selectRow(Number(tr.dataset.row));
  });
  for (const [selector, step] of [['#previous-row',-1],['#next-row',1]]) $(selector).addEventListener('click', () => {
    const candidates = traceCandidates(), next = candidates.indexOf(state.selected) + step;
    if (next >= 0 && next < candidates.length) selectRow(candidates[next], true);
  });
  for (const [selector,side] of [['#employees','employee'],['#spaces','space']]) $(selector).addEventListener('click', event => {
    const row = event.target.closest('tbody tr[data-source-index]');
    if (row) selectSource(side, Number(row.dataset.sourceIndex));
  });
  $('#theme').addEventListener('click', () => {
    const light = document.documentElement.dataset.theme !== 'light';
    document.documentElement.dataset.theme = light ? 'light' : 'dark';
    $('#theme').textContent = light ? 'Dark mode' : 'Light mode';
    $('#theme').setAttribute('aria-pressed', String(light));
  });
  $('#copy').addEventListener('click', async () => {
    const sql = $('#sql-code').textContent;
    try {
      if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(sql);
      $('#copy-status').textContent = 'SQL copied to clipboard.';
      $('#manual-copy').hidden = true;
    } catch (_) {
      $('#sql-fallback').value = sql;
      $('#manual-copy').hidden = false;
      $('#copy-status').textContent = 'Use the selected text below to copy manually.';
      $('#sql-fallback').focus(); $('#sql-fallback').select();
    }
  });
  $('#reset').addEventListener('click', () => {
    state.source = null;
    $$('details').forEach(detail => { detail.open = false; });
    document.documentElement.dataset.theme = 'dark';
    $('#theme').textContent = 'Light mode'; $('#theme').setAttribute('aria-pressed', 'false');
    state.type = 'INNER'; state.condition = 'ON'; selectExample('parking');
  });
  $$('[data-condition]').forEach(button => button.addEventListener('click', () => {
    state.condition = button.dataset.condition;
    renderSQL();
  }));
  $('#example-select').addEventListener('change', event => selectExample(event.target.value));
  selectExample('parking');
})();
