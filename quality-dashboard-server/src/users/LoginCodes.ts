import {
  LoginCodesOptionsFromConfig,
  createLoginCodesStoreCommonUtils,
  type LoginCodesEvent,
  type LoginCodesRoutesOptions,
  type LoginCodesSettings,
  type LoginCodesStore,
} from "@devopsplaybook.io/common-utils";
import { Config } from "../Config";
import { OTelLogger } from "../OTelContext";
import { Auth } from "./Auth";
import { UsersData } from "./UsersData";
import { UserPassword } from "./UserPassword";

const logger = OTelLogger().createModuleLogger("LoginCodes");

/**
 * Resolve the login-code settings from the application config. `ConfigBase`
 * already declares and registers every `LOGIN_CODE_*` field, so the library
 * reader applies the same defaults and clamps as the shared auth stack.
 */
export function LoginCodesBuildSettings(config: Config): LoginCodesSettings {
  return LoginCodesOptionsFromConfig(config);
}

/**
 * Structured audit log for the login-code flow. Only allow-listed fields are
 * written: an event never carries a code, request token, hash or header, so
 * this sink cannot leak a secret into the logs.
 */
export function LoginCodesLogEvent(event: LoginCodesEvent): void {
  logger.info(
    "[LoginCodes] " +
      JSON.stringify({
        type: event.type,
        requestId: event.requestId,
        userId: event.userId,
        userName: event.userName,
        deviceLabel: event.deviceLabel,
        reason: event.reason,
        ip: event.ip,
      }),
  );
}

/**
 * Build the `LoginCodesRoutes` options for quality-dashboard: the DB-backed
 * store, an approver resolved from this app's own JWT session, a session
 * issuer matching `POST /api/users/session`, the app's bcrypt password check
 * and the structured event log.
 */
export function LoginCodesBuildRoutesOptions(
  config: Config,
  store: LoginCodesStore = createLoginCodesStoreCommonUtils(),
): LoginCodesRoutesOptions {
  return {
    ...LoginCodesBuildSettings(config),
    store,
    // Evaluated lazily at the first request: Auth.init() has populated the
    // key by then. An empty key makes the feature answer 503, never crash.
    hashKey: () => config.JWT_KEY,
    getApprovingUser: async (req) => {
      const session = await Auth.getUserSession(req);
      if (!session.isAuthenticated) {
        // quality-dashboard has no API-token session: X-Upload-Token is only
        // accepted by the report ingest routes and is never a bearer session,
        // so any non-interactive credential resolves to null (401).
        return null;
      }
      return { id: session.userId, name: session.userName };
    },
    getUserById: async (id) => {
      const user = await UsersData.get(undefined, id);
      return user ? { id: user.id, name: user.name } : null;
    },
    issueSession: async (approver) => {
      // Re-read the user live: the approver may have been deleted since the
      // approval. A missing user aborts the redemption (fails closed).
      const user = await UsersData.get(undefined, approver.id);
      if (!user) {
        throw new Error("Login code approver no longer exists");
      }
      return {
        token: await Auth.generateJWT(user),
        user: user.toTransportJson(),
      };
    },
    verifyPassword: async (approver, password) => {
      const user = await UsersData.get(undefined, approver.id);
      return user ? UserPassword.checkPassword(undefined, user, password) : false;
    },
    onEvent: LoginCodesLogEvent,
  };
}
