import { DbConnection } from "./db-connection.js";
export class Repository {
    constructor(model) {
        this.tableName = model.tableName;
        this.idField = model.idField;
        this.publicFields = model.publicFields;
        this.insertFields = model.insertFields;
        this.updateFields = model.updateFields;
    }
    async insert(input) {
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
    async update(input) {
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
    async delete(input) {
        const where = input.params
            .map((param, index) => `${param.key} = $${index + 1}`)
            .join(" AND ");
        const query = `DELETE FROM ${this.tableName} WHERE ${where};`;
        await DbConnection.query({
            sql: query,
            params: input.params.map((param) => param.value),
        });
    }
    async findOne(input) {
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
    async findMany(input) {
        const fields = this.publicFields.join(",");
        const whereConditions = [];
        const values = [];
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
    async executeSql(input) {
        return DbConnection.query({ sql: input.query, params: input.params });
    }
    extractFieldsFromObject(input) {
        const values = [];
        const fields = [];
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
