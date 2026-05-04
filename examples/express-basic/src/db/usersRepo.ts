type User = {
  id: number;
  email: string;
  name?: string;
};

const users: User[] = [{ id: 1, email: "ada@example.com", name: "Ada" }];

export const usersRepo = {
  findAll(limit?: number): User[] {
    if (!limit || Number.isNaN(limit)) {
      return users;
    }

    return users.slice(0, limit);
  },

  findById(id: number): User | undefined {
    return users.find((user) => user.id === id);
  },

  create(input: { email: string; name?: string }): User {
    const user = {
      id: users.length + 1,
      email: input.email,
      name: input.name,
    };

    users.push(user);
    return user;
  },
};
