type User = {
  id: number;
  name: string;
};

const users: User[] = [{ id: 1, name: "Ada" }];

export const usersRepo = {
  list(): User[] {
    return users;
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
