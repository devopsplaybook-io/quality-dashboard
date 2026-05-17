import * as jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { User } from "./model/User";
import { UserSession } from "./model/UserSession";
import { Config } from "../Config";
import { Span } from "@opentelemetry/sdk-trace-base";
import { OTelLogger, OTelTracer } from "../OTelContext";
import {
  SqlDbUtilsExecSQL,
  SqlDbUtilsQuerySQL,
} from "../utils-std-ts/SqlDbUtils";

const logger = OTelLogger().createModuleLogger("Auth");
let config: Config;

export class Auth {
  //
  public static async init(context: Span, configIn: Config) {
    config = configIn;
    const span = OTelTracer().startSpan("Auth_init", context);
    const authKeyRaw = SqlDbUtilsQuerySQL(
      span,
      "SELECT * FROM metadata WHERE type='auth_token'",
    );
    if (authKeyRaw.length == 0) {
      configIn.JWT_KEY = uuidv4();
      SqlDbUtilsExecSQL(
        span,
        "INSERT INTO metadata (type, value, dateCreated) VALUES ('auth_token', ?, ?)",
        [configIn.JWT_KEY, new Date().toISOString()] as never[],
      );
    } else {
      configIn.JWT_KEY = authKeyRaw[0].value;
    }
    span.end();
  }

  public static async generateJWT(user: User): Promise<string> {
    return jwt.sign(
      {
        exp: Math.floor(Date.now() / 1000) + config.JWT_VALIDITY_DURATION,
        userId: user.id,
        userName: user.name,
        role: user.role,
        permissions: user.permissions,
      },
      config.JWT_KEY,
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public static async mustBeAuthenticated(req: any, res: any): Promise<void> {
    let authenticated = false;
    if (req.headers.authorization) {
      try {
        jwt.verify(req.headers.authorization.split(" ")[1], config.JWT_KEY);
        authenticated = true;
      } catch (err) {
        authenticated = false;
      }
    }
    if (!authenticated) {
      res.status(403).send({ error: "Access Denied" });
      throw new Error("Access Denied");
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public static async mustBeAdmin(req: any, res: any): Promise<void> {
    if (req.headers.authorization) {
      try {
        const info = jwt.verify(
          req.headers.authorization.split(" ")[1],
          config.JWT_KEY,
        );
        if (info.role === "admin") {
          return;
        }
      } catch (err) {
        // fall through
      }
    }
    res.status(403).send({ error: "Access Denied" });
    throw new Error("Access Denied");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public static async getUserSession(req: any): Promise<UserSession> {
    const userSession: UserSession = { isAuthenticated: false };
    if (req.headers.authorization) {
      try {
        const info = jwt.verify(
          req.headers.authorization.split(" ")[1],
          config.JWT_KEY,
        );
        userSession.userId = info.userId;
        userSession.userName = info.userName;
        userSession.role = info.role;
        userSession.permissions = info.permissions;
        userSession.isAuthenticated = true;
      } catch (err) {
        logger.error(err);
      }
    }
    return userSession;
  }
}
