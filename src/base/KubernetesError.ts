export class KubernetesError {
  static Generic = class Generic extends Error {
    public details: unknown;

    public code: number;

    public retryAfter: number | null;

    constructor(obj: Record<string, unknown>, retryAfterRaw: string | undefined) {
      let message = "";

      if ("message" in obj) {
        if (typeof obj.message === "string") {
          ({ message } = obj);
        }
      }

      super(message);
      this.details = obj.details ?? null;

      this.code = 0;
      if (typeof obj.code === "number") {
        this.code = obj.code;
      }

      this.retryAfter = null;
      if (retryAfterRaw) {
        const retryAfterInt = parseInt(retryAfterRaw, 10);

        if (retryAfterInt.toString() === retryAfterRaw.trim()) {
          this.retryAfter = retryAfterInt * 1000;
        }

        const retryAfterDate = new Date(retryAfterRaw);

        if (!isNaN(retryAfterDate.getTime())) {
          this.retryAfter = Math.max(0, retryAfterDate.getTime() - new Date().getTime());
        }
      }
    }
  };

  static BadRequest = class BadRequest extends KubernetesError.Generic {};

  static Unauthorized = class Unauthorized extends KubernetesError.Generic {};

  static Forbidden = class Forbidden extends KubernetesError.Generic {};

  static NotFound = class NotFound extends KubernetesError.Generic {};

  static MethodNotAllowed = class MethodNotAllowed extends KubernetesError.Generic {};

  static Conflict = class Conflict extends KubernetesError.Generic {};

  static Gone = class Gone extends KubernetesError.Generic {};

  static UnprocessableEntity = class UnprocessableEntity extends KubernetesError.Generic {};

  static TooManyRequests = class TooManyRequests extends KubernetesError.Generic {};

  static InternalServerError = class InternalServerError extends KubernetesError.Generic {};

  static ServiceUnavailable = class ServiceUnavailable extends KubernetesError.Generic {};

  static ServerTimeout = class ServerTimeout extends KubernetesError.Generic {};

  static NonZeroExitCode = class NonZeroExitCode extends KubernetesError.Generic {};

  static fromStatus(data: Record<string, unknown>, retryAfterRaw?: string) {
    switch (data.code) {
      case 400:
        return new KubernetesError.BadRequest(data, retryAfterRaw);
      case 401:
        return new KubernetesError.Unauthorized(data, retryAfterRaw);
      case 403:
        return new KubernetesError.Forbidden(data, retryAfterRaw);
      case 404:
        return new KubernetesError.NotFound(data, retryAfterRaw);
      case 405:
        return new KubernetesError.MethodNotAllowed(data, retryAfterRaw);
      case 409:
        return new KubernetesError.Conflict(data, retryAfterRaw);
      case 410:
        return new KubernetesError.Gone(data, retryAfterRaw);
      case 422:
        return new KubernetesError.UnprocessableEntity(data, retryAfterRaw);
      case 429:
        return new KubernetesError.TooManyRequests(data, retryAfterRaw);
      case 500:
        return new KubernetesError.InternalServerError(data, retryAfterRaw);
      case 503:
        return new KubernetesError.ServiceUnavailable(data, retryAfterRaw);
      case 504:
        return new KubernetesError.ServerTimeout(data, retryAfterRaw);
      default:
        switch (data.reason) {
          case "NonZeroExitCode":
            return new KubernetesError.NonZeroExitCode(data, retryAfterRaw);
          default:
            console.error("Unhandled error code", data);
            return new KubernetesError.Generic(data, retryAfterRaw);
        }
    }
  }
}
