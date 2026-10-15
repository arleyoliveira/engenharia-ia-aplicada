/** Adaptador Sequelize → StoreRepos (fronteira de IO de banco). */
import { Op, type Sequelize } from "sequelize";
import type {
  AlertStatus,
  Severity,
  StoreRepos,
} from "../services/alert-store.js";
import { getSequelize } from "./database.js";
import { initAlertModel } from "./alert.js";
import { initIncidentModel } from "./incident.js";
import { initServiceModel } from "./service.js";

let initialized = false;

/** Registra os models e as associações na conexão ativa. */
export function initModels(sequelize: Sequelize = getSequelize()): Sequelize {
  if (!initialized) {
    const Service = initServiceModel(sequelize);
    const Alert = initAlertModel(sequelize);
    const Incident = initIncidentModel(sequelize);
    Service.hasMany(Alert, { foreignKey: "serviceId" });
    Service.hasMany(Incident, { foreignKey: "serviceId" });
    Alert.belongsTo(Service, { foreignKey: "serviceId" });
    Incident.belongsTo(Service, { foreignKey: "serviceId" });
    initialized = true;
  }
  return sequelize;
}

export function createSequelizeRepos(): StoreRepos {
  const sequelize = initModels();
  const Service = sequelize.models.ServiceModel as typeof import("./service.js").ServiceModel;
  const Alert = sequelize.models.AlertModel as typeof import("./alert.js").AlertModel;
  const Incident = sequelize.models.IncidentModel as typeof import("./incident.js").IncidentModel;

  return {
    services: {
      async findByName(name) {
        const row = await Service.findOne({ where: { name } });
        return row ? { id: row.id, name: row.name } : null;
      },
      async create(name) {
        const row = await Service.create({ name });
        return { id: row.id, name: row.name };
      },
    },
    alerts: {
      async findByTitle(title) {
        const row = await Alert.findOne({ where: { title } });
        return row
          ? {
              id: row.id,
              serviceId: row.serviceId,
              title: row.title,
              status: row.status,
            }
          : null;
      },
      async create(input) {
        const row = await Alert.create({ ...input });
        return {
          id: row.id,
          serviceId: row.serviceId,
          title: row.title,
          status: row.status,
        };
      },
      async list(status?: AlertStatus) {
        const rows = await Alert.findAll({
          where: status ? { status: { [Op.eq]: status } } : undefined,
          order: [["id", "ASC"]],
        });
        return rows.map((row) => ({
          id: row.id,
          serviceId: row.serviceId,
          title: row.title,
          status: row.status,
        }));
      },
    },
    incidents: {
      async create(input: {
        serviceId: number;
        title: string;
        severity: Severity;
      }) {
        const row = await Incident.create({ ...input, status: "open" });
        return toRecord(row);
      },
      async findById(id) {
        const row = await Incident.findByPk(id);
        return row ? toRecord(row) : null;
      },
      async markResolved(id, resolvedAt) {
        await Incident.update(
          { status: "resolved", resolvedAt },
          { where: { id } },
        );
        const row = await Incident.findByPk(id);
        if (!row) {
          throw new Error(`Incidente ${id} desapareceu após update.`);
        }
        return toRecord(row);
      },
    },
    async serviceName(serviceId) {
      const row = await Service.findByPk(serviceId);
      return row?.name ?? `#${serviceId}`;
    },
  };
}

function toRecord(row: import("./incident.js").IncidentModel) {
  return {
    id: row.id,
    serviceId: row.serviceId,
    title: row.title,
    severity: row.severity,
    status: row.status,
    resolvedAt: row.resolvedAt,
  };
}
