import { usersRepo } from "../db/usersRepo";

export class UserService {
  static async listUsers() {
    return usersRepo.list();
  }

  static async getUserById(id: number) {
    return usersRepo.getById(id);
  }

  static async createUser(input: { name: string }) {
    return usersRepo.create(input);
  }
}
