import * as faker from '@faker-js/faker';

export const FakeData = {
    email: (): string => faker.faker.internet.email(),
    password: (): string => faker.faker.internet.password(),
    word: (length = 10): string => faker.faker.string.alphanumeric({ length }),
    uuid: (): string => faker.faker.string.uuid(),
    numberInteger: (): number => faker.faker.number.int(),
    phrase: (): string => faker.faker.lorem.words(),
    url: (): string => faker.faker.internet.url(),
    bool: (): boolean => faker.faker.datatype.boolean(),
    date: (): string => faker.faker.date.anytime().toDateString(),
};