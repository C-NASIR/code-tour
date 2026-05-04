import { usersRepo } from "../db/usersRepo";

export class UserService {
  static async listUsers(limit?: number) {
    return usersRepo.findAll(limit);
  }

  static async getUserById(id: number) {
    return usersRepo.findById(id);
  }

  static async createUser(input: { email: string; name?: string }) {
    return usersRepo.create(input);
  }
}
