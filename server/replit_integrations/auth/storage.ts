import db from "../../db.ts";

export interface User {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  profile_image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpsertUser {
  id: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  profileImageUrl?: string | null;
}

export interface IAuthStorage {
  getUser(id: string): User | undefined;
  upsertUser(user: UpsertUser): User;
}

class AuthStorage implements IAuthStorage {
  getUser(id: string): User | undefined {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
  }

  upsertUser(userData: UpsertUser): User {
    const existing = this.getUser(userData.id);
    if (existing) {
      db.prepare(
        'UPDATE users SET email = ?, first_name = ?, last_name = ?, profile_image_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      ).run(
        userData.email ?? existing.email,
        userData.firstName ?? existing.first_name,
        userData.lastName ?? existing.last_name,
        userData.profileImageUrl ?? existing.profile_image_url,
        userData.id
      );
    } else {
      db.prepare(
        'INSERT INTO users (id, email, first_name, last_name, profile_image_url) VALUES (?, ?, ?, ?, ?)'
      ).run(userData.id, userData.email ?? null, userData.firstName ?? null, userData.lastName ?? null, userData.profileImageUrl ?? null);
    }
    return this.getUser(userData.id)!;
  }
}

export const authStorage = new AuthStorage();
