/** Conexão Sequelize via DATABASE_URL (ConfigError quando ausente). */
import { Sequelize } from "sequelize";
import { ConfigError } from "../errors.js";

let instance: Sequelize | null = null;

export function getSequelize(): Sequelize {
  if (instance) {
    return instance;
  }
  const url = process.env.DATABASE_URL;
  if (!url || url.trim() === "") {
    throw new ConfigError(
      "DATABASE_URL ausente. Defina no ambiente ou em .env (ex.: mysql://user:pass@localhost:3306/ops_pilot).",
    );
  }
  instance = new Sequelize(url, { logging: false });
  return instance;
}

/** Fecha a conexão (uso em scripts CLI). */
export async function closeSequelize(): Promise<void> {
  if (instance) {
    await instance.close();
    instance = null;
  }
}
