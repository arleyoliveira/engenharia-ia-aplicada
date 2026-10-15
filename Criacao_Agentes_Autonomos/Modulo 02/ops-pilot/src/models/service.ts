/** Model Service (data-model.md). */
import { DataTypes, Model, type Sequelize } from "sequelize";

export class ServiceModel extends Model {
  declare id: number;
  declare name: string;
}

export function initServiceModel(sequelize: Sequelize): typeof ServiceModel {
  ServiceModel.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      name: { type: DataTypes.STRING(120), allowNull: false, unique: true },
    },
    { sequelize, tableName: "services", timestamps: false },
  );
  return ServiceModel;
}
