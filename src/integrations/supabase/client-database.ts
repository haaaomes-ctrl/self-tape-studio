import type { Database } from "./types";

type PublicSchema = Database["public"];

type SupabaseTableCompat<T> = T extends { Insert: unknown; Update: unknown }
  ? T
  : T & { Insert: never; Update: never };

export type SupabaseClientDatabase = Omit<Database, "public"> & {
  public: Omit<PublicSchema, "Tables"> & {
    Tables: {
      [TableName in keyof PublicSchema["Tables"]]: SupabaseTableCompat<
        PublicSchema["Tables"][TableName]
      >;
    };
  };
};
