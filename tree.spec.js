import { types, getParent, getSnapshot } from 'mobx-state-tree';

/*
Goal: design a graph that automatically normalizes into a JSON tree like this:

{
    users: {
        "a123": {
            id: "a123",
            name: "John Doe"
        }
    },
    messages: [{
        author: "a123",
        message: "test"
    }],
    selectedUser: "a123"
}
*/

const User = types
    .model({
        id: types.identifier(),
        name: 'John Doe'
    })
    .views(self => ({
        get messageCount() {
            // getRoot(self)
            return getParent(self, 2).messages.filter(msg => msg.author === self).length;
        }
    }));

const Message = types.model({
    author: types.reference(User),
    message: types.string
});

const Store = types
    .model({
        users: types.optional(types.map(User), {}),
        messages: types.optional(types.array(Message), []),
        selectedUser: types.optional(types.union(types.reference(User), types.literal(null)), null)
        // OR
        // selectedUser: types.maybe(types.reference(User))
    })
    .actions(self => ({
        addMessage: (author, message) => {
            self.messages.push({ author, message });
        }
    }));

test('Users have an identifier and name', () => {
    expect(User.is({})).toBe(false);
    expect(
        User.is({
            id: 'a123',
            name: 'John Doe'
        })
    ).toBe(true);
});

test('Messages refer to an author and have a message', () => {
    expect(
        Message.is({
            author: 'a123',
            message: 'test'
        })
    ).toBe(true);
    expect(Message.is({})).toBe(false);
});

test('Store has users, messages and a selected user', () => {
    expect(
        Store.is({
            users: {
                a123: {
                    id: 'a123',
                    name: 'John Doe'
                }
            },
            messages: [
                {
                    author: 'a123',
                    message: 'test'
                }
            ],
            selectedUser: null
        })
    ).toBe(true);
});

test('Store can be created from an empty snapshot', () => {
    expect(Store.is({})).toBe(true);
});

test('References and identifiers work', () => {
    const store = Store.create({
        users: {
            a123: {
                id: 'a123',
                name: 'John Doe'
            }
        },
        messages: [
            {
                author: 'a123',
                message: 'test'
            }
        ],
        selectedUser: 'a123'
    });

    // Tip: use types.identifier() and types.reference instead of strings
    // to have MST take care of data (de)normalization
    expect(store.users.get('a123').name).toBe('John Doe');
    expect(store.messages[0].message).toBe('test');

    expect(store.messages[0].author.name).toBe('John Doe');
    expect(store.selectedUser).toBe(store.users.get('a123'));
    expect(store.selectedUser.name).toBe('John Doe');
    expect(store.messages[0].author).toBe(store.users.get('a123'));
});

test('There is an action to add messages', () => {
    const store = Store.create({
        users: {
            a123: {
                id: 'a123',
                name: 'John Doe'
            }
        },
        messages: [
            {
                author: 'a123',
                message: 'test'
            }
        ],
        selectedUser: 'a123'
    });

    store.addMessage(store.users.get('a123'), 'booyah');
    expect(store.messages.length).toBe(2);
    expect(store.messages[1].message).toBe('booyah');
    expect(store.messages[1].author.name).toBe('John Doe');
    // The snapshot is still denormalized
    expect(getSnapshot(store)).toEqual({
        users: {
            a123: {
                id: 'a123',
                name: 'John Doe'
            }
        },
        messages: [
            {
                author: 'a123',
                message: 'test'
            },
            {
                author: 'a123',
                message: 'booyah'
            }
        ],
        selectedUser: 'a123'
    });
});

test('Users have a derived view returning the amount of messages', () => {
    const store = Store.create({
        users: {
            a123: {
                id: 'a123',
                name: 'John Doe'
            },
            b17: {
                id: 'b17',
                name: 'Elle'
            }
        },
        messages: [
            {
                author: 'a123',
                message: 'test'
            }
        ],
        selectedUser: 'a123'
    });

    // Tip: use `getParent(self)` in a model to walk to the parent of an object
    expect(store.users.get('a123').messageCount).toBe(1);
    expect(store.users.get('b17').messageCount).toBe(0);
});
