/** Model Incident (data-model.md). */
import { DataTypes, Model, type Sequelize } from "sequelize";

export class IncidentModel extends Model {
  declare id: number;
  declare serviceId: number;
  declare title: string;
  declare severity: "low" | "medium" | "high" | "critical";
  declare status: "open" | "resolved";
  declare resolvedAt: Date | null;
  declare createdAt: Date;
}

export function initIncidentModel(sequelize: Sequelize): typeof IncidentModel {
  IncidentModel.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      serviceId: { type: DataTypes.INTEGER, allowNull: false },
      title: { type: DataTypes.STRING(200), allowNull: false },
      severity: {
        type: DataTypes.ENUM("low", "medium", "high", "critical"),
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM("open", "resolved"),
        allowNull: false,
        defaultValue: "open",
      },
      resolvedAt: { type: DataTypes.DATE, allowNull: true },
    },
    { sequelize, tableName: "incidents", timestamps: true, updatedAt: false },
  );
  return IncidentModel;
}
