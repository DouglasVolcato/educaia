import * as faker from '@faker-js/faker';
export const FakeData = {
    email: () => faker.faker.internet.email(),
    password: () => faker.faker.internet.password(),
    word: (length = 10) => faker.faker.string.alphanumeric({ length }),
    uuid: () => faker.faker.string.uuid(),
    numberInteger: () => faker.faker.number.int(),
    phrase: () => faker.faker.lorem.words(),
    url: () => faker.faker.internet.url(),
    bool: () => faker.faker.datatype.boolean(),
    date: () => faker.faker.date.anytime().toDateString(),
};
