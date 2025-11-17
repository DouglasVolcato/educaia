import { DbConnection } from "./db-connection";

export type InputField = { key: string; value: any };

export abstract class Repository {
  private tableName: string;
  private idField: string;
  private publicFields: string[];
  private insertFields: string[];
  private updateFields: string[];

  public constructor(model: {
    tableName: string;
    idField: string;
    publicFields: string[];
    insertFields: string[];
    updateFields: string[];
  }) {
    this.tableName = model.tableName;
    this.idField = model.idField;
    this.publicFields = model.publicFields;
    this.insertFields = model.insertFields;
    this.updateFields = model.updateFields;
  }

  public async insert(input: { fields: InputField[] }): Promise<void> {
    const { fields, values } = this.extractFieldsFromObject({
      object: input.fields,
      fieldNames: this.insertFields,
    });
    const sqlFields = fields.join(",");
    const placeholders = values.map((_, index) => `$${index + 1}`).join(",");
    const query = `INSERT INTO ${this.tableName} (${sqlFields}) VALUES (${placeholders});`;
    await DbConnection.query({
      sql: query,
      params: values,
    });
  }

  public async update(input: {
    fields: InputField[];
    id: string;
  }): Promise<void> {
    const { fields, values } = this.extractFieldsFromObject({
      object: input.fields,
      fieldNames: this.updateFields,
    });
    const sqlFields = fields
      .map((field, index) => `${field} = $${index + 1}`)
      .join(",");
    const idPlaceholder = `$${fields.length + 1}`;
    const query = `UPDATE ${this.tableName} SET ${sqlFields} WHERE ${this.idField} = ${idPlaceholder};`;
    await DbConnection.query({
      sql: query,
      params: [...values, input.id],
    });
  }

  public async delete(input: { params: InputField[] }): Promise<void> {
    const where = input.params
      .map((param, index) => `${param.key} = $${index + 1}`)
      .join(" AND ");
    const query = `DELETE FROM ${this.tableName} WHERE ${where};`;
    await DbConnection.query({
      sql: query,
      params: input.params.map((param) => param.value),
    });
  }

  public async findOne(input: { params?: InputField[]; orderByAsc?: boolean }): Promise<any | null> {
    const fields = this.publicFields.join(",");
    const params = input.params ?? [];
    const where = params.length
      ? `WHERE ${params.map((param, index) => `${param.key} = $${index + 1}`).join(" AND ")}`
      : "";
    const orderDirection = input.orderByAsc ? "ASC" : "DESC";
    const query = `SELECT ${fields} FROM ${this.tableName} ${where} ORDER BY ${this.idField} ${orderDirection} LIMIT 1;`;
    const result = await DbConnection.query({
      sql: query,
      params: params.map((param) => param.value),
    });
    return result.length === 0 ? null : result[0];
  }

  public async findMany(input: {
    limit: number;
    offset: number;
    params?: InputField[];
    likeParams?: InputField[];
    orderByAsc?: boolean;
  }): Promise<any[]> {
    const fields = this.publicFields.join(",");
    const whereConditions: string[] = [];
    const values: any[] = [];

    let placeholderIndex = 1;

    if (input.params) {
      for (const param of input.params) {
        whereConditions.push(`${param.key} = $${placeholderIndex++}`);
        values.push(param.value);
      }
    }

    if (input.likeParams) {
      for (const param of input.likeParams) {
        if (!param.value) {
          continue;
        }
        whereConditions.push(`${param.key} ILIKE $${placeholderIndex++}`);
        values.push(`%${param.value}%`);
      }
    }

    const limitPlaceholder = `$${placeholderIndex++}`;
    const offsetPlaceholder = `$${placeholderIndex++}`;
    values.push(input.limit, input.offset);

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";

    const query = `
      SELECT ${fields}
      FROM ${this.tableName}
      ${whereClause}
      ORDER BY ${this.idField} ${input.orderByAsc ? "ASC" : "DESC"}
      LIMIT ${limitPlaceholder}
      OFFSET ${offsetPlaceholder};
    `;

    return DbConnection.query({
      sql: query,
      params: values,
    });
  }

  public async executeSql(input: {
    query: string;
    params: any[];
  }): Promise<any[]> {
    return DbConnection.query({ sql: input.query, params: input.params });
  }

  private extractFieldsFromObject(input: {
    object: InputField[];
    fieldNames: string[];
  }) {
    const values: any[] = [];
    const fields: string[] = [];
    for (const fieldName of input.fieldNames) {
      for (const field of input.object) {
        if (field.key === fieldName) {
          fields.push(fieldName);
          values.push(field.value);
        }
      }
    }
    return { fields, values };
  }
}