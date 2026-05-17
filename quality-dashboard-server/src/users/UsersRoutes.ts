import { FastifyInstance, RequestGenericInterface } from "fastify";
import { Auth } from "./Auth";
import { User } from "./model/User";
import { UsersData } from "./UsersData";
import { UserPassword } from "./UserPassword";
import { OTelLogger, OTelRequestSpan } from "../OTelContext";

const logger = OTelLogger().createModuleLogger("UsersRoutes");

export class UsersRoutes {
  //

  public async getRoutes(fastify: FastifyInstance): Promise<void> {
    //
    fastify.get("/status/initialization", async (req, res) => {
      const context = OTelRequestSpan(req);
      if ((await UsersData.list(context)).length === 0) {
        res.status(201).send({ initialized: false });
      } else {
        res.status(201).send({ initialized: true });
      }
    });

    // ==================== SESSION (Login) ====================

    interface PostSession extends RequestGenericInterface {
      Body: {
        name: string;
        password: string;
      };
    }
    fastify.post<PostSession>("/session", async (req, res) => {
      const context = OTelRequestSpan(req);
      let user: User;
      // From token
      const userSession = await Auth.getUserSession(req);
      if (userSession.isAuthenticated) {
        user = await UsersData.get(context, userSession.userId);
        if (!user) {
          return res.status(403).send({ error: "Authentication Failed" });
        }
        return res.status(201).send({
          success: true,
          token: await Auth.generateJWT(user),
          user: user.toTransportJson(),
        });
      }

      // From User/Pass
      if (!req.body.name) {
        return res.status(400).send({ error: "Missing: Name" });
      }
      if (!req.body.password) {
        return res.status(400).send({ error: "Missing: Password" });
      }
      user = await UsersData.getByName(context, req.body.name);
      if (!user) {
        return res.status(403).send({ error: "Authentication Failed" });
      } else if (
        await UserPassword.checkPassword(context, user, req.body.password)
      ) {
        return res.status(201).send({
          success: true,
          token: await Auth.generateJWT(user),
          user: user.toTransportJson(),
        });
      } else {
        return res.status(403).send({ error: "Authentication Failed" });
      }
    });

    // ==================== LIST USERS (Admin only) ====================

    fastify.get("/", async (req, res) => {
      logger.info(`[${req.method}] ${req.url}`);
      const context = OTelRequestSpan(req);
      try {
        await Auth.mustBeAdmin(req, res);
      } catch {
        return;
      }
      const users = await UsersData.list(context);
      return res.status(200).send(users.map((u) => u.toTransportJson()));
    });

    // ==================== CREATE USER ====================

    interface PostUser extends RequestGenericInterface {
      Body: {
        name: string;
        password: string;
        role?: string;
        permissions?: {
          canConfigureDashboards?: boolean;
          canConfigureReportTags?: boolean;
        };
      };
    }
    fastify.post<PostUser>("/", async (req, res) => {
      const context = OTelRequestSpan(req);
      let isInitialized = true;
      if ((await UsersData.list(context)).length === 0) {
        isInitialized = false;
      }

      // If initialized, only admin can create users
      if (isInitialized) {
        try {
          await Auth.mustBeAdmin(req, res);
        } catch {
          return;
        }
      }

      if (!req.body.name) {
        return res.status(400).send({ error: "Missing: Name" });
      }
      if (!req.body.password) {
        return res.status(400).send({ error: "Missing: Password" });
      }
      if (await UsersData.getByName(context, req.body.name)) {
        return res.status(400).send({ error: "Username Already Exists" });
      }

      const newUser = new User();
      newUser.name = req.body.name;
      // First user is always admin
      if (isInitialized) {
        newUser.role = req.body.role === "admin" ? "admin" : "user";
        if (req.body.permissions) {
          newUser.permissions = {
            canConfigureDashboards:
              req.body.permissions.canConfigureDashboards === true,
            canConfigureReportTags:
              req.body.permissions.canConfigureReportTags === true,
          };
        }
      } else {
        newUser.role = "admin";
      }
      await UserPassword.setPassword(context, newUser, req.body.password);
      await UsersData.add(context, newUser);
      res.status(201).send({ user: newUser.toTransportJson() });
    });

    // ==================== ADMIN: CHANGE OWN PASSWORD ====================

    interface PutOwnPassword extends RequestGenericInterface {
      Body: {
        password: string;
        passwordOld: string;
      };
    }
    fastify.put<PutOwnPassword>("/password", async (req, res) => {
      const context = OTelRequestSpan(req);
      const userSession = await Auth.getUserSession(req);
      if (!userSession.isAuthenticated) {
        return res.status(403).send({ error: "Access Denied" });
      }
      const user = await UsersData.get(context, userSession.userId);
      if (!req.body.password) {
        return res.status(400).send({ error: "Missing: Password" });
      }
      if (
        !(await UserPassword.checkPassword(context, user, req.body.passwordOld))
      ) {
        return res.status(403).send({ error: "Old Password Wrong" });
      }
      await UserPassword.setPassword(context, user, req.body.password);
      await UsersData.updatePassword(context, user);
      res.status(201).send({});
    });

    // ==================== ADMIN: UPDATE USER (role, permissions, password) ====================

    interface PutUser extends RequestGenericInterface {
      Params: {
        id: string;
      };
      Body: {
        role?: string;
        permissions?: {
          canConfigureDashboards?: boolean;
          canConfigureReportTags?: boolean;
        };
        password?: string;
      };
    }
    fastify.put<PutUser>("/:id", async (req, res) => {
      logger.info(`[${req.method}] /api/users/:id`);
      const context = OTelRequestSpan(req);
      try {
        await Auth.mustBeAdmin(req, res);
      } catch {
        return;
      }

      const user = await UsersData.get(context, req.params.id);
      if (!user) {
        return res.status(404).send({ error: "User Not Found" });
      }

      if (req.body.role) {
        user.role = req.body.role === "admin" ? "admin" : "user";
      }
      if (req.body.permissions) {
        user.permissions = {
          canConfigureDashboards:
            req.body.permissions.canConfigureDashboards === true,
          canConfigureReportTags:
            req.body.permissions.canConfigureReportTags === true,
        };
      }

      await UsersData.updateUser(context, user);

      // If password change requested
      if (req.body.password) {
        await UserPassword.setPassword(context, user, req.body.password);
        await UsersData.updatePassword(context, user);
      }

      res.status(201).send({ user: user.toTransportJson() });
    });

    // ==================== ADMIN: DELETE USER ====================

    interface DeleteUser extends RequestGenericInterface {
      Params: {
        id: string;
      };
    }
    fastify.delete<DeleteUser>("/:id", async (req, res) => {
      logger.info(`[${req.method}] /api/users/:id`);
      const context = OTelRequestSpan(req);
      try {
        await Auth.mustBeAdmin(req, res);
      } catch {
        return;
      }

      const userSession = await Auth.getUserSession(req);

      // Cannot delete yourself
      if (userSession.userId === req.params.id) {
        return res.status(400).send({ error: "Cannot Delete Yourself" });
      }

      const user = await UsersData.get(context, req.params.id);
      if (!user) {
        return res.status(404).send({ error: "User Not Found" });
      }

      // Check that at least 1 admin remains
      if (user.role === "admin") {
        const admins = (await UsersData.list(context)).filter(
          (u) => u.role === "admin",
        );
        if (admins.length <= 1) {
          return res
            .status(400)
            .send({ error: "At least 1 admin must be defined" });
        }
      }

      await UsersData.delete(context, req.params.id);
      res.status(201).send({});
    });
  }
}
