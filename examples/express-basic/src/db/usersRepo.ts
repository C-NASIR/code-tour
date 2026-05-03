type User = {
  id: number;
  name: string;
};

const users: User[] = [{ id: 1, name: "Ada" }];

export const usersRepo = {
  list(): User[] {
    return users;
  },
  getById(id: number): User | undefined {
    return users.find((user) => user.id === id);
  },
  create(input: { name: string }): User {
    const user = {
      id: users.length + 1,
      name: input.name,
    };

    users.push(user);
    return user;
  },
};
