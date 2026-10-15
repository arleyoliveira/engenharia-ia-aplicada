/** Model Alert (data-model.md). */
import { DataTypes, Model, type Sequelize } from "sequelize";

export class AlertModel extends Model {
  declare id: number;
  declare serviceId: number;
  declare title: string;
  declare status: "firing" | "resolved";
}

export function initAlertModel(sequelize: Sequelize): typeof AlertModel {
  AlertModel.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      serviceId: { type: DataTypes.INTEGER, allowNull: false },
      title: { type: DataTypes.STRING(200), allowNull: false },
      status: {
        type: DataTypes.ENUM("firing", "resolved"),
        allowNull: false,
      },
    },
    { sequelize, tableName: "alerts", timestamps: false },
  );
  return AlertModel;
}
