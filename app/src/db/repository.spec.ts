import { DbConnection } from "./db-connection";
import { FakeData } from "../tests/fake-data";
import { Repository } from "./repository";

jest.mock("./db-connection", () => ({
  DbConnection: {
    connect: jest.fn(),
    disconnect: jest.fn(),
    startTransaction: jest.fn(),
    commit: jest.fn(),
    rollback: jest.fn(),
    query: jest.fn(),
  },
}));

class RepositoryStup extends Repository {
  constructor(
    tableName: string,
    idField: string,
    publicFields: string[],
    insertFields: string[],
    updateFields: string[],
  ) {
    super({
      tableName,
      idField,
      publicFields,
      insertFields,
      updateFields,
    });
  }
}

type SutTypes = {
  sut: RepositoryStup;
};

const makeSut = (
  tableName: string,
  idField: string,
  publicFields: string[],
  insertFields: string[],
  updateFields: string[],
): SutTypes => {
  const sut = new RepositoryStup(
    tableName,
    idField,
    publicFields,
    insertFields,
    updateFields,
  );
  return { sut };
}

describe("Repository", () => {
  const dbQueryMock = DbConnection.query as jest.MockedFunction<typeof DbConnection.query>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Constructor", () => {
    test("Should create a new repository with given properties", () => {
      const tableName = FakeData.word();
      const idField = FakeData.word();
      const publicFields = [FakeData.word(), FakeData.word()];
      const insertFields = [FakeData.word()];
      const updateFields = [FakeData.word(), FakeData.word()];

      const { sut } = makeSut(tableName, idField, publicFields, insertFields, updateFields);

      expect((sut as any).tableName).toBe(tableName);
      expect((sut as any).idField).toBe(idField);
      expect((sut as any).publicFields).toEqual(publicFields);
      expect((sut as any).insertFields).toEqual(insertFields);
      expect((sut as any).updateFields).toEqual(updateFields);
    })
  })

  describe("Insert", () => {
    test("Should call connection query with right values", async () => {
      const tableName = FakeData.word();
      const idField = FakeData.word();
      const publicFields = [FakeData.word()];
      const insertFields = [FakeData.word(), FakeData.word()];
      const updateFields = insertFields;
      const { sut } = makeSut(tableName, idField, publicFields, insertFields, updateFields);
      const fields = [
        { key: insertFields[0], value: FakeData.word() },
        { key: insertFields[1], value: FakeData.word() },
        { key: FakeData.word(), value: FakeData.word() },
      ];
      dbQueryMock.mockResolvedValueOnce([]);

      await sut.insert({ fields });

      const expectedSql = `INSERT INTO ${tableName} (${insertFields.join(",")}) VALUES ($1,$2);`;
      const expectedParams = insertFields.map(
        (fieldName) => fields.find((field) => field.key === fieldName)!.value,
      );

      expect(DbConnection.query).toHaveBeenCalledWith({
        sql: expectedSql,
        params: expectedParams,
      });
    })

    test("Should throw if connection query throws", async () => {
      const tableName = FakeData.word();
      const idField = FakeData.word();
      const fields = [FakeData.word(), FakeData.word(), FakeData.word()];
      const insertFields = [fields[0], fields[1]];
      const { sut } = makeSut(tableName, idField, [], insertFields, insertFields);
      const error = new Error(FakeData.phrase());
      dbQueryMock.mockRejectedValueOnce(error);
      const params = insertFields.map((field) => ({ key: field, value: FakeData.word() }));

      await expect(sut.insert({ fields: params })).rejects.toThrow(error);
    })

    test("Should throw if extractFieldsFromObject throws", async () => {
      const tableName = FakeData.word();
      const idField = FakeData.word();
      const insertFields = [FakeData.word()];
      const { sut } = makeSut(tableName, idField, [], insertFields, insertFields);
      const error = new Error(FakeData.phrase());
      const spy = jest
        .spyOn(sut as any, "extractFieldsFromObject")
        .mockImplementationOnce(() => {
          throw error;
        });

      await expect(
        sut.insert({ fields: [{ key: insertFields[0], value: FakeData.word() }] }),
      ).rejects.toThrow(error);

      spy.mockRestore();
    })
  })

  describe("Update", () => {
    test("Should call connection query with right values", async () => {
      const tableName = FakeData.word();
      const idField = FakeData.word();
      const updateFields = [FakeData.word(), FakeData.word()];
      const { sut } = makeSut(tableName, idField, [], updateFields, updateFields);
      const fieldValues = updateFields.map((field) => ({
        key: field,
        value: FakeData.word(),
      }));
      dbQueryMock.mockResolvedValueOnce([]);
      const idValue = FakeData.uuid();

      await sut.update({ fields: fieldValues, id: idValue });

      const sqlFields = `${updateFields[0]} = $1,${updateFields[1]} = $2`;
      const expectedSql = `UPDATE ${tableName} SET ${sqlFields} WHERE ${idField} = $3;`;
      const expectedParams = [...fieldValues.map((field) => field.value), idValue];

      expect(DbConnection.query).toHaveBeenCalledWith({
        sql: expectedSql,
        params: expectedParams,
      });
    })

    test("Should throw if connection query throws", async () => {
      const tableName = FakeData.word();
      const idField = FakeData.word();
      const updateFields = [FakeData.word()];
      const { sut } = makeSut(tableName, idField, [], updateFields, updateFields);
      const error = new Error(FakeData.phrase());
      dbQueryMock.mockRejectedValueOnce(error);

      await expect(
        sut.update({
          fields: [{ key: updateFields[0], value: FakeData.word() }],
          id: FakeData.uuid(),
        }),
      ).rejects.toThrow(error);
    })

    test("Should throw if extractFieldsFromObject throws", async () => {
      const tableName = FakeData.word();
      const idField = FakeData.word();
      const updateFields = [FakeData.word()];
      const { sut } = makeSut(tableName, idField, [], updateFields, updateFields);
      const error = new Error(FakeData.phrase());
      const spy = jest
        .spyOn(sut as any, "extractFieldsFromObject")
        .mockImplementationOnce(() => {
          throw error;
        });

      await expect(
        sut.update({
          fields: [{ key: updateFields[0], value: FakeData.word() }],
          id: FakeData.uuid(),
        }),
      ).rejects.toThrow(error);

      spy.mockRestore();
    })
  })

  describe("Delete", () => {
    test("Should call connection query with right values", async () => {
      const tableName = FakeData.word();
      const idField = FakeData.word();
      const { sut } = makeSut(tableName, idField, [], [], []);
      const params = [
        { key: FakeData.word(), value: FakeData.word() },
        { key: FakeData.word(), value: FakeData.word() },
      ];
      dbQueryMock.mockResolvedValueOnce([]);

      await sut.delete({ params });

      const where = `${params[0].key} = $1 AND ${params[1].key} = $2`;
      const expectedSql = `DELETE FROM ${tableName} WHERE ${where};`;

      expect(DbConnection.query).toHaveBeenCalledWith({
        sql: expectedSql,
        params: params.map((param) => param.value),
      });
    })

    test("Should throw if connection query throws", async () => {
      const tableName = FakeData.word();
      const idField = FakeData.word();
      const { sut } = makeSut(tableName, idField, [], [], []);
      const error = new Error(FakeData.phrase());
      dbQueryMock.mockRejectedValueOnce(error);

      await expect(
        sut.delete({
          params: [{ key: FakeData.word(), value: FakeData.word() }],
        }),
      ).rejects.toThrow(error);
    })
  })

  describe("FindOne", () => {
    test("Should call connection query with right values", async () => {
      const tableName = FakeData.word();
      const idField = FakeData.word();
      const publicFields = [FakeData.word(), FakeData.word()];
      const { sut } = makeSut(tableName, idField, publicFields, [], []);
      const params = [
        { key: FakeData.word(), value: FakeData.word() },
        { key: FakeData.word(), value: FakeData.word() },
      ];
      dbQueryMock.mockResolvedValueOnce([]);

      await sut.findOne({ params });

      const where = `${params[0].key} = $1 AND ${params[1].key} = $2`;
      const expectedSql = `SELECT ${publicFields.join(",")} FROM ${tableName} WHERE ${where} ORDER BY ${idField} DESC LIMIT 1;`;
      const expectedParams = params.map((param) => param.value);

      expect(DbConnection.query).toHaveBeenCalledWith({
        sql: expectedSql,
        params: expectedParams,
      });
    })

    test("Should throw if connection query throws", async () => {
      const tableName = FakeData.word();
      const idField = FakeData.word();
      const publicFields = [FakeData.word()];
      const { sut } = makeSut(tableName, idField, publicFields, [], []);
      const error = new Error(FakeData.phrase());
      dbQueryMock.mockRejectedValueOnce(error);

      await expect(
        sut.findOne({ params: [{ key: FakeData.word(), value: FakeData.word() }] }),
      ).rejects.toThrow(error);
    })

    test("Should allow calling without params", async () => {
      const tableName = FakeData.word();
      const idField = FakeData.word();
      const publicFields = [FakeData.word()];
      const { sut } = makeSut(tableName, idField, publicFields, [], []);
      const row = { id: FakeData.uuid() };
      dbQueryMock.mockResolvedValueOnce([row]);

      const result = await sut.findOne({ orderByAsc: true });

      expect(result).toEqual(row);
      expect(DbConnection.query).toHaveBeenCalledWith({
        sql: `SELECT ${publicFields.join(",")} FROM ${tableName}  ORDER BY ${idField} ASC LIMIT 1;`,
        params: [],
      });
    })

    test("Should return null if connection query has no results", async () => {
      const tableName = FakeData.word();
      const idField = FakeData.word();
      const publicFields = [FakeData.word()];
      const { sut } = makeSut(tableName, idField, publicFields, [], []);
      dbQueryMock.mockResolvedValueOnce([]);

      const result = await sut.findOne({
        params: [{ key: FakeData.word(), value: FakeData.word() }],
      });

      expect(result).toBeNull();
    })

    test("Should return what connection query first row", async () => {
      const tableName = FakeData.word();
      const idField = FakeData.word();
      const publicFields = [FakeData.word()];
      const { sut } = makeSut(tableName, idField, publicFields, [], []);
      const row = { id: FakeData.uuid(), name: FakeData.word() };
      dbQueryMock.mockResolvedValueOnce([row]);

      const result = await sut.findOne({
        params: [{ key: FakeData.word(), value: FakeData.word() }],
      });

      expect(result).toBe(row);
    })
  })

  describe("FindMany", () => {
    test("Should call connection query with right values", async () => {
      const tableName = FakeData.word();
      const idField = FakeData.word();
      const publicFields = [FakeData.word(), FakeData.word(), FakeData.word()];
      const { sut } = makeSut(tableName, idField, publicFields, [], []);
      const params = [
        { key: FakeData.word(), value: FakeData.word() },
        { key: FakeData.word(), value: FakeData.word() },
      ];
      const likeParams = [{ key: FakeData.word(), value: FakeData.word() }];
      const limit = 10;
      const offset = 5;
      dbQueryMock.mockResolvedValueOnce([]);

      await sut.findMany({
        limit,
        offset,
        params,
        likeParams,
        orderByAsc: true,
      });

      const where = `${params[0].key} = $1 AND ${params[1].key} = $2 AND ${likeParams[0].key} ILIKE $3`;
      const expectedSql = `
      SELECT ${publicFields.join(",")}
      FROM ${tableName}
      WHERE ${where}
      ORDER BY ${idField} ASC
      LIMIT $4
      OFFSET $5;
    `;
      const expectedParams = [
        params[0].value,
        params[1].value,
        `%${likeParams[0].value}%`,
        limit,
        offset,
      ];

      expect(DbConnection.query).toHaveBeenCalledWith({
        sql: expectedSql,
        params: expectedParams,
      });
    })

    test("Should throw if connection query throws", async () => {
      const tableName = FakeData.word();
      const idField = FakeData.word();
      const publicFields = [FakeData.word()];
      const { sut } = makeSut(tableName, idField, publicFields, [], []);
      const error = new Error(FakeData.phrase());
      dbQueryMock.mockRejectedValueOnce(error);

      await expect(
        sut.findMany({ limit: 1, offset: 0, params: [{ key: FakeData.word(), value: FakeData.word() }] }),
      ).rejects.toThrow(error);
    })

    test("Should return what connection query returns", async () => {
      const tableName = FakeData.word();
      const idField = FakeData.word();
      const publicFields = [FakeData.word()];
      const { sut } = makeSut(tableName, idField, publicFields, [], []);
      const rows = [{ id: FakeData.uuid() }, { id: FakeData.uuid() }];
      dbQueryMock.mockResolvedValueOnce(rows);

      const result = await sut.findMany({ limit: 2, offset: 0 });

      expect(result).toBe(rows);
    })
  })

  describe("ExecuteSql", () => {
    test("Should call connection query with right values", async () => {
      const tableName = FakeData.word();
      const idField = FakeData.word();
      const { sut } = makeSut(tableName, idField, [], [], []);
      const query = FakeData.phrase();
      const params = [FakeData.uuid(), FakeData.word()];
      dbQueryMock.mockResolvedValueOnce([]);

      await sut.executeSql({ query, params });

      expect(DbConnection.query).toHaveBeenCalledWith({ sql: query, params });
    })

    test("Should throw if connection query throws", async () => {
      const tableName = FakeData.word();
      const idField = FakeData.word();
      const { sut } = makeSut(tableName, idField, [], [], []);
      const error = new Error(FakeData.phrase());
      dbQueryMock.mockRejectedValueOnce(error);

      await expect(
        sut.executeSql({ query: FakeData.phrase(), params: [FakeData.word()] }),
      ).rejects.toThrow(error);
    })

    test("Should return what connection query returns", async () => {
      const tableName = FakeData.word();
      const idField = FakeData.word();
      const { sut } = makeSut(tableName, idField, [], [], []);
      const rows = [{ id: FakeData.uuid() }];
      dbQueryMock.mockResolvedValueOnce(rows);

      const result = await sut.executeSql({ query: FakeData.phrase(), params: [] });

      expect(result).toBe(rows);
    })
  })
})
