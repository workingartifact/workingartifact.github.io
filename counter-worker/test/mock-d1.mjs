export class MemoryD1 {
  constructor(initialCount = 0) {
    this.count = initialCount;
  }

  prepare(sql) {
    const database = this;
    return {
      bind(artifact) {
        return {
          async first() {
            if (artifact !== "build-the-entity") return null;
            if (sql.startsWith("SELECT")) return { count: database.count };
            if (sql.startsWith("UPDATE")) {
              database.count += 1;
              return { count: database.count };
            }
            throw new Error("Unexpected SQL in test double");
          }
        };
      }
    };
  }
}

export class FailingD1 {
  prepare() {
    return {
      bind() {
        return {
          async first() {
            throw new Error("Database unavailable");
          }
        };
      }
    };
  }
}
